
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
    const targetTime = local_cache["target_time"];
    const leadTime = local_cache["lead_time"];
    const forecastCycle = local_cache["forecast_cycle"];
    const scaleX = local_cache["scaleX"];
    const scaleY = local_cache["scaleY"];
    const rowMin = local_cache["rowMin"];
    const rowMax = local_cache["rowMax"];
    const colMin = local_cache["colMin"];
    const colMax = local_cache["colMax"];
    return requestForecastedPrecip(
        targetTime,
        leadTime,
        forecastCycle,
        scaleX,
        scaleY,
        rowMin,
        rowMax,
        colMin,
        colMax
    ).then(data => {
        if (data) {
            // Update the map overlay with the received data
            updateForecastLayer(data);
            // We were successful, return true
            console.log('Forecasted precipitation overlay updated successfully.');
            return true;
        } else {
            console.warn('No data received for forecasted precipitation.');
            return false;
        }
    }).catch(error => {
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
