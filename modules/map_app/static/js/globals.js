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
 * @type {Object<string, string>}
 * @description
 * Dictionary of colors used in the map, pulled from CSS variables.
 * 
 * @todo Check if this is actually used anywhere... Or if it has a real value.
 */
var colorDict;