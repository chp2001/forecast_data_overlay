import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import geopandas as gpd
from data_processing.dataset_utils import save_and_clip_dataset
from data_processing.datasets import load_aorc_zarr, load_v3_retrospective_zarr
from data_processing.file_paths import file_paths
from data_processing.forcings import create_forcings
from data_processing.graph_utils import get_upstream_cats, get_upstream_ids
from flask import Blueprint, jsonify, render_template, request

from forecasting_data.forecast_datasets import (
    reproject_points,
    reproject_points_2d,
)
from forecasting_data.forcing_datasets import (
    load_forecasted_forcing,
    rescale_precip_dataset,
    get_dataset_precip,
    get_conus_forcing_gridlines_horiz_projected,
    get_conus_forcing_gridlines_vert_projected,
    get_point_geometry,
    get_simple_point_geometry,
    load_forecasted_forcing_with_options,
    get_timestep_data_for_frontend,
    get_timesteps_data_for_frontend,
    load_forecasted_dataset_with_options,
    save_forecasted_dataset_with_options,
)

from time import perf_counter
from numpy import isclose, isnan

main = Blueprint("main", __name__)
intra_module_db = {}

logger = logging.getLogger(__name__)


@main.route("/")
def index():
    return render_template("index.html")


@main.route("/get_upstream_catids", methods=["POST"])
def get_upstream_catids():
    cat_id = json.loads(request.data.decode("utf-8"))
    # give wb_id to get_upstream_cats because the graph search is 1000x faster
    wb_id = "wb-" + cat_id.split("-")[-1]
    upstream_cats = get_upstream_cats(wb_id)
    if cat_id in upstream_cats:
        upstream_cats.remove(cat_id)
    return list(upstream_cats), 200


@main.route("/get_upstream_wbids", methods=["POST"])
def get_upstream_wbids():
    cat_id = json.loads(request.data.decode("utf-8"))
    upstream_ids = get_upstream_ids(cat_id)
    # remove the selected cat_id from the set
    return [id for id in upstream_ids if id.startswith("wb")], 200


@main.route("/forcings", methods=["POST"])
def get_forcings():
    # body: JSON.stringify({'forcing_dir': forcing_dir, 'start_time': start_time, 'end_time': end_time}),
    data = json.loads(request.data.decode("utf-8"))
    subset_gpkg = Path(data.get("forcing_dir").split("subset to ")[-1])
    output_folder = Path(subset_gpkg.parent.parent)
    paths = file_paths(output_dir=output_folder)

    start_time = data.get("start_time")
    end_time = data.get("end_time")

    # get the selected data source
    data_source = data.get("source")
    # get the forcings
    start_time = datetime.strptime(start_time, "%Y-%m-%dT%H:%M")
    end_time = datetime.strptime(end_time, "%Y-%m-%dT%H:%M")
    # logger.info(intra_module_db)
    app = intra_module_db["app"]
    debug_enabled = app.debug
    app.debug = False
    logger.debug(f"get_forcings() disabled debug mode at {datetime.now()}")
    logger.debug(f"forcing_dir: {output_folder}")
    try:
        if data_source == "aorc":
            data = load_aorc_zarr(start_time.year, end_time.year)
        elif data_source == "nwm":
            data = load_v3_retrospective_zarr()
        gdf = gpd.read_file(paths.geopackage_path, layer="divides")
        cached_data = save_and_clip_dataset(data, gdf, start_time, end_time, paths.cached_nc_file)

        create_forcings(cached_data, paths.output_dir.stem)  # type: ignore
    except Exception as e:
        logger.info(f"get_forcings() failed with error: {str(e)}")
        return jsonify({"error": str(e)}), 500
    app.debug = debug_enabled

    return "success", 200


@main.route("/get_catids_from_vpu", methods=["POST"])
def get_catids_from_vpu():
    raise NotImplementedError


@main.route("/logs", methods=["GET"])
def get_logs():
    log_file_path = "app.log"
    try:
        with open(log_file_path, "r") as file:
            lines = file.readlines()
            reversed_lines = []
            for line in reversed(lines):
                if "werkzeug" not in line:
                    reversed_lines.append(line)
                if len(reversed_lines) > 100:
                    break
            return jsonify({"logs": reversed_lines}), 200
    except Exception:
        return jsonify({"error": "unable to fetch logs"})


# @main.route("/get_forecast_precip", methods=["POST"])
# def get_forecast_precip():
def get_forecast_precip_0():
    """Get the forecast precipitation for the selected arguments."""
    t0 = perf_counter()
    # First, check for options sent in the request
    request_data = {}
    if request.data:
        request_data = json.loads(request.data.decode("utf-8"))
    logger.info(f"Received request data: {request_data}")
    # Also, try to enforce standardized keys on the intra_module_db and request_data
    selected_time = request_data.get("selected_time")  # str like YYYYMMDD
    forecast_cycle = request_data.get("forecast_cycle")  # int like 0, 6, 12, 18
    lead_time = request_data.get("lead_time")  # int like 0, 1, ..., 18, ..., 384
    scaleX = int(request_data.get("scaleX"))  # int like 1, 2, 4, ..., 64
    scaleY = int(request_data.get("scaleY"))  # int like 1, 2, 4, ..., 64
    rowMin = request_data.get("rowMin")  # int like 0, 16, 32, ..., 3840
    rowMax = request_data.get("rowMax")  # int like 0, 16, 32, ..., 3840
    colMin = request_data.get("colMin")  # int like 0, 16, 32, ..., 4608
    colMax = request_data.get("colMax")  # int like 0, 16, 32, ..., 4608
    lead_time_end = request_data.get("lead_time_end")  # int like 0, 1, ..., 18, ..., 384
    range_mode = request_data.get("range_mode")  # bool like True or False
    intable_args = {  # Reformat for use in `load_forecasted_forcing_with_options`
        "forecast_cycle": forecast_cycle,
        "lead_time": lead_time,
        "scaleX": scaleX,
        "scaleY": scaleY,
        "rowMin": rowMin,
        "rowMax": rowMax,
        "colMin": colMin,
        "colMax": colMax,
        "lead_time_end": lead_time_end,
    }
    t1 = perf_counter()  # After reading request data / intra_module_db
    if t1 - t0 > 1.0:
        print(f"Reading request data took {t1 - t0:.2f} seconds")
    violations = []
    # if not selected_time or not forecast_cycle or not lead_time:
    if any(v is None for v in [selected_time, forecast_cycle, lead_time]):
        # return jsonify({"error": "Forecast arguments not set"}), 400
        violation = "Forecast arguments not set (missing: "
        missing = [
            name
            for name, val in [
                ("selected_time", selected_time),
                ("forecast_cycle", forecast_cycle),
                ("lead_time", lead_time),
            ]
            # if not val
            if val is None
        ]
        violation += ", ".join(missing) + ")"
        # violation += "\n" + "Full request data: " + json.dumps(request_data, indent=2)
        violations.append(violation)
    if any(v is not None for v in [rowMin, rowMax, colMin, colMax]) and not all(
        v is not None for v in [rowMin, rowMax, colMin, colMax]
    ):
        violation = "Missing required fields for region bounds: "
        missing = [
            name
            for name, val in [
                ("rowMin", rowMin),
                ("rowMax", rowMax),
                ("colMin", colMin),
                ("colMax", colMax),
            ]
            if val is None
        ]
        violation += ", ".join(missing)
        violations.append(violation)
    elif all(v is not None for v in [rowMin, rowMax, colMin, colMax]):
        if rowMin >= rowMax:
            violations.append(f"rowMin ({rowMin}) must be less than rowMax ({rowMax})")
        if colMin >= colMax:
            violations.append(f"colMin ({colMin}) must be less than colMax ({colMax})")
    if violations:
        return jsonify({"error": " ; ".join(violations)}), 400
    t2 = perf_counter()  # After validation
    if t2 - t1 > 1.0:
        print(f"Validating request data took {t2 - t1:.2f} seconds")
    intable_args = {k: int(v) if v is not None else None for k, v in intable_args.items()}
    if range_mode is None:
        range_mode = False
    # Combine args for passing to data loading functions
    all_args = intable_args.copy()
    all_args.update(
        {
            "selected_time": selected_time,
            "range_mode": range_mode,
        }
    )
    if not range_mode:
        # No range of lead times, single timestep only
        data_dict = get_timestep_data_for_frontend(
            selected_time=selected_time,
            **intable_args,
        )
        t3 = perf_counter()  # After data loading
        t4 = perf_counter()  # After data processing (Both handled inside function)
        if t3 - t2 > 1.0:
            print(f"Loading forecasted forcing took {t3 - t2:.2f} seconds")
    elif lead_time_end is not None and lead_time_end > lead_time:
        targeted_lead_times = list(range(lead_time, lead_time_end + 1))
        timestep_values, geometries = get_timesteps_data_for_frontend(
            selected_time=selected_time,
            lead_times=targeted_lead_times,
            **intable_args,
        )
        data_dict = {
            "timestep_values": timestep_values,
            "geometries": geometries,
        }
        t3 = perf_counter()  # After data loading
        t4 = perf_counter()  # After data processing (Both handled inside function)
        if t3 - t2 > 1.0:
            print(f"Loading {len(targeted_lead_times)} timesteps took {t3 - t2:.2f} seconds")
    else:
        # ???? How does one even get here ?
        # Throw an error/warning to catch the attention of the user/developer
        logger.warning(f"Reached branch unexpectedly with args: {all_args}")
        raise Exception(f"Reached branch unexpectedly with args: {all_args}")
        return jsonify({"error": "Invalid lead_time_end for range mode"}), 400
    print(f"Processed data at {t4 - t0:.2f} seconds since start")
    # Save to intra_module_db for potential session resumption
    intra_module_db["forecasted_forcing_data_dict"] = data_dict
    intra_module_db["selected_time"] = selected_time
    intra_module_db["forecast_cycle"] = forecast_cycle
    intra_module_db["lead_time"] = lead_time
    intra_module_db["scaleX"] = scaleX
    intra_module_db["scaleY"] = scaleY
    intra_module_db["rowMin"] = rowMin
    intra_module_db["rowMax"] = rowMax
    intra_module_db["colMin"] = colMin
    intra_module_db["colMax"] = colMax
    intra_module_db["lead_time_end"] = lead_time_end
    intra_module_db["range_mode"] = range_mode
    t5 = perf_counter()  # After saving to intra_module_db
    if t5 - t4 > 1.0:
        print(f"Saving to intra_module_db took {t5 - t4:.2f} seconds")
    data_json = json.dumps(data_dict, default=str)
    t6 = perf_counter()  # After JSON conversion
    if t6 - t5 > 1.0:
        print(f"Converting to JSON took {t6 - t5:.2f} seconds")
    logger.info(
        (
            f"Forecasted precipitation data loaded successfully in {t6 - t0:.2f} seconds for {selected_time} ; {forecast_cycle} ; {lead_time} "
            f"(breakdown: read/validate {t2 - t0:.2f}s, load {t3 - t2:.2f}s, process {t4 - t3:.2f}s, save {t5 - t4:.2f}s, json {t6 - t5:.2f}s)"
        )
    )
    return jsonify(data_json), 200


@main.route("/get_forecasted_forcing_grid", methods=["GET"])
def get_forecasted_forcing_grid():
    """Get forecasting gridlines to display on the map."""
    start_command = perf_counter()
    # scaleX = intra_module_db.get("scaleX", 16)
    # scaleY = intra_module_db.get("scaleY", 16)
    scaleX = 16
    scaleY = 16
    horiz_gridlines = get_conus_forcing_gridlines_horiz_projected(scaleX, scaleY)
    vert_gridlines = get_conus_forcing_gridlines_vert_projected(scaleX, scaleY)
    intra_module_db["regionRowMin"] = 0
    intra_module_db["regionRowMax"] = (len(horiz_gridlines) - 1) * scaleY
    intra_module_db["regionColMin"] = 0
    intra_module_db["regionColMax"] = (len(vert_gridlines) - 1) * scaleX
    if horiz_gridlines is None or vert_gridlines is None:
        logger.error(
            f"Failed to load forecasting gridlines in {perf_counter() - start_command:.2f} seconds"
        )
        return jsonify({"error": "Failed to load forecasting gridlines"}), 500
    logger.info(
        f"Forecasting gridlines loaded successfully in {perf_counter() - start_command:.2f} seconds"
    )
    return (
        jsonify(
            {
                "horiz_gridlines": horiz_gridlines,
                "vert_gridlines": vert_gridlines,
                "scaleX": scaleX,
                "scaleY": scaleY,
            }
        ),
        200,
    )


@main.route("/tryget_resume_session", methods=["GET"])
def tryget_resume_session():
    """On load, the page checks if there is a session to resume. We send back any relevant data."""
    if "forecasted_forcing_data_dict" in intra_module_db:
        data_json = json.dumps(intra_module_db["forecasted_forcing_data_dict"], default=str)
        result_dict = {
            # "forecasted_forcing_data_dict": data_json,
            "selected_time": intra_module_db.get("selected_time"),
            "forecast_cycle": intra_module_db.get("forecast_cycle"),
            "lead_time": intra_module_db.get("lead_time"),
            "scaleX": intra_module_db.get("scaleX", 16),
            "scaleY": intra_module_db.get("scaleY", 16),
            "rowMin": intra_module_db.get("rowMin", 0),
            "rowMax": intra_module_db.get("rowMax", 0),
            "colMin": intra_module_db.get("colMin", 0),
            "colMax": intra_module_db.get("colMax", 0),
            "regionRowMin": intra_module_db.get("regionRowMin", 0),
            "regionRowMax": intra_module_db.get("regionRowMax", 3840),
            "regionColMin": intra_module_db.get("regionColMin", 0),
            "regionColMax": intra_module_db.get("regionColMax", 4608),
            "lead_time_end": intra_module_db.get("lead_time_end"),
            "range_mode": intra_module_db.get("range_mode", False),
        }
        logger.info("Resuming session with data: %s", result_dict)
        result_dict["forecasted_forcing_data_dict"] = data_json
        return jsonify(result_dict), 200
    else:
        return jsonify({"error": "No session data found"}), 404


from views_utils import get_endpoint_request_obj, parse_request_args, forecast_precip_args


@main.route("/test_request", methods=["POST"])
def test_request():
    """Test the request parsing utilities."""
    arg_defs = forecast_precip_args
    request_data = get_endpoint_request_obj()
    parsed_args = parse_request_args(request_data, arg_defs)
    return jsonify(parsed_args), 200


@main.route("/get_forecast_precip", methods=["POST"])
def get_forecast_precip():
    """Get the forecast precipitation for the selected arguments."""
    t0 = perf_counter()
    request_data = get_endpoint_request_obj()
    arg_defs = forecast_precip_args
    parsed_args = parse_request_args(request_data, arg_defs)
    selected_time: str = parsed_args["selected_time"]
    forecast_cycle: int = parsed_args["forecast_cycle"]
    lead_time: int = parsed_args["lead_time"]
    scaleX: int = parsed_args["scaleX"]
    scaleY: int = parsed_args["scaleY"]
    rowMin: Optional[int] = parsed_args["rowMin"]
    rowMax: Optional[int] = parsed_args["rowMax"]
    colMin: Optional[int] = parsed_args["colMin"]
    colMax: Optional[int] = parsed_args["colMax"]
    lead_time_end: Optional[int] = parsed_args["lead_time_end"]
    range_mode: bool = parsed_args["range_mode"]
    t1 = perf_counter()  # After reading request data / intra_module_db
    if t1 - t0 > 1.0:
        print(f"Reading and parsing request data took {t1 - t0:.2f} seconds")
    violations = []
    # Required arguments handled with parse_request_args
    # Here we only check for logical consistency on region bounds if provided
    region_bounds = [rowMin, rowMax, colMin, colMax]
    if any(v is not None for v in region_bounds) and not all(v is not None for v in region_bounds):
        violation = "Missing required fields for region bounds: "
        missing = [
            name
            for name, val in [
                ("rowMin", rowMin),
                ("rowMax", rowMax),
                ("colMin", colMin),
                ("colMax", colMax),
            ]
            if val is None
        ]
        violation += ", ".join(missing)
        violation += ". Either provide all four or none."
        violations.append(violation)
    elif all(v is not None for v in region_bounds):
        if rowMin >= rowMax:
            violations.append(f"rowMin ({rowMin}) must be less than rowMax ({rowMax})")
        if colMin >= colMax:
            violations.append(f"colMin ({colMin}) must be less than colMax ({colMax})")
    if violations:
        return jsonify({"error": " ; ".join(violations)}), 400
    t2 = perf_counter()  # After validation
    if t2 - t1 > 1.0:
        print(f"Validating request data took {t2 - t1:.2f} seconds")

    if not range_mode:
        # No range of lead times, single timestep only
        data_dict = get_timestep_data_for_frontend(
            **parsed_args,
        )
        t3 = perf_counter()  # After data loading
        if t3 - t2 > 1.0:
            print(f"Loading forecasted forcing took {t3 - t2:.2f} seconds")
    elif lead_time_end is not None and lead_time_end > lead_time:
        targeted_lead_times = list(range(lead_time, lead_time_end + 1))
        timestep_values, geometries = get_timesteps_data_for_frontend(
            lead_times=targeted_lead_times,
            **parsed_args,
        )
        data_dict = {
            "timestep_values": timestep_values,
            "geometries": geometries,
        }
        t3 = perf_counter()  # After data loading
        if t3 - t2 > 1.0:
            print(f"Loading {len(targeted_lead_times)} timesteps took {t3 - t2:.2f} seconds")
    else:
        # ???? How does one even get here ?
        # Throw an error/warning to catch the attention of the user/developer
        logger.warning(f"Reached branch unexpectedly with args: {parsed_args}")
        raise Exception(f"Reached branch unexpectedly with args: {parsed_args}")
    # Save to intra_module_db for potential session resumption
    intra_module_db["forecasted_forcing_data_dict"] = data_dict
    for key, value in parsed_args.items():
        intra_module_db[key] = value
    t4 = perf_counter()  # After saving to intra_module_db
    if t4 - t3 > 1.0:
        print(f"Saving to intra_module_db took {t4 - t3:.2f} seconds")
    data_json = json.dumps(data_dict, default=str)
    t5 = perf_counter()  # After JSON conversion
    if t5 - t4 > 1.0:
        print(f"Converting to JSON took {t5 - t4:.2f} seconds")
    logger.info(
        (
            f"Forecasted precipitation data loaded successfully in {t5 - t0:.2f} seconds for {selected_time} ; {forecast_cycle} ; {lead_time} "
            f"(breakdown: read/validate {t2 - t0:.2f}s, load {t3 - t2:.2f}s, save {t4 - t3:.2f}s, json {t5 - t4:.2f}s)"
        )
    )
    return jsonify(data_json), 200


@main.route("/download_forecast_precip", methods=["POST"])
def download_forecast_precip():
    """Run the same logic as get_forecast_precip, but save the data to files instead of returning processed data."""
    t0 = perf_counter()
    request_data = get_endpoint_request_obj()
    arg_defs = forecast_precip_args
    parsed_args = parse_request_args(request_data, arg_defs)
    selected_time: str = parsed_args["selected_time"]
    forecast_cycle: int = parsed_args["forecast_cycle"]
    lead_time: int = parsed_args["lead_time"]
    scaleX: int = parsed_args["scaleX"]
    scaleY: int = parsed_args["scaleY"]
    rowMin: Optional[int] = parsed_args["rowMin"]
    rowMax: Optional[int] = parsed_args["rowMax"]
    colMin: Optional[int] = parsed_args["colMin"]
    colMax: Optional[int] = parsed_args["colMax"]
    lead_time_end: Optional[int] = parsed_args["lead_time_end"]
    range_mode: bool = parsed_args["range_mode"]
    t1 = perf_counter()  # After reading request data / intra_module_db
    if t1 - t0 > 1.0:
        print(f"Reading and parsing request data took {t1 - t0:.2f} seconds")
    violations = []
    # Required arguments handled with parse_request_args
    # Here we only check for logical consistency on region bounds if provided
    region_bounds = [rowMin, rowMax, colMin, colMax]
    if any(v is not None for v in region_bounds) and not all(v is not None for v in region_bounds):
        violation = "Missing required fields for region bounds: "
        missing = [
            name
            for name, val in [
                ("rowMin", rowMin),
                ("rowMax", rowMax),
                ("colMin", colMin),
                ("colMax", colMax),
            ]
            if val is None
        ]
        violation += ", ".join(missing)
        violation += ". Either provide all four or none."
        violations.append(violation)
    elif all(v is not None for v in region_bounds):
        if rowMin >= rowMax:
            violations.append(f"rowMin ({rowMin}) must be less than rowMax ({rowMax})")
        if colMin >= colMax:
            violations.append(f"colMin ({colMin}) must be less than colMax ({colMax})")
    if violations:
        return jsonify({"error": " ; ".join(violations)}), 400
    t2 = perf_counter()  # After validation
    if t2 - t1 > 1.0:
        print(f"Validating request data took {t2 - t1:.2f} seconds")
    # For now, we'll download to the dist/downloads/ folder
    download_dir = Path("dist") / "downloads"
    download_dir.mkdir(parents=True, exist_ok=True)

    def make_file_name(
        selected_time: str,
        forecast_cycle: int,
        lead_time: int,
        scaleX: int,
        scaleY: int,
        rowMin: Optional[int],
        rowMax: Optional[int],
        colMin: Optional[int],
        colMax: Optional[int],
    ) -> str:
        output_name = f"forecast_precip_{selected_time}_fc{forecast_cycle:02d}_lt{lead_time:03d}_sx{scaleX}_sy{scaleY}"
        if any(v is not None for v in [rowMin, rowMax, colMin, colMax]):
            output_name += f"_r{rowMin}-{rowMax}_c{colMin}-{colMax}"
        return output_name

    if not range_mode:
        # # No range of lead times, single timestep only
        output_name = make_file_name(
            selected_time, forecast_cycle, lead_time, scaleX, scaleY, rowMin, rowMax, colMin, colMax
        )
        file_path = download_dir / f"{output_name}.nc"
        save_forecasted_dataset_with_options(
            file_path=file_path,
            date=selected_time,
            forecast_cycle=forecast_cycle,
            lead_time=lead_time,
            scaleX=scaleX,
            scaleY=scaleY,
            rowMin=rowMin,
            rowMax=rowMax,
            colMin=colMin,
            colMax=colMax,
        )
        t3 = perf_counter()  # After saving to file
        if t3 - t2 > 1.0:
            print(f"Saving dataset to file took {t3 - t2:.2f} seconds")
    elif lead_time_end is not None and lead_time_end > lead_time:
        targeted_lead_times = list(range(lead_time, lead_time_end + 1))
        save_times = []
        for lt in targeted_lead_times:
            output_name = make_file_name(
                selected_time, forecast_cycle, lt, scaleX, scaleY, rowMin, rowMax, colMin, colMax
            )
            file_path = download_dir / f"{output_name}.nc"
            save_forecasted_dataset_with_options(
                file_path=file_path,
                date=selected_time,
                forecast_cycle=forecast_cycle,
                lead_time=lt,
                scaleX=scaleX,
                scaleY=scaleY,
                rowMin=rowMin,
                rowMax=rowMax,
                colMin=colMin,
                colMax=colMax,
            )
            curr_time = perf_counter()
            if len(save_times) == 0:
                elapsed = curr_time - t2
            else:
                elapsed = curr_time - save_times[-1][1]
            if elapsed > 1.0:
                print(f"Saving lead time {lt} dataset to file took {elapsed:.2f} seconds")
            save_times.append((lt, curr_time))
        t3 = perf_counter()  # After saving to file
        if t3 - t2 > 1.0:
            print(f"Saving {len(targeted_lead_times)} datasets to files took {t3 - t2:.2f} seconds")
    else:
        # ???? How does one even get here ?
        # Throw an error/warning to catch the attention of the user/developer
        logger.warning(f"Reached branch unexpectedly with args: {parsed_args}")
        raise Exception(f"Reached branch unexpectedly with args: {parsed_args}")
    logger.info(
        (
            f"Forecasted precipitation data saved successfully in {t3 - t0:.2f} seconds for {selected_time} ; {forecast_cycle} ; {lead_time} "
            f"(breakdown: read/validate {t2 - t0:.2f}s, save {t3 - t2:.2f}s)"
        )
    )
    return jsonify({"message": "Files saved successfully"}), 200
