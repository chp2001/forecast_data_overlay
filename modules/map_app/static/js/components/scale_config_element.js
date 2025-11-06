// Primary custom element for use is the double-labeled-slider custom element from components/double_labeled_slider.js

// The key points of the above code to replicate are:
// 1. Two sliders, one for x scale and one for y scale
// 2. Each slider has a label, a current value display, and a set value display
// 3. There is a checkbox to lock the two sliders together
// 4. There is a button to apply the selected scale settings

/**
 * @callback scaleSetCallback
 * @param {Object} options - The new values
 * @param {number?} options.xScale - The new x scale value. Null if unchanged
 * @param {number?} options.yScale - The new y scale value. Null if unchanged
 */
/**
 * @callback scaleSelectionCallback
 * @param {Object} options - The new selection values
 * @param {number?} options.xScale - The new x scale selection value. Null if unchanged
 * @param {number?} options.yScale - The new y scale selection value. Null if unchanged
 */

// import the double-labeled-slider component from components/double_labeled_slider.js
/**
 * @import { double_labeled_slider } from './double_labeled_slider.js';
 * @import { CallbackDict } from '../utilities/callbacks.js';
 */

class scale_config extends HTMLElement {
    constructor() {
        super();
        // this.shadow = this.attachShadow({ mode: 'open' });

        // Element attributes
        this.titleElement = null;
        this.xScaleSlider = null;
        this.yScaleSlider = null;
        this.lockCheckbox = null;
        this.setButton = null;
        this.container = null;
        this.lockContainer = null;

        this.mostRecentlySetScale = null; // one of [null, 'x', 'y']

        

        // /**
        //  * Functions to call when the scale is set
        //  * @type {Object.<string, scaleSetCallback>}
        //  */
        // this.scaleSetCallbacks = {};
        // /**
        //  * Functions to call when the scale selection changes
        //  * @type {Object.<string, scaleSelectionCallback>}
        //  */
        // this.scaleSelectionCallbacks = {};
        // Using CallbackDict for easier management
        /**
         * @type {CallbackDict<scaleSetCallback>}
         */
        this.scaleSetCallbacks = new CallbackDict();
        /**
         * @type {CallbackDict<scaleSelectionCallback>}
         */
        this.scaleSelectionCallbacks = new CallbackDict();

        this.locked = true; // Whether the x and y scales are locked together
        this.uuid = scale_config.id++;
    }

    connectedCallback() {
        console.log('Scale config ' + this.uuid + ' loaded successfully. Building...');

        this.build();
    }

    // // Callback registration functions
    // /**
    //  * Add a function to be called when any scale is set
    //  * @param {string} key - A unique key to identify the callback
    //  * @param {scaleSetCallback} func - The function to call when the scale is set
    //  */
    // addOnScaleSetFunction(key, func) {
    //     if (this.scaleSetCallbacks[key]) {
    //         // fail loudly, this shouldn't happen
    //         console.error('An onScaleSet callback with key ' + key + ' already exists. Choose a different key.');
    //         return;
    //     }
    //     this.scaleSetCallbacks[key] = func;
    // }
    // /**
    //  * Remove a previously added onScaleSet callback
    //  * @param {string} key - The unique key identifying the callback to remove
    //  */
    // removeOnScaleSetFunction(key) {
    //     if (!this.scaleSetCallbacks[key]) {
    //         console.error('No onScaleSet callback with key ' + key + ' exists. Cannot remove.');
    //         return;
    //     }
    //     delete this.scaleSetCallbacks[key];
    // }
    // /**
    //  * Trigger all registered onScaleSet callbacks
    //  * @param {Object} options - The new scale values
    //  * @param {number?} options.xScale - The new x scale value, or null if unchanged
    //  * @param {number?} options.yScale - The new y scale value, or null if unchanged
    //  */
    // triggerOnScaleSet(options) {
    //     for (const key in this.scaleSetCallbacks) {
    //         this.scaleSetCallbacks[key](options);
    //     }
    // }
    // /**
    //  * Add a function to be called when any scale selection changes
    //  * @param {string} key - A unique key to identify the callback
    //  * @param {scaleSelectionCallback} func - The function to call when the scale selection changes
    //  */
    // addOnScaleSelectionFunction(key, func) {
    //     if (this.scaleSelectionCallbacks[key]) {
    //         // fail loudly, this shouldn't happen
    //         console.error('An onScaleSelection callback with key ' + key + ' already exists. Choose a different key.');
    //         return;
    //     }
    //     this.scaleSelectionCallbacks[key] = func;
    // }
    // /**
    //  * Remove a previously added onScaleSelection callback
    //  * @param {string} key - The unique key identifying the callback to remove
    //  */
    // removeOnScaleSelectionFunction(key) {
    //     if (!this.scaleSelectionCallbacks[key]) {
    //         console.error('No onScaleSelection callback with key ' + key + ' exists. Cannot remove.');
    //         return;
    //     }
    //     delete this.scaleSelectionCallbacks[key];
    // }
    // /**
    //  * Trigger all registered onScaleSelection callbacks
    //  * @param {Object} options - The new scale selection values
    //  * @param {number?} options.xScale - The new x scale selection value, or null if unchanged
    //  * @param {number?} options.yScale - The new y scale selection value, or null if unchanged
    //  */
    // triggerOnScaleSelection(options) {
    //     for (const key in this.scaleSelectionCallbacks) {
    //         this.scaleSelectionCallbacks[key](options);
    //     }
    // }

    setSelection({xScale = null, yScale = null}={}) {
        // Single function rather than two separate functions,
        // while maintaining the ability to set either scale independently
        // Only changes the selection value, not the set value
        if (xScale !== null) {
            // For these interface functions, we use the silent option
            // to avoid triggering infinite recursion
            this.xScaleSlider.setExternally({selectionValue: xScale, silent: true});
        }
        if (yScale !== null) {
            this.yScaleSlider.setExternally({selectionValue: yScale, silent: true});
        }
        // this.triggerOnScaleSelection({xScale: xScale, yScale: yScale});
        this.scaleSelectionCallbacks.trigger({xScale: xScale, yScale: yScale});
    }

    setSet({xScale = null, yScale = null}={}) {
        // Single function rather than two separate functions,
        // while maintaining the ability to set either scale independently
        // Only changes the set value, not the selection value
        if (xScale !== null) {
            // this.xScaleSlider.setValueFunc(xScale);
            this.xScaleSlider.setExternally({setValue: xScale, silent: true});
        }
        if (yScale !== null) {
            // this.yScaleSlider.setValueFunc(yScale);
            this.yScaleSlider.setExternally({setValue: yScale, silent: true});
        }
        // this.triggerOnScaleSet({xScale: xScale, yScale: yScale});
        this.scaleSetCallbacks.trigger({xScale: xScale, yScale: yScale});
    }

    setFull({xScale = null, yScale = null}={}) {
        // Single function rather than two separate functions,
        // while maintaining the ability to set either scale independently
        // Changes both the selection and set values
        this.setSelection({xScale: xScale, yScale: yScale});
        this.setSet({xScale: xScale, yScale: yScale});
    }

    onXScaleChange(value) {
        // Called when the x scale slider changes
        if (this.locked) {
            this.setSelection({xScale: value, yScale: value});
            this.mostRecentlySetScale = null; // Both were set, so neither is more recent
        } else {
            this.setSelection({xScale: value});
            this.mostRecentlySetScale = 'x';
        }
    }

    onYScaleChange(value) {
        // Called when the y scale slider changes
        if (this.locked) {
            this.setSelection({xScale: value, yScale: value});
        } else {
            this.setSelection({yScale: value});
            this.mostRecentlySetScale = 'y';
        }
    }

    onToggleLock(locked) {
        // Called when the lock checkbox is toggled
        this.locked = locked;
        if (this.locked) {
            // If locking, set both scales to the most recently set scale
            if (this.mostRecentlySetScale === 'x') {
                const xValue = this.xScaleSlider.selectionValue;
                this.setSelection({xScale: xValue, yScale: xValue});
            } else if (this.mostRecentlySetScale === 'y') {
                const yValue = this.yScaleSlider.selectionValue;
                this.setSelection({xScale: yValue, yScale: yValue});
            }
            // If neither has been set, do nothing
            this.mostRecentlySetScale = null; // Reset to null
        }
    }

    onSetButtonClick() {
        this.xScaleSlider.setButton();
        this.yScaleSlider.setButton();
        // this.triggerOnScaleSet({
        this.scaleSetCallbacks.trigger({
            xScale: this.xScaleSlider.setValue,
            yScale: this.yScaleSlider.setValue
        });
    }

    build() {
        var title_string = 'Data Scale Settings:';
        var lock_label_string = 'Lock X and Y axis scaling';
        var xscale_label_string = 'X Scale (size of summed blocks in x direction):';
        var yscale_label_string = 'Y Scale (size of summed blocks in y direction):';
        // Create the container element
        this.container = document.createElement('div');
        this.container.id = 'scale-settings';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';

        // Prepare labels and styling before functionality

        // Title
        this.titleElement = document.createElement('label');
        this.titleElement.textContent = title_string;

        // Scale Labels
        const yScaleLabel = document.createElement('label');
        yScaleLabel.textContent = yscale_label_string;
        const xScaleLabel = document.createElement('label');
        xScaleLabel.textContent = xscale_label_string;

        // Lock Checkbox and Label
        this.lockContainer = document.createElement('div');
        this.lockContainer.style.display = 'flex';
        this.lockContainer.style.alignItems = 'center';

        const lockLabel = document.createElement('label');
        lockLabel.setAttribute('for', 'scale-axis-lock');
        lockLabel.textContent = lock_label_string;

        // Build the inner HTML structure of the element
        this.xScaleSlider = double_labeled_slider.newInstance({
            min: 1,
            max: 64,
            step: 1,
            // label: xscale_label_string,
            width: '300px',
            value: 16
        });
        this.yScaleSlider = double_labeled_slider.newInstance({
            min: 1,
            max: 64,
            step: 1,
            // label: yscale_label_string,
            width: '300px',
            value: 16
        });
        // Since the current labels are rather long, we'll add them vertically above the sliders
        
        this.lockCheckbox = document.createElement('input');
        this.lockCheckbox.type = 'checkbox';
        this.lockCheckbox.id = 'scale-axis-lock';
        this.lockCheckbox.name = 'scale-axis-lock';
        this.lockCheckbox.checked = this.locked;
        this.lockCheckbox.addEventListener('change', (event) => {
            this.onToggleLock(event.target.checked);
        });

        this.xScaleSlider.addOnChangeFunction('scale_config_x_change_' + this.uuid, (value) => {
            this.onXScaleChange(value);
        });
        this.yScaleSlider.addOnChangeFunction('scale_config_y_change_' + this.uuid, (value) => {
            this.onYScaleChange(value);
        });

        // Set Button
        this.setButton = document.createElement('button');
        this.setButton.id = 'set-scale';
        this.setButton.textContent = 'Set Scale';
        this.setButton.style.alignSelf = 'center';
        
        this.setButton.addEventListener('click', this.onSetButtonClick.bind(this));

        // Assemble the lock container
        this.lockContainer.appendChild(this.lockCheckbox);
        this.lockContainer.appendChild(lockLabel);

        // Assemble the main container
        this.container.appendChild(this.titleElement);
        this.container.appendChild(this.lockContainer);
        this.container.appendChild(xScaleLabel);
        this.container.appendChild(this.xScaleSlider);
        this.container.appendChild(yScaleLabel);
        this.container.appendChild(this.yScaleSlider);
        this.container.appendChild(this.setButton);

        // this.shadow.appendChild(this.container);
        this.appendChild(this.container);
    }
}
scale_config.id = 0; 
// Leaving the 'uuid'/'id' infrastructure in place, 
// but this should be largely unused
customElements.define('scale-config', scale_config);