from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from pathlib import Path
from typing import List, Optional, Dict, Tuple, Callable, TypeAlias
import xarray as xr
import os

from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import create_default_file_list, append_jsons
import numpy as np
from numpy import isclose
import pickle
import pyproj
from functools import cache
from time import perf_counter

from forecasting_data.forecast_datasets import (
    load_dataset_from_json,
    load_datasets,
    load_datasets_parallel,
    reproject_points_2d,
)

geom_t: TypeAlias = List[Tuple[float, float]]


def load_forecasted_forcings(
    start_date: str,
    end_date: str,
    runtype: NWMRun = NWMRun.SHORT_RANGE,
    geosource: NWMGeo = NWMGeo.CONUS,
    mem: Optional[NWMMem] = None,
    fcst_cycle: Optional[List[int]] = None,
    lead_times: Optional[List[int]] = None,
    parallel: bool = True,
) -> List[xr.Dataset]:
    """
    Load forecasted forcing datasets as zarr files for a specified date range.

    Args:
        start_date (str): Start date in 'YYYYMMDD' format.
        end_date (str): End date in 'YYYYMMDD' format.

    Returns:
        List[xr.Dataset]: List of xarray Datasets containing the forecasted forcings.
    """
    if not start_date and not end_date:
        raise ValueError("Either start_date or end_date must be provided.")
    if not start_date:
        start_date = end_date
    if not end_date:
        end_date = start_date
    if start_date > end_date:
        raise ValueError("start_date must be less than or equal to end_date.")
    # Create a default file list for the specified date range
    file_list = create_default_file_list(
        runinput=runtype,
        varinput=NWMVar.FORCING,
        geoinput=geosource,
        meminput=mem,
        start_date=start_date,
        end_date=end_date,
        fcst_cycle=fcst_cycle,
        lead_time=lead_times,
    )
    # Append .json to the file urls
    file_list = append_jsons(file_list)

    # Load the datasets from the file list
    if parallel:
        datasets = load_datasets_parallel(file_list)
    else:
        datasets = load_datasets(file_list)
    return datasets


def load_forecasted_forcing(
    date: str,
    forecast_cycle: int = 0,
    lead_time: int = 1,
    runtype: NWMRun = NWMRun.SHORT_RANGE,
    geosource: NWMGeo = NWMGeo.CONUS,
    mem: Optional[NWMMem] = None,
    quiet: bool = False,
) -> xr.Dataset:
    """
    Load a single forecasted forcing dataset for a specified date, forecast cycle, and lead time.
    Args:
        date (str): Date in 'YYYYMMDD' format.
        fcst_cycle (int): Forecast cycle hour (default is 0).
        lead_time (int): Lead time in hours (default is 1).
        runtype (NWMRun): Type of NWM run (default is NWMRun.SHORT_RANGE).
        geosource (NWMGeo): Geographic source of the data (default is NWMGeo.CONUS).
        mem (Optional[NWMMem]): Memory ensemble member (default is None).
        quiet (bool): If True, suppresses print statements (default is False).
    Returns:
        xr.Dataset: Loaded xarray Dataset containing the forecasted forcing.
    """
    if not date:
        raise ValueError("Date must be provided.")
    if not quiet:
        print(
            f"Preparing to load forecasted forcing for date: {date}, cycle: {forecast_cycle}, lead time: {lead_time}"
        )
    # Create a file list for the specified date, forecast cycle, and lead time
    file_list = create_default_file_list(
        runinput=runtype,
        varinput=NWMVar.FORCING,
        geoinput=geosource,
        meminput=mem,
        start_date=date,
        end_date=date,
        fcst_cycle=[forecast_cycle],
        lead_time=[lead_time],
    )
    assert (
        len(file_list) == 1
    ), f"Expected exactly one file for the specified parameters, got {len(file_list)}."
    # Append .json to the file urls
    file_list = append_jsons(file_list)
    if not quiet:
        print(f"Loading forecasted forcing from {file_list[0]}")

    # Load the dataset from the file list
    datasets = load_datasets(file_list)
    if not datasets:
        raise ValueError("No datasets found for the specified parameters.")
    return datasets[0]


def get_precip_projection(
    dataset: xr.Dataset,
) -> str:
    """
    Get the projection method of the precipitation data in the dataset.

    Args:
        dataset (xr.Dataset): The xarray Dataset containing the precipitation data.

    Returns:
        str: The projection method of the precipitation data.
    """
    if "RAINRATE" not in dataset.data_vars:
        raise ValueError("Dataset does not contain 'RAINRATE' variable.")
    precip_data = dataset["RAINRATE"]
    if "esri_pe_string" not in precip_data.attrs:
        raise ValueError("Precipitation data does not contain 'esri_pe_string' attribute.")
    return precip_data.attrs["esri_pe_string"]


def get_dataset_precip(
    dataset: xr.Dataset,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Extract the full precipitation data from the dataset and return it as a tuple of relevant arrays.
    Args:
        dataset (xr.Dataset): The xarray Dataset containing the precipitation data.
    Returns:
        result (Tuple[np.ndarray, np.ndarray, np.ndarray]): A tuple containing:
            - Precipitation data as a 2D numpy array with shape (y, x).
            - X coordinates as a 1D numpy array.
            - Y coordinates as a 1D numpy array.
    """
    if "RAINRATE" not in dataset.data_vars:
        raise ValueError("Dataset does not contain 'RAINRATE' variable.")
    precip_data = dataset["RAINRATE"][0]
    precip_data_np = precip_data.values  # Convert to numpy array
    x_coords = precip_data.x.values  # Get x coordinates as a numpy array
    y_coords = precip_data.y.values  # Get y coordinates as a numpy array
    result = (precip_data_np, x_coords, y_coords)
    print(
        f"Extracted ndarrays from dataset: {result[0].shape=}, {result[1].shape=}, {result[2].shape=}"
    )
    return result


def rescale_precip_dataset(
    dataset: xr.Dataset,
    scaleX: int = 16,
    scaleY: int = 16,
) -> xr.Dataset:
    """
    Rescale the dataset by collapsing individual data points into larger blocks of the specified size.
    Args:
        dataset (xr.Dataset): The xarray Dataset to rescale.
        scaleX (int): The number of x points to collapse into one.
        scaleY (int): The number of y points to collapse into one.
    Returns:
        xr.Dataset: The rescaled xarray Dataset.
    """
    if "RAINRATE" not in dataset.data_vars:
        raise ValueError("Dataset does not contain 'RAINRATE' variable.")
    precip_data = dataset["RAINRATE"]
    # Rescale the data by collapsing the specified number of points
    rescaled_data: xr.DataArray = precip_data.coarsen(x=scaleX, y=scaleY, boundary="exact").mean()
    print(
        f"Rescaled data from shape {precip_data.shape} to {rescaled_data.shape} using scaleX={scaleX}, scaleY={scaleY}"
    )
    # Create a new dataset with the rescaled data
    old_coords = precip_data.coords
    new_coords = old_coords.assign(
        {
            "x": rescaled_data.x,
            "y": rescaled_data.y,  # Use the new coordinates from the rescaled data
        }
    )
    rescaled_dataset = xr.Dataset(
        data_vars={"RAINRATE": rescaled_data},
        attrs=dataset.attrs,
        # coords=dataset.coords,
        coords=new_coords,
    )
    # Modify the coordinates to match the new shape
    assert (
        rescaled_dataset.RAINRATE.shape == rescaled_data.shape
    ), f"Rescaled dataset shape {rescaled_dataset.RAINRATE.shape} does not match rescaled data shape {rescaled_data.shape}."
    return rescaled_dataset


@cache
def get_example_forcing_dataset() -> xr.Dataset:
    """
    Get an example dataset for testing purposes.

    Returns:
        xr.Dataset: An example xarray Dataset.
    """
    try:
        with open("./dist/example_dataset.pkl", "rb") as f:
            dataset = pickle.load(f)
        print("Loaded example dataset from cache.")
    except FileNotFoundError:
        print("No example dataset found, loading a new one.")
        dataset = load_forecasted_forcing(date="202301010000", forecast_cycle=0, lead_time=1)
        if not os.path.exists("./dist/"):
            os.makedirs("./dist/")
        with open("./dist/example_dataset.pkl", "wb") as f:
            pickle.dump(dataset, f)
        print("Cached example dataset to ./dist/example_dataset.pkl")
    return dataset


def get_example_forcing_dataset_raw(quiet: bool = False) -> xr.Dataset:
    """
    Get an example dataset for testing purposes, without any caching.

    Returns:
        xr.Dataset: An example xarray Dataset.
    """
    dataset = load_forecasted_forcing(
        date="202301010000", forecast_cycle=0, lead_time=1, quiet=quiet
    )
    return dataset


@cache
def get_example_forcing_dataset_rescaled(scaleX: int = 16, scaleY: int = 16) -> xr.Dataset:
    """
    Get an example dataset for testing purposes, rescaled by the specified factors.

    Args:
        scaleX (int): The factor by which to rescale the x dimension.
        scaleY (int): The factor by which to rescale the y dimension.

    Returns:
        xr.Dataset: An example xarray Dataset, rescaled.
    """
    example_dataset = get_example_forcing_dataset()
    if scaleX != 1 or scaleY != 1:
        example_dataset = rescale_precip_dataset(example_dataset, scaleX=scaleX, scaleY=scaleY)
    return example_dataset


@cache
def get_example_dataset_precip(
    scaleX: int = 16, scaleY: int = 16
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Get the precipitation data from the example dataset, rescaled by the specified factors.

    Args:
        scaleX (int): The factor by which to rescale the x dimension.
        scaleY (int): The factor by which to rescale the y dimension.

    Returns:
        Tuple[np.ndarray, np.ndarray, np.ndarray]: A tuple containing:
            - Precipitation data as a 2D numpy array with shape (y, x).
            - X coordinates as a 1D numpy array.
            - Y coordinates as a 1D numpy array.
    """
    example_dataset = get_example_forcing_dataset_rescaled(scaleX=scaleX, scaleY=scaleY)
    return get_dataset_precip(example_dataset)


@cache
def get_conus_forcing_gridlines_horiz(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get horizontal grid lines for the forecasting data.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for horizontal grid lines.
    """
    example_dataset = get_example_forcing_dataset()
    precip_data_np, x_coords, y_coords = get_dataset_precip(example_dataset)
    gridlines_horiz = []
    for y in range(0, precip_data_np.shape[0], scaleY):
        line = []
        for x in range(0, precip_data_np.shape[1], scaleX):
            coord = (x_coords[x], y_coords[y])
            line.append(coord)
        gridlines_horiz.append(line)
    print(
        f"Generated {len(gridlines_horiz)} horizontal grid lines with {len(gridlines_horiz[0])} points each."
    )
    return gridlines_horiz


@cache
def get_conus_forcing_gridlines_vert(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get vertical grid lines for the forecasting data.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for vertical grid lines.
    """
    example_dataset = get_example_forcing_dataset()
    precip_data_np, x_coords, y_coords = get_dataset_precip(example_dataset)
    gridlines_vert = []
    for x in range(0, precip_data_np.shape[1], scaleX):
        line = []
        for y in range(0, precip_data_np.shape[0], scaleY):
            coord = (x_coords[x], y_coords[y])
            line.append(coord)
        gridlines_vert.append(line)
    print(
        f"Generated {len(gridlines_vert)} vertical grid lines with {len(gridlines_vert[0])} points each."
    )
    return gridlines_vert


@cache
def get_conus_forcing_gridlines_horiz_projected(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get horizontal grid lines for the forecasting data projected to EPSG:5070.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for horizontal grid lines projected to EPSG:5070.
    """
    unprojected_gridlines = get_conus_forcing_gridlines_horiz(scaleX=scaleX, scaleY=scaleY)
    current_projection = get_precip_projection(get_example_forcing_dataset())
    # target_projection = "EPSG:5070"
    target_projection = "EPSG:4326"  # We want lat/lon coordinates for the map
    transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
    gridlines_horiz_projected = []
    for line in unprojected_gridlines:
        projected_line = []
        for coord in line:
            projected_coord = transformer.transform(coord[0], coord[1])
            projected_line.append(projected_coord)
        gridlines_horiz_projected.append(projected_line)
    print(
        f"Projected horizontal grid lines with {len(gridlines_horiz_projected)} lines, each with {len(gridlines_horiz_projected[0])} points."
    )
    return gridlines_horiz_projected


@cache
def get_conus_forcing_gridlines_vert_projected(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get vertical grid lines for the forecasting data projected to EPSG:5070.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for vertical grid lines projected to EPSG:5070.
    """
    unprojected_gridlines = get_conus_forcing_gridlines_vert(scaleX=scaleX, scaleY=scaleY)
    current_projection = get_precip_projection(get_example_forcing_dataset())
    # target_projection = "EPSG:5070"
    target_projection = "EPSG:4326"  # We want lat/lon coordinates for the map
    transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
    gridlines_vert_projected = []
    for line in unprojected_gridlines:
        projected_line = []
        for coord in line:
            projected_coord = transformer.transform(coord[0], coord[1])
            projected_line.append(projected_coord)
        gridlines_vert_projected.append(projected_line)
    print(
        f"Projected vertical grid lines with {len(gridlines_vert_projected)} lines, each with {len(gridlines_vert_projected[0])} points."
    )
    return gridlines_vert_projected


@cache
def get_point_geometry(
    x: int,
    y: int,
    scaleX: int = 16,
    scaleY: int = 16,
) -> List[Tuple[float, float]]:
    """
    Get the unprojected square geometry for a point at the specified x, y indices in the rescaled dataset.
    Args:
        x (int): The x index of the point.
        y (int): The y index of the point.
        scaleX (int): The number of x points to collapse into one.
        scaleY (int): The number of y points to collapse into one.
    Returns:
        List[Tuple[float, float]]: A list of tuples representing the coordinates of the square geometry.
    """
    _, x_coords, y_coords = get_example_dataset_precip(scaleX=scaleX, scaleY=scaleY)
    # For now, let's just assume the dataset will always be in 1000x1000 squares at scale 1,
    # and that the x and y coordinates are evenly spaced.
    # From there, we can quickly assume the coordinates of the square geometry.
    centerX = x_coords[x]
    centerY = y_coords[y]
    baseWidth = 1000
    xWidth = baseWidth * scaleX
    yWidth = baseWidth * scaleY
    # Calculate the coordinates of the square geometry
    geometry = [
        (centerX - xWidth / 2, centerY - yWidth / 2),  # Bottom-left
        (centerX + xWidth / 2, centerY - yWidth / 2),  # Bottom-right
        (centerX + xWidth / 2, centerY + yWidth / 2),  # Top-right
        (centerX - xWidth / 2, centerY + yWidth / 2),  # Top-left
    ]
    # Return the geometry as a list of tuples
    return geometry


@cache
def get_simple_point_geometry(
    x_coord: float,
    y_coord: float,
    baseWidth: int = 1000,
    scaleX: int = 16,
    scaleY: int = 16,
) -> List[Tuple[float, float]]:
    """
    Get the unprojected square geometry for a point at the specified x, y coordinates.
    Args:
        x_coord (float): The x coordinate of the point.
        y_coord (float): The y coordinate of the point.
        baseWidth (int): The base width of the square at scale 1 (default is 1000).
        scaleX (int): The number of x points to collapse into one.
        scaleY (int): The number of y points to collapse into one.
    Returns:
        List[Tuple[float, float]]: A list of tuples representing the coordinates of the square geometry.
    """
    xWidth = baseWidth * scaleX
    yWidth = baseWidth * scaleY
    # Calculate the coordinates of the square geometry
    geometry = [
        (x_coord - xWidth / 2, y_coord - yWidth / 2),  # Bottom-left
        (x_coord + xWidth / 2, y_coord - yWidth / 2),  # Bottom-right
        (x_coord + xWidth / 2, y_coord + yWidth / 2),  # Top-right
        (x_coord - xWidth / 2, y_coord + yWidth / 2),  # Top-left
    ]
    # Return the geometry as a list of tuples
    return geometry


def uncached_get_point_geometry(
    x: int,
    y: int,
    scaleX: int = 16,
    scaleY: int = 16,
) -> List[Tuple[float, float]]:
    """
    Uncached version of get_point_geometry for testing purposes.
    """
    _, x_coords, y_coords = get_example_dataset_precip(scaleX=scaleX, scaleY=scaleY)
    # For now, let's just assume the dataset will always be in 1000x1000 squares at scale 1,
    # and that the x and y coordinates are evenly spaced.
    # From there, we can quickly assume the coordinates of the square geometry.
    centerX = x_coords[x]
    centerY = y_coords[y]
    baseWidth = 1000
    xWidth = baseWidth * scaleX
    yWidth = baseWidth * scaleY
    # Calculate the coordinates of the square geometry
    geometry = [
        (centerX - xWidth / 2, centerY - yWidth / 2),  # Bottom-left
        (centerX + xWidth / 2, centerY - yWidth / 2),  # Bottom-right
        (centerX + xWidth / 2, centerY + yWidth / 2),  # Top-right
        (centerX - xWidth / 2, centerY + yWidth / 2),  # Top-left
    ]
    # Return the geometry as a list of tuples
    return geometry


@cache
def load_forecasted_dataset_with_options(
    date: str,
    forecast_cycle: int = 0,
    lead_time: int = 1,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> xr.Dataset:
    """Use caching to make repeated access to the same data faster by
    running the calculations previously in `views.py::get_forecast_precip`
    within a function with hashable arguments.

    Bounding box for clipping is before scaling.
    Args:
        date (str): Date in 'YYYYMMDD' format.
        forcast_cycle (int): Forecast cycle hour (default is 0).
        lead_time (int): Lead time in hours (default is 1).
        scaleX (Optional[int]): The number of x points to collapse into one.
        scaleY (Optional[int]): The number of y points to collapse into one.
        rowMin (Optional[int]): Minimum row index to slice the data.
        rowMax (Optional[int]): Maximum row index to slice the data.
        colMin (Optional[int]): Minimum column index to slice the data.
        colMax (Optional[int]): Maximum column index to slice the data.
    Returns:
        xr.Dataset: The processed xarray Dataset. For download or otherwise.
    """
    dataset = load_forecasted_forcing(date=date, forecast_cycle=forecast_cycle, lead_time=lead_time)
    if all(v is not None for v in [rowMin, rowMax, colMin, colMax]):
        rangeAdjustX = 16 if scaleX is not None else scaleX
        rangeAdjustY = 16 if scaleY is not None else scaleY
        dataset = dataset.isel(
            y=slice(rowMin, rowMax - rangeAdjustY), x=slice(colMin, colMax - rangeAdjustX)
        )
    if scaleX is not None and scaleY is not None:
        dataset = dataset.coarsen(x=scaleX, y=scaleY, boundary="trim").mean()
    return dataset


def save_forecasted_dataset_with_options(
    file_path: Path,
    date: str,
    forecast_cycle: int = 0,
    lead_time: int = 1,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> None:
    """Save the processed forecasted dataset to a NetCDF file.

    Args:
        file_path (Path): The file path to save the dataset.
        date (str): Date in 'YYYYMMDD' format.
        forcast_cycle (int): Forecast cycle hour (default is 0).
        lead_time (int): Lead time in hours (default is 1).
        scaleX (Optional[int]): The number of x points to collapse into one.
        scaleY (Optional[int]): The number of y points to collapse into one.
        rowMin (Optional[int]): Minimum row index to slice the data.
        rowMax (Optional[int]): Maximum row index to slice the data.
        colMin (Optional[int]): Minimum column index to slice the data.
        colMax (Optional[int]): Maximum column index to slice the data.
    """
    dataset = load_forecasted_dataset_with_options(
        date=date,
        forecast_cycle=forecast_cycle,
        lead_time=lead_time,
        scaleX=scaleX,
        scaleY=scaleY,
        rowMin=rowMin,
        rowMax=rowMax,
        colMin=colMin,
        colMax=colMax,
    )
    dataset.to_netcdf(path=file_path)


@cache
def load_forecasted_forcing_with_options(
    date: str,
    forecast_cycle: int = 0,
    lead_time: int = 1,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> Tuple[xr.DataArray, pyproj.Transformer]:
    """Use caching to make repeated access to the same data faster by
    running the calculations previously in `views.py::get_forecast_precip`
    within a function with hashable arguments.

    Bounding box for clipping is before scaling.
    Args:
        date (str): Date in 'YYYYMMDD' format.
        forecast_cycle (int): Forecast cycle hour (default is 0).
        lead_time (int): Lead time in hours (default is 1).
        scaleX (Optional[int]): The number of x points to collapse into one.
        scaleY (Optional[int]): The number of y points to collapse into one.
        rowMin (Optional[int]): Minimum row index to slice the data.
        rowMax (Optional[int]): Maximum row index to slice the data.
        colMin (Optional[int]): Minimum column index to slice the data.
        colMax (Optional[int]): Maximum column index to slice the data.
    Returns:
        result (Tuple[xr.DataArray, pyproj.Transformer]): A tuple containing:
            - Precipitation data as an xarray DataArray.
            - A pyproj Transformer to convert from the dataset's projection to EPSG:4326.
    """
    dataset = load_forecasted_forcing(date=date, forecast_cycle=forecast_cycle, lead_time=lead_time)
    precip_data = dataset["RAINRATE"]
    if all(v is not None for v in [rowMin, rowMax, colMin, colMax]):
        rangeAdjustX = 16 if scaleX is not None else scaleX
        rangeAdjustY = 16 if scaleY is not None else scaleY
        precip_data = precip_data[:, rowMin : rowMax - rangeAdjustY, colMin : colMax - rangeAdjustX]
    if scaleX is not None and scaleY is not None:
        precip_data = precip_data.coarsen(x=scaleX, y=scaleY, boundary="trim").mean()
    transformer = pyproj.Transformer.from_crs(
        get_precip_projection(dataset), "EPSG:4326", always_xy=True
    )
    return precip_data, transformer


def get_timestep_data_for_frontend(
    selected_time: str,  # YYYYMMDD
    forecast_cycle: int,
    lead_time: int,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
    **kwargs,
) -> Dict[str, List]:
    """
    Migrated functionality from `views.py::get_forecast_precip` to a function,
    to self-contain the logic for preparing the geometries and values for a single
    timestep to send to the frontend.
    """
    # Wrapper for the cached version to allow for ignored arguments
    return _get_timestep_data_for_frontend(
        selected_time,
        forecast_cycle,
        lead_time,
        scaleX,
        scaleY,
        rowMin,
        rowMax,
        colMin,
        colMax,
    )


@cache
def _get_timestep_data_for_frontend(
    selected_time: str,  # YYYYMMDD
    forecast_cycle: int,
    lead_time: int,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> Dict[str, List]:
    """
    Migrated functionality from `views.py::get_forecast_precip` to a function,
    to self-contain the logic for preparing the geometries and values for a single
    timestep to send to the frontend.
    """
    ## Configuration segment
    # Enable timing logs for debugging performance issues
    do_timing_logs = False

    def tlog(*args, **kwargs):
        if do_timing_logs:
            print(*args, **kwargs)

    # Function for paring down data unwanted on the frontend
    def do_skip_value(value: float) -> bool:
        # Skip values that are NaN, negative, or zero
        if value is None or np.isnan(value) or isclose(value, 0.0, atol=1e-6):
            return True
        return False

    ## End configuration segment
    t0 = perf_counter()
    # input validation first
    scaleX = 1 if scaleX is None else scaleX
    scaleY = 1 if scaleY is None else scaleY
    # grab data the way the view function did first
    precip_data_array, transformer = load_forecasted_forcing_with_options(
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
    precip_data_array_np = precip_data_array.to_numpy()
    t1 = perf_counter()
    if any([v is None for v in [precip_data_array_np, transformer]]):
        raise ValueError(f"Failed to load precip data or transformer in {t1 - t0:.2f} seconds")
    if t1 - t0 > 1.0:
        tlog(f"Loading forecasted forcing took {t1 - t0:.2f} seconds")
    data_dict = {
        "geometries": [],
        "values": [],
    }
    x_coords: np.ndarray = precip_data_array.x.values
    y_coords: np.ndarray = precip_data_array.y.values
    for t in range(precip_data_array.shape[0]):
        for y in range(precip_data_array.shape[1]):
            for x in range(precip_data_array.shape[2]):
                value = precip_data_array_np[t, y, x]
                if do_skip_value(value):
                    continue
                x_coord = x_coords[x]
                y_coord = y_coords[y]
                geom = get_simple_point_geometry(
                    x_coord=x_coord,
                    y_coord=y_coord,
                    baseWidth=1000,
                    scaleX=scaleX,
                    scaleY=scaleY,
                )
                data_dict["geometries"].append(geom)
                data_dict["values"].append(value)
    t2 = perf_counter()
    if t2 - t1 > 1.0:
        tlog(f"Processing data into geometries took {t2 - t1:.2f} seconds")
    # Reproject the geometries using the transformer
    data_dict["geometries"] = reproject_points_2d(transformer, data_dict["geometries"])
    t3 = perf_counter()
    if t3 - t2 > 1.0:
        tlog(f"Reprojecting geometries took {t3 - t2:.2f} seconds")
    if do_timing_logs:
        tlog(f"Total time for get_timestep_data_for_frontend: {t3 - t0:.2f} seconds")
    return data_dict


@cache
def _get_timestep_values_for_frontend(
    selected_time: str,  # YYYYMMDD
    forecast_cycle: int,
    lead_time: int,
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> List[float]:
    """
    For multi-timestep data, we may want to get all values before deciding
    which geometries to send to the frontend. This function gets just the values
    for a given timestep, without the geometries.
    """
    ## Configuration segment
    # Enable timing logs for debugging performance issues
    do_timing_logs = False
    # minimum time in seconds to log
    do_timing_threshold = 1.0

    def tlog(*args, dt=None, thr=None, **kwargs):
        threshold = thr if thr is not None else do_timing_threshold
        if do_timing_logs:
            if dt is not None and dt < threshold:
                return
            print(*args, **kwargs)

    # # Function for paring down data unwanted on the frontend
    # (skipping paring, we want all values here)
    ## End configuration segment
    t0 = perf_counter()
    # input validation first
    scaleX = 1 if scaleX is None else scaleX
    scaleY = 1 if scaleY is None else scaleY
    # grab data the way the view function did first
    # (Not working with geometry here, so ignore transformer)
    precip_data_array, _ = load_forecasted_forcing_with_options(
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
    precip_data_array_np = precip_data_array.to_numpy()
    t1 = perf_counter()
    if precip_data_array_np is None:
        raise ValueError(f"Failed to load precip data in {t1 - t0:.2f} seconds")
    tlog(f"Loading forecasted forcing took {t1 - t0:.2f} seconds", dt=t1 - t0)
    values: List[float] = []
    for t in range(precip_data_array.shape[0]):
        for y in range(precip_data_array.shape[1]):
            for x in range(precip_data_array.shape[2]):
                value = precip_data_array_np[t, y, x]
                values.append(value)
    t2 = perf_counter()
    tlog(
        f"Processing data into {len(values)} values took {t2 - t1:.2f} seconds", dt=t2 - t1, thr=0.5
    )
    if do_timing_logs:
        tlog(
            f"Total time for _get_timestep_values_for_frontend: {t2 - t0:.2f} seconds",
            dt=t2 - t0,
            thr=0.0,
        )
    return values


def get_timesteps_data_for_frontend(
    selected_time: str,  # YYYYMMDD
    forecast_cycle: int,
    # lead_times: List[int],
    lead_times: Tuple[int, ...],
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
    **kwargs,
) -> Tuple[Dict[int, List[float]], List[geom_t]]:
    """
    Get the values for multiple lead times, and a single common geometry set.
    This is useful for sending multiple timesteps to the frontend at once,
    without duplicating the geometry data.

    Data is requested from the `_get_timestep_values_for_frontend` function
    for each lead time, and then geometries and values are filtered
    as a group to reduce the amount of extra data and geometry sent to the frontend.
    """
    if isinstance(lead_times, list):
        lead_times = tuple(lead_times)
    # Wrapper for the cached version to allow for ignored arguments
    return _get_timesteps_data_for_frontend(
        selected_time,
        forecast_cycle,
        lead_times,
        scaleX,
        scaleY,
        rowMin,
        rowMax,
        colMin,
        colMax,
    )


@cache
def _get_timesteps_data_for_frontend(
    selected_time: str,  # YYYYMMDD
    forecast_cycle: int,
    # lead_times: List[int],
    lead_times: Tuple[int, ...],
    scaleX: Optional[int] = None,
    scaleY: Optional[int] = None,
    rowMin: Optional[int] = None,
    rowMax: Optional[int] = None,
    colMin: Optional[int] = None,
    colMax: Optional[int] = None,
) -> Tuple[Dict[int, List[float]], List[geom_t]]:
    """
    Get the values for multiple lead times, and a single common geometry set.
    This is useful for sending multiple timesteps to the frontend at once,
    without duplicating the geometry data.

    Data is requested from the `_get_timestep_values_for_frontend` function
    for each lead time, and then geometries and values are filtered
    as a group to reduce the amount of extra data and geometry sent to the frontend.
    """
    ## Configuration segment
    # Enable timing logs for debugging performance issues
    do_timing_logs = False

    def tlog(*args, **kwargs):
        if do_timing_logs:
            print(*args, **kwargs)

    # # Function for paring down data unwanted on the frontend
    # def do_skip_value(value: float) -> bool:
    #     # Skip values that are NaN, negative, or zero
    #     if value is None or np.isnan(value) or isclose(value, 0.0, atol=1e-6):
    #         return True
    #     return False
    # The group filtering is the primary purpose of this function,
    # so trying to put it in as a configuration helper is counterproductive.
    ## End configuration segment
    t0 = perf_counter()
    # input validation first
    scaleX = 1 if scaleX is None else scaleX
    scaleY = 1 if scaleY is None else scaleY
    # lead_times = sorted(lead_times)
    lead_times: List[int] = sorted(list(lead_times))
    if not lead_times:
        raise ValueError("No lead times specified.")
    # Don't need to arrange the data into a dict until the end
    sub_times: List[float] = []  # time checkpoints for each lead time load
    lead_time_values: List[List[float]] = []
    for lead_time in lead_times:
        try:
            values = _get_timestep_values_for_frontend(
                selected_time,
                forecast_cycle,
                lead_time,
                scaleX,
                scaleY,
                rowMin,
                rowMax,
                colMin,
                colMax,
            )
            sub_times.append(perf_counter())
            lead_time_values.append(values)
        except Exception as e:
            print(f"Error loading data for lead_time={lead_time}: {e}")
            raise e
    t1 = perf_counter()
    assert len(lead_time_values) == len(
        lead_times
    ), f"Mismatch in lead times and values lengths: {len(lead_times)} vs {len(lead_time_values)}"
    tlog(f"Loading {len(lead_times)} lead times took {t1 - t0:.2f} seconds")
    # Now we need to get the geometries for the first lead time.
    precip_data_array, transformer = load_forecasted_forcing_with_options(
        date=selected_time,
        forecast_cycle=forecast_cycle,
        lead_time=lead_times[0],
        scaleX=scaleX,
        scaleY=scaleY,
        rowMin=rowMin,
        rowMax=rowMax,
        colMin=colMin,
        colMax=colMax,
    )
    precip_data_array_np = precip_data_array.to_numpy()
    t2 = perf_counter()
    if any([v is None for v in [precip_data_array_np, transformer]]):
        raise ValueError(f"Failed to load precip data or transformer in {t2 - t1:.2f} seconds")
    tlog(f"Loading precip data for geometries took {t2 - t1:.2f} seconds")
    values_dict: Dict[int, List[float]] = {lt: [] for lt in lead_times}
    geometries: List[geom_t] = []
    x_coords: np.ndarray = precip_data_array.x.values
    y_coords: np.ndarray = precip_data_array.y.values
    i = -1
    for t in range(precip_data_array.shape[0]):
        for y in range(precip_data_array.shape[1]):
            for x in range(precip_data_array.shape[2]):
                i += 1  # Flat index for the lead_time_values lists
                # Gather values for all lead times at this point
                point_values = [lt_values[i] for lt_values in lead_time_values]
                # Check if all values should be skipped
                if all(
                    [v is None or np.isnan(v) or isclose(v, 0.0, atol=1e-6) for v in point_values]
                ):
                    continue
                # If not skipped, add the values to the dict
                for lt, v in zip(lead_times, point_values):
                    values_dict[lt].append(v)
                # Add the geometry for this point
                x_coord = x_coords[x]
                y_coord = y_coords[y]
                geom = get_simple_point_geometry(
                    x_coord=x_coord,
                    y_coord=y_coord,
                    baseWidth=1000,
                    scaleX=scaleX,
                    scaleY=scaleY,
                )
                geometries.append(geom)
    t3 = perf_counter()
    tlog(f"Processing data into geometries and values took {t3 - t2:.2f} seconds")
    # Reproject the geometries using the transformer
    geometries = reproject_points_2d(transformer, geometries)
    t4 = perf_counter()
    tlog(f"Reprojecting geometries took {t4 - t3:.2f} seconds")
    if do_timing_logs:
        tlog(f"Total time for _get_timesteps_data_for_frontend: {t4 - t0:.2f} seconds")
    return values_dict, geometries
