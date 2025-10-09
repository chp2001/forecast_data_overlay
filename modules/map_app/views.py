import json
import logging
from datetime import datetime
from pathlib import Path

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


# @main.route("/set_time", methods=["POST"])
# def set_time():
#     """Set the selected forecast time for the app."""
#     data = json.loads(request.data.decode("utf-8"))
#     missing = []
#     selected_time = data.get("target_time")
#     if not selected_time:
#         missing.append("target_time")
#     forecast_cycle = data.get("forecast_cycle")
#     if not forecast_cycle:
#         missing.append("forecast_cycle")
#     lead_time = data.get("lead_time")
#     if not lead_time:
#         missing.append("lead_time")
#     if missing:
#         return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
#     intra_module_db["selected_time"] = selected_time
#     intra_module_db["forecast_cycle"] = forecast_cycle
#     intra_module_db["lead_time"] = lead_time
#     logger.info(
#         f"Selected time set to {selected_time}, cycle {forecast_cycle}, lead time {lead_time}"
#     )
#     return jsonify({"message": "Forecast arguments set successfully"}), 200


# intra_module_db["scaleX"] = 16
# intra_module_db["scaleY"] = 16


# @main.route("/set_scales", methods=["POST"])
# def set_scales():
#     """Set the scales for the forecasted forcing dataset."""
#     data = json.loads(request.data.decode("utf-8"))
#     logger.info(f"Setting scales with data: {data}")
#     scaleX = data.get("scaleX")
#     scaleY = data.get("scaleY")
#     if scaleX is None or scaleY is None:
#         return jsonify({"error": "Missing required fields: scaleX, scaleY"}), 400
#     intra_module_db["scaleX"] = int(scaleX)
#     intra_module_db["scaleY"] = int(scaleY)
#     logger.info(f"Scales set to {scaleX} (X) and {scaleY} (Y)")
#     return jsonify({"message": "Scales set successfully"}), 200


# @main.route("/set_region_bounds", methods=["POST"])
# def set_region_bounds():
#     """Set the region bounds for the forecasted forcing dataset."""
#     data = json.loads(request.data.decode("utf-8"))
#     logger.info(f"Setting region bounds with data: {data}")
#     rowMin = data.get("rowMin")
#     rowMax = data.get("rowMax")
#     colMin = data.get("colMin")
#     colMax = data.get("colMax")
#     regionRowMin = intra_module_db.get("regionRowMin", 0)
#     regionRowMax = intra_module_db.get("regionRowMax", 0)
#     regionColMin = intra_module_db.get("regionColMin", 0)
#     regionColMax = intra_module_db.get("regionColMax", 0)
#     missing = []
#     if rowMin is None:
#         missing.append("rowMin")
#     if rowMax is None:
#         missing.append("rowMax")
#     if colMin is None:
#         missing.append("colMin")
#     if colMax is None:
#         missing.append("colMax")
#     if missing:
#         return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
#     intra_module_db["rowMin"] = int(rowMin)
#     intra_module_db["rowMax"] = int(rowMax)
#     intra_module_db["colMin"] = int(colMin)
#     intra_module_db["colMax"] = int(colMax)
#     intra_module_db["regionRowMin"] = regionRowMin
#     intra_module_db["regionRowMax"] = regionRowMax
#     intra_module_db["regionColMin"] = regionColMin
#     intra_module_db["regionColMax"] = regionColMax
#     logger.info(f"Region bounds set to rows {rowMin}-{rowMax} and cols {colMin}-{colMax}")
#     return jsonify({"message": "Region bounds set successfully"}), 200

@main.route("/get_forecast_precip", methods=["POST"])
def get_forecast_precip():
    """Get the forecast precipitation for the selected arguments."""
    t0 = perf_counter()
    # First, check for options sent in the request
    request_data = {}
    if request.data:
        request_data = json.loads(request.data.decode("utf-8"))
    # Also, try to enforce standardized keys on the intra_module_db and request_data
    selected_time = request_data.get("selected_time")
    forecast_cycle = request_data.get("forecast_cycle")
    lead_time = request_data.get("lead_time")
    scaleX = int(request_data.get("scaleX"))
    scaleY = int(request_data.get("scaleY"))
    rowMin = request_data.get("rowMin")
    rowMax = request_data.get("rowMax")
    colMin = request_data.get("colMin")
    colMax = request_data.get("colMax")
    intable_args = {  # Reformat for use in `load_forecasted_forcing_with_options`
        "fcst_cycle": forecast_cycle,
        "lead_time": lead_time,
        "scaleX": scaleX,
        "scaleY": scaleY,
        "rowMin": rowMin,
        "rowMax": rowMax,
        "colMin": colMin,
        "colMax": colMax,
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
        # return jsonify(
        #     {
        #         "error": f"Missing required fields for region bounds: "
        #         f"{', '.join([k for k, v in [('rowMin', rowMin), ('rowMax', rowMax), ('colMin', colMin), ('colMax', colMax)] if v is None])}"
        #     }
        # ), 400
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

    precip_data_array, transformer = load_forecasted_forcing_with_options(
        date=selected_time,
        **intable_args,
    )
    precip_data_array_np = precip_data_array.to_numpy()

    t3 = perf_counter()  # After data loading
    if t3 - t2 > 1.0:
        print(f"Loading forecasted forcing took {t3 - t2:.2f} seconds")
    print(f"Finished loading data at {t3 - t0:.2f} seconds since start")
    if precip_data_array is None:
        return jsonify({"error": "Failed to load forecasted precipitation data"}), 500
    data_dict = {
        "geometries": [],
        "values": [],
    }
    # At this stage, time axis is not eliminated, but is very likely to be length 1
    geoms = []
    values = []
    processed_data_points = 0
    for t in range(precip_data_array.shape[0]):
        for y in range(precip_data_array.shape[1]):
            for x in range(precip_data_array.shape[2]):
                if processed_data_points == 0:
                    processed_data_points += 1
                    print(
                        f"Processing first data point at {perf_counter() - t0:.2f} seconds since start"
                    )
                value = precip_data_array_np[t, y, x]
                if isnan(value) or isclose(value, 0.0, atol=1e-6):
                    continue
                x_coord = precip_data_array.x[x].item()
                y_coord = precip_data_array.y[y].item()
                # Get the geometry for the point
                geom = get_simple_point_geometry(
                    x_coord, y_coord, baseWidth=1000, scaleX=scaleX, scaleY=scaleY
                )
                if len(geoms) == 0:
                    print(
                        f"Adding first geometry at {perf_counter() - t0:.2f} seconds since start"
                    )
                geoms.append(geom)
                values.append(value)
    reprojected_geoms = reproject_points_2d(transformer, geoms)
    data_dict["geometries"] = reprojected_geoms
    data_dict["values"] = values
    t4 = perf_counter()  # After data processing
    if t4 - t3 > 1.0:
        print(f"Processing data took {t4 - t3:.2f} seconds")
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
    return jsonify(
        {
            "horiz_gridlines": horiz_gridlines,
            "vert_gridlines": vert_gridlines,
            "scaleX": scaleX,
            "scaleY": scaleY,
        }
    ), 200


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
        }
        logger.info("Resuming session with data: %s", result_dict)
        result_dict["forecasted_forcing_data_dict"] = data_json
        return jsonify(result_dict), 200
    else:
        return jsonify({"error": "No session data found"}), 404
