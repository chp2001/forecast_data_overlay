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

# No relevant functionality (yet?)
