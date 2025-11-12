from __future__ import annotations

if __name__ == "__main__":
    import sys

    sys.path.append("./modules/")
from typing import (
    List,
    Tuple,
    Dict,
    Set,
    Any,
    Union,
    Callable,
    Literal,
    Optional,
    TypeAlias,
    TypedDict,
)

from dateutil import rrule
from datetime import datetime, timezone
from itertools import product
import os

from forecasting_data.urlgen_enums import NWMRun, NWMMem, NWMVar, NWMGeo


def run_type(runinput: NWMRun, varinput: NWMVar, geoinput: NWMGeo, default: str = "") -> str:
    """This function takes the numeric command line input and converts to the text used in the url."""
    if varinput == NWMVar.FORCING:
        if runinput == NWMRun.ANALYSIS_ASSIM and geoinput == NWMGeo.HAWAII:
            return "forcing_analysis_assim_hawaii"
        elif runinput == NWMRun.ANALYSIS_ASSIM and geoinput == NWMGeo.PUERTO_RICO:
            return "forcing_analysis_assim_puertorico"
        elif runinput == NWMRun.SHORT_RANGE and geoinput == NWMGeo.HAWAII:
            return "forcing_short_range_hawaii"
        elif runinput == NWMRun.SHORT_RANGE and geoinput == NWMGeo.PUERTO_RICO:
            return "forcing_short_range_puertorico"
        elif runinput == NWMRun.ANALYSIS_ASSIM:
            return "forcing_analysis_assim"
        elif runinput == NWMRun.ANALYSIS_ASSIM_EXTEND:
            return "forcing_analysis_assim_extend"
        elif runinput == NWMRun.MEDIUM_RANGE:
            return "forcing_medium_range"
        elif runinput == NWMRun.SHORT_RANGE:
            return "forcing_short_range"
    elif runinput == NWMRun.ANALYSIS_ASSIM and geoinput == NWMGeo.PUERTO_RICO:
        return "analysis_assim_puertorico"
    elif runinput == NWMRun.ANALYSIS_ASSIM_NO_DA and geoinput == NWMGeo.PUERTO_RICO:
        return "analysis_assim_puertorico_no_da"
    elif runinput == NWMRun.SHORT_RANGE and geoinput == NWMGeo.PUERTO_RICO:
        return "short_range_puertorico"
    elif runinput == NWMRun.SHORT_RANGE_NO_DA and geoinput == NWMGeo.PUERTO_RICO:
        return "short_range_puertorico_no_da"
    else:
        return default


def selectvar(varinput: NWMVar) -> str:
    """Selects the variable based on the NWMVar enum."""
    return varinput.name.lower()


def selectgeo(geoinput: NWMGeo) -> str:
    """Selects the geographic region based on the NWMGeo enum."""
    return geoinput.name.lower()


def selectrun(runinput: NWMRun) -> str:
    """Selects the run type based on the NWMRun enum."""
    return runinput.name.lower()


def makename(
    date: datetime,
    run_name: str,
    var_name: str,
    fcst_cycle: int,
    fcst_hour: int,
    geography: str,
    run_type: str,
    fhprefix: str = "",
    runsuffix: str = "",
    varsuffix: str = "",
    run_typesuffix: str = "",
    urlbase_prefix: str = "",
) -> str:
    """Constructs the URL for accessing the NWM data file."""
    datetxt = f"nwm.{date.strftime('%Y%m%d')}"
    foldertxt = f"{run_type}{run_typesuffix}"
    # 03d if not analysis_assim, 02d if analysis_assim
    fh_str = f"{fcst_hour:03d}" if "analysis_assim" not in run_type else f"{fcst_hour:02d}"
    filetxt = f"nwm.t{fcst_cycle:02d}z.{run_name}{runsuffix}.{var_name}{varsuffix}.{fhprefix}{fh_str}.{geography}.nc"
    return f"{urlbase_prefix}{datetxt}/{foldertxt}/{filetxt}"


# def fhprefix(runinput):
#     if 4 <= runinput <= 10:
#         return "tm"
#     return "f"

# def varsuffix(meminput):
#     if meminput in range(1, 8):
#         return f"_{meminput}"
#     else:
#         return ""

# def run_typesuffix(meminput):
#     if meminput in range(1, 8):
#         return f"_mem{meminput}"
#     else:
#         return ""

# def select_forecast_cycle(fcst_cycle=None, default=None):
#     if fcst_cycle:
#         return fcst_cycle
#     else:
#         return default

# def select_lead_time(lead_time=None, default=None):
#     if lead_time:
#         return lead_time
#     else:
#         return default


def fhprefix(runinput: NWMRun) -> str:
    """Returns the forecast hour prefix based on the run type."""
    if 4 <= runinput.value <= 10:
        return "tm"
    return "f"


# Original is checking if meminput (int) is one of [1, 2, ..., 7]
# If it is, it returns "_{meminput}".
# If not, it returns an empty string.
# Since meminput is now an enum, we check if it is not None and then return the value as a suffix.
def varsuffix(meminput: Optional[NWMMem]) -> str:
    """Returns the variable suffix based on the memory input."""
    if meminput and meminput in NWMMem:
        return f"_{meminput.value}"
    else:
        return ""


def run_typesuffix(meminput: Optional[NWMMem]) -> str:
    """Returns the run type suffix based on the memory input."""
    if meminput and meminput in NWMMem:
        return f"_mem{meminput.value}"
    else:
        return ""


def select_forecast_cycle(
    fcst_cycle: Optional[List[int]] = None, default: Optional[List[int]] = None
) -> List[int]:
    """Selects the forecast cycle based on the input or returns a default."""
    if fcst_cycle is not None:
        return fcst_cycle
    elif default is not None:
        return default
    else:
        raise ValueError("No forecast cycle provided and no default available.")


def select_lead_time(
    lead_time: Optional[List[int]] = None, default: Optional[List[int]] = None
) -> List[int]:
    """Selects the lead time based on the input or returns a default."""
    if lead_time is not None:
        return lead_time
    elif default is not None:
        return default
    else:
        raise ValueError("No lead time provided and no default available.")


urlbasedict = {
    0: "",
    1: "https://nomads.ncep.noaa.gov/pub/data/nccf/com/nwm/prod/",
    2: "https://nomads.ncep.noaa.gov/pub/data/nccf/com/nwm/post-processed/WMS/",
    3: "https://storage.googleapis.com/national-water-model/",
    4: "https://storage.cloud.google.com/national-water-model/",
    5: "gs://national-water-model/",
    6: "gcs://national-water-model/",
    7: "https://noaa-nwm-pds.s3.amazonaws.com/",
    8: "https://ciroh-nwm-zarr-copy.s3.amazonaws.com/national-water-model/",
}

# def selecturlbase(urlbasedict, urlbaseinput, defaulturlbase=""):
#     if urlbaseinput:
#         return urlbasedict[urlbaseinput]
#     else:
#         return defaulturlbase


def selecturlbase(
    urlbasedict: Dict[int, str], urlbaseinput: Optional[int] = None, defaulturlbase: str = ""
) -> str:
    """Selects the URL base from the dictionary based on the input or returns a default."""
    if urlbaseinput is not None and urlbaseinput in urlbasedict:
        return urlbasedict[urlbaseinput]
    else:
        return defaulturlbase


def make_daterange(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[datetime]:
    # If hours/minutes not provided, default to 00:00
    if start_date and len(start_date) == 8:
        start_date += "0000"
    if end_date and len(end_date) == 8:
        end_date += "0000"
    try:
        _dtstart = (
            datetime.strptime(start_date, "%Y%m%d%H%M")
            if start_date
            else datetime.now(timezone.utc)
        )
        _until = datetime.strptime(end_date, "%Y%m%d%H%M") if end_date else _dtstart
    except Exception:
        print(
            f"Provided dates {start_date=} and {end_date=} are not in the expected format. Defaulting to current date."
        )
        today = datetime.now(timezone.utc)
        _dtstart = today
        _until = today

    dates = rrule.rrule(
        rrule.DAILY,
        dtstart=_dtstart,
        until=_until,
    )
    return list(dates)


def create_file_list(
    runinput: NWMRun,
    varinput: NWMVar,
    geoinput: NWMGeo,
    meminput: Optional[NWMMem] = None,
    dates: Optional[List[datetime]] = None,
    fcst_cycle: Optional[List[int]] = None,
    urlbaseinput: Optional[int] = None,
    lead_time: Optional[List[int]] = None,
) -> List[str]:
    """For given date, run, var, fcst_cycle, and geography, return file names for the valid time and dates."""

    geography = selectgeo(geoinput)
    run_name = selectrun(runinput)
    var_name = selectvar(varinput)
    urlbase_prefix = selecturlbase(urlbasedict, urlbaseinput)

    if not dates:
        dates = make_daterange()
    run_t = run_type(runinput, varinput, geoinput, run_name)
    fhp = fhprefix(runinput)
    vsuff = varsuffix(meminput)
    rtsuff = run_typesuffix(meminput)

    # Helper to get enum values for comparison
    v = varinput.value
    r = runinput.value
    g = geoinput.value
    m = meminput.value if meminput else None

    if runinput == NWMRun.SHORT_RANGE:
        if varinput == NWMVar.FORCING:
            if geoinput == NWMGeo.HAWAII:
                prod = product(
                    dates,
                    select_forecast_cycle(fcst_cycle, list(range(0, 13, 12))),
                    select_lead_time(lead_time, list(range(1, 49))),
                )
            elif geoinput == NWMGeo.PUERTO_RICO:
                prod = product(
                    dates,
                    select_forecast_cycle(fcst_cycle, [6]),
                    select_lead_time(lead_time, list(range(1, 48))),
                )
            else:
                prod = product(
                    dates,
                    select_forecast_cycle(fcst_cycle, list(range(24))),
                    select_lead_time(lead_time, list(range(1, 19))),
                )
        elif geoinput == NWMGeo.PUERTO_RICO:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(6, 19, 12))),
                select_lead_time(lead_time, list(range(1, 48))),
            )
        else:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(24))),
                select_lead_time(lead_time, list(range(1, 19))),
            )
    elif runinput == NWMRun.MEDIUM_RANGE:
        if varinput == NWMVar.FORCING:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(0, 19, 6))),
                select_lead_time(lead_time, list(range(1, 241))),
            )
        else:
            default_fc = list(range(0, 19, 6))
            if meminput == NWMMem.MEM_1:
                if varinput in {NWMVar.CHANNEL_RT, NWMVar.RESERVOIR}:
                    prod = product(
                        dates,
                        select_forecast_cycle(fcst_cycle, default_fc),
                        select_lead_time(lead_time, list(range(1, 241))),
                    )
                elif varinput in {NWMVar.LAND, NWMVar.TERRAIN_RT}:
                    prod = product(
                        dates,
                        select_forecast_cycle(fcst_cycle, default_fc),
                        select_lead_time(lead_time, list(range(3, 241, 3))),
                    )
                else:
                    raise ValueError("varinput")
            elif meminput and meminput.value in range(2, 8):
                if varinput in {NWMVar.CHANNEL_RT, NWMVar.RESERVOIR}:
                    prod = product(
                        dates,
                        select_forecast_cycle(fcst_cycle, default_fc),
                        select_lead_time(lead_time, list(range(1, 205))),
                    )
                elif varinput in {NWMVar.LAND, NWMVar.TERRAIN_RT}:
                    prod = product(
                        dates,
                        select_forecast_cycle(fcst_cycle, default_fc),
                        select_lead_time(lead_time, list(range(3, 205, 3))),
                    )
                else:
                    raise ValueError("varinput")
            else:
                raise ValueError("meminput")
    elif runinput == NWMRun.MEDIUM_RANGE_NO_DA:
        if varinput == NWMVar.CHANNEL_RT:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(0, 13, 6))),
                select_lead_time(lead_time, list(range(3, 240, 3))),
            )
        else:
            raise ValueError("only valid variable for a _no_da type run is channel_rt")
    elif runinput == NWMRun.LONG_RANGE:
        default_fc = list(range(0, 19, 6))
        if varinput in {NWMVar.CHANNEL_RT, NWMVar.RESERVOIR}:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, default_fc),
                select_lead_time(lead_time, list(range(6, 721, 6))),
            )
        elif varinput == NWMVar.LAND:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, default_fc),
                select_lead_time(lead_time, list(range(24, 721, 24))),
            )
        else:
            raise ValueError("varinput")
    elif runinput == NWMRun.ANALYSIS_ASSIM:
        if varinput == NWMVar.FORCING:
            if geoinput == NWMGeo.HAWAII:
                prod = product(
                    dates,
                    select_forecast_cycle(fcst_cycle, list(range(19))),
                    select_lead_time(lead_time, list(range(3))),
                )
            else:
                prod = product(
                    dates,
                    select_forecast_cycle(fcst_cycle, list(range(20))),
                    select_lead_time(lead_time, list(range(3))),
                )
        else:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(24))),
                select_lead_time(lead_time, list(range(3))),
            )
    elif runinput == NWMRun.ANALYSIS_ASSIM_EXTEND:
        prod = product(
            dates,
            select_forecast_cycle(fcst_cycle, [16]),
            select_lead_time(lead_time, list(range(28))),
        )
    elif runinput == NWMRun.ANALYSIS_ASSIM_EXTEND_NO_DA:
        if varinput == NWMVar.CHANNEL_RT:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, [16]),
                select_lead_time(lead_time, list(range(28))),
            )
        else:
            raise ValueError("only valid variable for a _no_da type run is channel_rt")
    elif runinput == NWMRun.ANALYSIS_ASSIM_LONG:
        prod = product(
            dates,
            select_forecast_cycle(fcst_cycle, list(range(0, 24, 6))),
            select_lead_time(lead_time, list(range(12))),
        )
    elif runinput == NWMRun.ANALYSIS_ASSIM_LONG_NO_DA:
        if varinput == NWMVar.CHANNEL_RT:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(0, 24, 6))),
                select_lead_time(lead_time, list(range(12))),
            )
        else:
            raise ValueError("only valid variable for a _no_da type run is channel_rt")
    elif runinput == NWMRun.ANALYSIS_ASSIM_NO_DA:
        if varinput == NWMVar.CHANNEL_RT:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(21))),
                select_lead_time(lead_time, list(range(3))),
            )
        else:
            raise ValueError("only valid variable for a _no_da type run is channel_rt")
    elif runinput == NWMRun.SHORT_RANGE_NO_DA and geoinput == NWMGeo.PUERTO_RICO:
        if varinput == NWMVar.CHANNEL_RT:
            prod = product(
                dates,
                select_forecast_cycle(fcst_cycle, list(range(6, 19, 12))),
                select_lead_time(lead_time, list(range(1, 49))),
            )
        else:
            raise ValueError("only valid variable for a _no_da type run is channel_rt")
    else:
        raise ValueError("run error")

    result = []
    for _dt, _fc, _fh in prod:
        result.append(
            makename(
                _dt,
                run_name,
                var_name,
                _fc,
                _fh,
                geography,
                run_t,
                fhp,
                "",
                vsuff,
                rtsuff,
                urlbase_prefix,
            )
        )
    return result


def create_file_list_range(
    runinput: NWMRun,
    varinput: NWMVar,
    geoinput: NWMGeo,
    meminput: Optional[NWMMem] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fcst_cycle: Optional[List[int]] = None,
    urlbaseinput: Optional[int] = None,
    lead_time: Optional[List[int]] = None,
) -> List[str]:
    """Creates a file list for the specified date range."""
    # Create a list of dates within the specified range
    dates = make_daterange(start_date=start_date, end_date=end_date)

    # Generate the file list using the provided parameters
    return create_file_list(
        runinput=runinput,
        varinput=varinput,
        geoinput=geoinput,
        meminput=meminput,
        dates=dates,
        fcst_cycle=fcst_cycle,
        urlbaseinput=urlbaseinput,
        lead_time=lead_time,
    )


# Version of create_file_list that uses the 8th URL base by default
def create_default_file_list(
    runinput: NWMRun,
    varinput: NWMVar,
    geoinput: NWMGeo,
    meminput: Optional[NWMMem] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fcst_cycle: Optional[List[int]] = None,
    lead_time: Optional[List[int]] = None,
) -> List[str]:
    """Creates a file list using the 8th URL base by default."""
    return create_file_list_range(
        runinput=runinput,
        varinput=varinput,
        geoinput=geoinput,
        meminput=meminput,
        start_date=start_date,
        end_date=end_date,
        fcst_cycle=fcst_cycle,
        urlbaseinput=8,  # Default to the 8th URL base
        lead_time=lead_time,
    )


def get_default_file(
    runinput: NWMRun,
    varinput: NWMVar,
    geoinput: NWMGeo,
    meminput: Optional[NWMMem] = None,
    date: Optional[Union[str, datetime]] = None,
    fcst_cycle: Optional[List[int]] = None,
    lead_time: Optional[List[int]] = None,
) -> str:
    """Generates a default file name based on the provided parameters."""
    if isinstance(date, str):
        date = datetime.strptime(date, "%Y%m%d%H%M")
    elif date is None:
        date = datetime.now(timezone.utc)

    # Create a single-item list for dates
    dates = [date]

    # Generate the file list and return the first item
    file_list = create_file_list(
        runinput=runinput,
        varinput=varinput,
        geoinput=geoinput,
        meminput=meminput,
        dates=dates,
        fcst_cycle=fcst_cycle,
        lead_time=lead_time,
    )

    return file_list[0] if file_list else ""


def append_jsons(file_list: List[str]) -> List[str]:
    """Appends '.json' to each file in the list."""
    return [f"{file}.json" for file in file_list]


def generate_urls(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fcst_cycle: Optional[List[int]] = None,
    lead_time: Optional[List[int]] = None,
    varinput: NWMVar = NWMVar.CHANNEL_RT,
    geoinput: NWMGeo = NWMGeo.CONUS,
    runinput: NWMRun = NWMRun.SHORT_RANGE,
    target_file: str = "filenamelist.txt",
) -> List[str]:
    """Generates a list of URLs based on the provided parameters."""

    default_urlbase = selecturlbase(urlbasedict, 8)

    file_list = create_file_list_range(
        runinput,
        varinput,
        geoinput,
        None,  # meminput is not used in this context
        start_date,
        end_date,
        fcst_cycle,
        default_urlbase,
        lead_time,
    )

    if os.path.exists(target_file):
        os.remove(target_file)

    with open(target_file, "wt") as file:
        for item in file_list:
            file.write(f"{item}.json\n")

    return file_list


if __name__ == "__main__":
    # Test the file list generation
    # urlgennwm.generate_urls(
    #     start_date="202507040000",
    #     end_date="202507040000",
    #     fcst_cycle=[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    #     lead_time=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    #     varinput=1,
    #     geoinput=1,
    #     runinput=1,
    #     target_file=file_dest,
    # )
    file_urls = create_file_list_range(
        runinput=NWMRun.SHORT_RANGE,
        varinput=NWMVar.CHANNEL_RT,
        geoinput=NWMGeo.CONUS,
        start_date="202507040000",
        end_date="202507040000",
        fcst_cycle=[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        lead_time=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
        urlbaseinput=8,  # Match the default URL base used in the original code
    )
    for url in file_urls:
        print(url)
