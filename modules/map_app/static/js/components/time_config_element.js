// Previous structure:

// <section id="time-settings">
//     <label for="time-settings">Time Settings:</label>
//     <div class="time-input" style="display: flex; flex-direction: column; margin-bottom: 10px;">
//         <label for="target-time">Target Time:</label>
//         <!-- <input type="datetime-local" id="target-time" name="target-time" value="2018-09-17T00:00"
//             min="2018-09-17T00:00"> -->
//         <!-- max date is today's date to be safe... can handle on JS end -->
//         <input type="date" id="target-time" name="target-time" value="2025-07-04"
//             min="2018-09-17">
//     </div>
//     <div class="lead-time-input">
//         <label for="lead-time">Lead Time (hours):</label>
//         <input type="range" id="lead-time" name="lead-time" value="1" min="1" max="18" step="1">
//         <span id="lead-time-value">1</span>
//     </div>
//     <div class="forecast-cycle-input">
//         <label for="forecast-cycle">Forecast Cycle:</label>
//         <input type="range" id="forecast-cycle" name="forecast-cycle" value="0" min="0" max="23"
//             step="1">
//         <span id="forecast-cycle-value">0</span>
//     </div>
//     <div class="selected-values" style="outline: 1px solid #ccc; padding: 3px; margin-top: 10px;">
//         <!--Display the values as they were when the `set-time` button was last pressed-->
//         <!--The user must press the button for this section to be populated-->
//         <p>Selected Time: <span id="selected-time">None</span></p>
//         <p>Selected Lead Time: <span id="selected-lead-time">None</span></p>
//         <p>Selected Forecast Cycle: <span id="selected-forecast-cycle">None</span></p>
//     </div>
//     <button id="set-time">Set Time</button>
// </section>

// Implementing new structure as time_config_element.js

// Unlike the Scale and Region components, the value of individual sliders
// are unimportant until the user requests the data using the "Set Time" button.
// Therefore we do not need to use the double labeled slider component here.
// The forecast cycle and lead time inputs can be simple sliders or number inputs.

// Definitely unlike the original, we do not want to use datetime-local inputs,
// as the time selection clashes with the forecast-cycle input 
// (Forecast cycle determines the hour of the day for requests.)

// At the same time, we need to begin preparing for the animation / time series
// functionality, which means we need to allow for revealing an additional lead time
// slider when the time series mode is activated.


// Use a config object to avoid cluttering the global namespace
// and to make it easier to change strings and IDs later if needed.
var time_config_config = {
    time_config_element_id: 'time-settings',
    title_string: 'Time Settings:',
    target_time_label_string: 'Target Date:',
    target_time_default_date: '2025-07-04',
    target_time_min_date: '2018-09-17', // Earliest date for GFS data
    target_time_element_id: 'target-time-input',
    range_mode_label_string: 'Range Select Mode:',
    range_mode_tooltip_string: 'Toggle to enable selecting a range of lead times for time series/animation mode.',
    range_mode_element_id: 'time-range-mode-input',
    lead_time_label_string: 'Lead Time (hours):',
    lead_time_element_id: 'lead-time-input',
    lead_time_default: 1,
    lead_time_end_label_string: 'Lead Time End:',
    lead_time_end_element_id: 'lead-time-end-input',
    forecast_cycle_label_string: 'Forecast Cycle:',
    forecast_cycle_element_id: 'forecast-cycle-input',
    forecast_cycle_default: 0,
    selected_values_label_string: 'Selected Values:',
    selected_time_label_string: 'Selected Time: ',
    selected_lead_time_label_string: 'Selected Lead Time: ',
    selected_lead_times_label_string: 'Selected Lead Times (range): ',
    selected_forecast_cycle_label_string: 'Selected Forecast Cycle: ',
    // const submit_button_string = 'Set Time';
    submit_button_string: 'Get Data',
    submit_button_id: 'submit-time-config',
}

/**
 * @typedef {Object} timeConfigArgs
 * @property {string} target_time - The target time in YYYY-MM-DD format
 * @property {number} lead_time - The lead time value
 * @property {number} forecast_cycle - The forecast cycle value
 * @property {boolean|null} range_mode - True if range mode is enabled, false otherwise
 * @property {number|null} lead_time_end - The lead time end value (only if range mode)
 */

/**
 * @callback onSubmitCallback
 * @param {timeConfigArgs} args - The arguments passed to the callback
 */
// RANGE SLIDER RELEVANT CODE
/**
 * @callback onRangeSliderChangeCallback
 * @param {number} selectedLeadTime - The currently selected lead time
 */

/**
 * @class time_config
 * @extends {HTMLElement}
 */
class time_config extends HTMLElement {
    constructor() {
        super();
        // this.attachShadow({ mode: 'open' });
        // shadows not useful right now, they seem to break styling inheritance

        // For component structure, the constructor seems to be the place to set up
        // data structures and attributes, but it is too early in the data
        // lifecycle to interact with the DOM. The DOM can only be interacted with
        // in connectedCallback() and later.

        // Initialize attributes

        // Important interface object:
        /**
         * @type {Object.<string, onSubmitCallback>}
         */
        this.onSubmitFuncs = {};

        // Data attributes
        this.target_time = time_config_config.target_time_default_date; // expected to be '2025-07-04'
        this.lead_time = time_config_config.lead_time_default; // expected to be 1
        this.forecast_cycle = time_config_config.forecast_cycle_default; // expected to be 0
        this.range_mode = false; // Whether we are in range mode (time series) or single time mode
        this.lead_time_end = 1; // Only used in range mode

        // Constraints (Inclusive)
        this.data_min_lead_time = 1;
        this.data_max_lead_time = 18;
        this.data_step_lead_time = 1;
        this.data_min_forecast_cycle = 0;
        this.data_max_forecast_cycle = 23;
        this.data_step_forecast_cycle = 1;

        // Selected values (as of last submit)
        this.selected_target_time = null;
        this.selected_range_mode = null;
        this.selected_lead_time = null;
        this.selected_lead_time_end = null;
        this.selected_forecast_cycle = null;

        // Element references
        // header/title
        this.titleElement = null;
        // selector for the target date
        this.targetTimeElement = null;
        this.targetTimeLabel = null;
        // toggle/checkbox for range mode
        this.rangeModeElement = null;
        this.rangeModeLabel = null;
        // selector for lead time (start if range mode)
        this.leadTimeElement = null;
        this.leadTimeValueElement = null;
        this.leadTimeLabel = null;
        // selector for lead time end (only if range mode)
        this.leadTimeEndElement = null;
        this.leadTimeEndValueElement = null;
        this.leadTimeEndLabel = null;
        this.leadTimeEndContainer = null; // container for lead time end input, included for toggling visibility
        // selector for forecast cycle
        this.forecastCycleElement = null;
        this.forecastCycleValueElement = null;
        this.forecastCycleLabel = null;
        // display of selected values (as of last submit)
        this.selectedValuesElement = null; // container for selected values
        this.selectedTimeElement = null; // display for selected target time
        this.selectedTimeLabel = null;
        this.selectedLeadTimeElement = null; // display for selected lead time(s)
        this.selectedLeadTimeLabel = null;
        this.selectedForecastCycleElement = null; // display for selected forecast cycle
        this.selectedForecastCycleLabel = null;
        // button to submit the selected values and request data
        // this.setTimeButton = null;
        this.submitButton = null;
        // container element for the entire component
        this.containerElement = null;

        // RANGE SLIDER RELEVANT CODE
        this.showRangeSlider = false; // Enable/disable additional slider based on whether
        // range mode is enabled and lead time < lead time end, allowing for a range of lead times
        // to be selected for time series/animation mode.
        this.rangeSliderContainer = null; // Container for the range slider, shown/hidden based on showRangeSlider
        this.rangeSliderMinLabel = null; // Label for the minimum lead time in range slider
        this.rangeSliderMaxLabel = null; // Label for the maximum lead time in range slider
        this.rangeSliderValueLabel = null; // Label showing the current value of the range slider
        this.rangeSliderElement = null; // The range slider element itself

        /**
         * This is a temporary solution for now, and won't have proper infrastructure until
         * later.
         * @type {Object.<string, onRangeSliderChangeCallback>}
         */
        this.onRangeSliderChangeFuncs = {};


        this.uuid = time_config.id++;
    }

    connectedCallback() {
        console.log('Time Config ' + this.uuid + ' triggered callback. Building...');

        this.build();
    }

    // onSubmit function helpers

    /**
     * Add a function to be called when the submit button is pressed.
     * @param {string} key - The unique key to identify the function.
     * @param {onSubmitCallback} func - The function to call on submit.
     */
    addOnSubmitFunction(key, func) {
        if (this.onSubmitFuncs[key]) {
            console.error('Function with key ' + key + ' already exists. Use a unique key.');
            return;
        }
        this.onSubmitFuncs[key] = func;
    }

    /**
     * Remove a previously added onSubmit function.
     * @param {string} key - The unique key identifying the function to remove.
     */
    removeOnSubmitFunction(key) {
        if (!this.onSubmitFuncs[key]) {
            console.error('Function with key ' + key + ' does not exist.');
            return;
        }
        delete this.onSubmitFuncs[key];
    }

    /**
     * Call all registered onSubmit functions with the provided arguments.
     * @param {timeConfigArgs} args - The arguments to pass to the onSubmit functions.
     */
    triggerOnSubmit(args) {
        for (const key in this.onSubmitFuncs) {
            this.onSubmitFuncs[key](args);
        }
    }

    /**
     * Handler for selecting a target date. Modify both the attribute and the display element.
     * @param {string} value - The selected target date in YYYY-MM-DD format
     */
    selectTargetTime(value) {
        this.target_time = value;
        this.targetTimeElement.value = value;
    }

    /**
     * Handler for selecting a lead time value
     * @param {number} value - The selected lead time value
     */
    selectLeadTime(value) {
        const intValue = parseInt(value);
        this.lead_time = intValue;
        this.leadTimeValueElement.textContent = intValue;
        this.leadTimeElement.value = intValue;
    }

    /**
     * Handler for selecting a lead time end value
     * @param {number} value - The selected lead time end value
     */
    selectLeadTimeEnd(value) {
        const intValue = parseInt(value);
        this.lead_time_end = intValue;
        this.leadTimeEndValueElement.textContent = intValue;
        this.leadTimeEndElement.value = intValue;
    }

    /**
     * Handler for selecting a forecast cycle value
     * @param {number} value - The selected forecast cycle value
     */
    selectForecastCycle(value) {
        const intValue = parseInt(value);
        this.forecast_cycle = intValue;
        this.forecastCycleValueElement.textContent = intValue;
        this.forecastCycleElement.value = intValue;
    }

    /**
     * Set the range mode state and update the component display accordingly
     * @param {boolean} mode - True to enable range mode, false to disable
     */
    setRangeMode(mode) {
        if (this.range_mode === mode) {
            console.warn('Range mode already set to ' + mode);
            return;
        } else if (mode === true) {
            this.range_mode = true;
            this.leadTimeEndContainer.style.display = 'flex';
            this.rangeModeElement.checked = true;
            // Lead time end becoming visible, to ensure validity
            // just set it to the current lead time value.
            // This means the range being enabled does not
            // immediately change the selected values.
            this.selectLeadTimeEnd(this.lead_time);
        } else if (mode === false) {
            this.range_mode = false;
            this.leadTimeEndContainer.style.display = 'none';
            this.rangeModeElement.checked = false;
        } else {
            console.error('Invalid range mode value: ' + mode);
            return;
        }
    }

    /**
     * On submit, update the selected values with the requested values
     * and update the display elements accordingly.
     * This assumes the submit button has been pressed.
     */
    displaySelectedValues() {
        // this.selectedTimeElement.textContent = this.selected_target_time || 'None';
        this.selectedTimeElement.textContent = (this.selected_target_time !== null) ? this.selected_target_time : 'None';
        if (this.selected_range_mode === true && this.selected_lead_time !== this.selected_lead_time_end) {
            this.selectedLeadTimeLabel.textContent = time_config_config.selected_lead_times_label_string;
            this.selectedLeadTimeElement.textContent = this.selected_lead_time + ' to ' + this.selected_lead_time_end;
        } else {
            this.selectedLeadTimeLabel.textContent = time_config_config.selected_lead_time_label_string;
            // this.selectedLeadTimeElement.textContent = this.selected_lead_time || 'None';
            this.selectedLeadTimeElement.textContent = (this.selected_lead_time !== null) ? this.selected_lead_time : 'None';
        }
        // this.selectedForecastCycleElement.textContent = this.selected_forecast_cycle || 'None';
        this.selectedForecastCycleElement.textContent = (this.selected_forecast_cycle !== null) ? this.selected_forecast_cycle : 'None';
        // RANGE SLIDER RELEVANT CODE
        this.checkRangeSliderVisibility();
        this.updateRangeSliderSegment();
    }

    /**
     * Externally set the last submitted/loaded values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetPreviousValues({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null}={}) {
        this.selected_target_time = target_time;
        this.selected_lead_time = lead_time;
        this.selected_forecast_cycle = forecast_cycle;
        if (range_mode !== null) {
            this.selected_range_mode = range_mode;
        }
        if (lead_time_end !== null) {
            this.selected_lead_time_end = lead_time_end;
        }
        this.displaySelectedValues();
    }

    /**
     * Externally set the current input values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetInputValues({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null}={}) {
        this.selectTargetTime(target_time);
        this.selectLeadTime(lead_time);
        this.selectForecastCycle(forecast_cycle);
        if (range_mode !== null) {
            this.setRangeMode(range_mode);
        }
        if (lead_time_end !== null) {
            this.selectLeadTimeEnd(lead_time_end);
        }
    }

    /**
     * Externally set both the previous submitted values and the current input values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetFull({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null}={}) {
        this.externallySetPreviousValues({target_time, lead_time, forecast_cycle, range_mode, lead_time_end});
        this.externallySetInputValues({target_time, lead_time, forecast_cycle, range_mode, lead_time_end});
    }

    /**
     * Check whether the range slider should be shown or hidden, and update the relevant property.
     */
    checkRangeSliderVisibility() {
        // RANGE SLIDER RELEVANT CODE
        // Check only the 'selected_' properties, as these represent the last submitted values.
        if ([this.selected_range_mode, this.selected_lead_time, this.selected_lead_time_end].includes(null)) {
            this.showRangeSlider = false;
            return;
        }
        if (this.selected_range_mode === true && this.selected_lead_time < this.selected_lead_time_end) {
            this.showRangeSlider = true;
        } else {
            this.showRangeSlider = false;
        }
    }

    /**
     * Update the range slider segment to display the current range.
     */
    updateRangeSliderSegment() {
        // RANGE SLIDER RELEVANT CODE
        if (!this.showRangeSlider) {
            this.rangeSliderContainer.style.display = 'none';
            return;
        }
        this.rangeSliderContainer.style.display = 'flex';
        // this.rangeSliderMinLabel.textContent = this.lead_time;
        // this.rangeSliderMaxLabel.textContent = this.lead_time_end;
        // this.rangeSliderElement.min = this.lead_time;
        // this.rangeSliderElement.max = this.lead_time_end;
        // this.rangeSliderElement.step = this.data_step_lead_time;
        // this.rangeSliderElement.value = this.lead_time; // By default, always starts at the first value
        // this.rangeSliderValueLabel.textContent = this.lead_time;
        this.rangeSliderMinLabel.textContent = this.selected_lead_time;
        this.rangeSliderMaxLabel.textContent = this.selected_lead_time_end;
        this.rangeSliderElement.min = this.selected_lead_time;
        this.rangeSliderElement.max = this.selected_lead_time_end;
        this.rangeSliderElement.step = this.data_step_lead_time;
        this.rangeSliderElement.value = this.selected_lead_time; // By default, always starts at the first value
        this.rangeSliderValueLabel.textContent = this.selected_lead_time;
    }

    /**
     * Build the target_time segment of the component
     * @returns {HTMLDivElement} The target_time segment element
     */
    buildTargetTimeSegment() {
        // Target date input
        this.targetTimeElement = document.createElement('input');
        this.targetTimeElement.type = 'date';
        this.targetTimeElement.id = time_config_config.target_time_element_id;
        this.targetTimeElement.name = time_config_config.target_time_element_id;
        this.targetTimeElement.value = time_config_config.target_time_default_date;
        this.targetTimeElement.min = time_config_config.target_time_min_date;
        // max date is today's date to be safe...? can add handling logic later

        this.targetTimeLabel = document.createElement('label');
        this.targetTimeLabel.htmlFor = time_config_config.target_time_element_id;
        this.targetTimeLabel.textContent = time_config_config.target_time_label_string;

        const targetTimeContainer = document.createElement('div');
        targetTimeContainer.className = 'time-input';
        targetTimeContainer.style.display = 'flex';
        targetTimeContainer.style.flexDirection = 'column';
        targetTimeContainer.style.marginBottom = '10px';
        targetTimeContainer.appendChild(this.targetTimeLabel);
        targetTimeContainer.appendChild(this.targetTimeElement);
        return targetTimeContainer;
    }

    /**
     * Build the range mode toggle segment of the component
     * @returns {HTMLDivElement} The range mode toggle segment element
     */
    buildRangeModeToggleSegment() {
        // Range mode toggle
        this.rangeModeElement = document.createElement('input');
        this.rangeModeElement.type = 'checkbox';
        this.rangeModeElement.id = time_config_config.range_mode_element_id;
        this.rangeModeElement.name = time_config_config.range_mode_element_id;
        this.rangeModeElement.checked = this.range_mode;
        this.rangeModeElement.title = time_config_config.range_mode_tooltip_string;

        this.rangeModeLabel = document.createElement('label');
        this.rangeModeLabel.htmlFor = time_config_config.range_mode_element_id;
        this.rangeModeLabel.textContent = time_config_config.range_mode_label_string;
        this.rangeModeLabel.title = time_config_config.range_mode_tooltip_string;

        const rangeModeContainer = document.createElement('div');
        rangeModeContainer.className = 'range-mode-input';
        rangeModeContainer.style.display = 'flex';
        rangeModeContainer.style.alignItems = 'center';
        rangeModeContainer.style.marginBottom = '10px';
        rangeModeContainer.appendChild(this.rangeModeElement);
        rangeModeContainer.appendChild(this.rangeModeLabel);
        return rangeModeContainer;
    }

    /**
     * Build the lead time input segment of the component
     * @returns {HTMLDivElement} The lead time input segment element
     */
    buildLeadTimeSegment() {
        // Lead time input (start)
        this.leadTimeElement = document.createElement('input');
        this.leadTimeElement.type = 'range';
        this.leadTimeElement.id = time_config_config.lead_time_element_id;
        this.leadTimeElement.name = time_config_config.lead_time_element_id;
        this.leadTimeElement.value = this.lead_time;
        this.leadTimeElement.min = this.data_min_lead_time;
        this.leadTimeElement.max = this.data_max_lead_time;
        this.leadTimeElement.step = this.data_step_lead_time;

        this.leadTimeValueElement = document.createElement('span');
        this.leadTimeValueElement.id = 'lead-time-value';
        this.leadTimeValueElement.textContent = this.lead_time;

        this.leadTimeLabel = document.createElement('label');
        this.leadTimeLabel.htmlFor = time_config_config.lead_time_element_id;
        this.leadTimeLabel.textContent = time_config_config.lead_time_label_string;

        const leadTimeSelectorContainer = document.createElement('div');
        // by separating the selector/range input and value display into a
        // separate container from the label, we can align the range elements
        // despite labels of different lengths
        leadTimeSelectorContainer.style.display = 'flex';
        leadTimeSelectorContainer.style.marginLeft = '10px';
        leadTimeSelectorContainer.appendChild(this.leadTimeElement);
        leadTimeSelectorContainer.appendChild(this.leadTimeValueElement);

        const leadTimeContainer = document.createElement('div');
        leadTimeContainer.className = 'lead-time-input';
        leadTimeContainer.style.display = 'flex';
        leadTimeContainer.style.alignItems = 'center';
        leadTimeContainer.style.flexDirection = 'column';
        leadTimeContainer.style.marginBottom = '10px';
        leadTimeContainer.appendChild(this.leadTimeLabel);
        leadTimeContainer.appendChild(leadTimeSelectorContainer);
        return leadTimeContainer;
    }

    /**
     * Build the lead time end input segment of the component
     * @returns {HTMLDivElement} The lead time end input segment element
     */
    buildLeadTimeEndSegment() {
        // Lead time input (end) - container is toggled visible/invisible based on range mode
        this.leadTimeEndElement = document.createElement('input');
        this.leadTimeEndElement.type = 'range';
        this.leadTimeEndElement.id = time_config_config.lead_time_end_element_id;
        this.leadTimeEndElement.name = time_config_config.lead_time_end_element_id;
        this.leadTimeEndElement.value = this.lead_time_end;
        this.leadTimeEndElement.min = this.data_min_lead_time;
        this.leadTimeEndElement.max = this.data_max_lead_time;
        this.leadTimeEndElement.step = this.data_step_lead_time;

        this.leadTimeEndValueElement = document.createElement('span');
        this.leadTimeEndValueElement.id = 'lead-time-end-value';
        this.leadTimeEndValueElement.textContent = this.lead_time_end;

        this.leadTimeEndLabel = document.createElement('label');
        this.leadTimeEndLabel.htmlFor = time_config_config.lead_time_end_element_id;
        this.leadTimeEndLabel.textContent = time_config_config.lead_time_end_label_string;

        const leadTimeEndSelectorContainer = document.createElement('div');
        // by separating the selector/range input and value display into a
        // separate container from the label, we can align the range elements
        // despite labels of different lengths
        leadTimeEndSelectorContainer.style.display = 'flex';
        leadTimeEndSelectorContainer.style.marginLeft = '10px';
        leadTimeEndSelectorContainer.appendChild(this.leadTimeEndElement);
        leadTimeEndSelectorContainer.appendChild(this.leadTimeEndValueElement);

        this.leadTimeEndContainer = document.createElement('div');
        this.leadTimeEndContainer.className = 'lead-time-end-input';
        this.leadTimeEndContainer.style.display = this.range_mode ? 'flex' : 'none';
        this.leadTimeEndContainer.style.alignItems = 'center';
        this.leadTimeEndContainer.style.flexDirection = 'column';
        this.leadTimeEndContainer.style.marginBottom = '10px';
        this.leadTimeEndContainer.appendChild(this.leadTimeEndLabel);
        this.leadTimeEndContainer.appendChild(leadTimeEndSelectorContainer);
        return this.leadTimeEndContainer;
    }

    /**
     * Build the forecast cycle input segment of the component
     * @returns {HTMLDivElement} The forecast cycle input segment element
     */
    buildForecastCycleSegment() {
        // Forecast cycle input
        this.forecastCycleElement = document.createElement('input');
        this.forecastCycleElement.type = 'range';
        // this.forecastCycleElement.id = 'forecast-cycle';
        // this.forecastCycleElement.name = 'forecast-cycle';
        this.forecastCycleElement.id = time_config_config.forecast_cycle_element_id;
        this.forecastCycleElement.name = time_config_config.forecast_cycle_element_id;
        this.forecastCycleElement.value = this.forecast_cycle;
        this.forecastCycleElement.min = this.data_min_forecast_cycle;
        this.forecastCycleElement.max = this.data_max_forecast_cycle;
        this.forecastCycleElement.step = this.data_step_forecast_cycle;

        this.forecastCycleValueElement = document.createElement('span');
        this.forecastCycleValueElement.id = 'forecast-cycle-value';
        this.forecastCycleValueElement.textContent = this.forecast_cycle;

        this.forecastCycleLabel = document.createElement('label');
        // this.forecastCycleLabel.htmlFor = 'forecast-cycle';
        this.forecastCycleLabel.htmlFor = time_config_config.forecast_cycle_element_id;
        this.forecastCycleLabel.textContent = time_config_config.forecast_cycle_label_string;

        const forecastCycleSelectorContainer = document.createElement('div');
        // by separating the selector/range input and value display into a
        // separate container from the label, we can align the range elements
        // despite labels of different lengths
        forecastCycleSelectorContainer.style.display = 'flex';
        forecastCycleSelectorContainer.style.marginLeft = '10px';
        forecastCycleSelectorContainer.appendChild(this.forecastCycleElement);
        forecastCycleSelectorContainer.appendChild(this.forecastCycleValueElement);

        const forecastCycleContainer = document.createElement('div');
        forecastCycleContainer.className = 'forecast-cycle-input';
        forecastCycleContainer.style.display = 'flex';
        forecastCycleContainer.style.alignItems = 'center';
        forecastCycleContainer.style.flexDirection = 'column';
        forecastCycleContainer.style.marginBottom = '10px';
        forecastCycleContainer.appendChild(this.forecastCycleLabel);
        forecastCycleContainer.appendChild(forecastCycleSelectorContainer);
        return forecastCycleContainer;
    }

    /**
     * Build the selected values display segment of the component
     * @returns {HTMLDivElement} The selected values display segment element
     */
    buildSelectedValuesSegment() {
        // display of selected values (as of last submit)
        this.selectedValuesElement = document.createElement('div');
        this.selectedValuesElement.className = 'selected-values';
        this.selectedValuesElement.style.display = 'flex';
        this.selectedValuesElement.style.flexDirection = 'column';
        this.selectedValuesElement.style.outline = '1px solid #ccc';
        this.selectedValuesElement.style.padding = '3px';
        this.selectedValuesElement.style.marginTop = '10px';
        
        const selectedValuesTitle = document.createElement('label');
        selectedValuesTitle.textContent = time_config_config.selected_values_label_string;
        selectedValuesTitle.style.alignSelf = 'center';
        this.selectedValuesElement.appendChild(selectedValuesTitle);

        this.selectedTimeLabel = document.createElement('p');
        this.selectedTimeLabel.style.margin = '2px 0px';
        this.selectedTimeLabel.innerHTML = time_config_config.selected_time_label_string;
        this.selectedTimeElement = document.createElement('span');
        this.selectedTimeElement.id = 'selected-time';
        this.selectedTimeElement.textContent = 'None';
        const selectedTimeContainer = document.createElement('div');
        selectedTimeContainer.style.display = 'flex';
        selectedTimeContainer.style.alignItems = 'center';
        selectedTimeContainer.appendChild(this.selectedTimeLabel);
        selectedTimeContainer.appendChild(this.selectedTimeElement);
        this.selectedValuesElement.appendChild(selectedTimeContainer);

        this.selectedLeadTimeLabel = document.createElement('p');
        this.selectedLeadTimeLabel.style.margin = '2px 0px';
        this.selectedLeadTimeLabel.innerHTML = time_config_config.selected_lead_time_label_string;
        this.selectedLeadTimeElement = document.createElement('span');
        this.selectedLeadTimeElement.id = 'selected-lead-time';
        this.selectedLeadTimeElement.textContent = 'None';
        const selectedLeadTimeContainer = document.createElement('div');
        selectedLeadTimeContainer.style.display = 'flex';
        selectedLeadTimeContainer.style.alignItems = 'center';
        selectedLeadTimeContainer.appendChild(this.selectedLeadTimeLabel);
        selectedLeadTimeContainer.appendChild(this.selectedLeadTimeElement);
        this.selectedValuesElement.appendChild(selectedLeadTimeContainer);

        this.selectedForecastCycleLabel = document.createElement('p');
        this.selectedForecastCycleLabel.style.margin = '2px 0px';
        this.selectedForecastCycleLabel.innerHTML = time_config_config.selected_forecast_cycle_label_string;
        this.selectedForecastCycleElement = document.createElement('span');
        this.selectedForecastCycleElement.id = 'selected-forecast-cycle';
        this.selectedForecastCycleElement.textContent = 'None';
        const selectedForecastCycleContainer = document.createElement('div');
        selectedForecastCycleContainer.style.display = 'flex';
        selectedForecastCycleContainer.style.alignItems = 'center';
        selectedForecastCycleContainer.appendChild(this.selectedForecastCycleLabel);
        selectedForecastCycleContainer.appendChild(this.selectedForecastCycleElement);
        this.selectedValuesElement.appendChild(selectedForecastCycleContainer);

        return this.selectedValuesElement
    }

    /**
     * Build the submit button segment of the component
     * @returns {HTMLDivElement} The submit button container element
     */
    buildSubmitButtonSegment() {
        // button to submit the selected values and request data
        this.submitButton = document.createElement('button');
        this.submitButton.id = time_config_config.submit_button_id;
        this.submitButton.textContent = time_config_config.submit_button_string;
        
        const submitButtonContainer = document.createElement('div');
        submitButtonContainer.style.display = 'flex';
        submitButtonContainer.style.justifyContent = 'center';
        submitButtonContainer.style.marginTop = '10px';
        submitButtonContainer.appendChild(this.submitButton);

        return submitButtonContainer;
    }

    /**
     * Build the range slider segment of the component.
     * Separate segment below the submit button, only visible when range mode is enabled
     * and lead time < lead time end.
     * @returns {HTMLDivElement} The range slider segment element
     */
    buildRangeSliderSegment() {
        // RANGE SLIDER RELEVANT CODE
        // Range slider for selecting a specific lead time within the selected range
        // Only visible when range mode is enabled and lead time < lead time end

        // Initialize values to nulls, will be set in updateRangeSliderSegment()
        this.showRangeSlider = false;
        this.rangeSliderContainer = document.createElement('div');
        this.rangeSliderContainer.className = 'range-slider-container';
        this.rangeSliderContainer.style.display = 'none'; // Hidden by default

        const rangeSliderLabel = document.createElement('label');
        rangeSliderLabel.textContent = 'Select Lead Time for Display:';
        rangeSliderLabel.style.alignSelf = 'center';
        
        this.rangeSliderElement = document.createElement('input');
        this.rangeSliderElement.type = 'range';
        this.rangeSliderElement.id = 'lead-time-range-slider';
        this.rangeSliderElement.name = 'lead-time-range-slider';
        this.rangeSliderElement.min = 0;
        this.rangeSliderElement.max = 1;
        this.rangeSliderElement.step = 1;
        this.rangeSliderElement.value = 0;

        this.rangeSliderMinLabel = document.createElement('span');
        this.rangeSliderMinLabel.id = 'lead-time-range-slider-min';
        this.rangeSliderMinLabel.textContent = '';

        this.rangeSliderMaxLabel = document.createElement('span');
        this.rangeSliderMaxLabel.id = 'lead-time-range-slider-max';
        this.rangeSliderMaxLabel.textContent = '';

        this.rangeSliderValueLabel = document.createElement('span');
        this.rangeSliderValueLabel.id = 'lead-time-range-slider-value';
        this.rangeSliderValueLabel.textContent = '';

        const rangeSliderSelectorContainer = document.createElement('div');
        rangeSliderSelectorContainer.style.display = 'flex';
        rangeSliderSelectorContainer.style.alignItems = 'center';
        // rangeSliderSelectorContainer.style.marginLeft = '10px';
        rangeSliderSelectorContainer.appendChild(this.rangeSliderMinLabel);
        rangeSliderSelectorContainer.appendChild(this.rangeSliderElement);
        rangeSliderSelectorContainer.appendChild(this.rangeSliderMaxLabel);

        const rangeSliderValueContainer = document.createElement('div');
        rangeSliderValueContainer.style.display = 'flex';
        rangeSliderValueContainer.style.alignItems = 'center';
        rangeSliderValueContainer.appendChild(document.createTextNode(' Current: '));
        rangeSliderValueContainer.appendChild(this.rangeSliderValueLabel);
        
        this.rangeSliderContainer.style.flexDirection = 'column';
        this.rangeSliderContainer.style.alignItems = 'center';
        this.rangeSliderContainer.style.marginTop = '10px';
        this.rangeSliderContainer.style.outline = '1px solid #ccc';
        this.rangeSliderContainer.style.padding = '3px';
        this.rangeSliderContainer.appendChild(rangeSliderLabel);
        this.rangeSliderContainer.appendChild(rangeSliderSelectorContainer);
        this.rangeSliderContainer.appendChild(rangeSliderValueContainer);

        // Tiny disclaimer at bottom explaining that the slider is only
        // visible when the current data contains multiple lead times
        const rangeSliderDisclaimerText = 'Note: This slider is only visible when the currently loaded data contains multiple lead times.';
        const rangeSliderDisclaimer = document.createElement('div');
        rangeSliderDisclaimer.textContent = rangeSliderDisclaimerText;
        rangeSliderDisclaimer.style.fontSize = '0.8em';
        rangeSliderDisclaimer.style.fontStyle = 'italic';
        this.rangeSliderContainer.appendChild(rangeSliderDisclaimer);

        return this.rangeSliderContainer;
    }

    /**
     * Configure the range mode toggle events
     */
    configureRangeModeToggle() {
        this.rangeModeElement.addEventListener('change', (event) => {
            this.setRangeMode(event.target.checked);
        });
    }

    /**
     * Configure the lead time input events
     */
    configureLeadTimeInput() {
        this.leadTimeElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            if (this.range_mode && value > this.lead_time_end) {
                // In range mode, lead time cannot exceed lead time end
                // Cap the value to lead time end
                this.selectLeadTime(this.lead_time_end);
            } else {
                this.selectLeadTime(value);
            }
        });
    }

    /**
     * Configure the lead time end input events
     */
    configureLeadTimeEndInput() {
        this.leadTimeEndElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            if (value < this.lead_time) {
                // In range mode, lead time end cannot be less than lead time
                // Cap the value to lead time
                this.selectLeadTimeEnd(this.lead_time);
            } else {
                this.selectLeadTimeEnd(value);
            }
        });
    }

    /**
     * Configure the forecast cycle input events
     */
    configureForecastCycleInput() {
        this.forecastCycleElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            this.selectForecastCycle(value);
        });
    }

    /**
     * Configure the target time input events
     */
    configureTargetTimeInput() {
        this.targetTimeElement.addEventListener('input', (event) => {
            const value = event.target.value;
            this.selectTargetTime(value);
        });
    }

    /**
     * Configure the submit button events
     */
    configureSubmitButton() {
        this.submitButton.addEventListener('click', () => {
            // On submit, update the selected values display
            this.selected_target_time = this.target_time;
            this.selected_range_mode = this.range_mode;
            this.selected_lead_time = this.lead_time;
            this.selected_lead_time_end = this.lead_time_end;
            this.selected_forecast_cycle = this.forecast_cycle;
            this.displaySelectedValues();
            // Trigger any registered onSubmit functions
            if (this.range_mode) {
                this.triggerOnSubmit({
                    target_time: this.selected_target_time,
                    lead_time: this.selected_lead_time,
                    lead_time_end: this.selected_lead_time_end,
                    forecast_cycle: this.selected_forecast_cycle,
                    range_mode: this.selected_range_mode
                });
            } else {
                this.triggerOnSubmit({
                    target_time: this.selected_target_time,
                    lead_time: this.selected_lead_time,
                    forecast_cycle: this.selected_forecast_cycle,
                    range_mode: this.selected_range_mode
                });
            }
        });
    }

    /**
     * Configure the range slider events
     */
    configureRangeSlider() {
        this.rangeSliderElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            this.rangeSliderValueLabel.textContent = value;
            // Call any registered onRangeSliderChange functions
            for (const key in this.onRangeSliderChangeFuncs) {
                this.onRangeSliderChangeFuncs[key](value);
            }
        });
        // this.addOnSubmitFunction('tryUpdateRangeSlider', (args) => {
        //     // Show the range slider if in range mode and lead time < lead time end
        //     if (args.range_mode === true && args.lead_time < args.lead_time_end) {
        //         this.showRangeSlider = true;
        //     } else {
        //         this.showRangeSlider = false;
        //     }
        //     this.updateRangeSliderSegment();
        // });
    }

    /**
     * Build the entire component structure and append it to the custom element
     */
    build() {
        // Build the component structure
        // Don't modify the styling in this function, just create the elements and
        // set up the hierarchy.

        

        // container element
        this.containerElement = document.createElement('section');
        this.containerElement.id = 'time-settings';
        this.containerElement.style.display = 'flex';
        this.containerElement.style.flexDirection = 'column';
        this.containerElement.style.marginBottom = '10px';

        // title/header
        this.titleElement = document.createElement('label');
        this.titleElement.htmlFor = 'time-settings';
        this.titleElement.textContent = time_config_config.title_string;
        
        // Build segments

        const targetTimeContainer = this.buildTargetTimeSegment();
        const rangeModeContainer = this.buildRangeModeToggleSegment();
        const leadTimeContainer = this.buildLeadTimeSegment();
        const leadTimeEndContainer = this.buildLeadTimeEndSegment();
        const forecastCycleContainer = this.buildForecastCycleSegment();
        const selectedValuesContainer = this.buildSelectedValuesSegment();
        const submitButtonContainer = this.buildSubmitButtonSegment();

        // Configure segment events
        this.configureRangeModeToggle();
        this.configureLeadTimeInput();
        this.configureLeadTimeEndInput();
        this.configureForecastCycleInput();
        this.configureTargetTimeInput();
        this.configureSubmitButton();

        this.containerElement.appendChild(this.titleElement);
        this.containerElement.appendChild(targetTimeContainer);
        this.containerElement.appendChild(forecastCycleContainer);
        this.containerElement.appendChild(rangeModeContainer);
        this.containerElement.appendChild(leadTimeContainer);
        this.containerElement.appendChild(leadTimeEndContainer);
        
        this.containerElement.appendChild(selectedValuesContainer);
        this.containerElement.appendChild(submitButtonContainer);
        
        // RANGE SLIDER RELEVANT CODE
        const rangeSliderContainer = this.buildRangeSliderSegment();
        this.containerElement.appendChild(rangeSliderContainer);
        this.configureRangeSlider();

        // Append the container to the component
        this.appendChild(this.containerElement);
    }
}
time_config.id = 0;
// Leaving the 'uuid'/'id' infrastructure in place, 
// but this should be largely unused
customElements.define('time-config', time_config);