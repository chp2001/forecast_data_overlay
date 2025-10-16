/**
 * File specifically for the functions to configure the gages layer.
 * 
 * Code primarily from [JoshCu](www.github.com/JoshCu)'s repository:
 * @see {@link https://github.com/CIROH-UA/NGIAB_data_preprocess}
 */

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