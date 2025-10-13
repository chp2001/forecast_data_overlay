<!-- Using this document to map out the current structure of the project, and later to plan out future features and improvements. -->

# Project Goal

Tool for displaying varying types of forecast data simultaneously.

## High-Level Overview

The project is structured around using Flask with Python to render an HTML/JavaScript front-end, and provide data through API endpoints. The front-end uses Maplibre GL JS to display map data.

## Interface Structure

The interface is divided into two main sections:

1. **Map Section**: This is the `<div id="map">` element that is replaced and managed by Maplibre. All of our visualization occurs through interactions with the map's style layers.
2. **Options Panel**: This is the `<div id="options-panel" class="minimized">` element that contains all of the user interface controls as children. There is a parallel button that toggles the visibility of this panel.

While how we interact with the map is important, the details of its implementation and function are largely irrelvant, so we will focus on the options panel.

### Options Panel Logic

Individual sections need to be able to communicate with each other, as they all modify the request that is sent to the server for data.

Originally, this was done without communication by having each section send changed values to the server, and the server would then respond to the next map data request with the data for the current state of all options.

This was, however, very bad for the case where multiple clients were connected at once, as one client's changes would affect the data seen by all other clients.

As such, the current implementation uses:
- A client-side `local_cache` object implemented in the `main.js` file
- A main request function that restricts and standardizes requests for data to a single location in `main.js`

### Options Panel Structure

The options panel is structured into several sections, each with its own purpose. The sections are as follows:

#### Toggle Options 

This section contains a group of toggle buttons that control the visibility of various map layers. Each button corresponds to a specific layer or group of layers, and clicking a button will show or hide the associated layers on the map.

The functionality of these buttons is implemented and managed in the `map_configs/layer_toggles.js` file. Each button is linked to a specific layer or set of layers, and the JavaScript code handles the logic for toggling their visibility.

Any change to their displayed text or functionality will need to be handled in this file.

#### Scale Config

This section contains controls for adjusting the scaling of the represented data. 

Since the raw 1km^2 data is typically too dense to be displayed or rendered effectively, the scale section modifies the granularity of the data being displayed. 

By default, the scale is set to 16, or 16km squares. The scale can be adjusted from 1 (1km^2) to 64 (64km*64km).

The functionality of this section is implemented in a group of files:
1. `components/double_labeled_slider.js` - Since the interface calls for the ability to slide between values, but not request data at every value slid over, this file implements the `double_labeled_slider` custom element. The custom element required two stored values: the current `instance.selectionValue` value, and the `instance.setValue` value. The `selectionValue` value is updated as the slider is moved, while the `setValue` value is only updated when another part of the code signals to update it through the `instance.setButton()` method (intended to be signalled from external set buttons). This allows for the slider to be moved freely, but only request new data when the user has finished adjusting the slider.
2. `components/scale_config_element.js` - This file implements the appearance and overall behavior of the `scale_config` interface element. It uses two instances of the double labeled slider to allow for modifying the X and Y scales independently. It also includes logic for locking the two scales together, so that they always match, and for a button to signal that the current selected values should be set.
3. `map_configs/scale_config.js` - This file contains the logic for coupling the scale config element to the `local_cache` object, as well as making the `scaleConfigElement` instance available to other parts of the code.

This section does not initiate any data requests at this time.

#### Region Selection

This section contains controls for limiting the displayed data to a specific rectangular region, vastly reducing the amount of data that needs to be requested and rendered.

The region selection is implemented almost entirely within the `map_configs/region_config.js` file. 

The current implementation is effectively a precursor to the more advanced custom-component-based approach used in the scale config section, where the elements are created and managed within various semi-modular functions and objects within the file.

For example, rather than use the later-implemented double-labeled slider component, the region selection uses two standard HTML range inputs, and manages their behavior through functions within the file.

Because the sliders are standard HTML elements, and managed more-or-less directly, many segments of code manage the same values on update, leading to significant redundancy and some confusion. Efforts to improve this essentially implemented class functionality in the `setupMinMaxSliders()` function's returned object, but less elegantly.

The structure of the region selection section is as follows:
1. A simple title indicating the purpose of the section.
2. A div for the region column (x) `<div id="region-col-selection"></div>` selectors.
3. A div for the region row (y) `<div id="region-row-selection"></div>` selectors.
4. A button to signal that the current selected values should be set.

On page load, the `setupMinMaxSliders()` function is called to replace the column and row selection divs with the appropriate slider elements and labels.

Both the column and row selection divs are replaced with two sliders each, one for the minimum value and one for the maximum value. Each slider is accompanied by a pair of labels indicating the current `selectionValue` and the `setValue`.

The sliders are configured to update the `selectionValue` as they are moved, and the `setValue` when the "Set Region" button is clicked.

Further, the `set-region` button interfaces with the local_cache object to update the stored region values.

To cap off the functionality of this section, the `externalSetRegionBounds(rowMin, rowMax, colMin, colMax, rowStep, colStep)` and `externalSetRegionValues(rowMin, rowMax, colMin, colMax)` functions are made available to change the slider values and properties from other parts of the code, as well as allowing initialization to specific values or resuming from a previous session.

This section does not initiate any data requests at this time.

#### Time Settings

This section is the primary control point for the application, and the `set-time` button within both saves the selected time values to cache and requests the data from the server.

The time settings section is implemented in a similar manner to the region selection section, with the entire section being managed within the `map_configs/time_config.js` file.

The interface for the time settings, unlike the others, is implemented directly in the HTML file, rather than being generated on page load. However, callbacks and event listeners are still set up within the `time_config.js` file. This is because the time settings section is the oldest remaining section, and was implemented before the more modular approach used in later sections.

## What's Next

The current focus is on changing the implementation of the `region-selection` and `time-settings` sections to use custom components in the same manner as the `scale-config` section. 

While this won't have an immediate benefit to functionality, it will make things significantly easier to manage and modify later on, so in the near term most tasks will be related to this refactor.

### Refactoring Region Selection

This will involve creating a new custom component, likely called `region_selection_element.js`, that will encapsulate all of the functionality currently in the `map_configs/region_config.js` file.

The majority of the related work can be skipped by both reusing the `double_labeled_slider.js` component, and by copying over the structure of the `scale_config_element.js` component.

Since the previous version was essentially a modular pseudo-class implementation, much of the existing code can be reused with minor modifications.

This is now complete.

### Candidate Region Bound Display

The current implementation already displays the selected region on the map as a rectangle, but this is only updated when the "Set Region" button is clicked. This is workable, but to see what effect an adjustment to one of the sliders will have, the user has to 'lock in' the new values by clicking the button. This is very clunky, and can significantly slow down the process of finding a desired region.

To improve this, we can add a secondary rectangle to the map that displays the currently selected region based on the `selectionValue` values of the sliders, rather than the `setValue` values. This rectangle would update in real-time as the sliders are moved, providing immediate visual feedback on the selected region.

This is a relatively simple addition, likely requiring only a few lines of code and some callbacks, but will be easiest to implement after the custom component refactor of the region selection section is complete.

This is now complete.

### Refactoring Time Settings

This will involve creating a new custom component, likely called `time_settings_element.js`, that will encapsulate the interface creation currently in the `index.html` file.

Most of the functionality will remain in the `map_configs/time_config.js` file, but will be modified to interface with the new custom component.

At this time, the `time_settings_element.js` component will likely be less critical and have less functionality than the other two custom components, as the time settings section is relatively simple. However, it will still simplify the HTML structure and provide a convenient stepping stone for later features that may rely on either multiple time settings sections, or more complex time selection functionality.

Custom element may not actually be necessary, as the section is relatively simple, and shouldn't need duplication. Can likely continue the current management method with additional functionality.

Decided custom element is still worthwhile for consistency and future-proofing. Currently in progress.