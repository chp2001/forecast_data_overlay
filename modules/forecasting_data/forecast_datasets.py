from __future__ import annotations
from typing import List, Optional, Dict
import xarray as xr
import fsspec
import ujson
import psutil
import joblib
import os
from kerchunk.combine import MultiZarrToZarr
import glob

from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import create_default_file_list, append_jsons
from data_processing.dask_utils import use_cluster

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
    with fsspec.open(file_path, 'r') as f:
        data = ujson.load(f)
    backend_args = {
        "consolidated": False,
        "storage_options": {
            "fo": data,
        },
    }
    return xr.open_dataset(
        'reference://',
        engine='zarr',
        backend_kwargs=backend_args,
        chunks="auto",
    )
    

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
        backend='threading',
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
    assert len(file_list) == 1, f"Expected exactly one file for the specified parameters, got {len(file_list)}."
    # Append .json to the file urls
    file_list = append_jsons(file_list)
    
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
    
if __name__ == "__main__":
    import time
    # Example usage
    start_date = "202301010000" # January 1, 2023
    end_date = "202301020000" # January 2, 2023
    t0 = time.perf_counter()
    datasets = load_forecasted_forcings(
        start_date=start_date,
        end_date=end_date,
        # fcst_cycle=[0, 6, 12, 18],
        # lead_times=[1, 2, 3],
        fcst_cycle=[0],
        lead_times=[1],
        parallel=True,
    )
    t1 = time.perf_counter()
    print(f"Loaded {len(datasets)} datasets in {t1 - t0:.2f} seconds")
    # print(datasets[0])  # Print the first dataset for verification
    # print(datasets[1])  # Print the first dataset for verification
    
    # Check that single dataset loading works
    single_dataset = load_forecasted_forcing(
        date="202301010000",
    )
    print(f"Single dataset loaded: {single_dataset}")
    
    # print(f"Merging datasets...")
    # t2 = time.perf_counter()
    # merged_dataset = merge_datasets(datasets)
    # t3 = time.perf_counter()
    # print(f"Merged dataset created in {t3 - t2:.2f} seconds")
    # print(merged_dataset)  # Print the merged dataset for verification
    # print(f"Total time taken: {t3 - t0:.2f} seconds")