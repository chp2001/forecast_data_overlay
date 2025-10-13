/**
 * @file Provides a double-labeled slider custom element
 * that shows both the current selection value and the last set value.
 * The slider can be configured with min, max, step, label, width, and initial value.
 * It also supports adding and removing onchange event functions.
 *
 * @author chp2001 <https://github.com/chp2001>
 */

/**
 * Custom element for a slider with two labeled and stored values:
 * one for the current selection value,
 * and one for the last set value.
 * The slider can be configured with min, max, step, label, width, and initial value.
 * It also supports adding and removing onchange event functions.
 * @class double_labeled_slider
 * @extends HTMLElement
 * @example
 * <double-labeled-slider 
 *     min="1" max="64" step="1" 
 *     label="X Scale (size of summed blocks in x direction):" 
 *     width="300px" value="16">
 * </double-labeled-slider>
 */
class double_labeled_slider extends HTMLElement {

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        
        this.setValue = null;
        this.selectionValue = null;

        this.containerElement = null;
        this.sliderElement = null;
        this.setLabelElement = null;
        this.selectionLabelElement = null;

        this.onChangeFuncs = {}; // Key-value pairs of functions to call on change events
        this.onSetFuncs = {}; // Key-value pairs of functions to call on set events

        this.uuid = double_labeled_slider.id++;
    }
    
    /**
     * Interface method called by the browser when the element is added to the document.
     * All attributes will have been set at this point.
     */
    connectedCallback() {
        console.log('Double labeled slider ' + this.uuid + ' loaded successfully. Building...');
        

        this.min =  parseInt(this.getAttribute('min') || 0);
        this.max =  parseInt(this.getAttribute('max') || 100);
        this.step =  parseInt(this.getAttribute('step') || 1);
        this.label = this.getAttribute('label') || '';
        this.width = this.getAttribute('width') || '300px';
        this.value =  parseInt(this.getAttribute('value') || this.min);
        
        this.includeSetButton = (this.getAttribute('include-set-button') === 'true');

        
        this.build();
        // this.selectValue(this.value);
        // this.setValueFunc(this.value);
        // this.updateLabels();
        this.setValues({selectionValue: this.value, setValue: this.value});
        this.refreshDisplay();
    }

    /**
     * Static method to create a new instance of the element with the given attributes.
     * @param {Object} options - The options for the new element.
     * @param {number?} options.min - The minimum value of the slider. Default is 0.
     * @param {number?} options.max - The maximum value of the slider. Default is 100.
     * @param {number?} options.step - The step value of the slider. Default is 1.
     * @param {string?} options.label - The label for the slider. Default is ''.
     * @param {string?} options.width - The width of the slider. Default is '300px'.
     * @param {number?} options.value - The initial value of the slider. Default is min.
     * @returns {double_labeled_slider} The new instance of the element.
     */
    static newInstance({min=0, max=100, step=1, label='', width='300px', value=0}={}) {
        // Create a new instance of the element with the given attributes
        var element = document.createElement('double-labeled-slider');
        element.setAttribute('min', min);
        element.setAttribute('max', max);
        element.setAttribute('step', step);
        element.setAttribute('label', label);
        element.setAttribute('width', width);
        element.setAttribute('value', value);
        return element;
    }

    // Callback functions

    /**
     * Event handler for the slider input event.
     * Should not be interacted with externally.
     * @param {Event} event - The input event.
     * @private
     */
    onSliderChange(event) {
        this.selectValue(parseInt(event.target.value));
        this.triggerOnChange(this.selectionValue);
    }

    /**
     * Event handler for the set value action.
     * Allows for callbacks when the set value is updated.
     * Potentially useful externally.
     * @param {Event?} event - Set event, if any. Not necessarily provided.
     */
    onSetValue(event=null) {
        this.triggerOnSet(this.setValue);
    }

    // Internal display functions

    /**
     * Configure the slider element with the current configuration values.
     * Should not be interacted with externally.
     * @private
     */
    configureSlider() {
        this.sliderElement.min = this.min;
        this.sliderElement.max = this.max;
        this.sliderElement.step = this.step;
    }

    /**
     * Update both labels to match the current values.
     * Should not be interacted with externally.
     * @private
     */
    updateLabels() {
        this.setLabelElement.textContent = this.setValue;
        this.selectionLabelElement.textContent = this.selectionValue;
    }

    /**
     * Update the slider value to match the current selection value.
     * Should not be interacted with externally.
     * @private
     */
    updateDisplay() {
        this.sliderElement.value = this.selectionValue;
    }

    /**
     * Refresh the entire display, including slider configuration and labels.
     * Not expected to be used externally.
     * @private
     */
    refreshDisplay() {
        this.configureSlider();
        this.updateDisplay();
        this.updateLabels();
    }

    // Basic interface functions

    /**
     * Update the selection value and label.
     * Usable by onchange event or externally.
     * @param {number} value - The new selection value.
     */
    selectValue(value) {
        this.selectionValue = value;
        this.updateLabels();
    }

    /**
     * Update the set value to match the selection value.
     * Usable externally.
     */
    updateSetValue() {
        this.setValue = this.selectionValue;
        this.updateLabels();
    }

    /**
     * Change the selection and set values and labels externally.
     * @param {number} value - The new value to set both selection and set values to.
     */
    setValueFunc(value) {
        this.selectionValue = value;
        this.setValue = value;
        this.sliderElement.value = value;
        this.updateLabels();
    }

    // Advanced interface functions

    /**
     * Trigger all onchange functions with the given value.
     * @param {number} newValue - The new selection value to pass to the onchange functions.
     */
    triggerOnChange(newValue) {
        for (const key in this.onChangeFuncs) {
            this.onChangeFuncs[key](newValue);
        }
    }

    /**
     * Trigger all onSet functions with the given value.
     * @param {number} newValue - The new set value to pass to the onSet functions.
     */
    triggerOnSet(newValue) {
        for (const key in this.onSetFuncs) {
            this.onSetFuncs[key](newValue);
        }
    }

    /**
     * Change the selection and/or set values externally.
     * Any of selectionValue or setValue can be null to leave unchanged.
     * @param {Object} options - The new values.
     * @param {number?} options.selectionValue - The new selection value. Null to leave unchanged.
     * @param {number?} options.setValue - The new set value. Null to leave unchanged.
     */
    setValues({selectionValue = null, setValue = null}={}) {
        if (selectionValue !== null) {
            this.selectionValue = selectionValue;
            this.updateDisplay();
        }
        if (setValue !== null) {
            this.setValue = setValue;
        }
        if (selectionValue !== null || setValue !== null) {
            this.updateLabels();
        }
        else {
            // Improper usage, fail loudly
            console.error('No values provided to setValues. At least one of selectionValue or setValue must be non-null.');
        }
    }

    /**
     * Change the slider configuration externally.
     * Any of min, max, or step can be null to leave unchanged.
     * @param {Object} options - The new configuration options.
     * @param {number?} options.min - The new minimum value. Null to leave unchanged.
     * @param {number?} options.max - The new maximum value. Null to leave unchanged.
     * @param {number?} options.step - The new step value. Null to leave unchanged.
     */
    setSliderConfig({min=null, max=null, step=null}={}) {
        if (min !== null) {
            this.min = min;
        }
        if (max !== null) {
            this.max = max;
        }
        if (step !== null) {
            this.step = step;
        }
        if (min !== null || max !== null || step !== null) {
            this.configureSlider();
        }
        else {
            // Improper usage, fail loudly
            console.error('No configuration values provided to setSliderConfig. At least one of min, max, or step must be non-null.');
        }
    }

    /**
     * Change the selection and/or set values externally (optionally) without triggering onchange events.
     * Any of selectionValue, setValue, min, max, step can be null to leave unchanged.
     * @param {Object} options - The new values and/or configuration options.
     * @param {number?} options.selectionValue - The new selection value. Null to leave unchanged.
     * @param {number?} options.setValue - The new set value. Null to leave unchanged.
     * @param {number?} options.min - The new minimum value. Null to leave unchanged.
     * @param {number?} options.max - The new maximum value. Null to leave unchanged.
     * @param {number?} options.step - The new step value. Null to leave unchanged.
     * @param {boolean?} options.silent - If true, do not trigger onchange events. Default is false.
     */
    setExternally({selectionValue = null, setValue = null, min = null, max = null, step = null, silent = false}={}) {
        if ([selectionValue, setValue].some(v => v !== null)) {
            this.setValues({selectionValue: selectionValue, setValue: setValue});
            if (!silent && selectionValue !== null) {
                this.triggerOnChange(this.selectionValue);
            }
            if (!silent && setValue !== null) {
                this.triggerOnSet(this.setValue);
            }
        }
        if ([min, max, step].some(v => v !== null)) {
            this.setSliderConfig({min: min, max: max, step: step});
        }
        if (![selectionValue, setValue, min, max, step].some(v => v !== null)) {
            // Improper usage, fail loudly
            console.error('No values or configuration provided to setExternally. At least one of selectionValue, setValue, min, max, or step must be non-null.');
        }
    }

    /**
     * Function provided for use with a "Set" button, if desired.
     * Runs the expected logic of updating the set value
     */
    setButton() {
        this.updateSetValue();
        this.onSetValue(this.setValue);
    }

    /**
     * Add a function to be called when the slider value changes.
     * The function should take one argument, the new selection value.
     * The key is used to identify the function, so it can be removed later if needed.
     * @param {string} key - The unique key to identify the function.
     * @param {function} func - The function to call on change events.
     */
    addOnChangeFunction(key, func) {
        // Primary intent is to allow interface from UI handling code,
        // allowing us to display candidate data as the user moves the slider.
        if (this.onChangeFuncs[key]) {
            // fail loudly, this shouldn't happen
            console.error('An onchange function with key ' + key + ' already exists. Choose a different key.');
            return;
        }
        this.onChangeFuncs[key] = func;
    }

    /**
     * Remove a function from the onchange event list.
     * @param {string} key - The unique key identifying the function to remove.
     */
    removeOnChangeFunction(key) {
        // Remove a function from the onchange event list
        if (!this.onChangeFuncs[key]) {
            // fail loudly, this shouldn't happen
            console.error('No onchange function with key ' + key + ' found.');
            return;
        }
        delete this.onChangeFuncs[key];
    }

    /**
     * Add a function to be called when the set value is updated.
     * The function should take one argument, the new set value.
     * The key is used to identify the function, so it can be removed later if needed.
     * @param {string} key - The unique key to identify the function.
     * @param {function} func - The function to call on set events.
     */
    addOnSetFunction(key, func) {
        if (this.onSetFuncs[key]) {
            // fail loudly, this shouldn't happen
            console.error('An onSet function with key ' + key + ' already exists. Choose a different key.');
            return;
        }
        this.onSetFuncs[key] = func;
    }

    /**
     * Remove a function from the onSet event list.
     * @param {string} key - The unique key identifying the function to remove.
     */
    removeOnSetFunction(key) {
        // Remove a function from the onSet event list
        if (!this.onSetFuncs[key]) {
            // fail loudly, this shouldn't happen
            console.error('No onSet function with key ' + key + ' found.');
            return;
        }
        delete this.onSetFuncs[key];
    }

    build() {
        var title = document.createElement('div');
        title.textContent = this.label;
        title.style.fontSize = '14px';
        title.style.marginBottom = '4px';
        
        this.sliderElement = document.createElement('input');
        this.sliderElement.type = 'range';
        // this.configureSlider();
        this.sliderElement.style.width = this.width;
        this.sliderElement.addEventListener('input', this.onSliderChange.bind(this));

        this.setLabelElement = document.createElement('span');
        this.setLabelElement.style.width = '30px';

        this.selectionLabelElement = document.createElement('span');
        this.selectionLabelElement.style.width = '30px';

        this.containerElement = document.createElement('div');
        this.containerElement.style.display = 'flex';
        this.containerElement.style.alignItems = 'center';
        this.containerElement.style.gap = '10px';
        this.containerElement.appendChild(title);
        this.containerElement.appendChild(this.sliderElement);
        this.containerElement.appendChild(this.setLabelElement);
        this.containerElement.appendChild(this.selectionLabelElement);

        if (this.includeSetButton) {
            // temp set button for testing
            var setButton = document.createElement('button');
            setButton.textContent = 'Set';
            setButton.style.marginLeft = '4px';
            setButton.addEventListener('click', this.setButton.bind(this));
            this.containerElement.appendChild(setButton);
        }
        

        this.shadow.appendChild(this.containerElement);
    }
}
double_labeled_slider.id = 0;
customElements.define('double-labeled-slider', double_labeled_slider);