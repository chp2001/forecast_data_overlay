var colorDict = {
    selectedCatOutline: getComputedStyle(document.documentElement).getPropertyValue('--selected-cat-outline'),
    selectedCatFill: getComputedStyle(document.documentElement).getPropertyValue('--selected-cat-fill'),
    upstreamCatOutline: getComputedStyle(document.documentElement).getPropertyValue('--upstream-cat-outline'),
    upstreamCatFill: getComputedStyle(document.documentElement).getPropertyValue('--upstream-cat-fill'),
    flowlineToCatOutline: getComputedStyle(document.documentElement).getPropertyValue('--flowline-to-cat-outline'),
    flowlineToNexusOutline: getComputedStyle(document.documentElement).getPropertyValue('--flowline-to-nexus-outline'),
    nexusOutline: getComputedStyle(document.documentElement).getPropertyValue('--nexus-outline'),
    nexusFill: getComputedStyle(document.documentElement).getPropertyValue('--nexus-fill'),
    clearFill: getComputedStyle(document.documentElement).getPropertyValue('--clear-fill')
};

// // These functions are exported by data_processing.js
// document.getElementById('map').addEventListener('click', create_cli_command);
// document.getElementById('start-time').addEventListener('change', create_cli_command);
// document.getElementById('end-time').addEventListener('change', create_cli_command);


// add the PMTiles plugin to the maplibregl global.
let protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);

// select light-style if the browser is in light mode
// select dark-style if the browser is in dark mode
var style = 'https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/styles/light-style.json';
var colorScheme = "light";
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    style = 'https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/styles/dark-style.json';
    colorScheme = "dark";
}
var map = new maplibregl.Map({
    container: "map", // container id
    style: style, // style URL
    center: [-96, 40], // starting position [lng, lat]
    zoom: 4, // starting zoom
});


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


function update_map(cat_id, e) {
    $('#selected-basins').text(cat_id)
    map.setFilter('selected-catchments', ['any', ['in', 'divide_id', cat_id]]);
    map.setFilter('upstream-catchments', ['any', ['in', 'divide_id', ""]])
    fetch('/get_upstream_catids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat_id),
    })
        .then(response => response.json())
        .then(data => {
            map.setFilter('upstream-catchments', ['any', ['in', 'divide_id', ...data]]);
            if (data.length === 0) {
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML('No upstreams')
                    .addTo(map);
            }
        });
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

map.on('mouseenter', 'conus_gages', (e) => {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = 'pointer';

    const coordinates = e.features[0].geometry.coordinates.slice();
    const description = e.features[0].properties.hl_uri + "<br> click for more info";

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup.setLngLat(coordinates).setHTML(description).addTo(map);
});

map.on("mouseleave", "conus_gages", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
});

map.on("click", "conus_gages", (e) => {
    //  https://waterdata.usgs.gov/monitoring-location/02465000
    window.open(
        "https://waterdata.usgs.gov/monitoring-location/" +
        e.features[0].properties.hl_link,
        "_blank",
    );
});

var local_cache = {
    colMin: null,
    colMax: null,
    rowMin: null,
    rowMax: null,
    regionRowMin: null,
    regionRowMax: null,
    regionColMin: null,
    regionColMax: null,
    scaleX: 16,
    scaleY: 16,
    target_time: null,
    lead_time: null,
    forecast_cycle: null,
    lead_time_end: null,
    range_mode: null
};

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
