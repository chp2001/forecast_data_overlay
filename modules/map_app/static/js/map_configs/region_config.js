/**
 * @file Functionality for the region selection configuration interface.
 * @author chp2001 <https://github.com/chp2001>
 */

/** @const {Boolean} - Whether to enable debug logging. Set to true to enable debug logs, false to disable.*/
const region_config_debug = false;

/**
 * Logs messages to the console if region_config_debug is true.
 * Intended only for use within this file.
 * @param  {...any} args - The messages or objects to log to the console.
 */
function r_c_d_log(...args) {
    if (region_config_debug) {
        console.log("[region_config]", ...args);
    }
}

// New method using the region-selector component
/**
 * @type {region_selector}
 */
const regionSelectorElement = document.getElementById('region-selector');
if (!regionSelectorElement) {
    throw new Error('Region selector element not found');
}

// Store the target region bounds globally for access when fetching data
var targetRegionBounds = {
    rowMin: regionSelectorElement.rowMinSetValue,
    rowMax: regionSelectorElement.rowMaxSetValue,
    colMin: regionSelectorElement.colMinSetValue,
    colMax: regionSelectorElement.colMaxSetValue
}
// Store the properties of the region sliders for use when they change due to other actions
var regionProperties = {
    minimumRow: regionSelectorElement.yMinSlider.min,
    maximumRow: regionSelectorElement.yMaxSlider.max,
    stepRow: regionSelectorElement.yMinSlider.step,
    minimumCol: regionSelectorElement.xMinSlider.min,
    maximumCol: regionSelectorElement.xMaxSlider.max,
    stepCol: regionSelectorElement.xMinSlider.step,
}
function updateRegionProperties() {
    // Update the regionProperties object
    regionProperties.minimumRow = regionSelectorElement.yMinSlider.min;
    regionProperties.maximumRow = regionSelectorElement.yMaxSlider.max;
    regionProperties.stepRow = regionSelectorElement.yMinSlider.step;
    regionProperties.minimumCol = regionSelectorElement.xMinSlider.min;
    regionProperties.maximumCol = regionSelectorElement.xMaxSlider.max;
    regionProperties.stepCol = regionSelectorElement.xMinSlider.step;
}
function updateTargetRegionBounds() {
    targetRegionBounds.rowMin = regionSelectorElement.rowMinSetValue;
    targetRegionBounds.rowMax = regionSelectorElement.rowMaxSetValue;
    targetRegionBounds.colMin = regionSelectorElement.colMinSetValue;
    targetRegionBounds.colMax = regionSelectorElement.colMaxSetValue;
}
// Translating the sendSelectedRegion function
function sendSelectedRegion() {
    // Just saves relevant values to local_cache for use when fetching data
    local_cache["colMin"] = regionSelectorElement.colMinSetValue;
    local_cache["colMax"] = regionSelectorElement.colMaxSetValue;
    local_cache["rowMin"] = regionSelectorElement.rowMinSetValue;
    local_cache["rowMax"] = regionSelectorElement.rowMaxSetValue;
    local_cache["regionRowMin"] = regionProperties.minimumRow;
    local_cache["regionRowMax"] = regionProperties.maximumRow;
    local_cache["regionColMin"] = regionProperties.minimumCol;
    local_cache["regionColMax"] = regionProperties.maximumCol;
    r_c_d_log("Saved selected region to local cache:", local_cache);
}
// Translating the setRegionCallbacks functionality
var setRegionCallbacks = [];
function callSetRegion() {
    setRegionCallbacks.forEach((callback) => {
        callback();
    });
}
var selectRegionCallbacks = [];
function callSelectRegion(rowMin, rowMax, colMin, colMax) {
    selectRegionCallbacks.forEach((callback) => {
        callback(rowMin, rowMax, colMin, colMax);
    });
}
// Translating the externalSetRegionBounds function
function externalSetRegionBounds(rowMin, rowMax, colMin, colMax, rowStep, colStep) {
    regionSelectorElement.setSliderBounds({
        rowMin: rowMin,
        rowMax: rowMax,
        colMin: colMin,
        colMax: colMax,
    });
    // Update the regionProperties object
    updateRegionProperties();
    callSetRegion();
    // rowStep and colStep are not currently set up to be easily changed externally...
    if (rowStep !== undefined && rowStep !== 16) {
        // Fail loudly to get dev attention
        throw new Error("Non-default rowStep provided to externalSetRegionBounds, but changing rowStep is not currently supported: " + rowStep);
    }
    if (colStep !== undefined && colStep !== 16) {
        // Fail loudly to get dev attention
        throw new Error("Non-default colStep provided to externalSetRegionBounds, but changing colStep is not currently supported: " + colStep);
    }
    r_c_d_log("Region sliders externally set. Target region properties now:", regionProperties);
}
// Translating the externalSetRegionValues function
function externalSetRegionValues(rowMin, rowMax, colMin, colMax) {
    // Triggers both the set and select functions of the component
    regionSelectorElement.setFull({
        rowMin: rowMin,
        rowMax: rowMax,
        colMin: colMin,
        colMax: colMax
    });
    updateTargetRegionBounds();
    callSetRegion();
    r_c_d_log("Region slider values externally set. Target region bounds now:", targetRegionBounds);
}

// Callbacks for when the sliders are adjusted without setting them
regionSelectorElement.addOnRegionSelectionFunction(
    'region-config-selection-update', 
    ({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) =>
    {
        // Send the selected region to the callbacks
        callSelectRegion(
            regionSelectorElement.rowMinSelectionValue,
            regionSelectorElement.rowMaxSelectionValue,
            regionSelectorElement.colMinSelectionValue,
            regionSelectorElement.colMaxSelectionValue
        )
    }
);
// Callbacks for when the values are locked in
regionSelectorElement.addOnRegionSetFunction(
    'region-config-set-update',
    ({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) =>
    {
        updateRegionProperties();
        updateTargetRegionBounds();
        sendSelectedRegion();
        callSetRegion();
    }
);

// externalSetRegionBounds(
//     0, 3840,
//     0, 4608,
//     16, 16
// );
// externalSetRegionValues(656, 1264, 1952, 2416);

// function finalizeRegionConfig() {
    // Need to set up callback etc after the component is ready

    
externalSetRegionValues(656, 1264, 1952, 2416);

sendSelectedRegion();
// }
// map.on('load', () => {
//     finalizeRegionConfig();
// });
// document.addEventListener('DOMContentLoaded', () => {
//     finalizeRegionConfig();
// });
map.on('load', () => {
    sendSelectedRegion();
});