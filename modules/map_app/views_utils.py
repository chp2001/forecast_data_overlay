import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Type, Union

import geopandas as gpd
from data_processing.dataset_utils import save_and_clip_dataset
from data_processing.datasets import load_aorc_zarr, load_v3_retrospective_zarr
from data_processing.file_paths import file_paths
from data_processing.forcings import create_forcings
from data_processing.graph_utils import get_upstream_cats, get_upstream_ids
from flask import Request, request

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
)
from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import make_partial_filepath
from time import perf_counter
from numpy import isclose, isnan

# views_utils.py
# Store implementation of views.py functionality here so
# that views.py can focus on routing and endpoint definitions.


def run_type_cast(run_type_str: str) -> NWMRun:
    """
    Cast a string representation of run type to the corresponding NWMRun enum.

    Args:
        run_type_str: String representation of the run type.
    Returns:
        Corresponding NWMRun enum value.
    Raises:
        ValueError: If the provided string does not match any NWMRun enum.
    """
    for run in NWMRun:
        if run.name.lower() == run_type_str.lower():
            return run
    raise ValueError(f"Invalid run type: {run_type_str}")


# (argument name, type, {optional parameters})
# {
# "default": default value if optional
# "type_cast": if True or Callable, will try to cast a provided value to the specified type or use the Callable
# }
FuncArgOptions = Dict[str, Any]
FuncArgTuple = Tuple[str, Type, Optional[FuncArgOptions]]

forecast_precip_args: List[FuncArgTuple] = [
    ("selected_time", str, None),
    ("lead_time", int, {"type_cast": True}),
    ("forecast_cycle", int, {"type_cast": True}),
    ("scaleX", int, {"default": 16, "type_cast": True}),
    ("scaleY", int, {"default": 16, "type_cast": True}),
    ("rowMin", int, {"default": None, "type_cast": True}),
    ("rowMax", int, {"default": None, "type_cast": True}),
    ("colMin", int, {"default": None, "type_cast": True}),
    ("colMax", int, {"default": None, "type_cast": True}),
    ("lead_time_end", int, {"default": None, "type_cast": True}),
    ("range_mode", bool, {"default": False, "type_cast": True}),
    ("runtype", NWMRun, {"default": NWMRun.SHORT_RANGE, "type_cast": run_type_cast}),
]


def get_endpoint_request_obj() -> Dict[str, Any]:
    """
    Pull the JSON data from a Flask Request object into a dictionary.
    Returns:
        Dictionary of argument names to their parsed and casted values.
    """
    parsed_args: Dict[str, Any] = {}
    request_data: Dict[str, Any] = json.loads(request.data.decode("utf-8"))
    for key, value in request_data.items():
        parsed_args[key] = value
    return parsed_args


def parse_request_args(
    request_data: Dict[str, Any],
    arg_definitions: List[FuncArgTuple],
) -> Dict[str, Any]:
    """
    Parse and cast request arguments based on provided definitions.

    Args:
        request_data: Dictionary of request data.
        arg_definitions: List of argument definitions.
    Returns:
        Dictionary of parsed and casted argument values.
    """
    parsed_args: Dict[str, Any] = {}
    for arg_name, arg_type, options in arg_definitions:
        is_optional = options is not None and "default" in options
        default_value = options.get("default") if is_optional else None
        type_cast = options.get("type_cast") if options is not None else False
        try:
            if arg_name not in request_data:
                if is_optional:
                    parsed_args[arg_name] = default_value
                    continue
                else:
                    raise ValueError(f"Missing required argument: {arg_name}")
            raw_value = request_data[arg_name]
            if raw_value is None:
                if is_optional:
                    parsed_args[arg_name] = default_value
                    continue
                else:
                    raise ValueError(f"Argument {arg_name} cannot be None")
            if type_cast:
                if type_cast is True:
                    parsed_value = arg_type(raw_value)
                else:
                    try:
                        parsed_value = type_cast(raw_value)
                    except Exception as e:
                        raise ValueError(
                            f"Error casting argument {arg_name} with custom type_cast {type_cast}"
                        ) from e
            else:
                parsed_value = raw_value
            parsed_args[arg_name] = parsed_value
        except Exception as e:
            raise ValueError(f"Error parsing argument {arg_name}: {e}") from e
    return parsed_args


def make_file_unique_path(
    date: str,
    forecast_cycle: int,
    lead_time: int,
    runtype: NWMRun = NWMRun.SHORT_RANGE,
    varname: NWMVar = NWMVar.FORCING,
    geoname: NWMGeo = NWMGeo.CONUS,
    meminput: Optional[NWMMem] = None,
    region_bounds: Optional[Tuple[int, int, int, int]] = None,
    scale_factors: Tuple[int, int] = (16, 16),
    output_dir: Optional[Path] = Path("dist/downloads"),
) -> Path:
    """
    Create a unique file path for a forecast dataset based on input parameters.

    Args:
        date: Date string in 'YYYYMMDD' format.
        forecast_cycle: Forecast cycle hour (0-23).
        lead_time: Lead time in hours.
        runtype: NWMRun enum value.
        varname: NWMVar enum value.
        geoname: NWMGeo enum value.
        meminput: Optional NWMMem enum value.
        region_bounds: Optional tuple of (rowMin, rowMax, colMin, colMax) for clipping.
        scale_factors: Tuple of (scaleX, scaleY) for downscaling. Defaults to (16, 16).
        output_dir: Directory to save the file. Defaults to 'dist/downloads'.
    Returns:
        Path object representing the unique file path.
    """
    # Generate the partial filepath using the provided parameters
    # Returns in format:
    # nwm.20250704/forcing_short_range/nwm.t00z.short_range.forcing.f001.conus.nc
    partial_filepath = make_partial_filepath(
        date=date,
        forecast_cycle=forecast_cycle,
        lead_time=lead_time,
        runtype=runtype,
        varname=varname,
        geoname=geoname,
        meminput=meminput,
    )
    # Insert region bounds and scale factors into the filename to ensure uniqueness.
    bounds_str = ""
    if region_bounds is not None:
        rowMin, rowMax, colMin, colMax = region_bounds
        bounds_str = f"_r{rowMin}-{rowMax}_c{colMin}-{colMax}"
    scale_str = f"_s{scale_factors[0]}x{scale_factors[1]}"
    # Insert before the file extension
    if partial_filepath.endswith(".nc"):
        partial_filepath = partial_filepath.replace(".nc", f"{bounds_str}{scale_str}.nc")
    else:
        partial_filepath += f"{bounds_str}{scale_str}"
    unique_path = output_dir / partial_filepath
    return unique_path
