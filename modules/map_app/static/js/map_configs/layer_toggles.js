
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
setupToggleButton(
    "#toggle-button-gages",
    "conus_gages",
    "showGages",
    ["any", ["==", "hl_uri", ""]],
    "Show gages",
    "Hide gages"
);
setupToggleButton(
    "#toggle-button-camels",
    "camels",
    "showCamels",
    ["any", ["==", "hru_id", ""]],
    "Show CAMELS basins",
    "Hide CAMELS basins"
);
setupToggleButton(
    "#toggle-button-nwm",
    "nwm_zarr_chunks",
    "showNwm",
    ["any"],
    "Overlay NWM chunks",
    "Hide NWM chunks"
);
setupToggleButton(
    "#toggle-button-aorc",
    "aorc_zarr_chunks",
    "showAorc",
    ["any"],
    "Overlay AORC chunks",
    "Hide AORC chunks"
);
setupToggleButton(
    "#toggle-button-forecast",
    "forecasted_precip_layer",
    "showForecastedPrecip",
    ["==", "color", ""],
    "Show forecasted precipitation",
    "Hide forecasted precipitation"
);
map.on("load", toggleFunctions["showForecastedPrecip"]); // Start with it shown