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

from time import perf_counter
from numpy import isclose, isnan

# views_utils.py
# Store implementation of views.py functionality here so
# that views.py can focus on routing and endpoint definitions.

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
