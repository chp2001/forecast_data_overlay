/**
 * @file File for initializing various global variables and data structures
 * that need to be referenceable across multiple files.
 * 
 * Will be loaded near the beginning of the HTML file to ensure
 * precedence over other files.
 * 
 * Code primarily from [JoshCu](www.github.com/JoshCu)'s repository:
 * @see {@link https://github.com/CIROH-UA/NGIAB_data_preprocess}
 */

// add the PMTiles plugin to the maplibregl global.
protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);


// select light-style if the browser is in light mode
// select dark-style if the browser is in dark mode
var style = 'https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/styles/light-style.json';
// (style is only used in after_map.js to initialize the map after this section)
// (nwm_paint and aorc_paint are used once each in map_configs/basic_layers.js)
var colorScheme = "light";
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    style = 'https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/styles/dark-style.json';
    colorScheme = "dark";
}

if (colorScheme == "light") {
    nwm_paint = {
        "line-width": 1,
        "line-color": ["rgba", 0, 0, 0, 1],
    };
    aorc_paint = {
        "line-width": 1,
        "line-color": ["rgba", 71, 58, 222, 1],
    };
}
if (colorScheme == "dark") {
    nwm_paint = {
        "line-width": 1,
        "line-color": ["rgba", 255, 255, 255, 1],
    };
    aorc_paint = {
        "line-width": 1,
        "line-color": ["rgba", 242, 252, 126, 1],
    };
}

// map.on('click', 'catchments', (e) => {
//   cat_id = e.features[0].properties.divide_id;
//   update_map(cat_id, e);
// });

// Create a popup, but don't add it to the map yet.
const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false
});



/**
 * Generalized function to request forecasted precipitation data from the server.
 */
function requestForecastedPrecip(
    selected_time,
    lead_time,
    forecast_cycle,
    scaleX = null,
    scaleY = null,
    rowMin = null,
    rowMax = null,
    colMin = null,
    colMax = null,
    lead_time_end = null,
    range_mode = null
) {
    if (scaleX === null) {
        scaleX = 16;
    }
    if (scaleY === null) {
        scaleY = 16;
    }
    var arg_body = {
        selected_time: selected_time,
        lead_time: lead_time,
        forecast_cycle: forecast_cycle,
        scaleX: scaleX,
        scaleY: scaleY,
        rowMin: rowMin,
        rowMax: rowMax,
        colMin: colMin,
        colMax: colMax,
        lead_time_end: lead_time_end,
        range_mode: range_mode
    }
    console.log('Requesting forecasted precipitation with args:', arg_body);
    return fetch('/get_forecast_precip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arg_body),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok, was ' + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (typeof data === 'string') {
                data = JSON.parse(data);
            }
            console.log('Forecasted precipitation data received:', data);
            return data;
        })
        .catch(error => {
            console.error('Error fetching forecasted precipitation data:', error);
            return null;
        });
}

/**
 * Generalized function to download the netcdfs relevant to the provided parameters.
 * Saves the files to dist/downloads/ directory.
 */
function downloadNetcdfData(
    selected_time,
    lead_time,
    forecast_cycle,
    scaleX = null,
    scaleY = null,
    rowMin = null,
    rowMax = null,
    colMin = null,
    colMax = null,
    lead_time_end = null,
    range_mode = null
) {
    if (scaleX === null) {
        scaleX = 16;
    }
    if (scaleY === null) {
        scaleY = 16;
    }
    var arg_body = {
        selected_time: selected_time,
        lead_time: lead_time,
        forecast_cycle: forecast_cycle,
        scaleX: scaleX,
        scaleY: scaleY,
        rowMin: rowMin,
        rowMax: rowMax,
        colMin: colMin,
        colMax: colMax,
        lead_time_end: lead_time_end,
        range_mode: range_mode
    }
    console.log('Requesting netcdf download with args:', arg_body);
    return fetch("/download_forecast_precip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg_body),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok, was " + response.status);
            }
            // Saving to file was handled server-side, so just return success message
            return response.json();
        })
        .then((data) => {
            console.log("Netcdf download request successful:", data);
            return data;
        })
        .catch((error) => {
            console.error("Error requesting netcdf download:", error);
            return null;
        });
}