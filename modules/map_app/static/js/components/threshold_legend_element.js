// Make a custom element for displaying a legend for
// the threshold based coloring of the map

// function applyNOAAThresholdToValue(value_inches, alpha=1.0) {
//     // Rainfall (inches)
//     // Greater than or equal to 10 
//     // rgb(215, 215, 215); // very light gray
//     // 8 to 10
//     // rgb(114, 64, 214); // purple
//     // 6 to 8
//     // rgb(246, 0, 242); // magenta
//     // 5 to 6
//     // rgb(112, 2, 9); // dark red
//     // 4 to 5
//     // rgb(162, 3, 17); // red
//     // 3 to 4
//     // rgb(245, 7, 25); // bright red
//     // 2.5 to 3
//     // rgb(246, 140, 40); // orange
//     // 2 to 2.5
//     // rgb(253, 212, 105); // yellow-orange
//     // 1.5 to 2
//     // rgb(248, 250, 61); // yellow
//     // 1 to 1.5
//     // rgb(14, 89, 24); // darkish-green
//     // 0.75 to 1
//     // rgb(24, 150, 36); // green
//     // 0.5 to 0.75
//     // rgb(40, 250, 59); // light-green
//     // 0.25 to 0.5
//     // rgb(12, 18, 135); // dark-blue
//     // 0.1 to 0.25
//     // rgb(59, 121, 187); // lightish-blue
//     // 0.01 to 0.1
//     // rgb(43, 192, 245); // very-light-blue or cyan
//     // Missing data
//     // rgb(114, 114, 114); // gray
//     var thresholds = [
//         { min: 10, color: `rgba(215, 215, 215, ${alpha})`}, // very light gray
//         { min: 8, color: `rgba(114, 64, 214, ${alpha})`}, // purple
//         { min: 6, color: `rgba(246, 0, 242, ${alpha})`}, // magenta
//         { min: 5, color: `rgba(112, 2, 9, ${alpha})`}, // dark red
//         { min: 4, color: `rgba(162, 3, 17, ${alpha})`}, // red
//         { min: 3, color: `rgba(245, 7, 25, ${alpha})`}, // bright red
//         { min: 2.5, color: `rgba(246, 140, 40, ${alpha})`}, // orange
//         { min: 2, color: `rgba(253, 212, 105, ${alpha})`}, // yellow-orange
//         { min: 1.5, color: `rgba(248, 250, 61, ${alpha})`}, // yellow
//         { min: 1, color: `rgba(14, 89, 24, ${alpha})`}, // darkish-green
//         { min: 0.75, color: `rgba(24, 150, 36, ${alpha})`}, // green
//         { min: 0.5, color: `rgba(40, 250, 59, ${alpha})`}, // light-green
//         { min: 0.25, color: `rgba(12, 18, 135, ${alpha})`}, // dark-blue
//         { min: 0.1, color: `rgba(59, 121, 187, ${alpha})`}, // lightish-blue
//         { min: 0.01, color: `rgba(43, 192, 245, ${alpha})`}, // very-light-blue or cyan
//     ];
//     var error_color = `rgba(114, 114, 114, ${alpha})`;
//     // If value is NaN or undefined, return error color
//     if (value_inches === null || value_inches === undefined || isNaN(value_inches)) {
//         return error_color;
//     }
//     // Iterate through thresholds from highest to lowest
//     for (let threshold of thresholds) {
//         if (value_inches >= threshold.min) {
//             return threshold.color;
//         }
//     }
//     // Past the last threshold, scale down the alpha based on distance from the lowest threshold
//     var lowestThreshold = thresholds[thresholds.length - 1].min;
//     var lowestThresholdColor = thresholds[thresholds.length - 1].color;
//     if (value_inches > 0 && value_inches < lowestThreshold) {
//         var scale = value_inches / lowestThreshold; // Scale from 0 to 1
//         // Extract the RGB values from the color string
//         var rgb = lowestThresholdColor.match(/\d+/g);
//         var r = parseInt(rgb[0]);
//         var g = parseInt(rgb[1]);
//         var b = parseInt(rgb[2]);
//         var scaledAlpha = alpha * scale; // Scale the alpha
//         return `rgba(${r}, ${g}, ${b}, ${scaledAlpha})`;
//     }
//     // If value is 0 or negative, return error color
    
//     return error_color;
// }

class ThresholdLegendElement extends HTMLElement {
    constructor() {
        super();
        // this.attachShadow({ mode: 'open' });
        
        this.thresholds = [
            { min: 10, label: "≥ 10 in" , color: `rgb(215, 215, 215)`}, // very light gray
            { min: 8, label: "8 - 10 in" , color: `rgb(114, 64, 214)`}, // purple
            { min: 6, label: "6 - 8 in" , color: `rgb(246, 0, 242)`}, // magenta
            { min: 5, label: "5 - 6 in" , color: `rgb(112, 2, 9)`}, // dark red
            { min: 4, label: "4 - 5 in" , color: `rgb(162, 3, 17)`}, // red
            { min: 3, label: "3 - 4 in" , color: `rgb(245, 7, 25)`}, // bright red
            { min: 2.5, label: "2.5 - 3 in" , color: `rgb(246, 140, 40)`}, // orange
            { min: 2, label: "2 - 2.5 in" , color: `rgb(253, 212, 105)`}, // yellow-orange
            { min: 1.5, label: "1.5 - 2 in" , color: `rgb(248, 250, 61)`}, // yellow
            { min: 1, label: "1 - 1.5 in" , color: `rgb(14, 89, 24)`}, // darkish-green
            { min: 0.75, label: "0.75 - 1 in" , color: `rgb(24, 150, 36)`}, // green
            { min: 0.5, label: "0.5 - 0.75 in" , color: `rgb(40, 250, 59)`}, // light-green
            { min: 0.25, label: "0.25 - 0.5 in" , color: `rgb(12, 18, 135)`}, // dark-blue
            { min: 0.1, label: "0.1 - 0.25 in" , color: `rgb(59, 121, 187)`}, // lightish-blue
            { min: 0.01, label: "0.01 - 0.1 in" , color: `rgb(43, 192, 245)`}, // very-light-blue or cyan
        ];
        this.error_color = `rgb(114, 114, 114)`; // gray

        this.container = null;
        this.legendTitle = null;
        this.legendItemsContainer = null;
        this.errorItem = null;
        this.thresholdItems = [];
    }
    connectedCallback() {
        this.build();
    }

    makeLegendItem(color, label) {
        var item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '4px';

        var colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = color;
        colorBox.style.border = '1px solid #000';
        colorBox.style.marginRight = '8px';

        var labelSpan = document.createElement('span');
        labelSpan.textContent = label;

        item.appendChild(colorBox);
        item.appendChild(labelSpan);

        return item;
    }

    build() {
        // Leave most elements minimally styled to begin with

        this.container = document.createElement('div');

    }
}