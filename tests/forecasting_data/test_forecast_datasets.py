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

from forecasting_data.forecast_datasets import load_dataset_from_json

if __name__ == "__main__":
    test_crs_accessibility = False
    if test_crs_accessibility:
        from forecasting_data.show_util import show

        valid_combinations = []
        valid_datasets = []
        invalid_combinations = []
        # Iterate through the types of datasets and check what attributes are available
        # for run in NWMRun:
        for run in [NWMRun.SHORT_RANGE]:  # MEDIUM_RANGE etc seem to have strange properties
            for var in NWMVar:
                for geo in NWMGeo:
                    print(f"Testing {run}, {var}, {geo}")
                    file_list = create_default_file_list(
                        runinput=run,
                        varinput=var,
                        geoinput=geo,
                        start_date="202301010000",
                        end_date="202301010000",
                        fcst_cycle=[0],
                        lead_time=[1],
                    )
                    file_list = append_jsons(file_list=file_list)
                    if not file_list:
                        print(f"No files found for {run}, {var}, {geo}")
                        continue
                    try:
                        dataset = load_dataset_from_json(file_list[0])
                        print(f"\tDataset loaded with type: {type(dataset)=}")
                        valid_combinations.append((run, var, geo))
                        valid_datasets.append(dataset)
                    except FileNotFoundError:
                        print(f"File not found for {run}, {var}, {geo}")
                        invalid_combinations.append((run, var, geo))
                        continue
                    # print(f"{dataset.dims=}")
                    # print(f"{dataset.coords=}")
                    # print(f"{dataset.data_vars=}")
                    # print(f"{dataset.attrs=}")
                    # show(dataset)
                    show(dataset, prefix=f"{run}, {var}, {geo} - ")
        from pprint import pformat

        valid_combinations_str = f"Valid combinations:\n{pformat(valid_combinations)}"
        invalid_combinations_str = f"Invalid combinations:\n{pformat(invalid_combinations)}"
        show(valid_combinations_str)
        show(invalid_combinations_str)

        # Evaluate the present CRS parts
        for i in range(len(valid_datasets)):
            dataset = valid_datasets[i]
            key = f"{valid_combinations[i]}"
            dataset_crs = dataset.crs
            if dataset_crs is None:
                print(f"{key} - No CRS found in dataset.")
                continue
            show(dataset_crs, prefix=f"{key} - Dataset CRS: ")
