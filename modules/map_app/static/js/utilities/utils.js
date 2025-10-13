/**
 * @file Potentially reusable utility functions.
 * Expected to be imported statically in the html file before usage (i.e. <script src="...">)
 * @author chp2001 <https://github.com/chp2001>
 */

// Export is not used, as this is imported via <script> tag

/**
 * @namespace testing_utils
 * @description Utilities for testing purposes
 */
var testing_utils = {}

/**
 * Get details about a function for debugging purposes.
 * @param {Function} func - The function to get details about
 * @returns {Object} - An object containing details about the function
 */
testing_utils.getFuncDetails = function(func) {
    // Get details about a function for debugging purposes
    var debug_info = {};
    // Specifically, we want to use the Object methods to get
    // details that are not included with Object.[values, keys, entries]
    var shortPrint = function(value) {
        // We want to avoid printing large trees of data.
        // If it's an object or array that might be large or have children,
        // we return a descriptive string instead.
        // i.e. [1, 2, 3] -> 'Array(3)'
        // i.e. {a: 1, b: 2} -> 'Object(2)'
        if (Array.isArray(value)) {
            var length = value.length;
            if (length === 0) {
                return '[]';
            }
            return 'Array(' + length + ')';
        }
        else if (typeof value === 'object' && value !== null) {
            var length = Object.keys(value).length;
            if (length === 0) {
                return '{}';
            }
            return 'Object(' + length + ')';
        }
        else {
            return value;
        }
    }
    debug_info.all_properties = Object.getOwnPropertyNames(func);
    debug_info.all_properties_values = debug_info.all_properties.map(prop => shortPrint(func[prop]));
    debug_info.all_symbols = Object.getOwnPropertySymbols(func);
    if (debug_info.all_symbols.length > 0) {
        debug_info.all_symbols_values = debug_info.all_symbols.map(sym => shortPrint(func[sym]));
    } else {
        // Remove the empty array to reduce noise
        delete debug_info.all_symbols;
    }
    debug_info.prototype = Object.getPrototypeOf(func);
    debug_info.prototype_properties = Object.getOwnPropertyNames(debug_info.prototype);
    // debug_info.prototype_properties_values = debug_info.prototype_properties.map(prop => shortPrint(debug_info.prototype[prop]));
    debug_info.prototype_symbols = Object.getOwnPropertySymbols(debug_info.prototype);
    return debug_info;
}

/**
 * Bind a function to a context while maintaining its name.
 * @param {Object} context - The object to bind the function to
 * @param {string} methodName - The name of the method to bind
 * @returns {Function} - The bound function
 */
testing_utils.enstaticMethod = function(context, methodName) {
    // Bind a function to a context while maintaining its name
    var func = context[methodName];
    if (typeof func !== 'function') {
        throw new Error('Property is not a function: ' + methodName);
    }
    var boundFunc = func.bind(context);
    Object.defineProperty(boundFunc, 'name', { value: methodName });
    // check that the name was set correctly
    if (boundFunc.name !== methodName) {
        throw new Error('Failed to set function name: ' + methodName);
    }
    return boundFunc;
}

/**
 * Bind all functions in a namespace object to a static object.
 * This allows for easier testing of functions that use 'this'.
 * @param {Object} namespace_object - The object containing the functions to bind
 * @returns {Object} - A new object with all functions bound to itself
 */
testing_utils.staticify = function(namespace_object) {
    var static_object = {};
    for (const key in namespace_object) {
        if (typeof namespace_object[key] === 'function') {
            // static_object[key] = namespace_object[key].bind(static_object);
            // static_object[key] = this.enstaticFunc(namespace_object[key], static_object);
            static_object[key] = this.enstaticMethod(namespace_object, key);
            // Check that the function name was preserved
            if (static_object[key].name !== key) {
                throw new Error('Failed to preserve function name for: ' + key);
            }
        }
        else {
            static_object[key] = namespace_object[key];
        }
    }
    return static_object;
}

/**
 * Format an error message with the given variables.
 * @param {string} msg - The message template with {var} placeholders
 * @param {Object<string, any>} vars - The variables to format into the message
 * @returns {string} - The formatted message
 */
testing_utils.formatErrorMessage = function(msg, vars) {
    // Formats an error message with the given variables
    // msg: string with {var} placeholders
    const concise = false; // Whether to use the concise method
    if (concise) {
        // Concise method using regex
        return msg.replace(/{(\w+)}/g, (match, p1) => vars[p1] || match);
    }
    var formatted_msg = msg;
    for (const key in vars) {
        const value = vars[key];
        const placeholder = '{' + key + '}';
        formatted_msg = formatted_msg.replace(placeholder, value);
    }
    return formatted_msg;
}

/**
 * Experimental 'branch_errors' error convention:
 * - Functions that can throw errors have a 'static' array of error messages
 * - The array is named 'branch_errors_<function_name>' for ease of identification,
 *  as well as uniqueness and alphabetical ordering
 * - Each branch of the function that can throw an error has a unique index in the array
 * - The function throws an Error with the message from the corresponding index
 * - This allows for easy identification of which branch caused the error
 * - This is especially useful for testing, as we can test for specific errors being thrown
 */

/**
 * Get the branch_errors array key for a given function.
 * @param {Function} func - The function to get the branch_errors array key for
 * @returns {string} - The branch_errors array key
 */
testing_utils.expectedErrorArrayKey = function(func) {
    return 'branch_errors_' + func.name;
}

/**
 * Get the branch_errors array for a given function and namespace.
 * @param {Object} namespace_object - The object containing the function
 * @param {Function} func - The function to get the branch_errors array for
 * @returns {Array} - The branch_errors array
 */
testing_utils.getExpectedErrorArray = function(namespace_object, func) {
    const key = this.expectedErrorArrayKey(func);
    if (key in namespace_object) {
        return namespace_object[key];
    } else {
        if (func.name != '') {
            throw new Error('Function does not have a branch_errors array: `' + func.name + '`');
        }
        else {
            throw new Error('Function does not have a branch_errors array, and is unnamed: `' + func.toString() + '`\n' +
                            'Function details: ' + JSON.stringify(this.getFuncDetails(func), null, 2));
        }
    }
}

/**
 * Get a specific raw error message from a function's branch_errors array.
 * @param {Object} context - The object containing the function
 * @param {Function} func - The function to get the error message from
 * @param {number} index - The index of the error message in the branch_errors array
 * @returns {string} - The error message
 */
testing_utils.getMessage = function(context, func, index) {
    const error_array = this.getExpectedErrorArray(context, func);
    if (index < 0 || index >= error_array.length) {
        throw new Error('Index out of bounds for branch_errors array: ' + index);
    }
    return error_array[index];
}

/**
 * Get a specific formatted error message from a function's branch_errors array.
 * @param {Object} context - The object containing the function
 * @param {Function} func - The function to get the error message from
 * @param {number} index - The index of the error message in the branch_errors array
 * @param {Object<string, any>} [msgVars={}] - Values expected to be formatted into the error message
 * @returns {string} - The formatted error message
 */
testing_utils.getExpectedErrorMessage = function(context, func, index, msgVars={}) {
    const raw_msg = this.getMessage(context, func, index);
    return this.formatErrorMessage(raw_msg, msgVars);
}

/**
 * Test for a specific error being thrown.
 * Assumes the function follows the 'branch_errors' convention.
 * @param {Function} func - The function to test
 * @param {Array} args - The arguments to pass to the function
 * @param {number} expectedErrorIndex - The index of the expected error in the function's branch_errors array
 * @param {Object<string, any>} [msgVars={}] - Values expected to be formatted into the error message
 * @returns {object} - { passed: boolean, message: string }
 */
testing_utils.testForError = function(context, func, args, expectedErrorIndex, msgVars={}) {
    try {
        func(...args);
        return { passed: false, message: "Function did not throw an error" };
    } catch (e) {
        const expectedMessage = this.getExpectedErrorMessage(context, func, expectedErrorIndex, msgVars);
        if (e.message === expectedMessage) {
            return { passed: true, message: "Function threw the expected error: " + e.message };
        } else {
            return { passed: false, message: "Function threw an unexpected error: " + e.message + "\nExpected: " + expectedMessage };
        }
    }
}

/**
 * @namespace iter_logic_utils
 */
var iter_logic_utils = {}


/**
 * Generate a digital logic truth table for the given list of variable names.
 * If stepsize is > 1, only every stepsize-th combination is included.
 * @param {Array<string>} vars - The list of variable names
 * @param {number} [stepsize=1] - The step size for generating combinations
 * @returns {Array<Object<string, boolean>>} - The truth table as an array of objects
 */
iter_logic_utils.boolMatrix = function(vars, stepsize = 1) {
    var numVars = vars.length;
    var numCombinations = Math.pow(2, numVars);
    var matrixList = [];
    for (var i = 0; i < numCombinations; i += stepsize) {
        var row = {};
        for (var j = 0; j < numVars; j++) {
            // Determine if the j-th variable is true or false in the i-th combination
            var value = (i & (1 << (numVars - j - 1))) ? true : false;
            row[vars[j]] = value;
        }
        matrixList.push(row);
    }
    return matrixList;
}

iter_logic_utils.showMatrixTable = function(matrix, varGroups=[]) {
    // Build a string representation of the matrix
    // If varGroups is provided, it will be used to group the variables
    // into column sections delimited by '|'
    if (matrix.length === 0) {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.showMatrixTable, 0, {matrix: matrix}));
    }
    var ordering = Object.keys(matrix[0]);
    if (varGroups.length > 0) {
        ordering = [];
        for (const group of varGroups) {
            for (const varName of group) {
                ordering.push(varName);
            }
        }
    } else {
        varGroups = [ordering];
    }
    var header = varGroups.map(g => g.join(' ')).join(' | ');
    var separator = '-'.repeat(header.length);
    var rows = [];
    for (const row of matrix) {
        var groupStrs = [];
        for (const group of varGroups) {
            groupStrs.push(group.map(v => row[v] ? '1' : '0').join(' '));
        }
        rows.push(groupStrs.join(' | '));
    }
    return header + '\n' + separator + '\n' + rows.join('\n');
}
iter_logic_utils.branch_errors_showMatrixTable = [
    "Input matrix must have at least one row. Received: {matrix}"
]

/**
 * Convert a provided object into an array of its values.
 * If already an array, returns the array unchanged.
 * @param {Object|Array} obj - The object or array to convert
 * @returns {Array} - The array of values
 */
iter_logic_utils.arrayify = function(obj) {
    if (Array.isArray(obj)) {
        return obj;
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.values(obj);
    } else {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.arrayify, 0, {input: obj}));
    }
}
// Following experimental 'branch_errors' convention, name the array
// after the function it corresponds to
iter_logic_utils.branch_errors_arrayify = ["Input must be an object or array. Received: {input}"];

/**
 * Returns true if any value in the object is true
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if any value is true, false otherwise
 */
iter_logic_utils.anyTrue = function(obj) {
    // // Returns true if any value in the object is true
    // for (const key in obj) {
    //     if (obj[key]) {
    //         return true;
    //     }
    // }
    // return false;
    return this.arrayify(obj).some(v => v);
}

/**
 * Returns true if all values in the object are true
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if all values are true, false otherwise
 */
iter_logic_utils.allTrue = function(obj) {
    // // Returns true if all values in the object are true
    // for (const key in obj) {
    //     if (!obj[key]) {
    //         return false;
    //     }
    // }
    // return true;
    return this.arrayify(obj).every(v => v);
}

/**
 * Returns true if no values in the object are true
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if no values are true, false otherwise
 */
iter_logic_utils.noneTrue = function(obj) {
    // Returns true if no values in the object are true
    return this.arrayify(obj).every(v => !v);
}

/**
 * Returns true if not all values in the object are true
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if not all values are true, false otherwise
 */
iter_logic_utils.notAllTrue = function(obj) {
    // Returns true if not all values in the object are true
    return this.arrayify(obj).some(v => !v);
}

/**
 * 2 input XOR
 * @param {Object} obj - The object to check
 * @returns {boolean} - True if exactly one value is true, false otherwise
 */
iter_logic_utils.xor2 = function(obj) {
    var arr = this.arrayify(obj);
    if (arr.length !== 2) {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.xor2, 0, {input: obj}));
    }
    var case1 = (iter_logic_utils.anyTrue(obj) && iter_logic_utils.notAllTrue(obj));
    var case2 = (!iter_logic_utils.allTrue(obj) && !iter_logic_utils.noneTrue(obj));
    if (case1 !== case2) {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.xor2, 1, {input: obj, case1: case1, case2: case2}));
    }
    return case1;
}
iter_logic_utils.branch_errors_xor2 = [
    "Input must have exactly 2 values. Received: {input}",
    "Internal logic error: case1 ({case1}) does not match case2 ({case2}) for input: {input}"
];

/**
 * 4 input XOR composed of 2-input XORs
 * @param {Object} obj - The object to check
 * @return {boolean} - True if an exactly one of the results of two 2-input XORs is true, false otherwise
 */
iter_logic_utils.xor4xor2 = function(obj) {
    var arr = this.arrayify(obj);
    if (arr.length !== 4) {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.xor4xor2, 0, {input: obj}));
    }
    return iter_logic_utils.xor2([iter_logic_utils.xor2(arr.slice(0, 2)), iter_logic_utils.xor2(arr.slice(2, 4))]);
}
iter_logic_utils.branch_errors_xor4xor2 = [
    "Input must have exactly 4 values. Received: {input}"
]

iter_logic_utils.xor8xor4xor2 = function(obj) {
    var arr = this.arrayify(obj);
    if (arr.length !== 8) {
        throw new Error(testing_utils.getExpectedErrorMessage(this, iter_logic_utils.xor8xor4xor2, 0, {input: obj}));
    }
    return iter_logic_utils.xor2([iter_logic_utils.xor4xor2(arr.slice(0, 4)), iter_logic_utils.xor4xor2(arr.slice(4, 8))]);
}
iter_logic_utils.branch_errors_xor8xor4xor2 = [
    "Input must have exactly 8 values. Received: {input}"
]


// Truthfully, this likely doesn't actually need to be
// imported as it is.
// However, these functions are useful for
// remembering how to interact with objects and arrays
// in Javascript.

// Object.values(obj).every(v => v): AND, or 'all true'
// (fails on first false value)
// [0 0]: 0
// [0 1]: 0
// [1 0]: 0
// [1 1]: 1
// []: 1 (vacuously true)
// Object.values(obj).some(v => v): OR, or 'any true'
// (succeeds on first true value)
// [0 0]: 0
// [0 1]: 1
// [1 0]: 1
// [1 1]: 1
// []: 0 (vacuously false)
// Object.values(obj).every(v => !v): NOR, or 'none true'
// (fails on first true value)
// [0 0]: 1
// [0 1]: 0
// [1 0]: 0
// [1 1]: 0
// []: 1 (vacuously true)
// Object.values(obj).some(v => !v): NAND, or 'not all true'
// (succeeds on first false value)
// [0 0]: 1
// [0 1]: 1
// [1 0]: 1
// [1 1]: 0
// []: 0 (vacuously false)

// Objects can be made into arrays with Object.values(obj)
// The following logical functions can be made through a
// combination of Object.values and Array.prototype.some/every:
// AND: Object.values(obj).every(v => v)
// OR: Object.values(obj).some(v => v)
// NOR: Object.values(obj).every(v => !v)
// NAND: Object.values(obj).some(v => !v)

if (typeof require !== 'undefined' || (typeof process !== 'undefined' && process.argv[1] === import.meta.filename)) {
    // 'if __main__' equivalent. allows us to run tests directly.

    var iter_logic_utils = testing_utils.staticify(iter_logic_utils);
    // First, verify that staticify worked correctly
    console.log('Running staticify tests...');
    if (iter_logic_utils.arrayify.name !== 'arrayify') {
        throw new Error('staticify failed to preserve function name for arrayify');
    }
    // iter_logic_utils.arrayify(null)
    if (iter_logic_utils.anyTrue.name !== 'anyTrue') {
        throw new Error('staticify failed to preserve function name for anyTrue');
    }
    if (iter_logic_utils.allTrue.name !== 'allTrue') {
        throw new Error('staticify failed to preserve function name for allTrue');
    }
    function checkNamePreserved(func, name) {
        // Something strange is happening here, the function name is somehow being lost
        // between being checked and run within testForError
        if (func.name !== name) {
            throw new Error('staticify failed to preserve function name for ' + name);
        }
    }
    checkNamePreserved(iter_logic_utils.arrayify, 'arrayify');
    checkNamePreserved(iter_logic_utils.anyTrue, 'anyTrue');
    checkNamePreserved(iter_logic_utils.allTrue, 'allTrue');
    console.log('staticify tests passed.');

    console.log('Running iter_logic_utils tests...');
    console.log('arrayify tests:');
    console.log(iter_logic_utils.arrayify([1, 2, 3])); // [1, 2, 3]
    console.log(iter_logic_utils.arrayify({'a': 1, 'b': 2, 'c': 3})); // [1, 2, 3]

    var temp_test = testing_utils.testForError(iter_logic_utils, iter_logic_utils.arrayify, [null], 0, {input: null});
    if (temp_test.passed) {
        console.log('Passed testForError for arrayify with null input');
    } else {
        console.log('Failed testForError for arrayify with null input:', temp_test.message);
    }
    var temp_test = testing_utils.testForError(iter_logic_utils, iter_logic_utils.arrayify, [123], 0, {input: 123});
    if (temp_test.passed) {
        console.log('Passed testForError for arrayify with non-object non-array input');
    } else {
        console.log('Failed testForError for arrayify with non-object non-array input:', temp_test.message);
    }

    // boolMatrix tests:
    console.log('boolMatrix tests:');
    console.log(iter_logic_utils.boolMatrix(['A', 'B']));
    // [
    //   { A: false, B: false },
    //   { A: false, B: true },
    //   { A: true, B: false },
    //   { A: true, B: true }
    // ]
    console.log(iter_logic_utils.boolMatrix(['A', 'B'], 2));
    // [
    //   { A: false, B: false },
    //   { A: true, B: false }
    // ]

    // Logical function tests:
    var testMatrix = iter_logic_utils.boolMatrix(['A', 'B', 'C']);
    console.log('Logical function tests:');
    var testVarGroups = [
        ['A', 'B', 'C'],
        ['D', 'E'],
        ['F', 'G'],
    ]
    console.log('A, B, C = input variables');
    console.log('D = anyTrue, E = allTrue');
    console.log('F = noneTrue, G = notAllTrue');
    // var testHeader = 'A B C | D E | F G';
    var testHeader = testVarGroups.map(g => g.join(' ')).join(' | ');
    console.log(testHeader);
    console.log('-'.repeat(testHeader.length));
    for (const row of testMatrix) {
        // const A = row['A'];
        // const B = row['B'];
        // const C = row['C'];
        const A = row.A ? 1 : 0;
        const B = row.B ? 1 : 0;
        const C = row.C ? 1 : 0;
        // const D = iter_logic_utils.anyTrue(row);
        // const E = iter_logic_utils.allTrue(row);
        // const F = iter_logic_utils.noneTrue(row);
        // const G = iter_logic_utils.notAllTrue(row);
        const D = iter_logic_utils.anyTrue(row) ? 1 : 0;
        const E = iter_logic_utils.allTrue(row) ? 1 : 0;
        const F = iter_logic_utils.noneTrue(row) ? 1 : 0;
        const G = iter_logic_utils.notAllTrue(row) ? 1 : 0;
        // console.log(A + ' ' + B + ' ' + C + ' | ' + D + ' ' + E);
        // console.log((A ? 1 : 0) + ' ' + (B ? 1 : 0) + ' ' + (C ? 1 : 0) + ' | ' + (D ? 1 : 0) + ' ' + (E ? 1 : 0));
        console.log(A + ' ' + B + ' ' + C + ' | ' + D + ' ' + E + ' | ' + F + ' ' + G);
    }
    // Expected output:
    // A B C | D E
    // --------------
    // 0 0 0 | 0 0
    // 0 0 1 | 1 0
    // 0 1 0 | 1 0
    // 0 1 1 | 1 0
    // 1 0 0 | 1 0
    // 1 0 1 | 1 0
    // 1 1 0 | 1 0
    // 1 1 1 | 1 1

    console.log('iter_logic_utils tests passed.');

    // xor experiment
    console.log('xor2 tests:');
    var xorTest2Matrix = iter_logic_utils.boolMatrix(['A', 'B']);
    // make result matrix with C = xor2(A, B)
    var xorTest2Result = xorTest2Matrix.map(row => {
        return {
            ...row,
            C: iter_logic_utils.xor2(row)
        }
    });
    // console.log(xorTest2Result);
    console.log('Basic 2-input XOR truth table:');
    console.log(iter_logic_utils.showMatrixTable(xorTest2Result, [['A', 'B'], ['C']]));
    // Expected output:
    // A B | C
    // --------
    // 0 0 | 0
    // 0 1 | 1
    // 1 0 | 1
    // 1 1 | 0
    var xorTest4Matrix = iter_logic_utils.boolMatrix(['A', 'B', 'C', 'D']);
    var xorTest4Result = xorTest4Matrix.map(row => {
        return {
            ...row,
            E: iter_logic_utils.xor4xor2(row)
        }
    });
    console.log('4-input XOR truth table (as two chained 2-input XORs):');
    console.log(iter_logic_utils.showMatrixTable(xorTest4Result, [['A', 'B', 'C', 'D'], ['E']]));
    // Expected output:
    // A B C D | E
    // ----------------
    // 0 0 0 0 | 0
    // 0 0 0 1 | 1
    // 0 0 1 0 | 1
    // 0 0 1 1 | 0
    // 0 1 0 0 | 1
    // 0 1 0 1 | 0
    // 0 1 1 0 | 0
    // 0 1 1 1 | 1
    // 1 0 0 0 | 1
    // 1 0 0 1 | 0
    // 1 0 1 0 | 0
    // 1 0 1 1 | 1
    // 1 1 0 0 | 0
    // 1 1 0 1 | 1
    // 1 1 1 0 | 1
    // 1 1 1 1 | 0
    var xorTest8Matrix = iter_logic_utils.boolMatrix(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    var xorTest8Result = xorTest8Matrix.map(row => {
        return {
            ...row,
            I: iter_logic_utils.xor8xor4xor2(row)
        }
    });
    console.log('8-input XOR truth table (as a 3 deep tree of 2-input XORs):')
    console.log(iter_logic_utils.showMatrixTable(xorTest8Result, [['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], ['I']]));
}   