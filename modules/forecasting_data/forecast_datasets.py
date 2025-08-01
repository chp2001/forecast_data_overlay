from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from typing import List, Optional, Dict
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

    access_test = True
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
