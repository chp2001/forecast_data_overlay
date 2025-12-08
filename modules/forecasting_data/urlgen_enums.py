from __future__ import annotations
from enum import Enum
from typing import Dict, List, NamedTuple, Tuple, Union


class NWMRun(Enum):
    SHORT_RANGE = 1
    MEDIUM_RANGE = 2
    MEDIUM_RANGE_NO_DA = 3
    LONG_RANGE = 4
    ANALYSIS_ASSIM = 5
    ANALYSIS_ASSIM_EXTEND = 6
    ANALYSIS_ASSIM_EXTEND_NO_DA = 7
    ANALYSIS_ASSIM_LONG = 8
    ANALYSIS_ASSIM_LONG_NO_DA = 9
    ANALYSIS_ASSIM_NO_DA = 10
    SHORT_RANGE_NO_DA = 11


class NWMMem(Enum):
    MEM_1 = 1
    MEM_2 = 2
    MEM_3 = 3
    MEM_4 = 4
    MEM_5 = 5
    MEM_6 = 6
    MEM_7 = 7


class NWMVar(Enum):
    CHANNEL_RT = 1
    LAND = 2
    RESERVOIR = 3
    TERRAIN_RT = 4
    FORCING = 5


class NWMGeo(Enum):
    CONUS = 1
    HAWAII = 2
    PUERTO_RICO = 3


class AvailabilityValue(NamedTuple):
    lead_times: List[int]
    forecast_hours: List[int]


AvailabilityNodeType = Dict[Enum, Union["AvailabilityNodeType", Tuple[List[int], List[int]]]]
# Match the decision tree from `create_file_list` in `urlgen_builder.py`
# To make it easier to understand what lead times and forecast hours are available
# Shorthand combination paths:
# NWMRun.SHORT_RANGE / NWMVar.FORCING / NWMGeo.HAWAII
# NWMRun.SHORT_RANGE / NWMVar.FORCING / NWMGeo.PUERTO_RICO
# NWMRun.SHORT_RANGE / NWMVar.FORCING / NWMGeo.CONUS
# NWMRun.SHORT_RANGE / NWMGeo.PUERTO_RICO
# NWMRun.SHORT_RANGE / (NWMGeo.CONUS or NWMGeo.HAWAII)
# NWMRun.MEDIUM_RANGE / NWMVar.FORCING
# NWMRun.MEDIUM_RANGE / NWMMem.MEM_1 / (NWMVar.CHANNEL_RT, NWMVar.RESERVOIR)
# NWMRun.MEDIUM_RANGE / NWMMem.MEM_1 / (NWMVar.LAND, NWMVar.TERRAIN_RT)
# NWMRun.MEDIUM_RANGE / (NWMMem.MEM_2 to NWMMem.MEM_7) / (NWMVar.CHANNEL_RT, NWMVar.RESERVOIR)
# NWMRun.MEDIUM_RANGE / (NWMMem.MEM_2 to NWMMem.MEM_7) / (NWMVar.LAND, NWMVar.TERRAIN_RT)
# NWMRun.MEDIUM_RANGE_NO_DA / NWMVar.CHANNEL_RT
# NWMRun.LONG_RANGE / (NWMVar.CHANNEL_RT, NWMVar.RESERVOIR)
# NWMRun.LONG_RANGE / NWMVar.LAND
# NWMRun.ANALYSIS_ASSIM / NWMVar.FORCING / NWMGeo.HAWAII
# NWMRun.ANALYSIS_ASSIM / NWMVar.FORCING / (NWMGeo.CONUS or NWMGeo.PUERTO_RICO)
# NWMRun.ANALYSIS_ASSIM / (NWMVar NOT FORCING)
# NWMRun.ANALYSIS_ASSIM_EXTEND
# NWMRun.ANALYSIS_ASSIM_EXTEND_NO_DA / NWMVar.CHANNEL_RT
# NWMRun.ANALYSIS_ASSIM_LONG
# NWMRun.ANALYSIS_ASSIM_LONG_NO_DA / NWMVar.CHANNEL_RT
# NWMRun.ANALYSIS_ASSIM_NO_DA / NWMVar.CHANNEL_RT
# NWMRun.SHORT_RANGE_NO_DA / NWMVar.CHANNEL_RT / NWMGeo.PUERTO_RICO

AvailabilityTree: Dict[Enum, AvailabilityNodeType] = {}
