// time_config_element.js

// 'Imports' (Mark things we need from files that are loaded earlier in the HTML file)

/**
 * @import {CallbackDict} from '../utilities/callbacks.js';
 * @import {DataSourceOption, data_source_options} from '../globals.js';
 */

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
    run_type_label_string: 'Run Type:',
    run_type_default: 'short_range',
    run_type_element_id: 'run-type-input',
    // lead time / lead time end coupling behavior:
    // choose between:
    // 1. constrain: disallow movement of one past the other
    // 2. propagate: moving one past the other moves the other as well
    // lead_time_end_coupling: 'constrain',
    lead_time_end_coupling: 'propagate',
    forecast_cycle_label_string: 'Forecast Cycle:',
    forecast_cycle_element_id: 'forecast-cycle-input',
    forecast_cycle_default: 0,
    selected_values_label_string: 'Selected Values:',
    selected_time_label_string: 'Selected Time: ',
    selected_lead_time_label_string: 'Selected Lead Time: ',
    selected_lead_times_label_string: 'Selected Lead Times (range): ',
    selected_forecast_cycle_label_string: 'Selected Forecast Cycle: ',
    selected_run_type_label_string: 'Selected Run Type: ',
    // const submit_button_string = 'Set Time';
    submit_button_string: 'Get Data',
    submit_button_id: 'submit-time-config',
    submit_button_tooltip_string: 'Submit the selected time configuration and request forecast data for display on the map.',
    download_button_string: 'Download Selected',
    download_button_id: 'download-forecast-data',
    download_button_tooltip_string: 'Download NetCDF files for the currently selected/displayed forecast data.',
    download_fullres_button_string: 'Download Selected Full Resolution',
    download_fullres_button_id: 'download-forecast-data-fullres',
    download_fullres_button_tooltip_string: 'Download NetCDF files for the currently selected/displayed forecast data at full resolution (1kmx1km scale).',
}

/**
 * @typedef {Object} timeConfigArgs
 * @property {string} target_time - The target time in YYYY-MM-DD format
 * @property {number} lead_time - The lead time value
 * @property {number} forecast_cycle - The forecast cycle value
 * @property {boolean|null} range_mode - True if range mode is enabled, false otherwise
 * @property {number|null} lead_time_end - The lead time end value (only if range mode)
 * @property {string|null} runtype - The run type (e.g., 'short_range', 'medium_range')
 */

/**
 * @callback onSubmitCallback
 * @param {timeConfigArgs} args - The arguments passed to the callback
 */

/**
 * @class 
 * @name time_config
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
         * @type {CallbackDict<onSubmitCallback>}
         */
        this.submitCallbacks = new CallbackDict();
        /**
         * @type {CallbackDict<onSubmitCallback>}
         */
        this.displaySelectCallbacks = new CallbackDict();
        /**
         * @type {CallbackDict<onSubmitCallback>}
         */
        this.downloadCallbacks = new CallbackDict();
        /**
         * @type {CallbackDict<onSubmitCallback>}
         */
        this.fullResDownloadCallbacks = new CallbackDict();

        // Data attributes
        this.runtype = time_config_config.run_type_default; // expected to be 'short_range'
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
        this.selected_run_type = null;
        this.selected_target_time = null;
        this.selected_range_mode = null;
        this.selected_lead_time = null;
        this.selected_lead_time_end = null;
        this.selected_forecast_cycle = null;

        // Element references
        // header/title
        this.titleElement = null;
        // selector for run type
        this.runTypeElement = null;
        this.runTypeLabel = null;
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
        this.selectedRunTypeElement = null; // display for selected run type
        this.selectedRunTypeLabel = null;
        this.selectedTimeElement = null; // display for selected target time
        this.selectedTimeLabel = null;
        this.selectedLeadTimeElement = null; // display for selected lead time(s)
        this.selectedLeadTimeLabel = null;
        this.selectedForecastCycleElement = null; // display for selected forecast cycle
        this.selectedForecastCycleLabel = null;
        // button to submit the selected values and request data
        // this.setTimeButton = null;
        this.submitButton = null;
        this.downloadButton = null;
        this.downloadFullResButton = null;
        // container element for the entire component
        this.containerElement = null;

        this.uuid = time_config.id++;
    }

    connectedCallback() {
        console.log('Time Config ' + this.uuid + ' triggered callback. Building...');
        this.build();
    }

    /**
     * Handler for selecting a run type. Modify both the attribute and the display element.
     * @param {string} value - The selected run type
     */
    selectRunType(value) {
        this.runtype = value;
        this.runTypeElement.value = value;
        var option = data_source_options[value];
        this.reconfigureLeadTimeConstraints(option.lead_time.min, option.lead_time.max, option.lead_time.interval);
        this.reconfigureForecastCycleConstraints(option.forecast_cycle.min, option.forecast_cycle.max, option.forecast_cycle.interval);
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
     * Update the lead time input properties based on the data constraints.
     * Called when data constraints change.
     */
    updateLeadTimeInputProperties() {
        this.leadTimeElement.min = this.data_min_lead_time;
        this.leadTimeElement.max = this.data_max_lead_time;
        this.leadTimeElement.step = this.data_step_lead_time;
        if (this.lead_time < this.data_min_lead_time) {
            this.selectLeadTime(this.data_min_lead_time);
        } else if (this.lead_time > this.data_max_lead_time) {
            this.selectLeadTime(this.data_max_lead_time);
        }
        this.leadTimeEndElement.min = this.data_min_lead_time;
        this.leadTimeEndElement.max = this.data_max_lead_time;
        this.leadTimeEndElement.step = this.data_step_lead_time;
        if (this.lead_time_end < this.data_min_lead_time) {
            this.selectLeadTimeEnd(this.data_min_lead_time);
        } else if (this.lead_time_end > this.data_max_lead_time) {
            this.selectLeadTimeEnd(this.data_max_lead_time);
        }
    }

    /**
     * Update the forecast cycle input properties based on the data constraints.
     * Called when data constraints change.
     */
    updateForecastCycleInputProperties() {
        this.forecastCycleElement.min = this.data_min_forecast_cycle;
        this.forecastCycleElement.max = this.data_max_forecast_cycle;
        this.forecastCycleElement.step = this.data_step_forecast_cycle;
        if (this.forecast_cycle < this.data_min_forecast_cycle) {
            this.selectForecastCycle(this.data_min_forecast_cycle);
        } else if (this.forecast_cycle > this.data_max_forecast_cycle) {
            this.selectForecastCycle(this.data_max_forecast_cycle);
        }
    }

    /**
     * Reconfigure the lead time constraints and update the input properties accordingly.
     * @param {number} min - The new minimum lead time
     * @param {number} max - The new maximum lead time
     * @param {number} step - The new lead time step
     */
    reconfigureLeadTimeConstraints(min, max, step) {
        this.data_min_lead_time = min;
        this.data_max_lead_time = max;
        this.data_step_lead_time = step;
        this.updateLeadTimeInputProperties();
    }

    /**
     * Reconfigure the forecast cycle constraints and update the input properties accordingly.
     * @param {number} min - The new minimum forecast cycle
     * @param {number} max - The new maximum forecast cycle
     * @param {number} step - The new forecast cycle step
     */
    reconfigureForecastCycleConstraints(min, max, step) {
        this.data_min_forecast_cycle = min;
        this.data_max_forecast_cycle = max;
        this.data_step_forecast_cycle = step;
        this.updateForecastCycleInputProperties();
    }

    /**
     * Update runtype selection options based on data source options
     */
    updateRunTypeOptions() {
        // Clear existing options
        while (this.runTypeElement.firstChild) {
            this.runTypeElement.removeChild(this.runTypeElement.firstChild);
        }
        // Add options from data_source_options
        for (const [key, option] of Object.entries(data_source_options)) {
            const optionElement = document.createElement('option');
            optionElement.value = key;
            optionElement.textContent = option.name;
            this.runTypeElement.appendChild(optionElement);
        }
    }

    /**
     * On submit, update the selected values with the requested values
     * and update the display elements accordingly.
     * This assumes the submit button has been pressed.
     */
    displaySelectedValues() {
        this.selectedRunTypeElement.textContent = (this.selected_run_type !== null) ? this.selected_run_type : 'None';
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
        // Trigger any display select functions
        // this.triggerOnDisplaySelect({
        //     target_time: this.selected_target_time,
        //     lead_time: this.selected_lead_time,
        //     forecast_cycle: this.selected_forecast_cycle,
        //     range_mode: this.selected_range_mode,
        //     lead_time_end: this.selected_lead_time_end
        // });
        this.displaySelectCallbacks.trigger({
            target_time: this.selected_target_time,
            lead_time: this.selected_lead_time,
            forecast_cycle: this.selected_forecast_cycle,
            range_mode: this.selected_range_mode,
            lead_time_end: this.selected_lead_time_end,
            runtype: this.selected_run_type
        });
    }

    /**
     * Externally set the last submitted/loaded values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetPreviousValues({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null, runtype=null}={}) {
        this.selected_target_time = target_time;
        this.selected_lead_time = lead_time;
        this.selected_forecast_cycle = forecast_cycle;
        if (range_mode !== null) {
            this.selected_range_mode = range_mode;
        }
        if (lead_time_end !== null) {
            this.selected_lead_time_end = lead_time_end;
        }
        if (runtype !== null) {
            this.selected_run_type = runtype;
        } else {
            // Assume default if not provided
            this.selected_run_type = time_config_config.run_type_default;
        }
        this.displaySelectedValues();
    }

    /**
     * Externally set the current input values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetInputValues({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null, runtype=null}={}) {
        this.selectTargetTime(target_time);
        this.selectLeadTime(lead_time);
        this.selectForecastCycle(forecast_cycle);
        if (range_mode !== null) {
            this.setRangeMode(range_mode);
        }
        if (lead_time_end !== null) {
            this.selectLeadTimeEnd(lead_time_end);
        }
        if (runtype !== null) {
            this.selectRunType(runtype);
        } else {
            // Assume default if not provided
            this.selectRunType(time_config_config.run_type_default);
        }
    }

    /**
     * Externally set both the previous submitted values and the current input values.
     * Will be called from the resume functionality.
     * @param {timeConfigArgs} param0 - Object containing the values to set
     */
    externallySetFull({target_time, lead_time, forecast_cycle, range_mode=null, lead_time_end=null, runtype=null}={}) {
        this.externallySetPreviousValues({target_time, lead_time, forecast_cycle, range_mode, lead_time_end, runtype});
        this.externallySetInputValues({target_time, lead_time, forecast_cycle, range_mode, lead_time_end, runtype});
    }

    /**
     * Build the runtype segment of the component
     * @returns {HTMLDivElement} The runtype segment element
     */
    buildRunTypeSegment() {
        // Run type input
        // Unlike other inputs being toggles, sliders, buttons, this is a select dropdown
        this.runTypeElement = document.createElement('select');
        this.runTypeElement.id = time_config_config.run_type_element_id;
        this.runTypeElement.name = time_config_config.run_type_element_id;
        this.updateRunTypeOptions();

        this.runTypeLabel = document.createElement('label');
        this.runTypeLabel.htmlFor = time_config_config.run_type_element_id;
        this.runTypeLabel.textContent = time_config_config.run_type_label_string;

        const runTypeContainer = document.createElement('div');
        runTypeContainer.className = 'run-type-input';
        runTypeContainer.style.display = 'flex';
        runTypeContainer.style.flexDirection = 'column';
        runTypeContainer.style.marginBottom = '10px';
        runTypeContainer.appendChild(this.runTypeLabel);
        runTypeContainer.appendChild(this.runTypeElement);
        return runTypeContainer;
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

        function makeDefaultSelectedLabel(text, id=null) {
            const label = document.createElement('p');
            label.style.margin = '2px 0px';
            label.innerHTML = text;
            if (id !== null) {
                label.id = id;
            }
            return label;
        }
        function makeDefaultSelectedValue(text, id=null) {
            const value = document.createElement('span');
            value.textContent = text;
            if (id !== null) {
                value.id = id;
            }
            return value;
        }

        // Selected run type
        this.selectedRunTypeLabel = makeDefaultSelectedLabel(time_config_config.selected_run_type_label_string);
        this.selectedRunTypeElement = makeDefaultSelectedValue('None', 'selected-run-type');
        const selectedRunTypeContainer = document.createElement('div');
        selectedRunTypeContainer.style.display = 'flex';
        selectedRunTypeContainer.style.alignItems = 'center';
        selectedRunTypeContainer.appendChild(this.selectedRunTypeLabel);
        selectedRunTypeContainer.appendChild(this.selectedRunTypeElement);
        this.selectedValuesElement.appendChild(selectedRunTypeContainer);

        // Selected time
        this.selectedTimeLabel = makeDefaultSelectedLabel(time_config_config.selected_time_label_string);
        this.selectedTimeElement = makeDefaultSelectedValue('None', 'selected-time');
        const selectedTimeContainer = document.createElement('div');
        selectedTimeContainer.style.display = 'flex';
        selectedTimeContainer.style.alignItems = 'center';
        selectedTimeContainer.appendChild(this.selectedTimeLabel);
        selectedTimeContainer.appendChild(this.selectedTimeElement);
        this.selectedValuesElement.appendChild(selectedTimeContainer);

        // Selected lead time(s)
        this.selectedLeadTimeLabel = makeDefaultSelectedLabel(time_config_config.selected_lead_time_label_string);
        this.selectedLeadTimeElement = makeDefaultSelectedValue('None', 'selected-lead-time');
        const selectedLeadTimeContainer = document.createElement('div');
        selectedLeadTimeContainer.style.display = 'flex';
        selectedLeadTimeContainer.style.alignItems = 'center';
        selectedLeadTimeContainer.appendChild(this.selectedLeadTimeLabel);
        selectedLeadTimeContainer.appendChild(this.selectedLeadTimeElement);
        this.selectedValuesElement.appendChild(selectedLeadTimeContainer);

        // Selected forecast cycle
        this.selectedForecastCycleLabel = makeDefaultSelectedLabel(time_config_config.selected_forecast_cycle_label_string);
        this.selectedForecastCycleElement = makeDefaultSelectedValue('None', 'selected-forecast-cycle');
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
        // segment of the component that contains the buttons
        // that finalize the selection and interact with the data requesting
        // functionality

        // 2 rows, top has submit and download buttons, bottom has download full res button

        // button to submit the selected values and request data
        this.submitButton = document.createElement('button');
        this.submitButton.id = time_config_config.submit_button_id;
        this.submitButton.textContent = time_config_config.submit_button_string;
        this.submitButton.title = time_config_config.submit_button_tooltip_string;

        // Include the download button here as well in the same flex container
        
        this.downloadButton = document.createElement('button');
        this.downloadButton.id = time_config_config.download_button_id;
        this.downloadButton.textContent = time_config_config.download_button_string;
        this.downloadButton.style.marginLeft = '10px';
        this.downloadButton.title = time_config_config.download_button_tooltip_string;

        this.downloadFullResButton = document.createElement('button');
        this.downloadFullResButton.id = time_config_config.download_fullres_button_id;
        this.downloadFullResButton.textContent = time_config_config.download_fullres_button_string;
        this.downloadFullResButton.title = time_config_config.download_fullres_button_tooltip_string;
        
        const submitButtonContainer = document.createElement('div');
        submitButtonContainer.style.display = 'flex';
        submitButtonContainer.style.justifyContent = 'center';
        submitButtonContainer.style.marginTop = '10px';
        submitButtonContainer.style.flexDirection = 'column';
        
        const topButtonRow = document.createElement('div');
        topButtonRow.style.display = 'flex';
        topButtonRow.style.justifyContent = 'center';
        topButtonRow.appendChild(this.submitButton);
        topButtonRow.appendChild(this.downloadButton);
        submitButtonContainer.appendChild(topButtonRow);

        const bottomButtonRow = document.createElement('div');
        bottomButtonRow.style.display = 'flex';
        bottomButtonRow.style.justifyContent = 'center';
        bottomButtonRow.style.marginTop = '5px';
        bottomButtonRow.appendChild(this.downloadFullResButton);
        submitButtonContainer.appendChild(bottomButtonRow);

        return submitButtonContainer;
    }

    /**
     * Configure the run type select events
     */
    configureRunTypeSelect() {
        this.runTypeElement.addEventListener('input', (event) => {
            const value = event.target.value;
            this.selectRunType(value);
        });
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
        if (time_config_config.lead_time_end_coupling === 'constrain') {
            // Original behavior: when lead time is changed, if it exceeds lead time end,
            // cap it to lead time end
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
        } else if (time_config_config.lead_time_end_coupling === 'propagate') {
            // New behavior: when lead time is changed, if it exceeds lead time end,
            // set lead time end to the new lead time value
            this.leadTimeElement.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                if (this.range_mode && value > this.lead_time_end) {
                    // In range mode, lead time cannot exceed lead time end
                    // Set lead time end to the new lead time value
                    this.selectLeadTime(value);
                    this.selectLeadTimeEnd(value);
                } else {
                    this.selectLeadTime(value);
                }
            });
        } else {
            console.error('Invalid lead_time_end_coupling configuration: ' + time_config_config.lead_time_end_coupling);
            return;
        }
    }

    /**
     * Configure the lead time end input events
     */
    configureLeadTimeEndInput() {
        if (time_config_config.lead_time_end_coupling === 'constrain') {
            // Original behavior: when lead time end is changed, if it is less than lead time,
            // cap it to lead time
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
        } else if (time_config_config.lead_time_end_coupling === 'propagate') {
            // New behavior: when lead time end is changed, if it is less than lead time,
            // set lead time to the new lead time end value
            this.leadTimeEndElement.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                if (value < this.lead_time) {
                    // In range mode, lead time end cannot be less than lead time
                    // Set lead time to the new lead time end value
                    this.selectLeadTimeEnd(value);
                    this.selectLeadTime(value);
                } else {
                    this.selectLeadTimeEnd(value);
                }
            });
        } else {
            console.error('Invalid lead_time_end_coupling configuration: ' + time_config_config.lead_time_end_coupling);
            return;
        }
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
            this.selected_run_type = this.runtype;
            this.selected_target_time = this.target_time;
            this.selected_range_mode = this.range_mode;
            this.selected_lead_time = this.lead_time;
            this.selected_lead_time_end = this.lead_time_end;
            this.selected_forecast_cycle = this.forecast_cycle;
            this.displaySelectedValues();
            // Trigger any registered onSubmit functions
            if (this.range_mode) {
                // this.triggerOnSubmit({
                //     target_time: this.selected_target_time,
                //     lead_time: this.selected_lead_time,
                //     lead_time_end: this.selected_lead_time_end,
                //     forecast_cycle: this.selected_forecast_cycle,
                //     range_mode: this.selected_range_mode
                // });
                this.submitCallbacks.trigger({
                    target_time: this.selected_target_time,
                    lead_time: this.selected_lead_time,
                    lead_time_end: this.selected_lead_time_end,
                    forecast_cycle: this.selected_forecast_cycle,
                    range_mode: this.selected_range_mode,
                    runtype: this.selected_run_type
                });
            } else {
                // this.triggerOnSubmit({
                //     target_time: this.selected_target_time,
                //     lead_time: this.selected_lead_time,
                //     forecast_cycle: this.selected_forecast_cycle,
                //     range_mode: this.selected_range_mode
                // });
                this.submitCallbacks.trigger({
                    target_time: this.selected_target_time,
                    lead_time: this.selected_lead_time,
                    forecast_cycle: this.selected_forecast_cycle,
                    range_mode: this.selected_range_mode,
                    runtype: this.selected_run_type
                });
            }
        });
    }

    /**
     * Configure the download button events
     */
    configureDownloadButton() {
        this.downloadButton.addEventListener('click', () => {
            // First, check that there are selected values
            if (this.selected_target_time === null ||
                this.selected_lead_time === null ||
                this.selected_forecast_cycle === null) {
                console.warn('Download button pressed but no valid selection submitted.');
                alert('Please submit a valid selection before downloading data.');
                return;
            }
            // On download button click, trigger any registered onDownload functions
            // this.triggerOnDownload({
            //     target_time: this.selected_target_time,
            //     lead_time: this.selected_lead_time,
            //     lead_time_end: this.selected_lead_time_end,
            //     forecast_cycle: this.selected_forecast_cycle,
            //     range_mode: this.selected_range_mode
            // });
            this.downloadCallbacks.trigger({
                target_time: this.selected_target_time,
                lead_time: this.selected_lead_time,
                lead_time_end: this.selected_lead_time_end,
                forecast_cycle: this.selected_forecast_cycle,
                range_mode: this.selected_range_mode,
                runtype: this.selected_run_type
            });
        });
    }

    /**
     * Configure the download full resolution button events
     */
    configureDownloadFullResButton() {
        this.downloadFullResButton.addEventListener('click', () => {
            // First, check that there are selected values
            if (this.selected_target_time === null ||
                this.selected_lead_time === null ||
                this.selected_forecast_cycle === null) {
                console.warn('Download Full Res button pressed but no valid selection submitted.');
                alert('Please submit a valid selection before downloading data.');
                return;
            }
            // On download full res button click, trigger any registered onDownloadFullRes functions
            this.fullResDownloadCallbacks.trigger({
                target_time: this.selected_target_time,
                lead_time: this.selected_lead_time,
                lead_time_end: this.selected_lead_time_end,
                forecast_cycle: this.selected_forecast_cycle,
                range_mode: this.selected_range_mode,
                runtype: this.selected_run_type
            });
        });
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
        this.titleElement.style.fontWeight = 'bold';
        this.titleElement.style.alignSelf = 'center';
        this.titleElement.style.marginBottom = '10px';
        
        // Build segments

        const runTypeContainer = this.buildRunTypeSegment();
        const targetTimeContainer = this.buildTargetTimeSegment();
        const rangeModeContainer = this.buildRangeModeToggleSegment();
        const leadTimeContainer = this.buildLeadTimeSegment();
        const leadTimeEndContainer = this.buildLeadTimeEndSegment();
        const forecastCycleContainer = this.buildForecastCycleSegment();
        const selectedValuesContainer = this.buildSelectedValuesSegment();
        const submitButtonContainer = this.buildSubmitButtonSegment();

        // Configure segment events
        this.configureRunTypeSelect();
        this.configureRangeModeToggle();
        this.configureLeadTimeInput();
        this.configureLeadTimeEndInput();
        this.configureForecastCycleInput();
        this.configureTargetTimeInput();
        this.configureSubmitButton();
        this.configureDownloadButton();
        this.configureDownloadFullResButton();

        this.containerElement.appendChild(this.titleElement);
        this.containerElement.appendChild(runTypeContainer);
        this.containerElement.appendChild(targetTimeContainer);
        this.containerElement.appendChild(forecastCycleContainer);
        this.containerElement.appendChild(rangeModeContainer);
        this.containerElement.appendChild(leadTimeContainer);
        this.containerElement.appendChild(leadTimeEndContainer);
        
        this.containerElement.appendChild(selectedValuesContainer);
        this.containerElement.appendChild(submitButtonContainer);
        
        

        // Append the container to the component
        this.appendChild(this.containerElement);
    }
}
time_config.id = 0;
// Leaving the 'uuid'/'id' infrastructure in place, 
// but this should be largely unused
customElements.define('time-config', time_config);