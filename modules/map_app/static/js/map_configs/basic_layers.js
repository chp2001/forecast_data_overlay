var layer_inclusions = {
    camels: true,
    nwm_zarr_chunks: true,
    aorc_zarr_chunks: true,
}
// map.on("load", () => {
//     if (layer_inclusions.camels) {
//         map.addSource("camels_basins", {
//             type: "vector",
//             url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/camels.pmtiles",
//         });
//         map.addLayer({
//             id: "camels",
//             type: "line",
//             source: "camels_basins",
//             "source-layer": "camels_basins",
//             layout: {},
//             filter: ["any", ["==", "hru_id", ""]],
//             paint: {
//                 "line-width": 1.5,
//                 "line-color": ["rgba", 134, 30, 232, 1],
//             },
//         });
//     }
//     if (layer_inclusions.nwm_zarr_chunks) {
//         map.addSource("nwm_zarr_chunks", {
//             type: "vector",
//             url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/nwm_retro_v3_zarr_chunks.pmtiles",
//         });
//         map.addLayer({
//             id: "nwm_zarr_chunks",
//             type: "line",
//             source: "nwm_zarr_chunks",
//             "source-layer": "nwm_zarr_chunks",
//             layout: {},
//             filter: ["any"],
//             paint: nwm_paint,
//         });
//     }
//     if (layer_inclusions.aorc_zarr_chunks) {
//         map.addSource("aorc_zarr_chunks", {
//             type: "vector",
//             url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/aorc_zarr_chunks.pmtiles",
//         });
//         map.addLayer({
//             id: "aorc_zarr_chunks",
//             type: "line",
//             source: "aorc_zarr_chunks",
//             "source-layer": "aorc_zarr_chunks",
//             layout: {},
//             filter: ["any"],
//             paint: aorc_paint,
//         });
//     }
// });
function setup_camels_layer() {
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
}
function setup_nwm_layer() {
    map.addSource("nwm_zarr_chunks", {
        type: "vector",
        url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/nwm_retro_v3_zarr_chunks.pmtiles",
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
}
function setup_aorc_layer() {
    map.addSource("aorc_zarr_chunks", {
        type: "vector",
        url: "pmtiles://https://communityhydrofabric.s3.us-east-1.amazonaws.com/map/forcing_chunks/aorc_zarr_chunks.pmtiles",
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
}
map.on("load", () => {
    if (layer_inclusions.camels) {
        setup_camels_layer();
    }
    if (layer_inclusions.nwm_zarr_chunks) {
        setup_nwm_layer();
    }
    if (layer_inclusions.aorc_zarr_chunks) {
        setup_aorc_layer();
    }
});