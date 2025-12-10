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

from forecasting_data.urlgen_enums import NWMRun, NWMMem, NWMVar, NWMGeo
from forecasting_data.urlgen_builder import urlbasedict, generate_url_reverse
import os
import pickle
import requests
from xml.etree import ElementTree as ET
from enum import Enum
import json

if __name__ == "__main__":
    # we want to check file availability by walking the S3 bucket
    urlbase = urlbasedict[8]  # https://ciroh-nwm-zarr-copy.s3.amazonaws.com/national-water-model/
    # import boto3

    # client = boto3.client("s3")
    # bucket_name = "ciroh-nwm-zarr-copy"
    # prefix = "national-water-model/"
    # response = client.list_objects_v2(Bucket=bucket_name, Prefix=prefix)
    # print(response)
    # boto3 being uncooperative... this is a public bucket,
    # it should not require special credentials to access

    # Instead, we can use REST API get requests to list objects in the S3 bucket
    # Unfortunately, S3 does not have a "real" directory structure, and simply stores the "path" as part of the object key.
    # Therefore, we will need to request a large number of objects and filter them ourselves.

    s3_bucket_url = "https://ciroh-nwm-zarr-copy.s3.amazonaws.com/"  # 'national-water-model/' is simply a prefix

    ### Need to limit requests to avoid getting rate-limited or timeouts
    response_cache_dir_path = "./dist/test_cache/"
    response_cache_path = response_cache_dir_path + "s3_list_response.pkl"
    os.makedirs(os.path.dirname(response_cache_path), exist_ok=True)
    if os.path.exists(response_cache_path):
        with open(response_cache_path, "rb") as f:
            response = pickle.load(f)
    else:
        params = {"list-type": "2", "prefix": "national-water-model/", "max-keys": "1"}
        response = requests.get(s3_bucket_url, params=params)
        with open(response_cache_path, "wb") as f:
            pickle.dump(response, f)
    print(response.status_code)

    # Need to parse XML response
    # import xml.etree.ElementTree as ET

    root = ET.fromstring(response.content)
    rootprefix = root.tag.split("}")[0] + "}"  # get the XML namespace prefix

    # Print out the full XML for inspection
    # ET.dump(root)
    # (With indentation for readability)
    # root_str = ET.tostring(root, encoding="unicode", method="html")
    # print(root_str)
    # that didn't work properly...
    def readabletag(tag: str) -> str:
        if "}" in tag:
            return tag.split("}", 1)[1]
        return tag

    def idump_value(elem: ET.Element, level: int = 0) -> str:
        indent = "  " * level
        tag = readabletag(elem.tag)
        text = elem.text.strip() if elem.text else ""
        if len(text) < 100:
            return f"{indent}<{tag}> {text} </{tag}>\n"
        else:
            return f"{indent}<{tag}>\n{indent}  {text}\n{indent}</{tag}>\n"

    def idump(elem: ET.Element, level: int = 0) -> str:
        if len(elem) == 0:
            return idump_value(elem, level)
        indent = "  " * level
        result = f"{indent}<{readabletag(elem.tag)}>\n"
        for child in elem:
            result += idump(child, level + 1)
        result += f"{indent}</{readabletag(elem.tag)}>\n"
        return result

    print(idump(root))

    object_keys = []
    # for contents in root.findall(".//{http://s3.amazonaws.com/doc/2006-03-01/}Contents"):
    #     key_elem = contents.find("{http://s3.amazonaws.com/doc/2006-03-01/}Key")
    #     if key_elem is not None and key_elem.text is not None:
    #         object_keys.append(key_elem.text)
    for contents in root.findall(f".//{rootprefix}Contents"):
        key_elem = contents.find(f"{rootprefix}Key")
        if key_elem is not None and key_elem.text is not None:
            object_keys.append(key_elem.text)
    print(f"Found {len(object_keys)} objects in the S3 bucket response.")
    # for key in object_keys:
    #     print(key)

    first_available_key = object_keys[0] if object_keys else None
    assert first_available_key is not None, "No objects found in the S3 bucket."
    print(f"First available object key: {first_available_key}")
    parts: List[str] = first_available_key.split("/")
    first_date_part = parts[1]  # nwm.YYYYMMDD
    # override to the next date for testing
    # 20180917 -> 20180918
    # first_date_part = first_date_part.replace("20180917", "20180918")
    # override to more recent date (20251206) for testing
    first_date_part = "nwm.20251206"
    print(f"First date part from object key: {first_date_part}")

    first_date_subfolder_request_params = {
        "list-type": "2",
        "prefix": f"national-water-model/{first_date_part}/",
        "max-keys": "1000",
    }
    first_date_req_cache_path = response_cache_dir_path + f"s3_list_response_{first_date_part}.pkl"
    if os.path.exists(first_date_req_cache_path):
        with open(first_date_req_cache_path, "rb") as f:
            first_date_response = pickle.load(f)
    else:
        first_date_response = requests.get(
            s3_bucket_url, params=first_date_subfolder_request_params
        )
        with open(first_date_req_cache_path, "wb") as f:
            pickle.dump(first_date_response, f)
    print(first_date_response.status_code)
    print(f"Made request at url: {first_date_response.url}")
    first_date_root = ET.fromstring(first_date_response.content)
    first_date_rootprefix = first_date_root.tag.split("}")[0] + "}"  # get the XML namespace prefix
    first_date_object_keys: List[str] = []
    for contents in first_date_root.findall(f".//{first_date_rootprefix}Contents"):
        key_elem = contents.find(f"{first_date_rootprefix}Key")
        if key_elem is not None and key_elem.text is not None:
            first_date_object_keys.append(key_elem.text)
    print(f"Found {len(first_date_object_keys)} objects in the first date subfolder response.")
    # if NextContinuationToken, make additional requests to get more objects
    extra_requests_made = 0
    need_more = True
    next_token = None
    # max_continuations = 15
    max_continuations = 200
    if len(first_date_root.findall(f".//{first_date_rootprefix}NextContinuationToken")) > 0:
        next_token_elem = first_date_root.find(f".//{first_date_rootprefix}NextContinuationToken")
        next_token = next_token_elem.text if next_token_elem is not None else None
    print(f"NextContinuationToken: {next_token}")
    while need_more and next_token is not None and extra_requests_made < max_continuations:
        extra_requests_made += 1
        continuation_params = {
            "list-type": "2",
            "prefix": f"national-water-model/{first_date_part}/",
            "continuation-token": next_token,
            "max-keys": "1000",
        }
        continuation_cache_path = (
            response_cache_dir_path
            + f"s3_list_response_{first_date_part}_cont{extra_requests_made}.pkl"
        )
        if os.path.exists(continuation_cache_path):
            with open(continuation_cache_path, "rb") as f:
                cont_response = pickle.load(f)
        else:
            cont_response = requests.get(s3_bucket_url, params=continuation_params)
            with open(continuation_cache_path, "wb") as f:
                pickle.dump(cont_response, f)
        print(cont_response.status_code)
        print(f"Made continuation request at url: {cont_response.url}")
        cont_root = ET.fromstring(cont_response.content)
        cont_rootprefix = cont_root.tag.split("}")[0] + "}"  # get the XML namespace prefix
        for contents in cont_root.findall(f".//{cont_rootprefix}Contents"):
            key_elem = contents.find(f"{cont_rootprefix}Key")
            if key_elem is not None and key_elem.text is not None:
                first_date_object_keys.append(key_elem.text)
        print(f"Found {len(first_date_object_keys)} total objects after continuation request.")
        next_token_elem = cont_root.find(f".//{cont_rootprefix}NextContinuationToken")
        next_token = next_token_elem.text if next_token_elem is not None else None
        print(f"NextContinuationToken: {next_token}")
        if next_token is None:
            need_more = False
    print(f"Total extra requests made: {extra_requests_made}")
    print(f"First 5 object keys in the first date subfolder:")
    for key in first_date_object_keys[:5]:
        print(key)
    first_date_subdirectories: List[str] = []
    first_date_subdirectories_known_prefixes: List[str] = []
    first_date_subdirectories_contents: Dict[str, List[str]] = {}
    for key in first_date_object_keys:
        # if any(key.startswith(prefix) for prefix in first_date_subdirectories_known_prefixes):
        #     first_date_subdirectories_contents
        #     continue
        found_prefix = None
        for i in range(len(first_date_subdirectories_known_prefixes)):
            prefix = first_date_subdirectories_known_prefixes[i]
            if key.startswith(prefix):
                found_prefix = i
                break
        if found_prefix is not None:
            first_date_subdirectories_contents[first_date_subdirectories[found_prefix]].append(key)
            continue
        parts = key.split("/")
        subfolder = parts[2]  # e.g., short_range, analysis_assim, etc.
        first_date_subdirectories.append(subfolder)
        first_date_subdirectories_known_prefixes.append(
            f"national-water-model/{first_date_part}/{subfolder}/"
        )
        first_date_subdirectories_contents[subfolder] = [key]
    print(f"Identified {len(first_date_subdirectories)} subdirectories in the first date folder:")
    # for subdir in sorted(first_date_subdirectories):
    #     print(subdir)
    for i, subdir in sorted(enumerate(first_date_subdirectories), key=lambda x: x[1]):
        print(
            f"Subdirectory: {subdir}, Number of contents: {len(first_date_subdirectories_contents[subdir])}"
        )

    # Now we can use generate_url_reverse to parse some of the URLs
    print("Parsing some example URLs:")
    # for subdir in sorted(first_date_subdirectories):
    for subdir in ["short_range"]:
        contents = first_date_subdirectories_contents[subdir]
        print(f"Subdirectory: {subdir}, Number of contents: {len(contents)}")
        # for key in contents[:3]:  # parse first 3 files in each subdirectory
        for key in contents[:1]:  # parse first file in each subdirectory
            full_url = s3_bucket_url + key
            print(f"Parsing URL: {full_url}")
            try:
                (
                    runinput,
                    varinput,
                    geoinput,
                    meminput,
                    date_str,
                    fcst_cycle,
                    lead_time,
                    urlbase_prefix,
                ) = generate_url_reverse(full_url)
                print(
                    f"Parsed values:\n"
                    f"  runinput: {runinput}\n"
                    f"  varinput: {varinput}\n"
                    f"  geoinput: {geoinput}\n"
                    f"  meminput: {meminput}\n"
                    f"  date_str: {date_str}\n"
                    f"  fcst_cycle: {fcst_cycle}\n"
                    f"  lead_time: {lead_time}\n"
                    f"  urlbase_prefix: {urlbase_prefix}\n"
                )
            except ValueError as e:
                print(f"Error parsing URL: {e}")

    # Now we can find patterns and discrepancies in available files
    # by parsing all URLs in the first date folder
    result_tuple_type = Tuple[
        NWMRun, NWMVar, NWMGeo, Optional[NWMMem], str, int, int, Optional[str]
    ]
    first_date_subdirectories_contents_results: Dict[str, List[result_tuple_type]] = {}
    first_date_all_contents_results: List[result_tuple_type] = []
    from time import perf_counter

    time_checkpoints: List[Tuple[str, float]] = []

    def checkpoint(label: str):
        time_checkpoints.append((label, perf_counter()))

    checkpoint("start parsing all URLs")
    for subdir in first_date_subdirectories:
        if subdir == "usgs_timeslices":
            continue  # skip this special subdir for now
        checkpoint(f"start subdir {subdir}")
        contents = first_date_subdirectories_contents[subdir]
        first_date_subdirectories_contents_results[subdir] = []
        for key in contents:
            # full_url = s3_bucket_url + key
            # try:
            #     parsed_tuple = generate_url_reverse(full_url)
            #     first_date_subdirectories_contents_results[subdir].append(parsed_tuple)
            #     first_date_all_contents_results.append(parsed_tuple)
            # except ValueError as e:
            #     print(f"Error parsing URL: {e}")
            # Adding the s3_bucket_url prefix back in for parsing
            # just adds complexity for no gain...
            try:
                parsed_tuple = generate_url_reverse(key)
                first_date_subdirectories_contents_results[subdir].append(parsed_tuple)
                first_date_all_contents_results.append(parsed_tuple)
            except ValueError as e:
                print(f"Error parsing URL: {e}")
        checkpoint(f"end subdir {subdir}")
    checkpoint("end parsing all URLs")
    checkpoint_pairs: Dict[str, float] = {}
    for label, time_value in time_checkpoints:
        checkpoint_pairs[label] = time_value
        if label.startswith("end "):
            start_label = "start " + label[4:]
            if start_label in checkpoint_pairs:
                duration = time_value - checkpoint_pairs[start_label]
                print(f"Duration for {label[4:]}: {duration:.2f} seconds")
            else:
                print(f"No start checkpoint found for {label[4:]}")
    print(f"Total URLs parsed: {len(first_date_all_contents_results)}")

    for subdir in first_date_subdirectories_contents_results:
        unique_enum_triples: Set[Tuple[NWMRun, NWMVar, NWMGeo]] = set()
        unique_enum_quads: Set[Tuple[NWMRun, NWMVar, NWMGeo, int]] = set()
        unique_enum_quints: Set[Tuple[NWMRun, NWMVar, NWMGeo, int, int]] = set()
        unique_enum_quads_2: Set[Tuple[NWMRun, NWMVar, NWMGeo, int]] = set()
        forecast_lead_times: Dict[Tuple[NWMRun, NWMVar, NWMGeo, int], Set[int]] = {}
        if len(first_date_subdirectories_contents_results[subdir]) == 0:
            continue
        for parsed_tuple in first_date_subdirectories_contents_results[subdir]:
            unique_enum_triples.add(
                (parsed_tuple[0], parsed_tuple[1], parsed_tuple[2])
            )  # (runinput, varinput, geoinput)
            unique_enum_quads.add(
                (parsed_tuple[0], parsed_tuple[1], parsed_tuple[2], parsed_tuple[5])
            )  # (runinput, varinput, geoinput, fcst_cycle)
            unique_enum_quints.add(
                (
                    parsed_tuple[0],
                    parsed_tuple[1],
                    parsed_tuple[2],
                    parsed_tuple[5],
                    parsed_tuple[6],
                )
            )  # (runinput, varinput, geoinput, fcst_cycle, lead_time)
            unique_enum_quads_2.add(
                (parsed_tuple[0], parsed_tuple[1], parsed_tuple[2], parsed_tuple[6])
            )  # (runinput, varinput, geoinput, lead_time
            # if parsed_tuple[5] not in forecast_lead_times:
            #     forecast_lead_times[parsed_tuple[5]] = set()
            # forecast_lead_times[parsed_tuple[5]].add(parsed_tuple[6])
            forecast_quad = (
                parsed_tuple[0],
                parsed_tuple[1],
                parsed_tuple[2],
                parsed_tuple[5],
            )
            if forecast_quad not in forecast_lead_times:
                forecast_lead_times[forecast_quad] = set()
            forecast_lead_times[forecast_quad].add(parsed_tuple[6])
        unique_forecast_lead_time_sets: Dict[Set[int], List[int]] = {}
        for fcst_cycle_key in forecast_lead_times:
            lead_time_set = frozenset(forecast_lead_times[fcst_cycle_key])
            if lead_time_set not in unique_forecast_lead_time_sets:
                unique_forecast_lead_time_sets[lead_time_set] = []
            unique_forecast_lead_time_sets[lead_time_set].append(fcst_cycle_key)
        print(f"Analysis for subdirectory: {subdir}")
        print(f"\tUnique (runinput, varinput, geoinput) combinations: {len(unique_enum_triples)}")
        print(
            f"\tUnique (runinput, varinput, geoinput, fcst_cycle) combinations: {len(unique_enum_quads)}"
        )
        print(
            f"\tUnique (runinput, varinput, geoinput, fcst_cycle, lead_time) combinations: {len(unique_enum_quints)}"
        )
        print(
            f"\tUnique (runinput, varinput, geoinput, lead_time) combinations: {len(unique_enum_quads_2)}"
        )
        if len(unique_forecast_lead_time_sets) > 1:
            print(f"\tMultiple lead time sets found for forecast cycles:")
            for lead_time_set in unique_forecast_lead_time_sets:
                fcst_cycles = unique_forecast_lead_time_sets[lead_time_set]
                print(f"\t  Lead time set for forecast cycles {fcst_cycles}:")
                print(f"\t    {sorted(list(lead_time_set))}")
        else:
            print(
                f"\tSingle lead time with length {len(list(unique_forecast_lead_time_sets.keys())[0])} found for all forecast cycles"
            )

    # full availability patterns... which runinput/varinput/geoinput combinations are available?
    # which meminput combinations are available?
    unique_all_enum_triples: Set[Tuple[NWMRun, NWMVar, NWMGeo]] = set()
    unique_all_enum_quads: Set[Tuple[NWMRun, NWMVar, NWMGeo, Optional[NWMMem]]] = set()
    all_enum_triples_meminput_availability: Dict[
        Tuple[NWMRun, NWMVar, NWMGeo], Set[Optional[NWMMem]]
    ] = {}
    for parsed_tuple in first_date_all_contents_results:
        parsed_triple = (parsed_tuple[0], parsed_tuple[1], parsed_tuple[2])
        unique_all_enum_triples.add(parsed_triple)
        if parsed_triple not in all_enum_triples_meminput_availability:
            all_enum_triples_meminput_availability[parsed_triple] = set()
        all_enum_triples_meminput_availability[parsed_triple].add(parsed_tuple[3])
        if parsed_tuple[3] is None:
            continue
        unique_all_enum_quads.add(
            # (parsed_tuple[0], parsed_tuple[1], parsed_tuple[2], parsed_tuple[3])
            (*parsed_triple, parsed_tuple[3])
        )  # (runinput, varinput, geoinput, meminput)
    print(f"Overall analysis for all contents in the first date folder:")
    print(f"\tUnique (runinput, varinput, geoinput) combinations: {len(unique_all_enum_triples)}")
    print(
        f"\tUnique (runinput, varinput, geoinput, meminput) combinations: {len(unique_all_enum_quads)}"
    )
    for enum_triple in sorted(
        unique_all_enum_triples, key=lambda x: (x[0].value, x[1].value, x[2].value)
    ):
        print(f"\t  Combination: {enum_triple}")
    for enum_triple in sorted(
        all_enum_triples_meminput_availability.keys(),
        key=lambda x: (x[0].value, x[1].value, x[2].value),
    ):
        meminputs = all_enum_triples_meminput_availability[enum_triple]
        if len(meminputs) == 0 or meminputs == {None}:
            continue
        print(
            f"\tCombination {enum_triple} has meminputs: {sorted([-1 if x is None else x.value for x in list(meminputs)])}"
        )
    # lead time and forecast cycle pattern analysis across all contents
    # for each (runinput, varinput, geoinput, (meminput)), find unique forecast cycles and lead times
    # and then ideally find the lead time pattern for simplification
    # i.e. the following patterns are gleaned through manual analysis:
    # medium_range forcing conus has forecast cycles 0, 6, 12, 18 with lead time range(1, 241, 1)
    # long_range channel_rt conus has forecast cycles 0, 6, 12, 18 with lead time range(6, 721, 6)
    ## barring errors, for a given (runinput, varinput, geoinput, (meminput)) combination,
    # the pattern of lead times should be the same across all forecast cycles
    # additionally, the pattern of increase should be consistent from x0, x1, ... through xn
    # so we can shortcut the analysis by sorting the lead times, then only considering x0, x1, and xn
    unique_forecast_lead_time_sets: Dict[
        Tuple[NWMRun, NWMVar, NWMGeo, Optional[NWMMem]], Set[Tuple[int, int]]
    ] = {}  # unique quad to set of unique (fcst_cycle, lead_time) tuples
    for parsed_tuple in first_date_all_contents_results:
        forecast_quad = (
            parsed_tuple[0],
            parsed_tuple[1],
            parsed_tuple[2],
            parsed_tuple[3],
        )
        if forecast_quad not in unique_forecast_lead_time_sets:
            unique_forecast_lead_time_sets[forecast_quad] = set()
        unique_forecast_lead_time_sets[forecast_quad].add(
            (parsed_tuple[5], parsed_tuple[6])
        )  # (fcst_cycle, lead_time)
    print(
        f"\tUnique forecast cycle and lead time sets per (runinput, varinput, geoinput, meminput) combination:"
    )
    fcst_quad_patterns: Dict[
        Tuple[NWMRun, NWMVar, NWMGeo, Optional[NWMMem]],
        Tuple[Tuple[int, int, int], Tuple[int, int, int]],
    ] = {}  # quad to (fcst_cycle_pattern, lead_time_pattern)
    for forecast_quad in sorted(
        unique_forecast_lead_time_sets.keys(),
        key=lambda x: (x[0].value, x[1].value, x[2].value, -1 if x[3] is None else x[3].value),
    ):
        fcst_lead_set = unique_forecast_lead_time_sets[forecast_quad]
        # before printing, need to separate out the lead time sets by forecast cycle
        # and calculate the lead time patterns individually
        # in order to verify consistency
        fcst_cycle_to_lead_times: Dict[int, List[int]] = {}
        for fcst_cycle, lead_time in fcst_lead_set:
            if fcst_cycle not in fcst_cycle_to_lead_times:
                fcst_cycle_to_lead_times[fcst_cycle] = []
            fcst_cycle_to_lead_times[fcst_cycle].append(lead_time)
        for fcst_cycle in fcst_cycle_to_lead_times:
            fcst_cycle_to_lead_times[fcst_cycle] = sorted(fcst_cycle_to_lead_times[fcst_cycle])
        # assert that all lead time lists are the same across forecast cycles
        assert (
            len(
                set(
                    tuple(fcst_cycle_to_lead_times[fcst_cycle])
                    for fcst_cycle in fcst_cycle_to_lead_times
                )
            )
            == 1
        ), f"Inconsistent lead time lists found across forecast cycles for forecast quad {forecast_quad}: {fcst_cycle_to_lead_times}"
        # Now we determine the lead time patterns
        lead_time_patterns: Dict[int, Tuple[int, int, int]] = {}  # index to (start, end, step)
        for fcst_cycle, lead_times in fcst_cycle_to_lead_times.items():
            if len(lead_times) < 2:
                lead_time_patterns[fcst_cycle] = (lead_times[0], lead_times[0] + 1, 1)
                continue
            elif len(lead_times) == 2:
                lead_time_patterns[fcst_cycle] = (
                    lead_times[0],
                    lead_times[1] + 1,
                    lead_times[1] - lead_times[0],
                )
                continue
            # more than 2 lead times, calculate step
            step = lead_times[1] - lead_times[0]
            consistent = True
            exceptions = []
            for i in range(2, len(lead_times)):
                if lead_times[i] - lead_times[i - 1] != step:
                    consistent = False
                    exceptions.append((i, lead_times[i - 1], lead_times[i]))
            if not consistent:
                print(
                    f"[WARNING] Inconsistent lead time steps found for forecast quad {forecast_quad} at forecast cycle {fcst_cycle}:"
                )
                for ex in exceptions:
                    print(
                        f"\tAt index {ex[0]}: lead time changed from {ex[1]} to {ex[2]} (expected step {step})"
                    )
            # regardless of consistency, we record the pattern based on start, end, and step
            lead_time_patterns[fcst_cycle] = (lead_times[0], lead_times[-1] + 1, step)
        unique_lead_time_patterns: Set[Tuple[int, int, int]] = set(
            [x for x in lead_time_patterns.values()]
        )
        fcst_cycle_pattern: Tuple[int, int, int] = ()
        if len(lead_time_patterns) > 1:
            fcst_cycles_sorted = sorted(lead_time_patterns.keys())
            fcst_cycle_step = fcst_cycles_sorted[1] - fcst_cycles_sorted[0]
            fcst_cycle_pattern = (
                fcst_cycles_sorted[0],
                fcst_cycles_sorted[-1] + 1,
                fcst_cycle_step,
            )
        else:
            fcst_cycle_pattern = (
                list(lead_time_patterns.keys())[0],
                list(lead_time_patterns.keys())[0] + 1,
                1,
            )
        resultstr = f"Forecast quad: {forecast_quad}"
        if len(unique_lead_time_patterns) > 1:
            resultstr += f" {len(unique_lead_time_patterns)} lead time patterns found with forecast cycle pattern {fcst_cycle_pattern}:\n"
            pattern_to_fcst_cycles: Dict[Tuple[int, int, int], List[int]] = {}
            for fcst_cycle in lead_time_patterns:
                pattern = lead_time_patterns[fcst_cycle]
                if pattern not in pattern_to_fcst_cycles:
                    pattern_to_fcst_cycles[pattern] = []
                pattern_to_fcst_cycles[pattern].append(fcst_cycle)
            for pattern in pattern_to_fcst_cycles:
                fcst_cycles = pattern_to_fcst_cycles[pattern]
                resultstr += f"\t  Lead time pattern {pattern} for forecast cycles {fcst_cycles}\n"
        else:
            # print(
            #     f"\tSingle lead time pattern {list(unique_lead_time_patterns)[0]} found with forecast cycle pattern {fcst_cycle_pattern}"
            # )
            resultstr += f" Single lead time pattern {list(unique_lead_time_patterns)[0]} for entire forecast cycle pattern {fcst_cycle_pattern}"
        print(resultstr)
        # assuming consistency, we can record the patterns
        fcst_quad_patterns[forecast_quad] = (fcst_cycle_pattern, list(unique_lead_time_patterns)[0])
    # now that we have collected all this data, we can make it readable and accessible
    # by constructing a tree structure to be placed in the urlgen_enums.py file
    # constructed_availability_result_base: str = (
    #     "ForecastCyclePatternType: TypeAlias = Tuple[int, int, int]\n"
    # )
    # constructed_availability_result_base += (
    #     "LeadTimePatternType: TypeAlias = Tuple[int, int, int]\n"
    # )
    # constructed_availability_result_base += (
    #     "AvailabilityNodeType: TypeAlias = Tuple[ForecastCyclePatternType, LeadTimePatternType]\n\n"
    # )
    # constructed_availability_result_base += "AvailabilityTree: Dict["
    constructed_availability_result_base: str = "AvailabilityTree: Dict["
    availability_docstring_base = (
        '"""AvailabilityTree structure describing available NWM forecast data.\n\n'
        "The tree is structured as a nested dictionary with the following hierarchy:\n"
    )
    availability_docstring_ends = (
        "    4th level: Optional[NWMMem] or direct tuple of patterns if only meminput None exists\n\n"
        "\nEach leaf node contains a tuple of range definitions for forecast cycles and lead times.\n"
    )
    availability_docstring_ends += (
        "The range definitions are tuples of (start, end, step) values.\n"
    )
    availability_docstring_ends += "\nExample usage:\n"
    availability_docstring_ends += (
        "    fcst_cycle_pattern, lead_time_pattern = AvailabilityTree[...][...][...]\n"
    )
    availability_docstring_ends += (
        "    # in the case where no meminput is available for that combination\n"
    )

    availability_docstring_ends += (
        f"\nGenerated from the following source's {first_date_part} data:\n    {s3_bucket_url}\n"
    )
    availability_docstring_ends += '"""'
    # the structure might be better compressed with different ordering of NWMRun, NWMVar, NWMGeo,
    # so we will try different orderings and see which yields the smallest structure
    base_key_order = (NWMRun, NWMVar, NWMGeo)
    constructed_availability_key_orders: List[Tuple[Enum, Enum, Enum]] = [
        (NWMRun, NWMVar, NWMGeo),
        (NWMRun, NWMGeo, NWMVar),
        (NWMVar, NWMRun, NWMGeo),
        (NWMVar, NWMGeo, NWMRun),
        (NWMGeo, NWMRun, NWMVar),
        (NWMGeo, NWMVar, NWMRun),
    ]
    constructed_availability_results: Dict[Tuple[Enum, Enum, Enum], str] = (
        {}
    )  # key order to constructed string
    result_trees: Dict[Tuple[Enum, Enum, Enum], Any] = {}
    for key_order in constructed_availability_key_orders:
        constructed_availability_result = constructed_availability_result_base
        constructed_availability_result += (
            f"{key_order[0].__name__}, Dict[{key_order[1].__name__}, Dict[{key_order[2].__name__}, "
        )
        constructed_availability_result += "Union["
        constructed_availability_result += "Dict[Optional[NWMMem], "
        # constructed_availability_result += "AvailabilityNodeType"
        constructed_availability_result += "Tuple[Tuple[int, int, int], Tuple[int, int, int]]"
        constructed_availability_result += "], "
        # constructed_availability_result += "AvailabilityNodeType"
        constructed_availability_result += "Tuple[Tuple[int, int, int], Tuple[int, int, int]]"
        constructed_availability_result += "]]]]"
        constructed_availability_result += " = "
        assert constructed_availability_result.count("[") == constructed_availability_result.count(
            "]"
        ), f"Mismatched brackets in header, found {constructed_availability_result.count('[')} '[' and {constructed_availability_result.count(']')} ']'"
        # print(f"Constructing availability tree with key order: {key_order}")
        # print(constructed_availability_result)
        # build the tree structure
        tree_dict: Dict[Any, Any] = {}
        # reorder_key_indices = tuple(key_order.index(x) for x in base_key_order)
        reorder_key_indices = tuple(base_key_order.index(x) for x in key_order)
        for forecast_quad in fcst_quad_patterns:
            reordered_key = tuple(forecast_quad[x] for x in reorder_key_indices)
            assert all(
                isinstance(reordered_key[i], key_order[i]) for i in range(3)
            ), f"Attempted to reorder key {forecast_quad} to match key order {key_order} using indices {reorder_key_indices}, but got reordered key {reordered_key} with mismatched types."
            print(
                f"Reordering key from {forecast_quad} to {reordered_key} to match key order {key_order}"
            )
            subtree = tree_dict
            for key_part in reordered_key:
                if key_part not in subtree:
                    subtree[key_part] = {}
                assert any(
                    [key_part.value == k.value for k in subtree]
                ), f"Key part {key_part} not found in subtree keys {list(subtree.keys())}"
                subtree = subtree[key_part]
                # print(subtree)
            if forecast_quad[3] not in subtree:
                subtree[forecast_quad[3]] = fcst_quad_patterns[forecast_quad]
            else:
                print(
                    f"[WARNING] Duplicate entry found for forecast quad {forecast_quad} in tree construction."
                )
        print(f"Constructed raw availability tree with key order {key_order}.")
        print(f"Raw tree dict: {tree_dict}")
        for first_key in tree_dict:
            assert isinstance(
                first_key, key_order[0]
            ), f"Top-level key {first_key} is not of expected type {key_order[0].__name__}"
            for second_key in tree_dict[first_key]:
                assert isinstance(
                    second_key, key_order[1]
                ), f"Second-level key {second_key} is not of expected type {key_order[1].__name__}"
                for third_key in tree_dict[first_key][second_key]:
                    assert isinstance(
                        third_key, key_order[2]
                    ), f"Third-level key {third_key} is not of expected type {key_order[2].__name__}"
                    if (
                        len(tree_dict[first_key][second_key][third_key]) == 1
                        and None in tree_dict[first_key][second_key][third_key]
                    ):
                        # only meminput None exists, simplify by removing the meminput level
                        node_value = tree_dict[first_key][second_key][third_key][None]
                        tree_dict[first_key][second_key][third_key] = node_value
        result_trees[key_order] = tree_dict
        assert all(
            isinstance(x, key_order[0]) for x in tree_dict.keys()
        ), f"Top-level keys in result tree do not match expected enum type {key_order[0].__name__}: {list(tree_dict.keys())}"

        # now convert to string representation
        def dict_to_string(d: Any, indent_level: int = 0) -> str:
            indent = "    " * indent_level
            if isinstance(d, tuple):
                return f"{d}"
            result = "{\n"
            for key in sorted(
                d.keys(),
                key=lambda x: (-1 if x is None else x.value) if isinstance(x, Enum) else (x),
            ):
                key_str = f'"{key}"' if key is None else f"{key.__class__.__name__}.{key.name}"
                result += f"{indent}    {key_str}: "
                result += dict_to_string(d[key], indent_level + 1)
                result += ",\n"
            result += f"{indent}}}"
            return result

        constructed_availability_result += dict_to_string(tree_dict)
        availability_docstring_result = availability_docstring_base
        availability_docstring_result += f"    1st level: {key_order[0].__name__}\n"
        availability_docstring_result += f"    2nd level: {key_order[1].__name__}\n"
        availability_docstring_result += f"    3rd level: {key_order[2].__name__}\n"
        availability_docstring_result += availability_docstring_ends
        constructed_availability_result += "\n" + availability_docstring_result
        constructed_availability_results[key_order] = constructed_availability_result
        print(f"Constructed availability tree string for key order {key_order}.")
        # print(constructed_availability_result)
    # find the smallest constructed result
    key_order_to_lengths: Dict[Tuple[Enum, Enum, Enum], int] = {}
    for key_order in constructed_availability_results:
        result_str = constructed_availability_results[key_order]
        key_order_to_lengths[key_order] = len(result_str)
    print("Constructed availability result lengths by key order:")
    for key_order in key_order_to_lengths:
        print(f"\tKey order {key_order}: Length {key_order_to_lengths[key_order]}")
    # print from worst to best
    print("Constructed availability results from longest to shortest:")
    for key_order in sorted(
        key_order_to_lengths.keys(),
        key=lambda x: key_order_to_lengths[x],
        reverse=True,
    ):
        print(f"\tKey order {key_order}: Length {key_order_to_lengths[key_order]}")
        assert all(
            isinstance(x, key_order[0]) for x in result_trees[key_order].keys()
        ), f"Top-level keys in result tree do not match expected enum type {key_order[0].__name__}: {list(result_trees[key_order].keys())}"
        # print(constructed_availability_results[key_order])
    best_key_order = min(key_order_to_lengths.keys(), key=lambda x: key_order_to_lengths[x])
    print(f"Best key order is {best_key_order} with length {key_order_to_lengths[best_key_order]}")
    print("Final constructed availability tree:")
    print(constructed_availability_results[best_key_order])
