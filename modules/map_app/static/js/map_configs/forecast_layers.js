
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

    // Layer to show candidate region for selection. Won't be locked in until user confirms
    map.addSource("forecasting_gridlines_candidate_region", {
        type: "geojson",
        data: {
            type: "FeatureCollection",
            features: []
        }
    });

    map.addLayer({
        id: "forecasting_gridlines_candidate_region_layer",
        type: "line",
        source: "forecasting_gridlines_candidate_region",
        paint: {
            "line-color": ["get", "color"],
            "line-width": 2,
            "line-opacity": 0.5
        }
    });

    // Layer to show the region that will limit the next requested data
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

/**
 * Get GeoJSON data from a Maplibre source
 * @param {maplibregl.Source} source 
 * @returns {Object} GeoJSON data
 */
function getGeoJSONFromSource(source) {
    var data = source._data;
    if (!data) {
        console.warn('Source has no data:', source);
        return null;
    } else if (data.geojson) {
        return data.geojson;
    } else {
        return data;
    }
}

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
    var gridline_source = map.getSource("forecasting_gridlines");
    var geojson_data = getGeoJSONFromSource(gridline_source);
    const features = geojson_data.features;

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
function highlightCandidateRegionBounds(rowMin, rowMax, colMin, colMax) {
    // Selects the edge gridlines to highlight the candidate selected region
    // rowMin, rowMax, colMin, colMax are integers
    // const features = map.getSource("forecasting_gridlines")._data.features;
    var gridline_source = map.getSource("forecasting_gridlines");
    var geojson_data = getGeoJSONFromSource(gridline_source);
    const features = geojson_data.features;
    var regionFeatures = [];
    // violet for candidate region
    const candidateColor = "rgba(255, 0, 255, 1)";
    for (let feature of features) {
        if (feature.id.startsWith("horiz-")) {
            // Horizontal line, check if its index is rowMin or rowMax
            const index = parseInt(feature.id.split("-")[1]);
            if (index === rowMin || index === rowMax - 1) {
                modifiedFeature = JSON.parse(JSON.stringify(feature));
                modifiedFeature.properties.color = candidateColor; // Highlight color
                regionFeatures.push(modifiedFeature);
            }
        }
        else if (feature.id.startsWith("vert-")) {
            // Vertical line, check if its index is colMin or colMax
            const index = parseInt(feature.id.split("-")[1]);
            if (index === colMin || index === colMax - 1) {
                modifiedFeature = JSON.parse(JSON.stringify(feature));
                modifiedFeature.properties.color = candidateColor; // Highlight color
                regionFeatures.push(modifiedFeature);
            }
        }
    }
    // Update the source data
    map.getSource("forecasting_gridlines_candidate_region").setData({
        type: "FeatureCollection",
        features: regionFeatures
    });
    console.log('Candidate region bounds highlighted:', { rowMin, rowMax, colMin, colMax });
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
    selectRegionCallbacks.push((rowMin, rowMax, colMin, colMax) => {
        highlightCandidateRegionBounds(
            rowMin / regionProperties.stepRow,
            rowMax / regionProperties.stepRow,
            colMin / regionProperties.stepCol,
            colMax / regionProperties.stepCol
        );
    });
}

function applyGradientColorsToFeatureCollection(featureCollection, minValue, maxValue) {
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
    featureCollection.features.forEach(f => {
        f.properties.color = color(f.properties.value);
    });
}

function applyNOAAThresholdToValue(value_inches, alpha=1.0) {
    // Rainfall (inches)
    // Greater than or equal to 10 
    // rgb(215, 215, 215); // very light gray
    // 8 to 10
    // rgb(114, 64, 214); // purple
    // 6 to 8
    // rgb(246, 0, 242); // magenta
    // 5 to 6
    // rgb(112, 2, 9); // dark red
    // 4 to 5
    // rgb(162, 3, 17); // red
    // 3 to 4
    // rgb(245, 7, 25); // bright red
    // 2.5 to 3
    // rgb(246, 140, 40); // orange
    // 2 to 2.5
    // rgb(253, 212, 105); // yellow-orange
    // 1.5 to 2
    // rgb(248, 250, 61); // yellow
    // 1 to 1.5
    // rgb(14, 89, 24); // darkish-green
    // 0.75 to 1
    // rgb(24, 150, 36); // green
    // 0.5 to 0.75
    // rgb(40, 250, 59); // light-green
    // 0.25 to 0.5
    // rgb(12, 18, 135); // dark-blue
    // 0.1 to 0.25
    // rgb(59, 121, 187); // lightish-blue
    // 0.01 to 0.1
    // rgb(43, 192, 245); // very-light-blue or cyan
    // Missing data
    // rgb(114, 114, 114); // gray
    var thresholds = [
        { min: 10, color: `rgba(215, 215, 215, ${alpha})`}, // very light gray
        { min: 8, color: `rgba(114, 64, 214, ${alpha})`}, // purple
        { min: 6, color: `rgba(246, 0, 242, ${alpha})`}, // magenta
        { min: 5, color: `rgba(112, 2, 9, ${alpha})`}, // dark red
        { min: 4, color: `rgba(162, 3, 17, ${alpha})`}, // red
        { min: 3, color: `rgba(245, 7, 25, ${alpha})`}, // bright red
        { min: 2.5, color: `rgba(246, 140, 40, ${alpha})`}, // orange
        { min: 2, color: `rgba(253, 212, 105, ${alpha})`}, // yellow-orange
        { min: 1.5, color: `rgba(248, 250, 61, ${alpha})`}, // yellow
        { min: 1, color: `rgba(14, 89, 24, ${alpha})`}, // darkish-green
        { min: 0.75, color: `rgba(24, 150, 36, ${alpha})`}, // green
        { min: 0.5, color: `rgba(40, 250, 59, ${alpha})`}, // light-green
        { min: 0.25, color: `rgba(12, 18, 135, ${alpha})`}, // dark-blue
        { min: 0.1, color: `rgba(59, 121, 187, ${alpha})`}, // lightish-blue
        { min: 0.01, color: `rgba(43, 192, 245, ${alpha})`}, // very-light-blue or cyan
    ];
    var error_color = `rgba(114, 114, 114, ${alpha})`;
    // If value is NaN or undefined, return error color
    if (value_inches === null || value_inches === undefined || isNaN(value_inches)) {
        return error_color;
    }
    // Iterate through thresholds from highest to lowest
    for (let threshold of thresholds) {
        if (value_inches >= threshold.min) {
            return threshold.color;
        }
    }
    // Past the last threshold, scale down the alpha based on distance from the lowest threshold
    var lowestThreshold = thresholds[thresholds.length - 1].min;
    var lowestThresholdColor = thresholds[thresholds.length - 1].color;
    if (value_inches > 0 && value_inches < lowestThreshold) {
        var scale = value_inches / lowestThreshold; // Scale from 0 to 1
        // Extract the RGB values from the color string
        var rgb = lowestThresholdColor.match(/\d+/g);
        var r = parseInt(rgb[0]);
        var g = parseInt(rgb[1]);
        var b = parseInt(rgb[2]);
        var scaledAlpha = alpha * scale; // Scale the alpha
        return `rgba(${r}, ${g}, ${b}, ${scaledAlpha})`;
    }
    // If value is 0 or negative, return error color
    
    return error_color;
}

function applyColorsToFeatureCollection(featureCollection) {
    // const method = 'gradient';
    const method = 'thresholds';
    if (method === 'gradient') {
        // Use previous method of coloring based on value compared to min and max
        var values = featureCollection.features.map(f => f.properties.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        applyGradientColorsToFeatureCollection(featureCollection, minValue, maxValue);
    } else if (method === 'thresholds') {
        const alpha = 1.0;
        // Try to use fixed thresholds seen in noaa's precipitation map
        // Values begin as kg/m^2/s, convert to inches using water's density of ~1000 kg/m^3
        // 1 kg/m^2 = 1 mm of water
        // 1 mm = 0.0393701 inches
        // depending on what this results in, we may need to convert to /hr instead of /s
        const convertToInches = (value_kg_m2_s) => {
            return value_kg_m2_s * 0.0393701 * 3600; // Convert to inches per hour
        };
        featureCollection.features.forEach(f => {
            const value_inches = convertToInches(f.properties.value);
            f.properties.color = applyNOAAThresholdToValue(value_inches, alpha);
            f.properties.value_inches = value_inches; // Store the converted value for reference
        });
    }
}

function applyValuesToFeatureCollection(featureCollection, values) {
    // Assume values and features are the same length and in the same order
    for (let i = 0; i < featureCollection.features.length; i++) {
        featureCollection.features[i].properties.value = values[i];
    }
}

/**
 * Build a GeoJSON FeatureCollection from an array of geometries
 * Each geometry is an array of four points that form a rectangle
 * @param {Array} geometry - Array of geometries, each geometry is an array of four [x, y] points
 * @returns {Object} GeoJSON FeatureCollection
 */
function buildFeatureCollection(geometry) {
    var features = [];
    for (let i = 0; i < geometry.length; i++) {
        const geom = geometry[i];
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
                color: "rgba(0, 0, 0, 0)", // Temporary, will be set later
                value: 0.0, // Temporary, will be set later
                center: [centerX, centerY] // Add center point for popup
            }
        });
    }
    var featureCollection = {
        type: "FeatureCollection",
        features: features
    };
    return featureCollection;
}

/**
 * Update a GeoJSON FeatureCollection with new values for a specific timestep
 * by pulling the values from data_cache.timestep_values
 * @param {Object} featureCollection - GeoJSON FeatureCollection to update
 * @param {number} timestep - Timestep to use for updating values
 */
function updateFeatureCollectionWithTimeStep(featureCollection, timestep) {
    if (!(timestep in data_cache.timestep_values)) {
        console.warn('Timestep not found in data_cache:', timestep);
        return;
    }
    const values = data_cache.timestep_values[timestep];
    applyValuesToFeatureCollection(featureCollection, values);
    applyColorsToFeatureCollection(featureCollection);
}


// Function to update the forecasted precipitation overlay with received data
var receivedData = null;

function updateForecastLayer(data) {
    // Assume data is already parsed correctly
    receivedData = data;

    var featureCollection = buildFeatureCollection(data["geometries"]);
    var values = null;
    if (data["timestep_values"]) {
        // If format is {timestep: [values]}, we initialize with the cached lead_time values
        // values = data["timestep_values"][local_cache["lead_time"]];
        updateFeatureCollectionWithTimeStep(featureCollection, local_cache["lead_time"]);
    } else {
        values = data["values"];
        applyValuesToFeatureCollection(featureCollection, values);
        // Apply colors to the features based on their values
        applyColorsToFeatureCollection(featureCollection);
    }
    // Update the source data
    map.getSource("forecasted_precip").setData(featureCollection);
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
    const lead_time_end = local_cache["lead_time_end"];
    const range_mode = local_cache["range_mode"];
    return requestForecastedPrecip(
        targetTime,
        leadTime,
        forecastCycle,
        scaleX,
        scaleY,
        rowMin,
        rowMax,
        colMin,
        colMax,
        lead_time_end,
        range_mode
    ).then(data => {
        if (data) {
            // Update data_cache
            data_cache.geometry = data["geometries"];
            if (data["timestep_values"]) {
                // If multiple time steps were received, store them all
                data_cache.timestep_values = data["timestep_values"];
            } else {
                // If only one time step received, store it under the leadTime key
                data_cache.timestep_values = {
                    leadTime: data["values"]
                };
            }

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
    const value_inches = e.features[0].properties.value_inches;
    const coordinates = e.features[0].geometry.coordinates[0][0];
    // Use the center point for the popup
    const center = JSON.parse(e.features[0].properties.center);

    // Create a popup at the center of the polygon with the value
    new maplibregl.Popup()
        .setLngLat(center)
        .setHTML(`RAINRATE:<br>${value} kg/m^2/s<br>${value_inches.toFixed(3)} in/hr`)
        .addTo(map);
    console.log('Clicked on forecasted precipitation layer at', coordinates, 'with value', value);
});

// RANGE SLIDER RELEVANT CODE
// Set up interactivity with the time_config_element's prototype
// range slider for adjusting the displayed data
// animationControlElement.onRangeSliderChangeFuncs['forecast_layers'] = (selectedLeadTime) => {
animationControlElement.onRangeSliderChangeFuncs.add('forecast_layers', (selectedLeadTime) => {
    // console.log('Range slider changed, displaying data from new lead time:', selectedLeadTime);
    // Pull the data from the map's source data
    var featureCollection = map.getSource("forecasted_precip")._data;
    // Update the feature collection with the new lead time's values
    updateFeatureCollectionWithTimeStep(featureCollection, selectedLeadTime);
    // Update the source data to refresh the map
    map.getSource("forecasted_precip").setData(featureCollection);
});