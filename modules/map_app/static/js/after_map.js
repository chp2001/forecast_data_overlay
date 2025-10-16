/**
 * @file File specifically for functions that need to be run after the map
 * element is created, but before any data is loaded.
 * 
 * Code primarily from [JoshCu](www.github.com/JoshCu)'s repository:
 * @see {@link https://github.com/CIROH-UA/NGIAB_data_preprocess}
 * 
 * Moved to different file to adjust the load order.
 */

// Map declaration in globals.js
map = new maplibregl.Map({
    container: "map", // container id
    style: style, // style URL
    center: [-96, 40], // starting position [lng, lat]
    zoom: 4, // starting zoom
});
