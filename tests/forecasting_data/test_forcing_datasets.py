from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from pathlib import Path
from typing import List, Optional, Dict, Tuple, Callable, TypeAlias
import xarray as xr
import os
import time
import numpy as np
from numpy import isclose
import pickle
import pyproj
from functools import cache
from time import perf_counter

from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import create_default_file_list, append_jsons
from forecasting_data.forecast_datasets import (
    load_datasets,
    load_datasets_parallel,
    reproject_points_2d,
)
from forecasting_data.forcing_datasets import (
    load_forecasted_forcings,
    get_example_forcing_dataset,
    get_example_forcing_dataset_raw,
    get_example_forcing_dataset_rescaled,
    rescale_precip_dataset,
    get_dataset_precip,
    get_conus_forcing_gridlines_horiz,
    get_conus_forcing_gridlines_horiz_projected,
    get_point_geometry,
    uncached_get_point_geometry,
)


def test_get_cached_datasets() -> List[xr.Dataset]:
    datasets: List[xr.Dataset] = []
    try:
        os.makedirs("./dist/", exist_ok=True)
        with open("./dist/forecasted_forcings_cache.pkl", "rb") as f:
            datasets = pickle.load(f)
        print(f"Loaded {len(datasets)} cached datasets.")
    except FileNotFoundError:
        pass
    return datasets


def test_cache_datasets(datasets: List[xr.Dataset]) -> None:
    os.makedirs("./dist/", exist_ok=True)
    with open("./dist/forecasted_forcings_cache.pkl", "wb") as f:
        pickle.dump(datasets, f)
    print("Cached datasets to ./dist/forecasted_forcings_cache.pkl")


def test_get_dataset_test_cases() -> List[Tuple[List[int], List[int], str]]:
    test_cases = [
        ([1], [0], "Single forecast cycle, single lead time"),
        ([1, 2, 3], [0], "Single forecast cycle, multiple (3) lead times"),
        ([1], list(range(0, 5)), "Multiple (5) forecast cycles, single lead time"),
        ([1, 2, 3], list(range(0, 5)), "Multiple (5) forecast cycles, multiple (3) lead times"),
        ([1], list(range(0, 24)), "Multiple (24) forecast cycles, single lead time"),
        ([1, 2, 3], list(range(0, 24)), "Multiple (24) forecast cycles, multiple (3) lead times"),
    ]
    return test_cases


def test_case_get_expected_dataset_count(fcst_cycle: List[int], lead_times: List[int]) -> int:
    return len(fcst_cycle) * len(lead_times)


def test_make_datasets_for_cache(test_ind: int) -> List[xr.Dataset]:
    # Example usage
    start_date = "202301010000"  # January 1, 2023
    end_date = "202301010000"  # January 2, 2023
    test_cases = test_get_dataset_test_cases()
    if test_ind < 0 or test_ind >= len(test_cases):
        raise ValueError(f"Invalid test_ind {test_ind}, must be between 0 and {len(test_cases)-1}")
    fcst_cycle, lead_times, case_desc = test_cases[test_ind]
    print(f"Making datasets for cache test case {test_ind}: {case_desc}")
    t0 = perf_counter()
    datasets = load_forecasted_forcings(
        start_date=start_date,
        end_date=end_date,
        fcst_cycle=fcst_cycle,
        lead_times=lead_times,
        parallel=True,
    )
    t1 = perf_counter()
    print(f"Loaded {len(datasets)} datasets in {t1 - t0:.2f} seconds")
    return datasets


def test_get_cache_datasets_or_make(test_ind: int) -> List[xr.Dataset]:
    datasets = test_get_cached_datasets()
    need_remake = False
    if not datasets:
        need_remake = True
    else:
        test_cases = test_get_dataset_test_cases()
        if test_ind < 0 or test_ind >= len(test_cases):
            raise ValueError(
                f"Invalid test_ind {test_ind}, must be between 0 and {len(test_cases)-1}"
            )
        fcst_cycle, lead_times, case_desc = test_cases[test_ind]
        expected_count = test_case_get_expected_dataset_count(fcst_cycle, lead_times)
        if len(datasets) != expected_count:
            print(
                f"Cached dataset count {len(datasets)} does not match expected {expected_count} for test case {test_ind}: {case_desc}, remaking datasets."
            )
            need_remake = True
    if need_remake:
        datasets = test_make_datasets_for_cache(test_ind)
        test_cache_datasets(datasets)
    return datasets


if __name__ == "__main__":

    test_dataset_ind = 0  # Change this index to test different dataset configurations
    datasets = test_get_cache_datasets_or_make(test_ind=test_dataset_ind)
    show_datasets = False  # Set to True to print dataset info
    rescale_test = False  # Set to True to test rescaling functionality
    grid_coordinate_test = False  # Set to True to test grid coordinate spacing
    wkt_crs_test = False  # Set to True to test WKT CRS extraction and transformation
    access_test = False  # Set to True to test accessing individual values in the dataset
    access_timing_test = False  # Set to True to time access methods
    do_timetest = False  # Set to True to run timetests on loading datasets
    test_geometry = False  # Set to True to test point geometry generation
    dataset_get_raw_test = False  # Set to True to test getting raw dataset multiple times
    dataset_clipping_test = True  # Set to True to test dataset clipping and rescaling

    if show_datasets:
        for i, dataset in enumerate(datasets):
            print(f"Dataset {i}:")
            print(f"  Dimensions: {dataset.dims=} ({type(dataset.dims)=})")
            dataset_vars = dataset.data_vars
            print(f"  Variables: {list(dataset_vars)=} ({type(dataset_vars)=})")
            print(f"  Attributes: {dataset.attrs=}")

    if rescale_test:
        # Test rescaling the dataset
        example_dataset = get_example_forcing_dataset()
        print(f"Example dataset loaded with shape: {example_dataset.RAINRATE.shape}")
        rescaled_dataset = rescale_precip_dataset(example_dataset, scaleX=16, scaleY=16)
        print(f"Rescaled dataset shape: {rescaled_dataset.RAINRATE.shape}")
        print(example_dataset)
        print(rescaled_dataset)
        print(example_dataset.RAINRATE.shape)
        print(rescaled_dataset.RAINRATE.shape)

    if grid_coordinate_test:
        # Test the x and y coordinates to see if they are evenly spaced, and by how much
        example_dataset = get_example_forcing_dataset()
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

        horiz_gridlines = get_conus_forcing_gridlines_horiz()
        print(
            f"Horizontal gridlines: {len(horiz_gridlines)} lines, each with {len(horiz_gridlines[0])} points."
        )
        print(f"First few points of the first horizontal gridline: {horiz_gridlines[0][:3]}")
        horiz_gridlines_projected = get_conus_forcing_gridlines_horiz_projected()
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

    if test_geometry:
        scaleX = 16
        scaleY = 16
        example_dataset0 = get_example_forcing_dataset_rescaled(scaleX=scaleX, scaleY=scaleY)
        # Need to time how long it takes to generate the geometry for a point
        t0 = time.perf_counter()
        num_points_to_test = 100
        geometries = []
        for i in range(num_points_to_test):
            geom = get_point_geometry(x=i, y=i, scaleX=scaleX, scaleY=scaleY)
            geometries.append(geom)
        t1 = time.perf_counter()
        print(
            f"Generated {num_points_to_test} point geometries in {t1 - t0:.2f} seconds, average {((t1 - t0) / num_points_to_test) * 1000:.2f} ms per geometry."
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
            xpoints_to_test = np.random.randint(
                0, example_dataset0.RAINRATE.shape[2], num_points_to_test
            )
            ypoints_to_test = np.random.randint(
                0, example_dataset0.RAINRATE.shape[1], num_points_to_test
            )
            for i in range(num_points_to_test):
                # geom = method(x=i, y=i, scaleX=scaleX, scaleY=scaleY)
                geom = method(
                    x=xpoints_to_test[i], y=ypoints_to_test[i], scaleX=scaleX, scaleY=scaleY
                )
                geometries.append(geom)
            t1 = time.perf_counter()
            total_points = example_dataset0.RAINRATE.shape[1] * example_dataset0.RAINRATE.shape[2]
            estimated_total_time = (t1 - t0) / num_points_to_test * total_points
            return (t1 - t0) / num_points_to_test, estimated_total_time / 60

        avg_time, est_total_time = estimate_geom_method("get_point_geometry", get_point_geometry)
        print(
            f"get_point_geometry: average {avg_time * 1000:.2f} ms per geometry, estimated time to generate all geometries: {est_total_time:.2f} minutes."
        )
        avg_time, est_total_time = estimate_geom_method(
            "uncached_get_point_geometry", uncached_get_point_geometry
        )
        print(
            f"uncached_get_point_geometry: average {avg_time * 1000:.2f} ms per geometry, estimated time to generate all geometries: {est_total_time:.2f} minutes."
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
            f"Generated all {len(all_geometries)} point geometries in {t3 - t2:.2f} seconds, average {((t3 - t2) / len(all_geometries)) * 1000:.2f} ms per geometry."
        )
        print(f"First few geometries: {all_geometries[:3]}")

    if dataset_get_raw_test:
        # Verify that getting the dataset raw will take the same amount of time each time
        def time_getting_raw_dataset() -> float:
            t0 = time.perf_counter()
            dataset = get_example_forcing_dataset_raw(quiet=True)
            t1 = time.perf_counter()
            # print(f"Raw dataset loaded with shape: {dataset.RAINRATE.shape}")
            return t1 - t0

        time_limit = 10.0  # seconds
        num_tests_limit = 100  # maximum number of tests to run in case they are very fast
        times = []
        before_test = time.perf_counter()
        while True:
            start_of_loop = time.perf_counter()
            if start_of_loop - before_test > time_limit:
                break
            elif len(times) >= num_tests_limit:
                break
            time_taken = time_getting_raw_dataset()
            print(f"Test {len(times) + 1}: {time_taken:.2f} seconds")
            times.append(time_taken)
        time_array = np.array(times)
        avg_time = np.mean(time_array)
        std_time = np.std(time_array)
        var_time = np.var(time_array)
        sub_avg = time_array - avg_time
        abs_sub_avg = np.abs(sub_avg)
        max_deviation = np.max(abs_sub_avg)
        min_deviation = np.min(abs_sub_avg)
        min_time = np.min(time_array)
        max_time = np.max(time_array)
        print(f"Ran {len(times)} tests in {time.perf_counter() - before_test:.2f} seconds")
        print(f"Average time to get raw dataset: {avg_time:.2f} seconds")
        print(f"Standard deviation of time: {std_time:.2f} seconds")
        print(f"Variance of time: {var_time:.4f} seconds^2")
        print(f"Maximum deviation from average: {max_deviation:.2f} seconds")
        print(f"Minimum deviation from average: {min_deviation:.2f} seconds")
        print(f"Minimum time: {min_time:.2f} seconds")
        print(f"Maximum time: {max_time:.2f} seconds")

    if dataset_clipping_test:
        from forecasting_data.show_util import show

        def get_dataset_shape(dataset: xr.Dataset) -> Tuple[int, int]:
            """
            Get the shape of the dataset as (height, width).

            Args:
                dataset (xr.Dataset): The xarray Dataset to get the shape of.
            Returns:
                Tuple[int, int]: A tuple containing the height and width of the dataset.
            """
            height = dataset.sizes["y"]
            width = dataset.sizes["x"]
            return (height, width)

        def clip_data_array_to_bbox(
            data_array: xr.DataArray, left: int, right: int, bottom: int, top: int
        ) -> xr.DataArray:
            """
            Clip the data array to the specified bounding box.

            Args:
                data_array (xr.DataArray): The xarray DataArray to clip.
                left (int): The left boundary (starting column index).
                right (int): The right boundary (end column index exclusive).
                bottom (int): The bottom boundary (starting row index).
                top (int): The top boundary (end row index exclusive).
            Returns:
                xr.DataArray: The clipped xarray DataArray.
            """
            before_dims = data_array.dims
            before_sizes = data_array.sizes
            clipped_data = data_array[:, bottom:top, left:right]
            after_dims = clipped_data.dims
            after_sizes = clipped_data.sizes
            print(f"Clipped data from dims {before_dims} to {after_dims}")
            print(f"Clipped data from sizes {before_sizes} to {after_sizes}")
            return clipped_data

        def rescale_data_array(data_array: xr.DataArray, scaleX: int, scaleY: int) -> xr.DataArray:
            """
            Rescale the data array by the specified factors.

            Args:
                data_array (xr.DataArray): The xarray DataArray to rescale.
                scaleX (int): The factor by which to rescale the x dimension.
                scaleY (int): The factor by which to rescale the y dimension.
            Returns:
                xr.DataArray: The rescaled xarray DataArray.
            """
            before_dims = data_array.dims
            before_sizes = data_array.sizes
            # Use coarsen to downsample the data array
            rescaled_data: xr.DataArray = data_array.coarsen(
                x=scaleX, y=scaleY, boundary="trim"
            ).mean()
            after_dims = rescaled_data.dims
            after_sizes = rescaled_data.sizes
            print(f"Rescaled data from dims {before_dims} to {after_dims}")
            print(f"Rescaled data from sizes {before_sizes} to {after_sizes}")
            return rescaled_data

        def false_view_data(data_array: xr.DataArray) -> xr.DataArray:
            """
            Force the computation of the data array by iterating over it.
            Args:
                data_array (xr.DataArray): The xarray DataArray to force computation on.
            Returns:
                xr.DataArray: The same xarray DataArray, but with data computed.
            """
            # Iterate over the data array to force computation
            sizes = data_array.sizes

            def next_index(sizes: Dict[str, int], current: Dict[str, int]) -> Dict[str, int]:
                keys = list(sizes.keys())
                next_indices = current.copy()
                enumerated = list(enumerate(keys))
                for i, key in reversed(enumerated):
                    # Try incrementing the rightmost index first
                    if next_indices[key] + 1 >= sizes[key]:
                        # It would overflow, so set it to 0 and carry the increment to the next index
                        next_indices[key] = 0
                        continue
                    else:
                        next_indices[key] += 1
                        return next_indices
                # If we get here, we've overflowed all indices and set them all to 0
                return None

            current_index = {key: 0 for key in sizes.keys()}
            while current_index is not None:
                val = data_array[tuple(current_index.values())]
                current_index = next_index(sizes, current_index)
            return data_array

        before_dataset_clipping_test = time.perf_counter()
        example_dataset = get_example_forcing_dataset_raw()
        after_raw = time.perf_counter()
        print(
            f"Loaded raw example dataset in {after_raw - before_dataset_clipping_test:.2f} seconds"
        )
        print(f"Raw dataset shape: {get_dataset_shape(example_dataset)}")
        after_shape = time.perf_counter()
        print(f"Got raw dataset shape in {after_shape - after_raw:.2f} seconds")
        example_rainrate: xr.DataArray = example_dataset["RAINRATE"]
        after_rainrate = time.perf_counter()
        print(f"Accessed RAINRATE in {after_rainrate - after_shape:.2f} seconds")
        clipped_dataset = clip_data_array_to_bbox(
            example_rainrate, left=1000, right=2000, bottom=1000, top=2000
        )
        after_clipping = time.perf_counter()
        print(f"Clipped data in {after_clipping - after_rainrate:.2f} seconds")

        # Want to evaluate if it's faster to clip then rescale, or rescale then clip...
        # Does rescaling load the full dataset into memory? Does clipping?
        def rescale_then_clip(
            data_array: xr.DataArray,
            scaleX: int,
            scaleY: int,
            left: int,
            right: int,
            bottom: int,
            top: int,
        ) -> xr.DataArray:
            rescaled = rescale_data_array(data_array, scaleX, scaleY)
            clipped = clip_data_array_to_bbox(
                rescaled, left // scaleX, right // scaleX, bottom // scaleY, top // scaleY
            )
            return clipped

        def clip_then_rescale(
            data_array: xr.DataArray,
            scaleX: int,
            scaleY: int,
            left: int,
            right: int,
            bottom: int,
            top: int,
        ) -> xr.DataArray:
            clipped = clip_data_array_to_bbox(data_array, left, right, bottom, top)
            rescaled = rescale_data_array(clipped, scaleX, scaleY)
            return rescaled

        scaleArg = {"scaleX": 16, "scaleY": 16}
        bboxArg = {"left": 1000, "right": 2000, "bottom": 1000, "top": 2000}

        def clip_then_rescale_test():
            data_for_test = get_example_forcing_dataset_raw()["RAINRATE"]
            t0 = time.perf_counter()
            result = clip_then_rescale(data_for_test, **scaleArg, **bboxArg)
            t1 = time.perf_counter()
            result_loaded = false_view_data(result)
            t2 = time.perf_counter()
            print(f"Clip then rescale took {t1 - t0:.2f} seconds")
            print(f"\tForced loading data took an additional {t2 - t1:.2f} seconds")
            print(f"\tTotal time: {t2 - t0:.2f} seconds")
            return result

        def rescale_then_clip_test():
            data_for_test = get_example_forcing_dataset_raw()["RAINRATE"]
            t0 = time.perf_counter()
            result = rescale_then_clip(data_for_test, **scaleArg, **bboxArg)
            t1 = time.perf_counter()
            result_loaded = false_view_data(result)
            t2 = time.perf_counter()
            print(f"Rescale then clip took {t1 - t0:.2f} seconds")
            print(f"\tForced loading data took an additional {t2 - t1:.2f} seconds")
            print(f"\tTotal time: {t2 - t0:.2f} seconds")
            return result

        print("Testing rescale then clip...")
        rescale_then_clip_result = rescale_then_clip_test()
        print("Testing clip then rescale...")
        clip_then_rescale_result = clip_then_rescale_test()
        print(f"Rescale then clip result shape: {rescale_then_clip_result.shape}")
        print(f"Clip then rescale result shape: {clip_then_rescale_result.shape}")

        print(f"Final time taken: {after_clipping - before_dataset_clipping_test:.2f} seconds")

        # Quickly check what iteration does...
        num_items = 0
        before_iter = time.perf_counter()
        for item in clip_then_rescale_result:
            if num_items < 1:
                print(f"\tIterated item: {item}")
                print(f"\tIterated item shape: {item.shape if hasattr(item, 'shape') else 'N/A'}")
                print(f"\tIterated item type: {type(item)}")
            num_items += 1
        after_iter = time.perf_counter()
        print(f"Total items iterated over: {num_items}")
        print(f"Time taken to iterate: {after_iter - before_iter:.2f} seconds")
