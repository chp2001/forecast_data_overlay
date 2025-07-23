from __future__ import annotations
from enum import Enum

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