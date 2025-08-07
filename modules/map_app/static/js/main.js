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

map.on("load", () => {
  map.addSource("camels_basins", {
    type: "vector",
    url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/camels.pmtiles",
  });
  map.addLayer({
    id: "camels",
    type: "line",
    source: "camels_basins",
    "source-layer": "camels_basins",
    layout: {},
    filter: ["any", ["==", "hru_id", ""]],
    paint: {
      "line-width": 1.5,
      "line-color": ["rgba", 134, 30, 232, 1],
    },
  });
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


map.on("load", () => {
  map.addSource("nwm_zarr_chunks", {
    type: "vector",
    url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/nwm_retro_v3_zarr_chunks.pmtiles",
  });
  map.addSource("aorc_zarr_chunks", {
    type: "vector",
    url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/aorc_zarr_chunks.pmtiles",
  });
  map.addLayer({
    id: "nwm_zarr_chunks",
    type: "line",
    source: "nwm_zarr_chunks",
    "source-layer": "nwm_zarr_chunks",
    layout: {},
    filter: ["any"],
    paint: nwm_paint,
  });
  map.addLayer({
    id: "aorc_zarr_chunks",
    type: "line",
    source: "aorc_zarr_chunks",
    "source-layer": "aorc_zarr_chunks",
    layout: {},
    filter: ["any"],
    paint: aorc_paint,
  });
});

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
show = false;

// TOGGLE BUTTON LOGIC
function initializeToggleSwitches() {
  // Find all toggle switches
  const toggleSwitches = document.querySelectorAll(".toggle-switch");
  // Process each toggle switch
  toggleSwitches.forEach((toggleSwitch) => {
    const toggleInput = toggleSwitch.querySelector(".toggle-input");
    const toggleHandle = toggleSwitch.querySelector(".toggle-handle");
    const leftText =
      toggleSwitch.querySelector(".toggle-text-left").textContent;
    const rightText =
      toggleSwitch.querySelector(".toggle-text-right").textContent;
    // Set initial handle text based on the default state using data attribute
    toggleHandle.textContent = toggleInput.checked ? rightText : leftText;
    // Add event listener
    toggleInput.addEventListener("change", function () {
      setTimeout(() => {
        if (this.checked) {
          toggleHandle.textContent = rightText;
        } else {
          toggleHandle.textContent = leftText;
        }
      }, 180);
    });
  });
}
document.addEventListener("DOMContentLoaded", initializeToggleSwitches);

function createToggleButton(buttonId, defaultText) {
  // Create, insert, and return a toggle button
  const button = document.createElement("button");
  button.id = buttonId;
  if (buttonId.startsWith("#")) {
    // # is a selector, not an ID
    button.id = buttonId.slice(1);
  }
  button.textContent = defaultText;
  button.className = "toggle-button";
  const optionsContent = document.querySelector("#options-content");
  if (optionsContent) {
    optionsContent.appendChild(button);
  } else {
    console.warn("Options content not found. Cannot append toggle button.");
  }
  return button;
}

var toggleShows = {};
var toggleFunctions = {}; // Storing functions allows us to call them ourselves if needed
function setupToggleButton(buttonId, layerId, toggleKey, filterCondition, showText, hideText) {
  var toggleButton = document.querySelector(buttonId);
  if (!toggleButton) {
    // console.warn(`Toggle button with ID ${buttonId} not found.`);
    // return;
    // Create a new toggle button if it doesn't exist
    toggleButton = createToggleButton(buttonId, showText);
  }
  if (toggleShows[toggleKey] === undefined) {
    toggleShows[toggleKey] = false; // Initialize the toggle state
  }
  // toggleButton.addEventListener("click", () => {
  //   if (toggleShows[toggleKey]) {
  //     map.setFilter(layerId, filterCondition);
  //     toggleButton.innerText = showText;
  //     toggleShows[toggleKey] = false;
  //   } else {
  //     map.setFilter(layerId, null);
  //     toggleButton.innerText = hideText;
  //     toggleShows[toggleKey] = true;
  //   }
  // });
  toggleFunctions[toggleKey] = () => {
    if (toggleShows[toggleKey]) {
      map.setFilter(layerId, filterCondition);
      toggleButton.innerText = showText;
      toggleShows[toggleKey] = false;
    } else {
      map.setFilter(layerId, null);
      toggleButton.innerText = hideText;
      toggleShows[toggleKey] = true;
    }
  };
  toggleButton.addEventListener("click", toggleFunctions[toggleKey]);
}

// showGages = false;
// const toggleButtonGages = document.querySelector("#toggle-button-gages");
// toggleButtonGages.addEventListener("click", () => {
//   if (showGages) {
//     map.setFilter("conus_gages", ["any", ["==", "hl_uri", ""]]);
//     toggleButtonGages.innerText = "Show gages";
//     showGages = false;
//   } else {
//     map.setFilter("conus_gages", null);
//     toggleButtonGages.innerText = "Hide gages";
//     showGages = true;
//   }
// });
setupToggleButton(
  "#toggle-button-gages",
  "conus_gages",
  "showGages",
  ["any", ["==", "hl_uri", ""]],
  "Show gages",
  "Hide gages"
)


// showCamels = false;
// const toggleButtonCamels = document.querySelector("#toggle-button-camels");
// toggleButtonCamels.addEventListener("click", () => {
//   if (showCamels) {
//     map.setFilter("camels", ["any", ["==", "hru_id", ""]]);
//     toggleButtonCamels.innerText = "Show CAMELS basins";
//     showCamels = false;
//   } else {
//     map.setFilter("camels", null);
//     toggleButtonCamels.innerText = "Hide CAMELS basins";
//     showCamels = true;
//   }
// });
setupToggleButton(
  "#toggle-button-camels",
  "camels",
  "showCamels",
  ["any", ["==", "hru_id", ""]],
  "Show CAMELS basins",
  "Hide CAMELS basins"
)

// showNwm = false;
// const toggleButtonNwm = document.querySelector("#toggle-button-nwm");
// toggleButtonNwm.addEventListener("click", () => {
//   if (showNwm) {
//     map.setFilter("nwm_zarr_chunks", ["any"]);
//     toggleButtonNwm.innerText = "Overlay NWM chunks";
//     showNwm = false;
//   } else {
//     map.setFilter("nwm_zarr_chunks", null);
//     toggleButtonNwm.innerText = "Hide NWM chunks";
//     showNwm = true;
//   }
// });
setupToggleButton(
  "#toggle-button-nwm",
  "nwm_zarr_chunks",
  "showNwm",
  ["any"],
  "Overlay NWM chunks",
  "Hide NWM chunks"
);

// showAorc = false;
// const toggleButtonAorc = document.querySelector("#toggle-button-aorc");
// toggleButtonAorc.addEventListener("click", () => {
//   if (showAorc) {
//     map.setFilter("aorc_zarr_chunks", ["any"]);
//     toggleButtonAorc.innerText = "Overlay AORC chunks";
//     showAorc = false;
//   } else {
//     map.setFilter("aorc_zarr_chunks", null);
//     toggleButtonAorc.innerText = "Hide AORC chunks";
//     showAorc = true;
//   }
// });
setupToggleButton(
  "#toggle-button-aorc",
  "aorc_zarr_chunks",
  "showAorc",
  ["any"],
  "Overlay AORC chunks",
  "Hide AORC chunks"
)


// Set up the map overlay for forecasted precipitation
// We don't have a tilemap ready for this, so we need to create the geometries ourselves

map.on("load", () => {
  map.addSource("forecasting_gridlines", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: []
    }
  });

  map.addLayer({
    id: "forecasting_gridlines_layer",
    type: "line",
    source: "forecasting_gridlines",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 1,
      "line-opacity": 0.1
    }
  });
});

// Populate the forecasting gridlines on the map
function updateForecastingGridlines() {
  // Fetch the forecasting gridlines data from the server
  // This function returns a promise that resolves to true if the gridlines were updated successfully
  // If the data is not available, it will log an error and return false
  // This allows us to have logic based on the success or failure of the request
  return fetch('/get_forecasted_forcing_grid')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      console.log('Forecasting gridlines data received:', data);
      const features = [];
      // Process horizontal gridlines
      // Each line is an array of tuples [x, y]
      data.horiz_gridlines.forEach(line => {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: line.map(point => [point[0], point[1]]),
          },
          properties: {
            // color: "rgba(255, 0, 0, 1)" // Red color for horizontal lines
            color: "rgba(0, 0, 255, 1)" // Blue color for horizontal lines
          }
        });
      });
      // Process vertical gridlines
      data.vert_gridlines.forEach(line => {
        features.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: line.map(point => [point[0], point[1]]),
          },
          properties: {
            color: "rgba(0, 0, 255, 1)" // Blue color for vertical lines
          }
        });
      });
      // Update the source data
      map.getSource("forecasting_gridlines").setData({
        type: "FeatureCollection",
        features: features
      });
      // We were successful, return true
      console.log('Forecasting gridlines updated successfully.');
      return true;
    })
    .catch(error => {
      console.error('Error fetching forecasting gridlines data:', error);
    });
}
show_gridlines = true;
if (show_gridlines) {
  map.on("load", updateForecastingGridlines); // Load gridlines on map load
}

map.on("load", () => {
  map.addSource("forecasted_precip", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: []
    }
  });

  map.addLayer({
    id: "forecasted_precip_layer",
    type: "fill",
    source: "forecasted_precip",
    paint: {
      "fill-color": ["get", "color"],
      "fill-opacity": 0.5
    }
  });
});

// showForecastedPrecip = false
// const toggleButtonForecastedPrecip = document.querySelector("#toggle-button-forecast");
// toggleButtonForecastedPrecip.addEventListener("click", () => {
//   if (showForecastedPrecip) {
//     map.setFilter("forecasted_precip_layer", ["==", "color", ""]);
//     toggleButtonForecastedPrecip.innerText = "Show forecasted precipitation";
//     showForecastedPrecip = false;
//   } else {
//     map.setFilter("forecasted_precip_layer", null);
//     toggleButtonForecastedPrecip.innerText = "Hide forecasted precipitation";
//     showForecastedPrecip = true;
//   }
// });
setupToggleButton(
  "#toggle-button-forecast",
  "forecasted_precip_layer",
  "showForecastedPrecip",
  ["==", "color", ""],
  "Show forecasted precipitation",
  "Hide forecasted precipitation"
);

// toggleFunctions["showForecastedPrecip"](); // Start with it shown
// document.addEventListener("DOMContentLoaded", toggleFunctions["showForecastedPrecip"]); // Start with it shown
map.on("load", toggleFunctions["showForecastedPrecip"]); // Start with it shown

// Function to update the forecasted precipitation overlay with received data
var receivedData = null;
function updateForecastLayer(data) {
  if (typeof data === 'string') {
    data = JSON.parse(data); // Ensure data is parsed correctly
  }
  receivedData = data;
  // // Data is an object that contains a 2D list of points and a 2D list of values
  // const points = data["points"];
  // Swapped the 2D list of points and values for 1D lists of geometries and their values
  const geoms = data["geometries"];
  const values = data["values"];
  // const minValue = Math.min(...values.flat());
  // const maxValue = Math.max(...values.flat());
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const color = (value) => {
    if (value === minValue || Math.abs(value - minValue) < 1e-6) {
      return "rgba(0, 0, 0, 0)"; // Transparent
    }
    // Map the value to a color based on a gradient
    const ratio = (value - minValue) / (maxValue - minValue);
    const g = Math.floor(255 * (1 - ratio));
    const r = Math.floor(255 * ratio);
    const a = Math.sqrt(ratio); // Adjust alpha for better visibility
    return `rgba(${r}, ${g}, 0, ${a})`; // Green to red gradient
  }
  // For each point, create a polygon feature using the neighboring points
  var features = [];
  // for (let i = 0; i < points.length - 1; i++) {
  //   for (let j = 0; j < points[i].length - 1; j++) {
  //     const curPos = points[i][j];
  //     const nextPosX = points[i][j + 1];
  //     const nextPosY = points[i + 1][j];
  //     const nextPosXY = points[i + 1][j + 1];
  //     const value = values[i][j];
  //     features.push({
  //       type: "Feature",
  //       geometry: {
  //         type: "Polygon",
  //         coordinates: [[
  //           [curPos[0], curPos[1]],
  //           [nextPosX[0], nextPosX[1]],
  //           [nextPosXY[0], nextPosXY[1]],
  //           [nextPosY[0], nextPosY[1]],
  //         ]]
  //       },
  //       properties: {
  //         color: color(value),
  //         value: value 
  //       }
  //     });
  //   }
  // }
  for (let i = 0; i < geoms.length; i++) {
    const geom = geoms[i];
    const value = values[i];
    // The geometry is a list of four points that form a rectangle
    if (geom.length < 4) {
      console.warn('Geometry has less than 4 points, skipping:', geom);
      continue; // Skip geometries that don't have enough points
    }
    const centerX = (geom[0][0] + geom[2][0]) / 2;
    const centerY = (geom[0][1] + geom[2][1]) / 2;
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [[
          [geom[0][0], geom[0][1]],
          [geom[1][0], geom[1][1]],
          [geom[2][0], geom[2][1]],
          [geom[3][0], geom[3][1]],
          [geom[0][0], geom[0][1]], // Close the polygon
        ]]
      },
      properties: {
        color: color(value),
        value: value,
        center: [centerX, centerY] // Add center point for popup
      }
    });
  }
  // Update the source data
  map.getSource("forecasted_precip").setData({
    type: "FeatureCollection",
    features: features
  });
  console.log('Forecasted precipitation overlay updated with data:', data);

}

// Set up geometry popups for RAINRATE values
map.on("click", "forecasted_precip_layer", (e) => {
  const value = e.features[0].properties.value;
  const coordinates = e.features[0].geometry.coordinates[0][0];
  // Use the center point for the popup
  const center = JSON.parse(e.features[0].properties.center);

  // Create a popup at the center of the polygon with the value
  new maplibregl.Popup()
    .setLngLat(center)
    .setHTML(`RAINRATE: ${value} kg/m^2/s`)
    .addTo(map);
  console.log('Clicked on forecasted precipitation layer at', coordinates, 'with value', value);
});


// Accessing forecasted forcing data

function updateForecastedPrecipOverlay() {
  // Fetch the forecasted precipitation data from the server
  // This function returns a promise that resolves to true if the overlay was updated successfully
  // If the data is not available, it will log an error and return false
  // This allows us to have logic based on the success or failure of the request
  return fetch('/get_forecast_precip', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      if (typeof data === 'string') {
        data = JSON.parse(data); // Ensure data is parsed correctly
      }
      console.log('Forecasted precipitation data received:', data);
      // Update the map overlay with the received data
      updateForecastLayer(data);
      // We were successful, return true
      console.log('Forecasted precipitation overlay updated successfully.');
      return true;
    })
    .catch(error => {
      console.error('Error fetching forecasted precipitation data:', error);
    });
}

function sendScaleValues(scaleX, scaleY) {
  // Takes scaleX and scaleY as strings, sends them to the server
  // Returns a promise that resolves to the response from the server
  // This allows us to have logic based on the success or failure of the request
  return fetch('/set_scales', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scaleX: scaleX,
      scaleY: scaleY
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    });
}

function setScaleLogic() {
  // Get the temporary scale values from scale-y-value and scale-x-value spans
  // Then we try to set the scale values server-side.
  // If it succeeds, we try to update the map with the new scale values.
  // If that succeeds, we update the scale values in the UI.
  const scaleX = document.getElementById('scale-x-value').textContent;
  const scaleY = document.getElementById('scale-y-value').textContent;
  const oldScaleX = document.getElementById('set-scale-x-value').textContent;
  const oldScaleY = document.getElementById('set-scale-y-value').textContent
  // Check if the scale values have changed
  if (scaleX === oldScaleX && scaleY === oldScaleY) {
    console.log('Scale values have not changed, skipping update.');
    return; // No need to update if the values haven't changed
  }
  console.log('Setting scale to:', scaleX, scaleY);
  // return sendScaleValues(scaleX, scaleY)
  //   .then(data => {
  //     console.log('Scale set successfully:', data);
  //     // Update the UI with the new scale values
  //     document.getElementById('set-scale-x-value').textContent = scaleX;
  //     document.getElementById('set-scale-y-value').textContent = scaleY;
  //     // Update the map with the new scale values
  //     map.setPaintProperty('forecasted_precip_layer', 'fill-extrusion-scale', [parseFloat(scaleX), parseFloat(scaleY)]);
  //   })
  //   .catch(error => {
  //     console.error('Error setting scale:', error);
  //   });
  result = sendScaleValues(scaleX, scaleY);
  result = result.then(data => {
    if (data) {
      console.log('Scale set successfully:', data);
      console.log('Trying to update the gridlines with the new scale values');
      return updateForecastingGridlines()
    }
    else {
      throw new Error('Failed to set scale values');
    }
  });
  // If the set-time values are set, we can try to update the forecasted precipitation overlay
  var selectedTime = document.getElementById('selected-time').textContent;
  var doForecastedPrecip = selectedTime !== "None";
  result = result.then(data => {
    if (data) {
      console.log('Gridlines updated successfully with new scale values');
      console.log('Trying to update the forecasted precipitation overlay with the new scale values');
      if (doForecastedPrecip) {
        return updateForecastedPrecipOverlay();
      }
      else {
        console.log('Skipping forecasted precipitation overlay update as selected time is None');
        return true; // Continue the promise chain
      }
    } else {
      throw new Error('Failed to update gridlines with new scale values');
    }
  });
  result = result.then(data => {
    if (data) {
      if (doForecastedPrecip) {
        console.log('Forecasted precipitation overlay updated successfully with new scale values');
      }
      // Update the UI with the new scale values
      document.getElementById('set-scale-x-value').textContent = scaleX;
      document.getElementById('set-scale-y-value').textContent = scaleY;
      console.log('Scale values updated in the UI:', scaleX, scaleY);
    } else {
      throw new Error('Failed to update forecasted precipitation overlay with new scale values');
    }
  });
  result = result.catch(error => {
    console.error('Error setting scale:', error);
  });
  return result; // Return the promise chain for further handling if needed
}


// set-scale button logic
document.getElementById('set-scale').addEventListener('click', setScaleLogic);

// set-time button logic
document.getElementById('set-time').addEventListener('click', function () {
  const targetTime = document.getElementById('target-time').value;
  const leadTime = document.getElementById('lead-time').value;
  const forecastCycle = document.getElementById('forecast-cycle').value;
  const prevTime = document.getElementById('selected-time').textContent;
  const prevLeadTime = document.getElementById('selected-lead-time').textContent;
  const prevForecastCycle = document.getElementById('selected-forecast-cycle').textContent
  var changed = false;
  // Check if any of the values have changed
  if (targetTime !== prevTime || leadTime !== prevLeadTime || forecastCycle !== prevForecastCycle) {
    changed = true;
  }
  if (changed) {
    document.getElementById('selected-time').textContent = targetTime;
    document.getElementById('selected-lead-time').textContent = leadTime;
    document.getElementById('selected-forecast-cycle').textContent = forecastCycle;

    // Need to send the time as YYYYMMDD, but input provides it as YYYY-MM-DDTHH:MM
    var formattedTime = targetTime.replace(/-/g, '');
    const Tindex = formattedTime.indexOf('T');
    if (Tindex !== -1) {
      formattedTime = formattedTime.substring(0, Tindex);
    }


    // Trigger the time change event
    fetch('/set_time', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_time: formattedTime,
        lead_time: leadTime,
        forecast_cycle: forecastCycle
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log('Time set successfully:', data);
      })
      .then(() => {
        // Fetch and update the forecasted precipitation data
        updateForecastedPrecipOverlay();
      })
      .catch(error => {
        console.error('Error setting time:', error);
      });
  }
});

// On page load, we use the `tryget_resume_session` endpoint to check if there is a session to resume
function updateWithResumedSession(data) {
  if (!data) {
    console.error('No data received for resumed session.');
    return;
  }
  if (data.selected_time) {
    var selectedTime = data.selected_time;
    // Received value is YYYYMMDD, convert it to YYYY-MM-DDTHH:MM
    selectedTime = selectedTime.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3T00:00');
    document.getElementById('selected-time').textContent = selectedTime;
    document.getElementById('target-time').value = selectedTime;
  }
  if (data.lead_time) {
    document.getElementById('selected-lead-time').textContent = data.lead_time;
    document.getElementById('lead-time').value = data.lead_time;
  }
  if (data.forecast_cycle) {
    document.getElementById('selected-forecast-cycle').textContent = data.forecast_cycle;
    document.getElementById('forecast-cycle').value = data.forecast_cycle;
  }
  if (data.scaleX) {
    document.getElementById('set-scale-x-value').textContent = data.scaleX;
  }
  if (data.scaleY) {
    document.getElementById('set-scale-y-value').textContent = data.scaleY;
  }
  if (data.forecasted_forcing_data_dict) {
    console.log('Resuming session with forecasted forcing data:', data.forecasted_forcing_data_dict);
    updateForecastLayer(data.forecasted_forcing_data_dict);
  }
  // If there are any other session data to resume, handle them here
}

// If response is 200, we update the page with the resumed session data
// If response is 404, we do nothing, there is no session to resume
function fetchResumeSession() {
  fetch('/tryget_resume_session')
    .then(response => {
      if (response.status === 200) {
        return response.json();
      } else if (response.status === 404) {
        console.log('No session to resume.');
        return null;
      } else {
        throw new Error('Unexpected response status: ' + response.status);
      }
    })
    .then(data => {
      if (data) {
        updateWithResumedSession(data);
      }
    })
    .catch(error => {
      console.error('Error fetching resumed session data:', error);
    }
  );
}
// On page load, we check if there is a session to resume
// document.addEventListener('DOMContentLoaded', fetchResumeSession);
// still too early, errors due to map not being ready
map.on('load', fetchResumeSession);