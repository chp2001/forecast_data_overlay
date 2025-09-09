
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

  map.addSource("forecasting_gridlines_region", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: []
    }
  });

  map.addLayer({
    id: "forecasting_gridlines_region_layer",
    type: "line",
    source: "forecasting_gridlines_region",
    paint: {
      "line-color": ["get", "color"],
      "line-width": 2,
      "line-opacity": 1.0
    }
  });
});
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
      data.horiz_gridlines.forEach((line, idx) => {
        features.push({
          type: "Feature",
          id: `horiz-${idx}`,
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
      data.vert_gridlines.forEach((line, idx) => {
        features.push({
          type: "Feature",
          id: `vert-${idx}`,
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
      // Use gridline data to set the region selection properties
      
      const scaleX = data.scaleX;
      const scaleY = data.scaleY;
      const numRows = data.horiz_gridlines.length * scaleY;
      const numCols = data.vert_gridlines.length * scaleX;
      externalSetRegionBounds(0, numRows, 0, numCols, scaleY, scaleX);

      return true;
    })
    .catch(error => {
      console.error('Error fetching forecasting gridlines data:', error);
    });
}
function highlightRegionBounds(rowMin, rowMax, colMin, colMax) {
  // Selects the edge gridlines to highlight the selected region
  // rowMin, rowMax, colMin, colMax are integers
  const features = map.getSource("forecasting_gridlines")._data.features;
  var regionFeatures = [];
  for (let feature of features) {
    if (feature.id.startsWith("horiz-")) {
      // Horizontal line, check if its index is rowMin or rowMax
      const index = parseInt(feature.id.split("-")[1]);
      if (index === rowMin || index === rowMax - 1) {
        modifiedFeature = JSON.parse(JSON.stringify(feature));
        modifiedFeature.properties.color = "rgba(255, 0, 0, 1)"; // Highlight color
        regionFeatures.push(modifiedFeature);
      }
    }
    else if (feature.id.startsWith("vert-")) {
      // Vertical line, check if its index is colMin or colMax
      const index = parseInt(feature.id.split("-")[1]);
      if (index === colMin || index === colMax - 1) {
        modifiedFeature = JSON.parse(JSON.stringify(feature));
        modifiedFeature.properties.color = "rgba(255, 0, 0, 1)"; // Highlight color
        regionFeatures.push(modifiedFeature);
      }
    }
  }
  // Update the source data
  map.getSource("forecasting_gridlines_region").setData({
    type: "FeatureCollection",
    features: regionFeatures
  });
  console.log('Region bounds highlighted:', { rowMin, rowMax, colMin, colMax });
}
show_gridlines = true;
if (show_gridlines) {
  map.on("load", updateForecastingGridlines); // Load gridlines on map load
  setRegionCallbacks.push(() => {
    highlightRegionBounds(
      targetRegionBounds.rowMin / regionProperties.stepRow,
      targetRegionBounds.rowMax / regionProperties.stepRow,
      targetRegionBounds.colMin / regionProperties.stepCol,
      targetRegionBounds.colMax / regionProperties.stepCol
    );
  });
}


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
