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
    load_forecasted_forcing,
    get_dataset_precip,
    get_forecasting_gridlines_horiz_projected,
    get_forecasting_gridlines_vert_projected,
    rescale_dataset,
    reproject_points,
    get_point_geometry,
    reproject_points_2d,
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


@main.route("/set_time", methods=["POST"])
def set_time():
    """Set the selected forecast time for the app."""
    data = json.loads(request.data.decode("utf-8"))
    missing = []
    selected_time = data.get("target_time")
    if not selected_time:
        missing.append("target_time")
    forecast_cycle = data.get("forecast_cycle")
    if not forecast_cycle:
        missing.append("forecast_cycle")
    lead_time = data.get("lead_time")
    if not lead_time:
        missing.append("lead_time")
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400
    intra_module_db["selected_time"] = selected_time
    intra_module_db["forecast_cycle"] = forecast_cycle
    intra_module_db["lead_time"] = lead_time
    logger.info(
        f"Selected time set to {selected_time}, cycle {forecast_cycle}, lead time {lead_time}"
    )
    return jsonify({"message": "Forecast arguments set successfully"}), 200

intra_module_db["scaleX"] = 16
intra_module_db["scaleY"] = 16
@main.route("/set_scales", methods=["POST"])
def set_scales():
    """Set the scales for the forecasted forcing dataset."""
    data = json.loads(request.data.decode("utf-8"))
    logger.info(f"Setting scales with data: {data}")
    scaleX = data.get("scaleX")
    scaleY = data.get("scaleY")
    if scaleX is None or scaleY is None:
        return jsonify({"error": "Missing required fields: scaleX, scaleY"}), 400
    intra_module_db["scaleX"] = int(scaleX)
    intra_module_db["scaleY"] = int(scaleY)
    logger.info(f"Scales set to {scaleX} (X) and {scaleY} (Y)")
    return jsonify({"message": "Scales set successfully"}), 200

import traceback


@main.route("/get_forecast_precip", methods=["GET"])
def get_forecast_precip():
    """Get the forecast precipitation for the selected arguments."""
    start_command = perf_counter()
    selected_time = intra_module_db.get("selected_time")
    forecast_cycle = intra_module_db.get("forecast_cycle")
    lead_time = intra_module_db.get("lead_time")
    scaleX = intra_module_db.get("scaleX", 16)
    scaleY = intra_module_db.get("scaleY", 16)

    if not selected_time or not forecast_cycle or not lead_time:
        return jsonify({"error": "Forecast arguments not set"}), 400

    forecast_cycle = int(forecast_cycle)
    lead_time = int(lead_time)

    try:
        print(
            f"Loading forecasted forcing for {selected_time} [{type(selected_time)}], "
            f"cycle {forecast_cycle} [{type(forecast_cycle)}], lead time {lead_time} [{type(lead_time)}]"
        )
        dataset = load_forecasted_forcing(
            date=selected_time, fcst_cycle=forecast_cycle, lead_time=lead_time
        )
        intra_module_db["forecasted_forcing_dataset"] = dataset
        
        rescaled_dataset = rescale_dataset(dataset, scaleX, scaleY)
        intra_module_db["rescaled_forecasted_forcing_dataset"] = rescaled_dataset
        # precip_data = dataset["RAINRATE"]
        data_dict = {}
        # # Dataset is a 3d array with dimensions (time, x, y)
        # # The requested data contains only the first time step
        # # Ideally we store the data in the dict with `"{x},{y}": value` pairs
        # print(f"Grabbing values from precip_data with shape {precip_data.shape}")
        # for x in range(precip_data.shape[1]):
        #     for y in range(precip_data.shape[2]):
        #         value = precip_data[0, x, y].values.item()  # Get the value as a float
        #         data_dict[f"{x},{y}"] = value
        # print(f"Data dict created with {len(data_dict)} entries. Converting to JSON.")

        # Accessing the data points individually is ridiculously slow,
        # so we will instead convert to numpy before accessing by using a relevant helper function
        before_access = perf_counter()
        # precip_data_np, x_coords, y_coords = get_dataset_precip(dataset)
        precip_data_np, x_coords, y_coords = get_dataset_precip(
            rescaled_dataset
        )  # Use the rescaled dataset
        # Precip data is now a 2D numpy array with shape (x, y)
        after_helper_access = perf_counter()
        print(f"Accessing precip data took {after_helper_access - before_access:.2f} seconds")
        
        # Lambda function for whether to skip a value
        # we want to skip values that are NaN or excessively close to zero
        skip_value = lambda v: isnan(v) or isclose(v, 0.0, atol=1e-6)
        
        # # Now we can iterate over the numpy array and create the data_dict
        # points = []
        # values = []
        # for y in range(precip_data_np.shape[0]):
        #     row = []
        #     rowvals = []
        #     for x in range(precip_data_np.shape[1]):
        #         value = precip_data_np[y, x]
        #         row.append((x_coords[x], y_coords[y]))  # (x, y) coordinates
        #         rowvals.append(value)
        #     points.append(row)
        #     values.append(rowvals)
        geoms = []
        values = []
        start_points_creation = perf_counter()
        last_printed_point = start_points_creation
        total_points = precip_data_np.shape[0] * precip_data_np.shape[1]
        points_created = 0
        print_interval = 10  # seconds
        for y in range(precip_data_np.shape[0]):
            for x in range(precip_data_np.shape[1]):
                if perf_counter() - last_printed_point > print_interval:
                    percent_complete = (points_created / total_points) * 100
                    print(
                        f"Point creation {percent_complete:.2f}% complete ({points_created}/{total_points})"
                    )
                    last_printed_point = perf_counter()
                points_created += 1
                value = precip_data_np[y, x]
                if skip_value(value):
                    continue
                # Get the geometry for the point
                geom = get_point_geometry(
                    x, y, scaleX=scaleX, scaleY=scaleY
                )
                geoms.append(geom)
                values.append(value)
        after_points_creation = perf_counter()
        print(f"Creating points took {after_points_creation - after_helper_access:.2f} seconds")
        # Reproject points to the desired projection
        # reprojected_points = reproject_points(dataset, points)
        # reprojected_points = [reproject_points(dataset, row) for row in points]
        # reprojected_geoms = [
        #     reproject_points(dataset, geom) for geom in geoms
        # ]
        # Reprojection seems excessively slow... Need to manually evaluate with for loop
        # reprojected_geoms = []
        # start_reprojection = perf_counter()
        # last_printed_geom = start_reprojection
        # total_geoms = len(geoms)
        # geoms_reprojected = 0
        # for geom in geoms:
        #     if perf_counter() - last_printed_geom > print_interval:
        #         percent_complete = (geoms_reprojected / total_geoms) * 100
        #         print(
        #             f"Reprojecting geometries {percent_complete:.2f}% complete ({geoms_reprojected}/{total_geoms})"
        #         )
        #         if geoms_reprojected > 1:
        #             # expected_time = (
        #             #     (after_reprojection - start_reprojection)
        #             #     / geoms_reprojected
        #             # ) * (total_geoms - geoms_reprojected)
        #             rate = (perf_counter() - start_reprojection) / geoms_reprojected
        #             expected_time = rate * (total_geoms - geoms_reprojected)
        #             print(
        #                 f"Expected time to complete reprojection: {expected_time:.2f} seconds"
        #             )
        #         last_printed_geom = perf_counter()
        #     geoms_reprojected += 1
        #     reprojected_geom = reproject_points(dataset, geom)
        #     reprojected_geoms.append(reprojected_geom)
        reprojected_geoms = reproject_points_2d(
            dataset, geoms
        )  # Reproject all geometries at once
        after_reprojection = perf_counter()
        print(f"Reprojecting points took {after_reprojection - after_points_creation:.2f} seconds")
        # Now we can create the data_dict with reprojected points and values
        # data_dict = {"points": reprojected_points, "values": values}
        data_dict = {
            "geometries": reprojected_geoms,
            "values": values,
        }
        intra_module_db["forecasted_forcing_data_dict"] = data_dict
        # print(f"Data dict created with {len(data_dict)} entries. Converting to JSON.")
        # data_dict["precip_data"] = precip_data_np.tolist()  # Convert to list for JSON serialization
        # data_dict["x_coords"] = x_coords.tolist()  # Convert to list for JSON serialization
        # data_dict["y_coords"] = y_coords.tolist()  # Convert to list for JSON serialization
        after_data_dict_creation = perf_counter()
        print(
            f"Creating data_dict took {after_data_dict_creation - after_helper_access:.2f} seconds"
        )
        # Convert the data_dict to JSON
        data_json = json.dumps(data_dict, default=str)
        after_json_conversion = perf_counter()
        print(
            f"JSON conversion took {after_json_conversion - after_data_dict_creation:.2f} seconds"
        )
        print(f"Data JSON created with length {len(data_json)}")
        logger.info(
            (
                f"Forecasted precipitation data loaded successfully in {after_json_conversion - start_command:.2f} seconds for {selected_time} ; {forecast_cycle} ; {lead_time}"
            )
        )
        return jsonify(data_json), 200
    except Exception as e:
        print("Error loading forecasted forcing")
        print(str(e))
        print(traceback.format_exc())
        logger.error(
            (
                f"Error loading forecasted forcing"
                f" in {perf_counter() - start_command:.2f} seconds: "
                f"{str(e)}"
            )
        )
        return jsonify({"error": str(e)}), 500


@main.route("/get_forecasted_forcing_grid", methods=["GET"])
def get_forecasted_forcing_grid():
    """Get forecasting gridlines to display on the map."""
    start_command = perf_counter()
    scaleX = intra_module_db.get("scaleX", 16)
    scaleY = intra_module_db.get("scaleY", 16)
    horiz_gridlines = get_forecasting_gridlines_horiz_projected(scaleX, scaleY)
    vert_gridlines = get_forecasting_gridlines_vert_projected(scaleX, scaleY)
    if horiz_gridlines is None or vert_gridlines is None:
        logger.error(
            f"Failed to load forecasting gridlines in {perf_counter() - start_command:.2f} seconds"
        )
        return jsonify({"error": "Failed to load forecasting gridlines"}), 500
    logger.info(
        f"Forecasting gridlines loaded successfully in {perf_counter() - start_command:.2f} seconds"
    )
    return jsonify({"horiz_gridlines": horiz_gridlines, "vert_gridlines": vert_gridlines}), 200

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
        }
        result_dict["forecasted_forcing_data_dict"] = data_json
        logger.info("Resuming session with data: %s", result_dict)
        return jsonify(result_dict), 200
    else:
        return jsonify({"error": "No session data found"}), 404
    