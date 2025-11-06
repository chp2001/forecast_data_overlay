/**
 * @typedef {Object} regionBounds
 * @property {number} rowMin - The minimum row (y) index (inclusive)
 * @property {number} rowMax - The maximum row (y) index (exclusive)
 * @property {number} colMin - The minimum column (x) index (inclusive)
 * @property {number} colMax - The maximum column (x) index (exclusive)
 */
/**
 * @typedef {Object} regionBoundArgs
 * @property {number?} rowMin - The minimum row (y) index (inclusive), or null if unchanged
 * @property {number?} rowMax - The maximum row (y) index (exclusive), or null if unchanged
 * @property {number?} colMin - The minimum column (x) index (inclusive), or null if unchanged
 * @property {number?} colMax - The maximum column (x) index (exclusive), or null if unchanged
 */
/**
 * @typedef {Object} regionSliderBounds
 * @property {number} rowMin - The minimum allowable row (y) index
 * @property {number} rowMax - The maximum allowable row (y) index
 * @property {number} colMin - The minimum allowable column (x) index
 * @property {number} colMax - The maximum allowable column (x) index
 */
/**
 * @callback regionSetCallback
 * @param {regionBoundArgs} bounds - The new values
 */
/**
 * @callback regionSelectionCallback
 * @param {regionBoundArgs} bounds - The new selection values
 */

// import the double-labeled-slider component from components/double_labeled_slider.js
/**
 * @import { double_labeled_slider } from './double_labeled_slider.js';
 * @import { CallbackDict } from '../utilities/callbacks.js';
 */

class region_selector extends HTMLElement {
    constructor() {
        super();
        // this.shadow = this.attachShadow({ mode: 'open' });

        // Element attributes
        this.titleElement = null;
        this.xMinSlider = null;
        this.xMaxSlider = null;
        this.yMinSlider = null;
        this.yMaxSlider = null;
        this.setButton = null;
        this.container = null;

        // /**
        //  * Functions to call when the region is set
        //  * @type {Object.<string, regionSetCallback>}
        //  */
        // this.regionSetCallbacks = {};
        // /**
        //  * Functions to call when the region selection changes
        //  * @type {Object.<string, regionSelectionCallback>}
        //  */
        // this.regionSelectionCallbacks = {};
        /**
         * @type {CallbackDict<regionSetCallback>}
         */
        this.regionSetCallbacks = new CallbackDict();
        /**
         * @type {CallbackDict<regionSelectionCallback>}
         */
        this.regionSelectionCallbacks = new CallbackDict();

        this.locked = true; // Whether the x and y scales are locked together
        this.uuid = region_selector.id++;
    }

    connectedCallback() {
        console.log('Region selector ' + this.uuid + ' loaded successfully. Building...');

        this.build();
    }

    // Callback registration functions
    // /**
    //  * Add a function to be called when any region is set
    //  * @param {string} key - A unique key to identify the callback
    //  * @param {regionSetCallback} func - The function to call when the region is set
    //  */
    // addOnRegionSetFunction(key, func) {
    //     if (this.regionSetCallbacks[key]) {
    //         // fail loudly, this shouldn't happen
    //         console.error('An onRegionSet callback with key ' + key + ' already exists. Choose a different key.');
    //         return;
    //     }
    //     this.regionSetCallbacks[key] = func;
    // }

    // /**
    //  * Remove a previously added onRegionSet callback
    //  * @param {string} key - The unique key identifying the callback to remove
    //  */
    // removeOnRegionSetFunction(key) {
    //     if (!this.regionSetCallbacks[key]) {
    //         console.error('No onRegionSet callback with key ' + key + ' exists. Cannot remove.');
    //         return;
    //     }
    //     delete this.regionSetCallbacks[key];
    // }

    // /**
    //  * Trigger all registered onRegionSet callbacks
    //  * @param {regionBoundArgs} options - The new region set values
    //  */
    // triggerOnRegionSet(options) {
    //     for (const key in this.regionSetCallbacks) {
    //         this.regionSetCallbacks[key](options);
    //     }
    // }

    // /**
    //  * Add a function to be called when any region selection changes
    //  * @param {string} key - A unique key to identify the callback
    //  * @param {regionSelectionCallback} func - The function to call when the region selection changes
    //  */
    // addOnRegionSelectionFunction(key, func) {
    //     if (this.regionSelectionCallbacks[key]) {
    //         // fail loudly, this shouldn't happen
    //         console.error('An onRegionSelection callback with key ' + key + ' already exists. Choose a different key.');
    //         return;
    //     }
    //     this.regionSelectionCallbacks[key] = func;
    // }

    // /**
    //  * Remove a previously added onRegionSelection callback
    //  * @param {string} key - The unique key identifying the callback to remove
    //  */
    // removeOnRegionSelectionFunction(key) {
    //     if (!this.regionSelectionCallbacks[key]) {
    //         console.error('No onRegionSelection callback with key ' + key + ' exists. Cannot remove.');
    //         return;
    //     }
    //     delete this.regionSelectionCallbacks[key];
    // }
    
    // /**
    //  * Trigger all registered onRegionSelection callbacks
    //  * @param {regionBoundArgs} options - The new region selection values
    //  */
    // triggerOnRegionSelection(options) {
    //     for (const key in this.regionSelectionCallbacks) {
    //         this.regionSelectionCallbacks[key](options);
    //     }
    // }

    /**
     * Set the selection values of the sliders
     * @param {regionBoundArgs} options - The new selection values to set
     */
    setSelection({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) {
        if (rowMin !== null) {
            this.yMinSlider.setExternally({selectionValue: rowMin, silent: true});
        }
        if (rowMax !== null) {
            this.yMaxSlider.setExternally({selectionValue: rowMax, silent: true});
        }
        if (colMin !== null) {
            this.xMinSlider.setExternally({selectionValue: colMin, silent: true});
        }
        if (colMax !== null) {
            this.xMaxSlider.setExternally({selectionValue: colMax, silent: true});
        }
        // this.triggerOnRegionSelection({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
        this.regionSelectionCallbacks.trigger({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
    }

    /**
     * Set the set values of the sliders (the values used when "Set Scale" is clicked)
     * @param {regionBoundArgs} options - The new set values to set
     */
    setSet({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) {
        if (rowMin !== null) {
            this.yMinSlider.setExternally({setValue: rowMin, silent: true});
        }
        if (rowMax !== null) {
            this.yMaxSlider.setExternally({setValue: rowMax, silent: true});
        }
        if (colMin !== null) {
            this.xMinSlider.setExternally({setValue: colMin, silent: true});
        }
        if (colMax !== null) {
            this.xMaxSlider.setExternally({setValue: colMax, silent: true});
        }
        // this.triggerOnRegionSet({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
        this.regionSetCallbacks.trigger({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
    }
    
    /**
     * Set both the selection and set values of the sliders
     * @param {regionBoundArgs} options - The new values to set
     */
    setFull({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) {
        this.setSelection({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
        this.setSet({rowMin: rowMin, rowMax: rowMax, colMin: colMin, colMax: colMax});
    }

    /**
     * Set the region slider bounds
     * @param {regionSliderBounds} options - The max and min acceptable values for each slider
     */
    setSliderBounds({rowMin = null, rowMax = null, colMin = null, colMax = null}={}) {
        const silent = false; 
        // This should not be triggerable from the sliders' end,
        // so silence is not necessary.
        this.yMinSlider.setExternally({min: rowMin, max: rowMax, silent: silent});
        this.yMaxSlider.setExternally({min: rowMin, max: rowMax, silent: silent});
        this.xMinSlider.setExternally({min: colMin, max: colMax, silent: silent});
        this.xMaxSlider.setExternally({min: colMin, max: colMax, silent: silent});
    }

    /**
     * On selection change for row min slider, ensure it does not exceed row max
     * @param {number} value - The new selection value
     */
    onYMinSelectionChange(value) {
        const spacing = this.yMaxSlider.step * 2;
        if (value >= this.yMaxSlider.selectionValue - spacing) {
            // If the new min >= max, set the min back to one step below the max
            this.yMinSlider.setExternally({
                selectionValue: this.yMaxSlider.selectionValue - spacing, 
                silent: true
            });
        } else {
            // Else, just trigger the change
            this.triggerOnRegionSelection({rowMin: value, rowMax: null, colMin: null, colMax: null});
        }
    }

    /**
     * On selection change for row max slider, ensure it does not go below row min
     * @param {number} value - The new selection value
     */
    onYMaxSelectionChange(value) {
        const spacing = this.yMaxSlider.step * 2;
        if (value <= this.yMinSlider.selectionValue + spacing) {
            // If the new max <= min, set the max back to one step above the min
            this.yMaxSlider.setExternally({
                selectionValue: this.yMinSlider.selectionValue + spacing, 
                silent: true
            });
        } else {
            // Else, just trigger the change
            this.triggerOnRegionSelection({rowMin: null, rowMax: value, colMin: null, colMax: null});
        }
    }

    /**
     * On selection change for column min slider, ensure it does not exceed column max
     * @param {number} value - The new selection value
     */
    onXMinSelectionChange(value) {
        const spacing = this.xMaxSlider.step * 2;
        if (value >= this.xMaxSlider.selectionValue - spacing) {
            // If the new min >= max, set the min back to one step below the max
            this.xMinSlider.setExternally({
                selectionValue: this.xMaxSlider.selectionValue - spacing, 
                silent: true
            });
        } else {
            // Else, just trigger the change
            this.triggerOnRegionSelection({rowMin: null, rowMax: null, colMin: value, colMax: null});
        }
    }

    /**
     * On selection change for column max slider, ensure it does not go below column min
     * @param {number} value - The new selection value
     */
    onXMaxSelectionChange(value) {
        const spacing = this.xMaxSlider.step * 2;
        if (value <= this.xMinSlider.selectionValue + spacing) {
            // If the new max <= min, set the max back to one step above the min
            this.xMaxSlider.setExternally({
                selectionValue: this.xMinSlider.selectionValue + spacing, 
                silent: true
            });
        } else {
            // Else, just trigger the change
            this.triggerOnRegionSelection({rowMin: null, rowMax: null, colMin: null, colMax: value});
        }
    }

    /**
     * Handle changes in selection sliders
     * @param {regionBoundArgs} changed - The changed values
     */
    onRegionSelectionChange(changed) {
        this.triggerOnRegionSelection(changed);
    }

    /**
     * Handle the Set Region button click
     */
    onSetButtonClick() {
        this.xMinSlider.setButton();
        this.xMaxSlider.setButton();
        this.yMinSlider.setButton();
        this.yMaxSlider.setButton();
        // this.triggerOnRegionSet({
        this.regionSetCallbacks.trigger({
            rowMin: this.yMinSlider.setValue,
            rowMax: this.yMaxSlider.setValue,
            colMin: this.xMinSlider.setValue,
            colMax: this.xMaxSlider.setValue
        });
    }

    get rowMinSetValue() {
        return this.yMinSlider.setValue;
    }
    get rowMaxSetValue() {
        return this.yMaxSlider.setValue;
    }
    get colMinSetValue() {
        return this.xMinSlider.setValue;
    }
    get colMaxSetValue() {
        return this.xMaxSlider.setValue;
    }
    get rowMinSelectionValue() {
        return this.yMinSlider.selectionValue;
    }
    get rowMaxSelectionValue() {
        return this.yMaxSlider.selectionValue;
    }
    get colMinSelectionValue() {
        return this.xMinSlider.selectionValue;
    }
    get colMaxSelectionValue() {
        return this.xMaxSlider.selectionValue;
    }

    build() {
        var title_string = 'Region Selection:';
        var xrange_label_string = 'Column Range (x direction):';
        var yrange_label_string = 'Row Range (y direction):';
        // Create the container element
        this.container = document.createElement('div');
        this.container.id = 'region-settings';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';

        // Set up the title label
        this.titleElement = document.createElement('label');
        this.titleElement.textContent = title_string;

        // externalSetRegionBounds(
        //     0, 3840, // rowMin, rowMax
        //     0, 4608, // colMin, colMax
        //     16, 16 // rowStep, colStep
        // )
        // externalSetRegionValues(656, 1264, 1952, 2416); // rowMin, rowMax, colMin, colMax

        // Row sliders label
        var yrangeLabel = document.createElement('label');
        yrangeLabel.textContent = yrange_label_string;
        // Row min slider
        this.yMinSlider = double_labeled_slider.newInstance({
            min: 0,
            max: 3840,
            step: 16,
            value: 656,
            width: '300px',
        })
        this.yMaxSlider = double_labeled_slider.newInstance({
            min: 0,
            max: 3840,
            step: 16,
            value: 1264,
            width: '300px',
        })
        // Set up callbacks for row sliders
        this.yMinSlider.addOnChangeFunction(
            'region-selector-ymin-selection-change-' + this.uuid,
            this.onYMinSelectionChange.bind(this)
        );
        this.yMaxSlider.addOnChangeFunction(
            'region-selector-ymax-selection-change-' + this.uuid,
            this.onYMaxSelectionChange.bind(this)
        );

        // Column sliders label
        var xrangeLabel = document.createElement('label');
        xrangeLabel.textContent = xrange_label_string;
        // Column min slider
        this.xMinSlider = double_labeled_slider.newInstance({
            min: 0,
            max: 4608,
            step: 16,
            value: 1952,
            width: '300px',
        })
        this.xMaxSlider = double_labeled_slider.newInstance({
            min: 0,
            max: 4608,
            step: 16,
            value: 2416,
            width: '300px',
        })
        // Set up callbacks for column sliders
        this.xMinSlider.addOnChangeFunction(
            'region-selector-xmin-selection-change-' + this.uuid,
            this.onXMinSelectionChange.bind(this)
        );
        this.xMaxSlider.addOnChangeFunction(
            'region-selector-xmax-selection-change-' + this.uuid,
            this.onXMaxSelectionChange.bind(this)
        );

        // Set Button
        this.setButton = document.createElement('button');
        this.setButton.id = 'set-region';
        this.setButton.textContent = 'Set Region';
        this.setButton.style.alignSelf = 'center';
        
        this.setButton.addEventListener('click', this.onSetButtonClick.bind(this));

        // Assemble the main container
        this.container.appendChild(this.titleElement);
        this.container.appendChild(xrangeLabel);
        this.container.appendChild(this.xMinSlider);
        this.container.appendChild(this.xMaxSlider);
        this.container.appendChild(yrangeLabel);
        this.container.appendChild(this.yMinSlider);
        this.container.appendChild(this.yMaxSlider);
        this.container.appendChild(this.setButton);

        // this.shadow.appendChild(this.container);
        this.appendChild(this.container);
    }
}
region_selector.id = 0; 
// Leaving the 'uuid'/'id' infrastructure in place, 
// but this should be largely unused
customElements.define('region-selector', region_selector);