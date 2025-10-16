/**
 * @file File to store global variables and data structures that need to be referenceable
 * across multiple files.
 * 
 * Will be loaded near the beginning of the HTML file to ensure
 * precedence over other files.
 */

// Quickly make imported scripts referenceable
// This won't necessarily be helpful for jsdoc's hinting, as these
// are dynamically imported packages, and have no inbuilt type information.
// But it will at least make it clear what libraries are being used.
/**
 * @external jQuery
 * @see {@link https://jquery.com/}
 * @import {default as $} from 'https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js';
 * @type {jQuery}
 */
var $ = jQuery;
/**
 * @external maplibregl
 * @see {@link https://maplibre.org/maplibre-gl-js/docs/API/}
 * @import 'https://unpkg.com/maplibre-gl@^5.2.0/dist/maplibre-gl.js';
 * @type {maplibregl}
 */
var maplibregl = window.maplibregl;
/**
 * @external pmtiles
 * @see {@link 'https://github.com/protomaps/PMTiles'}
 * @import 'https://unpkg.com/pmtiles@latest/dist/pmtiles.js';
 * @type {pmtiles}
 */
var pmtiles = window.pmtiles;

/**
 * @type {maplibregl.Map}
 * @link js/after_map.js
 * @description
 * Map object, initialized in after_map.js
 */
var map; 

/**
 * @type {pmtiles.Protocol}
 * @link js/main.js
 * @description
 * PMTiles protocol object, initialized in main.js
 */
var protocol;

/**
 * @type {Object}
 * @description
 * Object to store local cache information, such as the current
 * view bounds, scale, and selected forecast parameters.
 */
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
 * @type {{geometry: Array, timestep_values: Object.<number, Array>}}
 */
var data_cache = {
    geometry: [],
    timestep_values: {},
}

/**
 * @type {Object<string, Array<{min: number, color: string}>>}
 * @description
 * Color thresholds for various forecast parameters.
 * Currently only contains thresholds for 1-hour precipitation,
 * but can be expanded to include other parameters as needed.
 */
var noaa_threshold_color_sets = {
    "precip_1h": [
        { min: 10, color: `rgb(215, 215, 215)`}, // very light gray
        { min: 8, color: `rgb(114, 64, 214)`}, // purple
        { min: 6, color: `rgb(246, 0, 242)`}, // magenta
        { min: 5, color: `rgb(112, 2, 9)`}, // dark red
        { min: 4, color: `rgb(162, 3, 17)`}, // red
        { min: 3, color: `rgb(245, 7, 25)`}, // bright red
        { min: 2.5, color: `rgb(246, 140, 40)`}, // orange
        { min: 2, color: `rgb(253, 212, 105)`}, // yellow-orange
        { min: 1.5, color: `rgb(248, 250, 61)`}, // yellow
        { min: 1, color: `rgb(14, 89, 24)`}, // darkish-green
        { min: 0.75, color: `rgb(24, 150, 36)`}, // green
        { min: 0.5, color: `rgb(40, 250, 59)`}, // light-green
        { min: 0.25, color: `rgb(12, 18, 135)`}, // dark-blue
        { min: 0.1, color: `rgb(59, 121, 187)`}, // lightish-blue
        { min: 0.01, color: `rgb(43, 192, 245)`}, // very-light-blue or cyan
    ]
}