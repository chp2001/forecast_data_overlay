/**
 * @file Utility functionality for managing callbacks
 * Expected to be imported statically in the html file before usage (i.e. <script src="...">)
 * @author chp2001 <https://github.com/chp2001>
 */

// Export is not used, as this is imported via <script> tag

/**
 * Class representing a list of callback functions.
 * Simple, without additional features like keyed tracking or once-only execution.
 * @class
 * @template [T=Function]
 * @name CallbackList<T>
 */
class CallbackList {
    constructor() {
        /**
         * @type {T[]}
         */
        this.callbacks = [];
    }

    /**
     * Add a callback function to the list
     * @param {T} callback - The callback function to add
     * @returns {number} The index of the added callback function
     */
    add(callback) {
        this.callbacks.push(callback);
        return this.callbacks.length - 1; // Return the index of the added callback
    }

    /**
     * Remove a callback function from the list
     * @param {number} index - The index of the callback function to remove
     */
    remove(index) {
        // We don't track unique keys or anything, so the user can only remove by index
        // (assuming they remember it)
        if (index >= 0 && index < this.callbacks.length) {
            this.callbacks.splice(index, 1);
        } else {
            console.warn(`CallbackList: Attempted to remove callback at invalid index ${index}`);
        }
    }

    /**
     * Clear all registered callbacks
     */
    clear() {
        this.callbacks = [];
    }
    
    /**
     * Trigger all registered callbacks with the provided arguments
     * @param  {...any} args - Arguments to pass to each callback
     */
    trigger(...args) {
        this.callbacks.forEach(callback => {
            callback(...args);
        });
    }
}

/**
 * Class representing a keyed object/dictionary of callback functions.
 * Allows adding, removing, and triggering callbacks by key.
 * @class
 * @template [T=Function]
 * @name CallbackDict<T>
 */
class CallbackDict {
    constructor() {
        /**
         * @type {Object.<string, T>}
         */
        this.callbacks = {};
    }

    /**
     * Add a callback function with a specific key
     * @param {string} key - The key to associate with the callback
     * @param {T} callback - The callback function to add
     */
    add(key, callback) {
        if (typeof key !== 'string') {
            console.error('CallbackDict: Key must be a string');
            return;
        } else if (this.callbacks[key]) {
            console.error(`CallbackDict: Callback with key '${key}' already exists`);
            return;
        }
        this.callbacks[key] = callback;
    }

    /**
     * Remove a callback function by key
     * @param {string} key - The key of the callback function to remove
     */
    remove(key) {
        if (!this.callbacks[key]) {
            console.error(`CallbackDict: No callback found for key '${key}' to remove`);
            return;
        }
        delete this.callbacks[key];
    }

    /**
     * Clear all registered callbacks
     */
    clear() {
        this.callbacks = {};
    }

    /**
     * Get the number of registered callbacks
     * @returns {number} The count of registered callbacks
     */
    get count() {
        return Object.keys(this.callbacks).length;
    }

    /**
     * Trigger all registered callbacks with the provided arguments
     * @param  {...any} args - Arguments to pass to each callback
     */
    trigger(...args) {
        if (this.count === 0) {
            console.warn('CallbackDict: No callbacks to trigger');
            return;
        }
        for (const key in this.callbacks) {
            this.callbacks[key](...args);
        }
    }

    /**
     * Trigger the callback associated with the given key, passing provided arguments
     * @param {string} key - The key of the callback to trigger
     * @param  {...any} args - Arguments to pass to the callback
     */
    triggerSpecific(key, ...args) {
        if (this.callbacks.hasOwnProperty(key)) {
            this.callbacks[key](...args);
        } else {
            console.warn(`CallbackDict: No callback found for key '${key}' to trigger`);
        }
    }
}