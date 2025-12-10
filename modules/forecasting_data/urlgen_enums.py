from __future__ import annotations
from enum import Enum
from typing import Dict, List, NamedTuple, Optional, Tuple, TypeAlias, Union


class __SortableEnum(Enum):
    def __lt__(self, other: __SortableEnum) -> bool:
        if not isinstance(other, self.__class__):
            return NotImplemented
        return self.value < other.value


class NWMRun(__SortableEnum):
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


class NWMMem(__SortableEnum):
    MEM_1 = 1
    MEM_2 = 2
    MEM_3 = 3
    MEM_4 = 4
    MEM_5 = 5
    MEM_6 = 6
    MEM_7 = 7


class NWMVar(__SortableEnum):
    CHANNEL_RT = 1
    LAND = 2
    RESERVOIR = 3
    TERRAIN_RT = 4
    FORCING = 5


class NWMGeo(__SortableEnum):
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

# AvailabilityTree: Dict[Enum, AvailabilityNodeType] = {}
AvailabilityTree: Dict[
    NWMGeo,
    Dict[
        NWMRun,
        Dict[
            NWMVar,
            Union[
                Dict[Optional[NWMMem], Tuple[Tuple[int, int, int], Tuple[int, int, int]]],
                Tuple[Tuple[int, int, int], Tuple[int, int, int]],
            ],
        ],
    ],
] = {
    NWMGeo.CONUS: {
        NWMRun.SHORT_RANGE: {
            NWMVar.CHANNEL_RT: ((0, 24, 1), (1, 19, 1)),
            NWMVar.LAND: ((0, 24, 1), (1, 19, 1)),
            NWMVar.RESERVOIR: ((0, 24, 1), (1, 19, 1)),
            NWMVar.TERRAIN_RT: ((0, 24, 1), (1, 19, 1)),
            NWMVar.FORCING: ((0, 24, 1), (1, 19, 1)),
        },
        NWMRun.MEDIUM_RANGE: {
            NWMVar.CHANNEL_RT: ((0, 19, 6), (3, 241, 3)),
            NWMVar.LAND: ((0, 19, 6), (3, 241, 3)),
            NWMVar.RESERVOIR: ((0, 19, 6), (3, 241, 3)),
            NWMVar.TERRAIN_RT: ((0, 19, 6), (3, 241, 3)),
            NWMVar.FORCING: ((0, 19, 6), (1, 241, 1)),
        },
        NWMRun.LONG_RANGE: {
            NWMVar.CHANNEL_RT: {
                NWMMem.MEM_1: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_2: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_3: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_4: ((0, 19, 6), (6, 721, 6)),
            },
            NWMVar.LAND: {
                NWMMem.MEM_1: ((0, 19, 6), (24, 721, 24)),
                NWMMem.MEM_2: ((0, 19, 6), (24, 721, 24)),
                NWMMem.MEM_3: ((0, 19, 6), (24, 721, 24)),
                NWMMem.MEM_4: ((0, 19, 6), (24, 721, 24)),
            },
            NWMVar.RESERVOIR: {
                NWMMem.MEM_1: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_2: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_3: ((0, 19, 6), (6, 721, 6)),
                NWMMem.MEM_4: ((0, 19, 6), (6, 721, 6)),
            },
        },
        NWMRun.ANALYSIS_ASSIM: {
            NWMVar.CHANNEL_RT: ((0, 24, 1), (0, 3, 1)),
            NWMVar.LAND: ((0, 24, 1), (0, 3, 1)),
            NWMVar.RESERVOIR: ((0, 24, 1), (0, 3, 1)),
            NWMVar.TERRAIN_RT: ((0, 24, 1), (0, 3, 1)),
            NWMVar.FORCING: ((0, 24, 1), (0, 3, 1)),
        },
    },
}
"""AvailabilityTree structure describing available NWM forecast data.

The tree is structured as a nested dictionary with the following hierarchy:
    1st level: NWMGeo
    2nd level: NWMRun
    3rd level: NWMVar
    4th level: Optional[NWMMem] or direct tuple of patterns if only meminput None exists


Each leaf node contains a tuple of range definitions for forecast cycles and lead times.
The range definitions are tuples of (start, end, step) values.

Example usage:
    fcst_cycle_pattern, lead_time_pattern = AvailabilityTree[...][...][...]
    # in the case where no meminput is available for that combination

Generated from the following source's nwm.20180918 data:
    https://ciroh-nwm-zarr-copy.s3.amazonaws.com/
"""
