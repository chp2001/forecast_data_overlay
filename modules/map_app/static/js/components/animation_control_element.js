
// Use a config object to avoid cluttering the global namespace
// and to make it easier to change strings and IDs later if needed.
var animation_control_config = {
    animation_control_id: 'animation-settings', // The ID for the main container element of the component
    animation_control_title_text: 'Animation Control', // The title text for the component
    /// Range slider specific config
    range_slider_select_spam_console_log: false, // Whether to spam the console with range slider change logs
    // Text for the range slider segment
    range_slider_label_text: 'Select Lead Time for Display:',
    range_slider_disclaimer_text: 'Note: This slider is only visible when the currently loaded data contains multiple lead times.',
    // Whether to use styling that separates the range slider container box from the rest of the animation control
    // (adds a border and some other minor styling changes)
    range_slider_separate_box_styling: false,
}

// RANGE SLIDER RELEVANT CODE
/**
 * @callback onRangeSliderChangeCallback
 * @param {number} selectedLeadTime - The currently selected lead time
 */

/**
 * @class 
 * @name animation_control
 * @extends {HTMLElement}
 */
class animation_control extends HTMLElement {
    constructor() {
        super();

        this.containerElement = null; // The main container element for the component

        this.titleElement = null; // The title element for the component

        // RANGE SLIDER RELEVANT CODE
        this.showRangeSlider = false; // Enable/disable additional slider based on whether
        // range mode is enabled and lead time < lead time end, allowing for a range of lead times
        // to be selected for time series/animation mode.
        this.rangeSliderContainer = null; // Container for the range slider, shown/hidden based on showRangeSlider
        this.rangeSliderMinLabel = null; // Label for the minimum lead time in range slider
        this.rangeSliderMaxLabel = null; // Label for the maximum lead time in range slider
        this.rangeSliderValueLabel = null; // Label showing the current value of the range slider
        this.rangeSliderElement = null; // The range slider element itself
        this.rangeSliderValue = null; // The current value of the range slider

        /**
         * This is a temporary solution for now, and won't have proper infrastructure until
         * later.
         * @type {Object.<string, onRangeSliderChangeCallback>}
         */
        this.onRangeSliderChangeFuncs = {};

        // Playback control elements
        this.playButtonContainer = null; // Container for the play button
        this.playButtonElement = null; // The play button(?) element itself
        // (We might want to use a checkbox instead of a button for this, since it's a 2-state toggle)
        this.playButtonLabel = null; // Label for the play button
        this.playbackIntervalId = null; // ID for the playback interval, used to stop playback
        this.playbackIntervalDuration = 1000; // Duration between playback ticks in milliseconds
        this.playbackIntervalInput = null; // Input element for setting playback interval duration

        this.uuid = animation_control.id++;
    }

    connectedCallback() {
        console.log('Animation Control ' + this.uuid + ' triggered callback. Building...');
        this.build();
    }

    /**
     * Check whether the range slider should be shown or hidden, and update the relevant property.
     * @param {time_config_element} timeConfigElement - The time config element to use for values.
     */
    checkRangeSliderVisibility(timeConfigElement) {
        // RANGE SLIDER RELEVANT CODE
        // Check only the 'selected_' properties, as these represent the last submitted values.
        if ([timeConfigElement.selected_range_mode, timeConfigElement.selected_lead_time, timeConfigElement.selected_lead_time_end].includes(null)) {
            this.showRangeSlider = false;
            return;
        }
        if (timeConfigElement.selected_range_mode === true && timeConfigElement.selected_lead_time < timeConfigElement.selected_lead_time_end) {
            this.showRangeSlider = true;
        } else {
            this.showRangeSlider = false;
        }
    }

    /**
     * Update the range slider segment to display the current range.
     * @param {time_config_element} timeConfigElement - The time config element to use for values.
     */
    updateRangeSliderSegment(timeConfigElement) {
        // RANGE SLIDER RELEVANT CODE
        if (!this.showRangeSlider) {
            this.rangeSliderContainer.style.display = 'none';
            this.playButtonContainer.style.display = 'none';
            if (this.playbackIntervalId !== null) {
                this.stopPlayback();
                this.playButtonElement.checked = false;
            }
            return;
        }
        this.playButtonContainer.style.display = 'flex';
        this.rangeSliderContainer.style.display = 'flex';
        this.rangeSliderMinLabel.textContent = timeConfigElement.selected_lead_time;
        this.rangeSliderMaxLabel.textContent = timeConfigElement.selected_lead_time_end;
        this.rangeSliderElement.min = timeConfigElement.selected_lead_time;
        this.rangeSliderElement.max = timeConfigElement.selected_lead_time_end;
        this.rangeSliderElement.step = timeConfigElement.data_step_lead_time;
        this.rangeSliderElement.value = timeConfigElement.selected_lead_time; // By default, always starts at the first value
        this.rangeSliderValue = timeConfigElement.selected_lead_time;
        this.rangeSliderValueLabel.textContent = timeConfigElement.selected_lead_time;
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
        // rangeSliderLabel.textContent = 'Select Lead Time for Display:';
        rangeSliderLabel.textContent = animation_control_config.range_slider_label_text;
        rangeSliderLabel.style.alignSelf = 'center';
        
        this.rangeSliderElement = document.createElement('input');
        this.rangeSliderElement.type = 'range';
        this.rangeSliderElement.id = 'lead-time-range-slider';
        this.rangeSliderElement.name = 'lead-time-range-slider';
        this.rangeSliderElement.min = 0;
        this.rangeSliderElement.max = 1;
        this.rangeSliderElement.step = 1;
        this.rangeSliderElement.value = 0;
        this.rangeSliderValue = 0;

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
        if (animation_control_config.range_slider_separate_box_styling) {
            this.rangeSliderContainer.style.outline = '1px solid #ccc';
            this.rangeSliderContainer.style.padding = '3px';
        }
        this.rangeSliderContainer.appendChild(rangeSliderLabel);
        this.rangeSliderContainer.appendChild(rangeSliderSelectorContainer);
        this.rangeSliderContainer.appendChild(rangeSliderValueContainer);

        // Tiny disclaimer at bottom explaining that the slider is only
        // visible when the current data contains multiple lead times
        // const rangeSliderDisclaimerText = 'Note: This slider is only visible when the currently loaded data contains multiple lead times.';
        const rangeSliderDisclaimerText = animation_control_config.range_slider_disclaimer_text;
        const rangeSliderDisclaimer = document.createElement('div');
        rangeSliderDisclaimer.textContent = rangeSliderDisclaimerText;
        rangeSliderDisclaimer.style.fontSize = '0.8em';
        rangeSliderDisclaimer.style.fontStyle = 'italic';
        this.rangeSliderContainer.appendChild(rangeSliderDisclaimer);

        return this.rangeSliderContainer;
    }

    /**
     * Change the value of the range slider programmatically.
     * @param {number} newValue - The new value to set the range slider to.
     */
    changeRangeSliderValue(newValue) {
        // RANGE SLIDER RELEVANT CODE
        this.rangeSliderElement.value = newValue;
        this.rangeSliderValueLabel.textContent = newValue;
        this.rangeSliderValue = newValue;
        if (animation_control_config.range_slider_select_spam_console_log) {
            console.log('Range slider changed, triggering callbacks with new lead time:', value);
        }
        // Call any registered onRangeSliderChange functions
        for (const key in this.onRangeSliderChangeFuncs) {
            this.onRangeSliderChangeFuncs[key](newValue);
        }
    }

    /**
     * Configure the range slider events
     */
    configureRangeSlider() {
        // RANGE SLIDER RELEVANT CODE
        this.rangeSliderElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            this.changeRangeSliderValue(value);
        });
    }

    /**
     * Add time config couplings.
     * @param {time_config} timeConfigElement - The time config element to couple with.
     */
    addTimeConfigCoupling(timeConfigElement) {
        // RANGE SLIDER RELEVANT CODE
        // When the time config selection display is updated, update the animation control's
        // visibility and/or displays
        // timeConfigElement.addOnDisplaySelectFunction('animation_control_' + this.uuid, (args) => {
            timeConfigElement.displaySelectCallbacks.add('animation_control_' + this.uuid, (args) => {
            // RANGE SLIDER RELEVANT CODE
            this.checkRangeSliderVisibility(timeConfigElement);
            this.updateRangeSliderSegment(timeConfigElement);
        });
    }

    /**
     * Build the playback control segment of the component.
     * @returns {HTMLDivElement} The playback control segment element
     */
    buildPlaybackControlSegment() {
        // Playback control segment
        this.playButtonContainer = document.createElement('div');
        this.playButtonContainer.className = 'playback-control-container';
        // this.playButtonContainer.style.display = 'flex';
        this.playButtonContainer.style.display = 'none'; // Hidden by default
        this.playButtonContainer.style.alignItems = 'center';
        this.playButtonContainer.style.marginTop = '10px';

        this.playButtonElement = document.createElement('input');
        this.playButtonElement.type = 'checkbox';
        this.playButtonElement.id = 'playback-toggle';
        this.playButtonElement.name = 'playback-toggle';
        this.playButtonElement.checked = false; // Default to not playing

        this.playButtonLabel = document.createElement('label');
        this.playButtonLabel.htmlFor = 'playback-toggle';
        this.playButtonLabel.textContent = 'Play Animation';

        const intervalLabel = document.createElement('label');
        intervalLabel.htmlFor = 'playback-interval';
        intervalLabel.textContent = 'Interval (ms): ';
        intervalLabel.style.marginLeft = '10px';
        this.playButtonContainer.appendChild(intervalLabel);

        this.playbackIntervalInput = document.createElement('input');
        this.playbackIntervalInput.type = 'text';
        this.playbackIntervalInput.id = 'playback-interval';
        this.playbackIntervalInput.name = 'playback-interval';
        this.playbackIntervalInput.style.maxWidth = '60px';
        this.playbackIntervalInput.value = this.playbackIntervalDuration;

        this.playButtonContainer.appendChild(this.playButtonElement);
        this.playButtonContainer.appendChild(this.playButtonLabel);
        this.playButtonContainer.appendChild(intervalLabel);
        this.playButtonContainer.appendChild(this.playbackIntervalInput);

        return this.playButtonContainer;
    }

    doPlaybackTick() {
        // This function is called on each playback tick
        const minValue = parseInt(this.rangeSliderElement.min);
        const maxValue = parseInt(this.rangeSliderElement.max);
        let currentValue = parseInt(this.rangeSliderElement.value);
        if (minValue >= maxValue) {
            console.error('Playback tick error: minValue >= maxValue, cannot proceed.');
            return;
        }
        currentValue += 1;
        if (currentValue > maxValue) {
            currentValue = minValue; // Loop back to start
        }
        this.changeRangeSliderValue(currentValue);
    }

    startPlayback() {
        // Start playback interval
        console.log('Playback started');
        this.playbackIntervalId = setInterval(() => {
            // Trigger any playback-related functions here
            // console.log('Playback tick');
            this.doPlaybackTick();
        }, this.playbackIntervalDuration);
    }

    stopPlayback() {
        // Stop playback interval
        console.log('Playback stopped');
        if (this.playbackIntervalId !== null) {
            clearInterval(this.playbackIntervalId);
            this.playbackIntervalId = null;
        }
    }

    /**
     * Configure the playback toggle events
     */
    configurePlaybackToggle() {
        this.playButtonElement.addEventListener('change', (event) => {
            if (this.playButtonElement.checked) {
                this.startPlayback();
            } else {
                this.stopPlayback();
            }
        });
    }

    /**
     * Configure the playback interval input events
     */
    configurePlaybackIntervalInput() {
        this.playbackIntervalInput.addEventListener('change', (event) => {
            try {
                const newInterval = parseInt(this.playbackIntervalInput.value);
                if (isNaN(newInterval) || newInterval <= 0) {
                    throw new Error('Invalid interval');
                }
                this.playbackIntervalDuration = newInterval;
                console.log('Playback interval set to', newInterval, 'ms');
                // If currently playing, stop the playback to allow the user to
                // intentionally restart it with the new interval
                if (this.playbackIntervalId !== null) {
                    this.stopPlayback();
                    this.playButtonElement.checked = false;
                }
            } catch (error) {
                // Onchange will trigger even if the value is currently being edited,
                // so we don't want to be too aggressive with error handling here.
                console.error('Invalid playback interval input:', this.playbackIntervalInput.value);
            }
        });
    }

    /**
     * Build the component structure.
     */
    build() {
        // Build the component structure
        // Don't modify the styling in this function, just create the elements and
        // set up the hierarchy.

        // container element
        this.containerElement = document.createElement('section');
        this.containerElement.id = 'animation-settings';

        // Title
        this.titleElement = document.createElement('label');
        this.titleElement.htmlFor = 'animation-settings';
        this.titleElement.textContent = animation_control_config.animation_control_title_text;
        this.containerElement.appendChild(this.titleElement);

        // RANGE SLIDER RELEVANT CODE
        const rangeSliderContainer = this.buildRangeSliderSegment();
        this.containerElement.appendChild(rangeSliderContainer);
        this.configureRangeSlider();

        // Playback control segment
        const playbackControlContainer = this.buildPlaybackControlSegment();
        this.containerElement.appendChild(playbackControlContainer);
        this.configurePlaybackToggle();
        this.configurePlaybackIntervalInput();


        // Append the container to the component
        this.appendChild(this.containerElement);
    }
}

animation_control.id = 0;

customElements.define('animation-control', animation_control);