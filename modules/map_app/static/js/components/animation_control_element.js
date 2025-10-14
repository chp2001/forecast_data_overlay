
// Use a config object to avoid cluttering the global namespace
// and to make it easier to change strings and IDs later if needed.
var animation_control_config = {
    range_slider_select_spam_console_log: false, // Whether to spam the console with range slider change logs
    range_slider_label_text: 'Select Lead Time for Display:',
    range_slider_disclaimer_text: 'Note: This slider is only visible when the currently loaded data contains multiple lead times.',
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
            return;
        }
        this.rangeSliderContainer.style.display = 'flex';
        this.rangeSliderMinLabel.textContent = timeConfigElement.selected_lead_time;
        this.rangeSliderMaxLabel.textContent = timeConfigElement.selected_lead_time_end;
        this.rangeSliderElement.min = timeConfigElement.selected_lead_time;
        this.rangeSliderElement.max = timeConfigElement.selected_lead_time_end;
        this.rangeSliderElement.step = timeConfigElement.data_step_lead_time;
        this.rangeSliderElement.value = timeConfigElement.selected_lead_time; // By default, always starts at the first value
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
     * Configure the range slider events
     */
    configureRangeSlider() {
        // RANGE SLIDER RELEVANT CODE
        this.rangeSliderElement.addEventListener('input', (event) => {
            const value = parseInt(event.target.value);
            this.rangeSliderValueLabel.textContent = value;
            if (animation_control_config.range_slider_select_spam_console_log) {
                console.log('Range slider changed, triggering callbacks with new lead time:', value);
            }
            // Call any registered onRangeSliderChange functions
            for (const key in this.onRangeSliderChangeFuncs) {
                this.onRangeSliderChangeFuncs[key](value);
            }
        });
    }

    /**
     * Add time config couplings.
     * @param {time_config_element} timeConfigElement - The time config element to couple with.
     */
    addTimeConfigCoupling(timeConfigElement) {
        // RANGE SLIDER RELEVANT CODE
        // When the time config selection display is updated, update the animation control's
        // visibility and/or displays
        timeConfigElement.addOnDisplaySelectFunction('animation_control_' + this.uuid, (args) => {
            // RANGE SLIDER RELEVANT CODE
            this.checkRangeSliderVisibility(timeConfigElement);
            this.updateRangeSliderSegment(timeConfigElement);
        });
    }

    build() {
        // Build the component structure
        // Don't modify the styling in this function, just create the elements and
        // set up the hierarchy.

        // container element
        this.containerElement = document.createElement('section');
        this.containerElement.id = 'animation-control-container';

        // RANGE SLIDER RELEVANT CODE
        const rangeSliderContainer = this.buildRangeSliderSegment();
        this.containerElement.appendChild(rangeSliderContainer);
        this.configureRangeSlider();


        // Append the container to the component
        this.appendChild(this.containerElement);
    }
}

animation_control.id = 0;

customElements.define('animation-control', animation_control);