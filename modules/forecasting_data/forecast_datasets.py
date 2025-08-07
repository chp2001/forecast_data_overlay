from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from typing import List, Optional, Dict, Tuple, Callable
import xarray as xr
import fsspec
import ujson
import psutil
import joblib
import os

# from kerchunk.combine import MultiZarrToZarr
import glob

from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import create_default_file_list, append_jsons
from data_processing.dask_utils import use_cluster
import numpy as np
import pickle
import pyproj
from functools import cache

# fs2 = fsspec.filesystem("")

# def make_mzz():
#     json_list = glob.glob("/home/shared/GOES_DA/swe_new/ncjson/*.json")
#     mzz = MultiZarrToZarr(json_list, concat_dims=["t"], identical_dims=["x", "y"])
#     d = mzz.translate()

#     with fs2.open("/home/shared/GOES_DA/swe_new/combined.json", "wb") as f:
#         f.write(ujson.dumps(d).encode())


def load_dataset_from_json(file_path: str) -> xr.Dataset:
    """
    Load an xarray Dataset from a JSON file.

    Args:
        file_path (str): Path to the JSON file containing dataset metadata.

    Returns:
        xr.Dataset: Loaded xarray Dataset.
    """
    with fsspec.open(file_path, "r") as f:
        data = ujson.load(f)
    backend_args = {
        "consolidated": False,
        "storage_options": {
            "fo": data,
        },
    }
    ds = xr.open_dataset(
        "reference://",
        engine="zarr",
        backend_kwargs=backend_args,
        chunks="auto",
    )
    ds_df = ds.RAINRATE[:, 0:2000, 0:2000].to_dataframe()
    # ds_df = ds.RAINRATE.to_dataframe()
    # ds_df = ds.to_dataframe()
    return ds


def load_datasets(
    file_paths: List[str],
) -> List[xr.Dataset]:
    """
    Load multiple datasets from a list of file paths.

    Args:
        file_paths (List[str]): List of file paths to the datasets.

    Returns:
        List[xr.Dataset]: List of loaded xarray Datasets.
    """
    datasets = []
    for file_path in file_paths:
        dataset = load_dataset_from_json(file_path)
        datasets.append(dataset)
    return datasets


def load_datasets_parallel(
    file_paths: List[str],
) -> List[xr.Dataset]:
    """
    Load multiple datasets in parallel from a list of file paths.

    Args:
        file_paths (List[str]): List of file paths to the datasets.

    Returns:
        List[xr.Dataset]: List of loaded xarray Datasets.
    """
    num_cores = psutil.cpu_count(logical=False)
    os.makedirs("./dist/joblib_temp", exist_ok=True)
    with joblib.parallel_config(
        n_jobs=num_cores,
        # backend='threading',
        backend="loky",
        temp_folder="./dist/joblib_temp",
    ):
        datasets = joblib.Parallel()(
            joblib.delayed(load_dataset_from_json)(file_path) for file_path in file_paths
        )
    return datasets


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
    fcst_cycle: int = 0,
    lead_time: int = 1,
    runtype: NWMRun = NWMRun.SHORT_RANGE,
    geosource: NWMGeo = NWMGeo.CONUS,
    mem: Optional[NWMMem] = None,
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
    Returns:
        xr.Dataset: Loaded xarray Dataset containing the forecasted forcing.
    """
    if not date:
        raise ValueError("Date must be provided.")
    print(
        f"Preparing to load forecasted forcing for date: {date}, cycle: {fcst_cycle}, lead time: {lead_time}"
    )
    # Create a file list for the specified date, forecast cycle, and lead time
    file_list = create_default_file_list(
        runinput=runtype,
        varinput=NWMVar.FORCING,
        geoinput=geosource,
        meminput=mem,
        start_date=date,
        end_date=date,
        fcst_cycle=[fcst_cycle],
        lead_time=[lead_time],
    )
    assert len(file_list) == 1, (
        f"Expected exactly one file for the specified parameters, got {len(file_list)}."
    )
    # Append .json to the file urls
    file_list = append_jsons(file_list)
    print(f"Loading forecasted forcing from {file_list[0]}")

    # Load the dataset from the file list
    datasets = load_datasets(file_list)
    if not datasets:
        raise ValueError("No datasets found for the specified parameters.")
    return datasets[0]


@use_cluster
def merge_datasets(datasets: List[xr.Dataset]) -> xr.Dataset:
    """
    Merge multiple xarray Datasets into a single Dataset.

    Args:
        datasets (List[xr.Dataset]): List of xarray Datasets to merge.

    Returns:
        xr.Dataset: Merged xarray Dataset.
    """
    if not datasets:
        raise ValueError("No datasets provided for merging.")
    merged_dataset = xr.merge(datasets)
    return merged_dataset


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


@cache
def get_example_dataset() -> xr.Dataset:
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
        dataset = load_forecasted_forcing(date="202301010000", fcst_cycle=0, lead_time=1)
        with open("./dist/example_dataset.pkl", "wb") as f:
            pickle.dump(dataset, f)
        print("Cached example dataset to ./dist/example_dataset.pkl")
    return dataset


@cache
def get_example_dataset_rescaled(scaleX: int = 16, scaleY: int = 16) -> xr.Dataset:
    """
    Get an example dataset for testing purposes, rescaled by the specified factors.

    Args:
        scaleX (int): The factor by which to rescale the x dimension.
        scaleY (int): The factor by which to rescale the y dimension.

    Returns:
        xr.Dataset: An example xarray Dataset, rescaled.
    """
    example_dataset = get_example_dataset()
    if scaleX != 1 or scaleY != 1:
        example_dataset = rescale_dataset(example_dataset, scaleX=scaleX, scaleY=scaleY)
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
    example_dataset = get_example_dataset_rescaled(scaleX=scaleX, scaleY=scaleY)
    return get_dataset_precip(example_dataset)


# @cache
# def get_forecasting_grid(scaleX: int = 16, scaleY: int = 16) -> List[List[Tuple[float, float]]]:
#     """
#     Get the grid of coordinates for the forecasting data.

#     Returns:
#         List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates.
#     """
#     example_dataset = get_example_dataset()
#     if scaleX != 1 or scaleY != 1:
#         example_dataset = rescale_dataset(example_dataset, scaleX=scaleX, scaleY=scaleY)
#     precip_data_np, x_coords, y_coords = get_dataset_precip(example_dataset)
#     # grid = []
#     # for y in range(precip_data_np.shape[0]):
#     #     row = []
#     #     for x in range(precip_data_np.shape[1]):
#     #         coord = (x_coords[x], y_coords[y])
#     #         row.append(coord)
#     #     grid.append(row)
#     print(f"Creating grid from precip_data with shape {precip_data_np.shape}")
#     grid = [
#         [(x_coords[x], y_coords[y]) for x in range(precip_data_np.shape[1])]
#         for y in range(precip_data_np.shape[0])
#     ]
#     print(f"Generated grid with {len(grid)} rows and {len(grid[0])} columns.")
#     return grid


# @cache
# def get_forecasting_grid_projected() -> List[List[Tuple[float, float]]]:
#     """
#     Get the grid of coordinates for the forecasting data projected to EPSG:5070.

#     Returns:
#         List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates projected to EPSG:5070.
#     """
#     example_dataset = get_example_dataset()
#     current_projection = get_precip_projection(example_dataset)
#     target_projection = "EPSG:5070"
#     transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
#     unprojected_grid = get_forecasting_grid()
#     grid = []
#     for row in unprojected_grid:
#         projected_row = []
#         for coord in row:
#             projected_coord = transformer.transform(coord[0], coord[1])
#             projected_row.append(projected_coord)
#         grid.append(projected_row)
#     print(f"Projected grid with {len(grid)} rows and {len(grid[0])} columns.")
#     # Print the first few coordinates for verification
#     print(f"First few projected coordinates: {grid[0][:3]}")
#     return grid


@cache
def get_forecasting_gridlines_horiz(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get horizontal grid lines for the forecasting data.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for horizontal grid lines.
    """
    example_dataset = get_example_dataset()
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
def get_forecasting_gridlines_vert(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get vertical grid lines for the forecasting data.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for vertical grid lines.
    """
    example_dataset = get_example_dataset()
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
def get_forecasting_gridlines_horiz_projected(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get horizontal grid lines for the forecasting data projected to EPSG:5070.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for horizontal grid lines projected to EPSG:5070.
    """
    unprojected_gridlines = get_forecasting_gridlines_horiz(scaleX=scaleX, scaleY=scaleY)
    current_projection = get_precip_projection(get_example_dataset())
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


def reproject_points(
    dataset: xr.Dataset,
    points: List[Tuple[float, float]],
) -> List[Tuple[float, float]]:
    """
    Reproject a list of points from the dataset's projection to EPSG:4326.

    Args:
        dataset (xr.Dataset): The xarray Dataset containing the precipitation data.
        points (List[Tuple[float, float]]): List of tuples containing (x, y) coordinates.

    Returns:
        List[Tuple[float, float]]: List of reprojected (longitude, latitude) coordinates.
    """
    current_projection = get_precip_projection(dataset)
    target_projection = "EPSG:4326"
    transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
    reprojected_points = [transformer.transform(x, y) for x, y in points]
    return reprojected_points

def reproject_points_2d(
    dataset: xr.Dataset,
    points: List[List[Tuple[float, float]]],
) -> List[List[Tuple[float, float]]]:
    """
    Reproject a 2D list of points from the dataset's projection to EPSG:4326.

    Args:
        dataset (xr.Dataset): The xarray Dataset containing the precipitation data.
        points (List[List[Tuple[float, float]]]): 2D list of tuples containing (x, y) coordinates.

    Returns:
        List[List[Tuple[float, float]]]: 2D list of reprojected (longitude, latitude) coordinates.
    """
    current_projection = get_precip_projection(dataset)
    target_projection = "EPSG:4326"
    transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
    reprojected_points = [[transformer.transform(x, y) for x, y in row] for row in points]
    return reprojected_points

@cache
def get_forecasting_gridlines_vert_projected(
    scaleX: int = 16, scaleY: int = 16
) -> List[List[Tuple[float, float]]]:
    """
    Get vertical grid lines for the forecasting data projected to EPSG:5070.

    Returns:
        List[List[Tuple[float, float]]]: A list of lists containing tuples of (x, y) coordinates for vertical grid lines projected to EPSG:5070.
    """
    unprojected_gridlines = get_forecasting_gridlines_vert(scaleX=scaleX, scaleY=scaleY)
    current_projection = get_precip_projection(get_example_dataset())
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


def rescale_dataset(
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
    assert rescaled_dataset.RAINRATE.shape == rescaled_data.shape, (
        f"Rescaled dataset shape {rescaled_dataset.RAINRATE.shape} does not match rescaled data shape {rescaled_data.shape}."
    )
    return rescaled_dataset

@cache
def get_point_geometry(
    x: int,
    y: int,
    scaleX: int = 16,
    scaleY: int = 16,
)->List[Tuple[float, float]]:
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

def uncached_get_point_geometry(
    x: int,
    y: int,
    scaleX: int = 16,
    scaleY: int = 16,
)->List[Tuple[float, float]]:
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

if __name__ == "__main__":
    import time

    do_caching = True
    datasets: List[xr.Dataset] = []
    if do_caching:
        import pickle

        try:
            with open("./dist/forecasted_forcings_cache.pkl", "rb") as f:
                datasets = pickle.load(f)
            print(f"Loaded {len(datasets)} cached datasets.")
            got_data = True
        except FileNotFoundError:
            pass
    if not datasets:
        # Example usage
        start_date = "202301010000"  # January 1, 2023
        end_date = "202301010000"  # January 2, 2023
        t0 = time.perf_counter()
        datasets = load_forecasted_forcings(
            start_date=start_date,
            end_date=end_date,
            # fcst_cycle=[0, 6, 12, 18],
            # lead_times=[1, 2, 3],
            fcst_cycle=[0],
            # fcst_cycle=list(range(0, 5)),
            # fcst_cycle=list(range(0, 24)),
            lead_times=[1],
            parallel=True,
        )
        t1 = time.perf_counter()
        print(f"Loaded {len(datasets)} datasets in {t1 - t0:.2f} seconds")
        if do_caching:
            with open("./dist/forecasted_forcings_cache.pkl", "wb") as f:
                pickle.dump(datasets, f)
            print("Cached datasets to ./dist/forecasted_forcings_cache.pkl")

    rescale_test = False
    if rescale_test:
        # Test rescaling the dataset
        example_dataset = get_example_dataset()
        print(f"Example dataset loaded with shape: {example_dataset.RAINRATE.shape}")
        rescaled_dataset = rescale_dataset(example_dataset, scaleX=16, scaleY=16)
        print(f"Rescaled dataset shape: {rescaled_dataset.RAINRATE.shape}")
        print(example_dataset)
        print(rescaled_dataset)
        print(example_dataset.RAINRATE.shape)
        print(rescaled_dataset.RAINRATE.shape)

    grid_coordinate_test = False
    if grid_coordinate_test:
        # Test the x and y coordinates to see if they are evenly spaced, and by how much
        example_dataset = get_example_dataset()
        precip_data_np, x_coords, y_coords = get_dataset_precip(example_dataset)
        print(f"x_coords: {x_coords[:3]}... (total {len(x_coords)} points)")
        print(f"y_coords: {y_coords[:3]}... (total {len(y_coords)} points)")
        x_diff = np.diff(x_coords)
        y_diff = np.diff(y_coords)
        print(f"x_diff: {x_diff[:3]}... (total {len(x_diff)} points)")
        print(f"y_diff: {y_diff[:3]}... (total {len(y_diff)} points)")
        x_diff_set = set(x_diff)
        y_diff_set = set(y_diff)
        print(f"x_diff_set: {x_diff_set} (total {len(x_diff_set)} unique values)")
        print(f"y_diff_set: {y_diff_set} (total {len(y_diff_set)} unique values)")

        horiz_gridlines = get_forecasting_gridlines_horiz()
        print(
            f"Horizontal gridlines: {len(horiz_gridlines)} lines, each with {len(horiz_gridlines[0])} points."
        )
        print(f"First few points of the first horizontal gridline: {horiz_gridlines[0][:3]}")
        horiz_gridlines_projected = get_forecasting_gridlines_horiz_projected()
        print(
            f"Projected horizontal gridlines: {len(horiz_gridlines_projected)} lines, each with {len(horiz_gridlines_projected[0])} points."
        )
        print(
            f"First few points of the first projected horizontal gridline: {horiz_gridlines_projected[0][:3]}"
        )
        horiz_gridlines_firstline_diff = []
        for i in range(len(horiz_gridlines[0]) - 1):
            diff = (
                horiz_gridlines[0][i + 1][0] - horiz_gridlines[0][i][0],
                horiz_gridlines[0][i + 1][1] - horiz_gridlines[0][i][1],
            )
            horiz_gridlines_firstline_diff.append(diff)
        print(
            f"First horizontal gridline differences: {horiz_gridlines_firstline_diff[:3]}... (total {len(horiz_gridlines_firstline_diff)} differences)"
        )
        horiz_gridlines_projected_firstline_diff = []
        for i in range(len(horiz_gridlines_projected[0]) - 1):
            diff = (
                horiz_gridlines_projected[0][i + 1][0] - horiz_gridlines_projected[0][i][0],
                horiz_gridlines_projected[0][i + 1][1] - horiz_gridlines_projected[0][i][1],
            )
            horiz_gridlines_projected_firstline_diff.append(diff)
        print(
            f"First projected horizontal gridline differences: {horiz_gridlines_projected_firstline_diff[:3]}... (total {len(horiz_gridlines_projected_firstline_diff)} differences)"
        )

    wkt_crs_test = False
    if wkt_crs_test:
        # Get dataset's projection method, to see if we can convert it to another system
        first_dataset = datasets[0]
        print(f"First dataset loaded with type: {type(first_dataset)=}")
        print(f"First dataset dimensions: {first_dataset.dims=}")
        print(f"First dataset variables: {list(first_dataset.data_vars)=}")
        print(f"First dataset attributes: {first_dataset.attrs=}")
        fst_rainrate: xr.DataArray = first_dataset.RAINRATE
        print(f"First rainrate loaded with shape: {fst_rainrate.shape=}")
        fst_rainrate_attrs = fst_rainrate.attrs
        # print("First rainrate attributes:")
        # for key, value in fst_rainrate_attrs.items():
        #     print(f"  {key}: {value}")
        fst_rainrate_esri_pe = fst_rainrate_attrs["esri_pe_string"]
        print(f"First rainrate esri_pe_string: {fst_rainrate_esri_pe=}")
        import pyproj
        import geopandas as gpd

        target_crs = "EPSG:5070"
        current_crs = pyproj.CRS.from_string(fst_rainrate_esri_pe)
        print(f"Current CRS: {current_crs}")
        print(f"Target CRS: {target_crs}")
        # Verify the current CRS is valid by transforming a point
        test_point = (fst_rainrate.x.values[0], fst_rainrate.y.values[0])
        print(f"Test point in current CRS: {test_point}")
        transformer = pyproj.Transformer.from_crs(current_crs, target_crs, always_xy=True)
        transformed_point = transformer.transform(*test_point)
        print(f"Transformed point in target CRS: {transformed_point}")
        first_column_points = [
            (fst_rainrate.x.values[x], fst_rainrate.y.values[0])
            for x in range(fst_rainrate.shape[1])
        ]
        print(
            f"First column points in current CRS: {first_column_points[:3]}... (total {len(first_column_points)} points)"
        )
        transformed_first_column_points = [
            transformer.transform(*point) for point in first_column_points
        ]
        print(
            f"Transformed first column points in target CRS: {transformed_first_column_points[:3]}... (total {len(transformed_first_column_points)} points)"
        )

        # Check the grid functions
        # >.... it is crashing when trying to access the grid,..
        # Let's estimate the memory usage of the grid
        grid_memory_usage = (
            fst_rainrate.shape[0] * fst_rainrate.shape[1] * fst_rainrate.shape[2] * 4
        )  # 4 bytes per float32
        # however, it's not just float32s, it's a tuple of (x, y) coordinates,
        # which is two float64s (8 bytes each)
        # so we need to multiply by (8 + 8) / 4 = 4
        # grid_memory_usage *= 4
        mem_usage_kb = grid_memory_usage / 1024
        mem_usage_mb = mem_usage_kb / 1024
        mem_usage_gb = mem_usage_mb / 1024
        if mem_usage_gb > 1:
            print(f"Estimated memory usage of the grid: {mem_usage_gb:.2f} GB")
        elif mem_usage_mb > 1:
            print(f"Estimated memory usage of the grid: {mem_usage_mb:.2f} MB")
        elif mem_usage_kb > 1:
            print(f"Estimated memory usage of the grid: {mem_usage_kb:.2f} KB")
        else:
            print(f"Estimated memory usage of the grid: {grid_memory_usage} bytes")
        # grid = get_forecasting_grid()
        # print(f"Grid has {len(grid)} rows and {len(grid[0])} columns.")
        # print(f"First few grid coordinates: {grid[0][:3]}")
        # projected_grid = get_forecasting_grid_projected()
        # print(
        #     f"Projected grid has {len(projected_grid)} rows and {len(projected_grid[0])} columns."
        # )
        # print(f"First few projected grid coordinates: {projected_grid[0][:3]}")

    access_test = False
    if access_test:
        # Verify accessing individual values
        first_dataset = datasets[0]
        print(f"First dataset loaded with type: {type(first_dataset)=}")
        print(f"First dataset dimensions: {first_dataset.dims=}")
        print(f"First dataset variables: {list(first_dataset.data_vars)=}")
        fst_rainrate: xr.DataArray = first_dataset.RAINRATE
        print(f"First rainrate loaded with shape: {fst_rainrate.shape=}")
        rainrate_test0 = fst_rainrate[0]
        print(f"Test access 0: {rainrate_test0=}, type: {type(rainrate_test0)=}")
        # Interesting!! It reduced the shape (1, 3840, 4608) to (3840, 4608)!
        # It simplifies away the redundant time dimension!
        rainrate_test1 = fst_rainrate[0, 0, 0]
        print(f"Test access 1: {rainrate_test1=}, type: {type(rainrate_test1)=}")
        # It's a 4B xarray.DataArray with a single float value?
        # How do we get the value out of it? xarray.DataArray does not have a .item() method.
        rainrate_test2 = rainrate_test1.values
        print(f"Test access 2: {rainrate_test2=}, type: {type(rainrate_test2)=}")
        # It's a numpy ndarray with a single float value...
        rainrate_test3 = rainrate_test2.item()
        print(f"Test access 3: {rainrate_test3=}, type: {type(rainrate_test3)=}")

        # try making an 'access function'
        def access_rainrate(
            dataset: xr.Dataset, time_index: int, x_index: int, y_index: int
        ) -> float:
            """
            Access the rainrate value at specified indices in the dataset.

            Args:
                dataset (xr.Dataset): The xarray Dataset containing the rainrate data.
                time_index (int): The index of the time dimension.
                x_index (int): The index of the x dimension.
                y_index (int): The index of the y dimension.

            Returns:
                float: The rainrate value at the specified indices.
            """
            return dataset.RAINRATE[time_index, x_index, y_index].values.item()

        # Is this necessary in practice? Probably not, as long as we remember to use .values.item() when accessing individual values.

        # Once we've converted the data to numpy, can we still access the x and y coordinates?
        # Let's test.
        xr_subset_0 = fst_rainrate[0, 0:10, 0:10]  # Get a subset of the data
        print(f"Subset shape: {xr_subset_0.shape}")
        # Now convert to numpy
        np_subset_0 = xr_subset_0.values  # Convert to numpy array
        print(f"Numpy subset shape: {np_subset_0.shape}")
        # Can we still access the x and y coordinates? What does the object contain?
        print(f"Numpy subset type: {type(np_subset_0)}")
        print(f"Numpy subset data: {np_subset_0[:3, :3]}")
        # No x or y coordinates... Can we get them by accessing in a different way?
        test0 = fst_rainrate[0].x
        print(f"{test0=}, type: {type(test0)=}")
        test1 = fst_rainrate[0].x.values
        print(f"{test1=}, type: {type(test1)=}")
        test2 = fst_rainrate[0].y
        print(f"{test2=}, type: {type(test2)=}")
        test3 = fst_rainrate[0].y.values
        print(f"{test3=}, type: {type(test3)=}")

    access_timing_test = False
    if access_timing_test:
        fst_rainrate = datasets[0].RAINRATE
        # Actually. Is this a good way to do this? Let's compare individual access vs whole array access when iterating over the dataset.
        # Let's time it!
        t0 = time.perf_counter()
        last_printed_time = t0
        print("Starting individual access test...")
        indiv_values_0 = []
        total_values = fst_rainrate.shape[1] * fst_rainrate.shape[2]
        print(f"Total values to access: {total_values}")

        def estimated_time_remaining(start_time: float, total: int, amount_done: int) -> float:
            elapsed = time.perf_counter() - start_time
            if amount_done == 0:
                return float("inf")
            rate = elapsed / amount_done
            remaining = total - amount_done
            return remaining * rate

        for x in range(fst_rainrate.shape[1]):
            if time.perf_counter() - last_printed_time > 1:
                print(f"Accessing {x}th x index at {time.perf_counter() - t0:.2f} seconds")
                estimated_time = estimated_time_remaining(t0, total_values, len(indiv_values_0))
                if estimated_time > 180:
                    print(
                        f"Estimated time ({estimated_time:.2f} seconds) exceeds 3 minutes, stopping early."
                    )
                    break
                print(f"Estimated time remaining: {estimated_time:.2f} seconds")
                last_printed_time = time.perf_counter()
            for y in range(fst_rainrate.shape[2]):
                if time.perf_counter() - last_printed_time > 1:
                    print(
                        f"Accessing {x},{y}th (x,y) index at {time.perf_counter() - t0:.2f} seconds"
                    )
                    estimated_time = estimated_time_remaining(t0, total_values, len(indiv_values_0))
                    if estimated_time > 180:
                        print(
                            f"Estimated time ({estimated_time:.2f} seconds) exceeds 3 minutes, stopping early."
                        )
                        break
                    print(f"Estimated time remaining: {estimated_time:.2f} seconds")
                    last_printed_time = time.perf_counter()
                value = fst_rainrate[0, x, y].values.item()
                indiv_values_0.append(value)
        t1 = time.perf_counter()
        print(f"Time taken for individual access: {t1 - t0:.2f} seconds")
        t2 = time.perf_counter()
        # Now let's access the whole array at once
        whole_array = fst_rainrate[0].values  # This gets the whole array for the first time step
        last_printed_time = t2
        print("Starting whole array access test...")
        whole_values_0 = []
        for x in range(whole_array.shape[0]):
            if time.perf_counter() - last_printed_time > 1:
                print(f"Accessing {x}th x index at {time.perf_counter() - t2:.2f} seconds")
                last_printed_time = time.perf_counter()
            for y in range(whole_array.shape[1]):
                if time.perf_counter() - last_printed_time > 1:
                    print(
                        f"Accessing {x},{y}th (x,y) index at {time.perf_counter() - t2:.2f} seconds"
                    )
                    last_printed_time = time.perf_counter()
                value = whole_array[x, y].item()
                whole_values_0.append(value)
        t3 = time.perf_counter()
        print(f"Time taken for whole array access: {t3 - t2:.2f} seconds")

    do_timetest = False
    if do_timetest:

        def timetest_grab_ns(num: int) -> int:
            before = time.perf_counter_ns()
            test_date = "202301010000"
            test_dataset = load_forecasted_forcings(
                start_date=test_date,
                end_date=test_date,
                fcst_cycle=list(range(0, num + 1)),
                lead_times=[1],
                parallel=True,
            )
            after = time.perf_counter_ns()
            print(f"Finished loading {num}")
            return after - before

        # timetests = [timetest_grab_ns(i) for i in range(0, 24)]
        # from matplotlib import pyplot as plt

        # timetests = [i / 1e6 for i in timetests]  # Convert to milliseconds
        # plt.plot(timetests)
        # plt.xlabel("Number of Forecast Cycles")
        # plt.ylabel("Time (ms)")
        # plt.title("Time to Load Forecasted Forcings vs. Number of Forecast Cycles")
        # plt.grid()
        # plt.savefig("dist/forecasted_forcings_load_time.png")

        # print(datasets[0])  # Print the first dataset for verification
        # print(datasets[1])  # Print the first dataset for verification

        # Check that single dataset loading works
        # single_dataset = load_forecasted_forcing(
        #     date="202301010000",
        # )
        # print(f"Single dataset loaded: {single_dataset}")

        # print(f"Merging datasets...")
        # t2 = time.perf_counter()
        # merged_dataset = merge_datasets(datasets)
        # t3 = time.perf_counter()
        # print(f"Merged dataset created in {t3 - t2:.2f} seconds")
        # print(merged_dataset)  # Print the merged dataset for verification
        # print(f"Total time taken: {t3 - t0:.2f} seconds")

    test_geometry = True
    if test_geometry:
        scaleX = 16
        scaleY = 16
        example_dataset0 = get_example_dataset_rescaled(scaleX=scaleX, scaleY=scaleY)
        # Need to time how long it takes to generate the geometry for a point
        t0 = time.perf_counter()
        num_points_to_test = 100
        geometries = []
        for i in range(num_points_to_test):
            geom = get_point_geometry(x=i, y=i, scaleX=scaleX, scaleY=scaleY)
            geometries.append(geom)
        t1 = time.perf_counter()
        print(
            f"Generated {num_points_to_test} point geometries in {t1 - t0:.2f} seconds, average {((t1 - t0) / num_points_to_test)*1000:.2f} ms per geometry."
        )
        total_points = example_dataset0.RAINRATE.shape[1] * example_dataset0.RAINRATE.shape[2]
        print(
            f"Total points in the dataset: {total_points}, estimated time to generate all geometries: {(t1 - t0) / num_points_to_test * total_points / 60:.2f} minutes."
        )
        def estimate_geom_method(method_name: str, method: Callable) -> Tuple[float, float]:
            """Test a point geometry method and estimate time to run on full dataset."""
            t0 = time.perf_counter()
            num_points_to_test = 100
            geometries = []
            xpoints_to_test = np.random.randint(0, example_dataset0.RAINRATE.shape[2], num_points_to_test)
            ypoints_to_test = np.random.randint(0, example_dataset0.RAINRATE.shape[1], num_points_to_test)
            for i in range(num_points_to_test):
                # geom = method(x=i, y=i, scaleX=scaleX, scaleY=scaleY)
                geom = method(x=xpoints_to_test[i], y=ypoints_to_test[i], scaleX=scaleX, scaleY=scaleY)
                geometries.append(geom)
            t1 = time.perf_counter()
            total_points = example_dataset0.RAINRATE.shape[1] * example_dataset0.RAINRATE.shape[2]
            estimated_total_time = (t1 - t0) / num_points_to_test * total_points
            return (t1 - t0) / num_points_to_test, estimated_total_time / 60
        avg_time, est_total_time = estimate_geom_method("get_point_geometry", get_point_geometry)
        print(
            f"get_point_geometry: average {avg_time*1000:.2f} ms per geometry, estimated time to generate all geometries: {est_total_time:.2f} minutes."
        )
        avg_time, est_total_time = estimate_geom_method("uncached_get_point_geometry", uncached_get_point_geometry)
        print(
            f"uncached_get_point_geometry: average {avg_time*1000:.2f} ms per geometry, estimated time to generate all geometries: {est_total_time:.2f} minutes."
        )
        # Something strange is happening. It's zero both times.
        # Let's try actually running the full dataset.
        all_geometries = []
        t2 = time.perf_counter()
        for y in range(example_dataset0.RAINRATE.shape[1]):
            for x in range(example_dataset0.RAINRATE.shape[2]):
                geom = get_point_geometry(x=x, y=y, scaleX=scaleX, scaleY=scaleY)
                all_geometries.append(geom)
        t3 = time.perf_counter()
        print(
            f"Generated all {len(all_geometries)} point geometries in {t3 - t2:.2f} seconds, average {((t3 - t2) / len(all_geometries))*1000:.2f} ms per geometry."
        )
        print(
            f"First few geometries: {all_geometries[:3]}"
        )