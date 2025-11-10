from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from typing import List, Optional, Dict, Tuple, Callable, Union
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
    # ds_df = ds.RAINRATE[:, 0:2000, 0:2000].to_dataframe()
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


def get_dataset_projection(dataset: xr.Dataset) -> str:
    """
    Get the projection string from the dataset's attributes.

    Args:
        dataset (xr.Dataset): The xarray Dataset to extract the projection from.

    Returns:
        str: The projection string, or None if not found.
    """
    # if "crs" not in dataset.data_vars.keys():
    #     print(f"{dataset.data_vars=}")
    # Dataset does not always have a 'crs' variable. Sometimes it has an equivalent 'ProjectionCoordinateSystem' attribute.
    dataset_crs = dataset.crs if "crs" in dataset else dataset.ProjectionCoordinateSystem
    if dataset_crs is None:
        raise ValueError("Dataset does not have a 'crs' attribute.")
    esri_pe_string = dataset_crs.attrs.get("esri_pe_string")
    if esri_pe_string is None:
        raise ValueError("Dataset 'crs' does not have 'esri_pe_string' attribute.")
    return esri_pe_string


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
    current_projection = get_dataset_projection(dataset)
    target_projection = "EPSG:4326"
    transformer = pyproj.Transformer.from_crs(current_projection, target_projection, always_xy=True)
    reprojected_points = [transformer.transform(x, y) for x, y in points]
    return reprojected_points


def reproject_points_2d(
    dataset: Union[xr.Dataset, pyproj.Transformer],
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
    if isinstance(dataset, xr.Dataset):
        current_projection = get_dataset_projection(dataset)
        target_projection = "EPSG:4326"
        transformer = pyproj.Transformer.from_crs(
            current_projection, target_projection, always_xy=True
        )
    elif isinstance(dataset, pyproj.Transformer):
        transformer = dataset
    else:
        raise ValueError("dataset must be either an xarray.Dataset or a pyproj.Transformer")
    reprojected_points = [[transformer.transform(x, y) for x, y in row] for row in points]
    return reprojected_points
