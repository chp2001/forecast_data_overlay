from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from typing import List, Optional, Dict, Set, Tuple, Callable
import xarray as xr
import os

from forecasting_data.urlgen_enums import NWMRun, NWMVar, NWMGeo, NWMMem
from forecasting_data.urlgen_builder import create_default_file_list, append_jsons
import numpy as np
import pickle
import pyproj
import sqlite3
from functools import cache

from forecasting_data.forecast_datasets import load_dataset_from_json
from data_processing.gpkg_utils import blob_to_geometry
from data_processing.file_paths import file_paths


if __name__ == "__main__":
    import time

    test_channel_routes = False
    if test_channel_routes:
        # Instead of forcing data, access the NWMVar.CHANNEL_RT
        # and inspect the data.

        # Load the list of routing files with one date
        routing_files = create_default_file_list(
            runinput=NWMRun.SHORT_RANGE,
            varinput=NWMVar.CHANNEL_RT,
            geoinput=NWMGeo.CONUS,
            start_date="202301010000",
            end_date="202301010000",
            fcst_cycle=[0],  # Only one cycle for testing
            lead_time=[1],  # Only one lead time for testing
        )
        # Append the .json suffix to the routing url to make it loadable
        routing_files = append_jsons(file_list=routing_files)
        # Get the first file for testing
        routing_file = routing_files[0]
        print(f"Routing file: {routing_file}")
        routing_test_cache_path = "./dist/routing_test_cache.pkl"
        try:
            with open(routing_test_cache_path, "rb") as f:
                routing_dataset = pickle.load(f)
            print(f"Loaded cached routing dataset from {routing_test_cache_path}")
        except FileNotFoundError:
            # Load the dataset
            routing_dataset = load_dataset_from_json(file_path=routing_file)
            print(f"Loaded routing dataset from {routing_file}")
            with open(routing_test_cache_path, "wb") as f:
                pickle.dump(routing_dataset, f)
            print(f"Cached routing dataset to {routing_test_cache_path}")
        print(f"Routing dataset loaded with type: {type(routing_dataset)=}")
        print(f"{routing_dataset.dims=}")
        print(f"{routing_dataset.coords=}")
        print(f"{routing_dataset.data_vars=}")
        print(f"{routing_dataset.attrs=}")
        routing_streamflow = routing_dataset["streamflow"]
        print(f"Routing streamflow loaded with shape: {routing_streamflow.shape}")
        print(f"{routing_streamflow.dims=}")
        print(f"{routing_streamflow.coords=}")
        print(f"{routing_streamflow.chunksizes=}")
        print(f"{routing_streamflow.attrs=}")

    test_channel_geometry = True
    if test_channel_geometry:
        # Test loading the channel geometry data from the GeoPackage
        # and mapping to the routing data.
        # This is a one-time operation to create a cache file for later use.
        start_time = time.time()
        geopackage_path = file_paths.conus_hydrofabric
        print(f"Loading GeoPackage from {geopackage_path}")
        with sqlite3.connect(geopackage_path) as conn:
            # Print the list of tables in the GeoPackage
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            print(f"Tables in GeoPackage: {tables}")
            # We don't know yet which table contains the channel geometry,
            # But there are some suspects:
            # - flowpaths
            # - hydrolocations
            # - rtree_flowpaths_geom
            # - rtree_flowpaths_geom_rowid (and other similar rtree tables)
            # Let's inspect the flowpaths table first -  what are the columns?
            cursor.execute("PRAGMA table_info(flowpaths);")
            flowpaths_info = cursor.fetchall()
            print(f"Flowpaths table info: {flowpaths_info}")
            # Flowpaths table info:
            # [(0, 'fid', 'INTEGER', 1, None, 1),
            # (1, 'geom', 'GEOMETRY', 0, None, 0),
            # (2, 'id', 'TEXT', 0, None, 0),
            # (3, 'toid', 'TEXT', 0, None, 0),
            # (4, 'mainstem', 'REAL', 0, None, 0),
            # (5, 'order', 'REAL', 0, None, 0),
            # (6, 'hydroseq', 'MEDIUMINT', 0, None, 0),
            # (7, 'lengthkm', 'REAL', 0, None, 0),
            # (8, 'areasqkm', 'REAL', 0, None, 0),
            # (9, 'tot_drainage_areasqkm', 'REAL', 0, None, 0),
            # (10, 'has_divide', 'BOOLEAN', 0, None, 0),
            # (11, 'divide_id', 'TEXT', 0, None, 0),
            # (12, 'poi_id', 'TEXT', 0, None, 0),
            # (13, 'vpuid', 'TEXT', 0, None, 0)]
            # Looks like it has a 'geom' column with the geometry,
            # the feature ID may be in 'id', 'fid', or 'divide_id'.
            # Given that the feature IDs we get in the routing data
            # is a float, it is likely in 'fid'.

            # Quickly get the number of rows in the flowpaths table
            cursor.execute("SELECT COUNT(*) FROM flowpaths;")
            row_count = cursor.fetchone()[0]
            print(f"Number of rows in flowpaths table: {row_count}")

            # Let's load the feature IDs from a channel routing dataset
            # and then verify that they are all present in the GeoPackage.
            # Load the list of routing files with one date
            routing_files = create_default_file_list(
                runinput=NWMRun.SHORT_RANGE,
                varinput=NWMVar.CHANNEL_RT,
                geoinput=NWMGeo.CONUS,
                start_date="202301010000",
                end_date="202301010000",
                fcst_cycle=[0],  # Only one cycle for testing
                lead_time=[1],  # Only one lead time for testing
            )
            # Append the .json suffix to the routing url to make it loadable
            routing_files = append_jsons(file_list=routing_files)
            # Get the first file for testing
            routing_file = routing_files[0]
            print(f"Routing file: {routing_file}")
            routing_dataset = load_dataset_from_json(file_path=routing_file)
            print(f"Routing dataset loaded with type: {type(routing_dataset)=}")
            print(f"{routing_dataset.dims=}")
            print(f"{routing_dataset.coords=}")
            print(f"{routing_dataset.data_vars=}")
            print(f"{routing_dataset.attrs=}")
            routing_streamflow = routing_dataset["streamflow"]
            print(f"Routing streamflow loaded with shape: {routing_streamflow.shape}")
            print(f"{routing_streamflow.dims=}")
            # The only dimension is 'feature_id',
            # which contains the feature IDs as floats.
            feature_ids: xr.DataArray = routing_streamflow.coords["feature_id"]
            print(f"Feature IDs loaded with shape: {feature_ids.shape}")
            # Get the feature IDs as a list of integers
            feature_ids_list = feature_ids.values.astype(int).tolist()
            print(f"Feature IDs: {feature_ids_list[:10]}... (total {len(feature_ids_list)})")
            # Now we can query the GeoPackage for these feature IDs
            # feature_ids_tuple = tuple(feature_ids_list)
            # Let's just grab the fids to verify they are present. geoms are not needed yet.
            # if len(feature_ids_tuple) < 100000:
            #     query = f"SELECT fid FROM flowpaths WHERE fid IN ({','.join(['?'] * len(feature_ids_tuple))})"
            #     cursor.execute(query, feature_ids_tuple)
            #     results = cursor.fetchall()
            # else:
            #     # If there are too many feature IDs, we can only query a subset
            #     # to avoid hitting the SQLite limit.
            #     subset_size = 100000
            #     results = []
            #     for i in range(0, len(feature_ids_tuple), subset_size):
            #         subset = feature_ids_tuple[i : i + subset_size]
            #         query = (
            #             f"SELECT fid FROM flowpaths WHERE fid IN ({','.join(['?'] * len(subset))})"
            #         )
            #         cursor.execute(query, subset)
            #         results.extend(cursor.fetchall())
            # print(f"Found {len(results)} feature IDs in the GeoPackage.")
            dataset_feature_ids = set(feature_ids_list)
            print(f"Dataset has {len(dataset_feature_ids)} unique feature IDs.")
            # flowpaths_fids: Set[int] = set()
            # flowpaths_ids: Set[str] = set()
            # flowpaths_divide_ids: Set[str] = set()
            # for row in cursor.execute("SELECT fid, id, divide_id FROM flowpaths;"):
            #     fid, id_, divide_id = row
            #     flowpaths_fids.add(fid)
            #     flowpaths_ids.add(id_)
            #     flowpaths_divide_ids.add(divide_id)
            # print(f"Found {len(flowpaths_fids)} unique fids in the flowpaths table.")
            # print(f"Found {len(flowpaths_ids)} unique ids in the flowpaths table.")
            # print(f"Found {len(flowpaths_divide_ids)} unique divide_ids in the flowpaths table.")

            # 2776738 feature_ids in the routing data
            # 828288 unique fids, ids, and divide_ids in the flowpaths table.

            # flowpaths may not be the correct table.

            # Colleague suggested the 'network' table.
            cursor.execute("PRAGMA table_info(network);")
            network_info = cursor.fetchall()
            print(f"Network table info: {network_info}")
            # Network table info:
            # [(0, 'fid', 'INTEGER', 1, None, 1),
            # (1, 'id', 'TEXT', 0, None, 0),
            # (2, 'toid', 'TEXT', 0, None, 0),
            # (3, 'divide_id', 'TEXT', 0, None, 0),
            # (4, 'ds_id', 'REAL', 0, None, 0),
            # (5, 'mainstem', 'REAL', 0, None, 0),
            # (6, 'hydroseq', 'MEDIUMINT', 0, None, 0),
            # (7, 'hf_source', 'TEXT', 0, None, 0),
            # (8, 'hf_id', 'REAL', 0, None, 0),
            # (9, 'lengthkm', 'REAL', 0, None, 0),
            # (10, 'areasqkm', 'REAL', 0, None, 0),
            # (11, 'tot_drainage_areasqkm', 'REAL', 0, None, 0),
            # (12, 'type', 'TEXT', 0, None, 0),
            # (13, 'vpuid', 'TEXT', 0, None, 0),
            # (14, 'hf_hydroseq', 'REAL', 0, None, 0),
            # (15, 'hf_lengthkm', 'REAL', 0, None, 0),
            # (16, 'hf_mainstem', 'REAL', 0, None, 0),
            # (17, 'topo', 'TEXT', 0, None, 0),
            # (18, 'poi_id', 'MEDIUMINT', 0, None, 0),
            # (19, 'hl_uri', 'TEXT', 0, None, 0)]
            # ... 19 columns in total. Need to check row count to see if it COULD be the right table.
            cursor.execute("SELECT COUNT(*) FROM network;")
            network_row_count = cursor.fetchone()[0]
            print(f"Number of rows in network table: {network_row_count}")
            # Number of rows in network table: 3461367
            # Around 3.5 million rows, as compared to 2.7 million feature IDs in the routing data.
            # Let's check how much overlap there is.
            network_fids: Set[int] = set()
            for row in cursor.execute("SELECT fid FROM network;"):
                (fid,) = row
                network_fids.add(fid)
            print(f"Found {len(network_fids)} unique fids in the network table.")
            # Found 3461367 unique fids in the network table.
            # Now we check how many of the feature IDs from the routing data
            # are present in the network table.
            feature_ids_in_network = dataset_feature_ids.intersection(network_fids)
            print(f"Found {len(feature_ids_in_network)} feature IDs in the network table.")
            # Found 336440 feature IDs in the network table.
