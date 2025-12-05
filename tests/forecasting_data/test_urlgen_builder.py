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
from datetime import datetime, timezone, timedelta
from itertools import product
import os
import requests
from time import perf_counter

from forecasting_data.urlgen_enums import NWMRun, NWMMem, NWMVar, NWMGeo
from forecasting_data.urlgen_builder import (
    create_file_list_range,
    make_partial_filepath,
    urlbasedict,
    generate_url_single,
)

if __name__ == "__main__":
    test_file_list_generation = False
    if test_file_list_generation:
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
    test_find_most_recent_file = True
    if test_find_most_recent_file:
        # Testing / prototyping the logic to find the most recent available file
        # at the current time
        def check_url_exists(url: str) -> bool:
            response = requests.head(url)
            return response.status_code == 200

        def date_to_str(dt: datetime) -> str:
            # Need YYYYMMDD format
            return dt.strftime("%Y%m%d")

        # Groups of 'lead times' become available simultaneously for a given forecast cycle
        # so we only need to check lead times of 0 or 1 depending on which runtype
        # and varname is being requested
        runinput = NWMRun.SHORT_RANGE
        varinput = NWMVar.FORCING
        geoinput = NWMGeo.CONUS
        now_utc = datetime.now(timezone.utc)
        # For now, we only do short-range forcing, so forecast cycles are every hour
        # lead time begins at 1 for short-range forcing
        current_hr = now_utc.hour

        def prev_time(dt: datetime, hours: int) -> datetime:
            return dt - timedelta(hours=hours)

        def find_most_recent_file(
            runinput: NWMRun,
            varinput: NWMVar,
            geoinput: NWMGeo,
            initial_datetime: datetime,
            max_checks: int = 48,
            verbose: bool = False,
        ) -> Tuple[Optional[str], Optional[Tuple[str, int]], int]:
            check_datetime = initial_datetime
            checks_done = 0
            while checks_done < max_checks:
                if verbose:
                    t0_loop = perf_counter()
                date_str = date_to_str(check_datetime)
                fcst_cycle = check_datetime.hour
                lead_time = 1 if runinput == NWMRun.SHORT_RANGE else 0
                url = generate_url_single(
                    date=date_str,
                    fcst_cycle=fcst_cycle,
                    lead_time=lead_time,
                    runinput=runinput,
                    varinput=varinput,
                    geoinput=geoinput,
                )
                url = f"{url}.json"
                if verbose:
                    t1_loop = perf_counter()
                found_url = check_url_exists(url)
                if verbose:
                    t2_loop = perf_counter()
                    print(
                        f"Checked URL: {url} | Found: {found_url} | "
                        f"URL gen time: {t1_loop - t0_loop:.3f}s | "
                        f"Check time: {t2_loop - t1_loop:.3f}s"
                    )
                if found_url:
                    return url, (date_str, fcst_cycle), checks_done
                # Move to the previous forecast cycle time
                check_datetime = prev_time(check_datetime, 1)
                checks_done += 1
            # No file found within the max_checks limit
            return None, None, checks_done

        t0 = perf_counter()
        most_recent_file, final_tuple, checks_done = find_most_recent_file(
            runinput=runinput,
            varinput=varinput,
            geoinput=geoinput,
            initial_datetime=now_utc,
            verbose=True,
        )
        t1 = perf_counter()
        if most_recent_file:
            print(f"Most recent file found: {most_recent_file}")
            print(f"Found after {checks_done} checks in {t1 - t0:.2f} seconds.")
            print(f"Date and forecast cycle: {final_tuple}")
        else:
            print("No recent file found within the check limit.")
            print(f"Total checks done: {checks_done} in {t1 - t0:.2f} seconds.")
