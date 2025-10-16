// Make a custom element for displaying a legend for
// the threshold based coloring of the map

// this.thresholds = [
//     { min: 10, label: "≥ 10 in" , color: `rgb(215, 215, 215)`}, // very light gray
//     { min: 8, label: "8 - 10 in" , color: `rgb(114, 64, 214)`}, // purple
//     { min: 6, label: "6 - 8 in" , color: `rgb(246, 0, 242)`}, // magenta
//     { min: 5, label: "5 - 6 in" , color: `rgb(112, 2, 9)`}, // dark red
//     { min: 4, label: "4 - 5 in" , color: `rgb(162, 3, 17)`}, // red
//     { min: 3, label: "3 - 4 in" , color: `rgb(245, 7, 25)`}, // bright red
//     { min: 2.5, label: "2.5 - 3 in" , color: `rgb(246, 140, 40)`}, // orange
//     { min: 2, label: "2 - 2.5 in" , color: `rgb(253, 212, 105)`}, // yellow-orange
//     { min: 1.5, label: "1.5 - 2 in" , color: `rgb(248, 250, 61)`}, // yellow
//     { min: 1, label: "1 - 1.5 in" , color: `rgb(14, 89, 24)`}, // darkish-green
//     { min: 0.75, label: "0.75 - 1 in" , color: `rgb(24, 150, 36)`}, // green
//     { min: 0.5, label: "0.5 - 0.75 in" , color: `rgb(40, 250, 59)`}, // light-green
//     { min: 0.25, label: "0.25 - 0.5 in" , color: `rgb(12, 18, 135)`}, // dark-blue
//     { min: 0.1, label: "0.1 - 0.25 in" , color: `rgb(59, 121, 187)`}, // lightish-blue
//     { min: 0.01, label: "0.01 - 0.1 in" , color: `rgb(43, 192, 245)`}, // very-light-blue or cyan
// ];

/**
 * @class
 * @name threshold_legend
 * @description
 * Custom HTML element to display a legend for the threshold-based coloring
 * of the map. The legend dynamically updates based on the thresholds
 * provided.
 */
class threshold_legend extends HTMLElement {
    constructor() {
        super();
        // this.attachShadow({ mode: 'open' });
        
        this.thresholds = noaa_threshold_color_sets["precip_1h"];
        this.threshold_labels = null;
        this.threshold_units = "in";
        this.below_min_color = null;
        this.error_color = `rgb(114, 114, 114)`; // gray

        this.container = null;
        this.legendTitle = null;
        this.legendItemsContainer = null;
        this.errorItem = null;
        this.thresholdItems = [];

        this.uuid = threshold_legend.id++;
    }
    connectedCallback() {
        this.build();
    }

    makeThresholdLabels() {
        // reset the labels array.
        // we might have swapped threshold sets
        this.threshold_labels = [];
        // first label is always the highest threshold
        this.threshold_labels.push(`≥ ${this.thresholds[0].min} ${this.threshold_units}`);
        for (let i = 1; i < this.thresholds.length; i++) {
            const lower = this.thresholds[i].min;
            const upper = this.thresholds[i - 1].min;
            this.threshold_labels.push(`${lower} - ${upper} ${this.threshold_units}`);
        }
        // finally add the "below lowest" label
        const last_threshold = this.thresholds[this.thresholds.length - 1];
        this.threshold_labels.push(`< ${last_threshold.min} ${this.threshold_units} (gradient)`);
        // and the error label
        this.threshold_labels.push("No data / Zero");
    }

    makeLegendItem(color, label) {
        var item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '1px';
        item.style.overflow = 'hidden';
        // item.style.whiteSpace = 'nowrap';
        item.style.textOverflow = 'ellipsis';

        var colorBox = document.createElement('div');
        colorBox.style.width = '20px';
        colorBox.style.height = '20px';
        colorBox.style.backgroundColor = color;
        colorBox.style.border = '1px solid #000';
        colorBox.style.marginRight = '8px';
        colorBox.style.flexShrink = '0';
        colorBox.title = label;

        var labelSpan = document.createElement('span');
        labelSpan.textContent = label;
        labelSpan.style.fontSize = '12px';
        labelSpan.style.flexShrink = '0';
        labelSpan.style.textOverflow = 'ellipsis';

        item.appendChild(colorBox);
        item.appendChild(labelSpan);

        return item;
    }

    reconfigureLegendItem(item, color, label) {
        // assumes item has two children: colorBox and labelSpan
        const colorBox = item.children[0];
        const labelSpan = item.children[1];

        colorBox.style.backgroundColor = color;
        labelSpan.textContent = label;
    }

    updateThresholds(new_thresholds, units = "in") {
        this.thresholds = new_thresholds;
        this.threshold_units = units;
        this.makeThresholdLabels();

        // Update the color for "below minimum" category to be the
        // lowest threshold color, but with half opacity
        this.below_min_color = this.thresholds[this.thresholds.length - 1].color.replace('rgb', 'rgba').replace(')', ', 0.5)');

        const old_length = this.thresholdItems.length;
        const new_length = this.thresholds.length + 1 + 1; // +1 for below-min, +1 for error

        // Update the title
        if (this.legendTitle) {
            this.legendTitle.textContent = `Precipitation (${this.threshold_units})`;
        }

        const getColor = (index) => {
            if (index < this.thresholds.length) {
                return this.thresholds[index].color;
            } else if (index === this.thresholds.length) {
                return this.below_min_color;
            } else {
                return this.error_color;
            }
        };
        
        // Update existing items
        const min_length = Math.min(old_length, new_length);
        for (let i = 0; i < min_length; i++) {
            const color = getColor(i);
            const label = this.threshold_labels[i];
            this.reconfigureLegendItem(this.thresholdItems[i], color, label);
        }

        // If we have more new items, create and append them
        for (let i = min_length; i < new_length; i++) {
            const color = getColor(i);
            const label = this.threshold_labels[i];
            const newItem = this.makeLegendItem(color, label);
            this.legendItemsContainer.appendChild(newItem);
            this.thresholdItems.push(newItem);
        }

        // If we have fewer new items, remove the excess
        for (let i = new_length; i < old_length; i++) {
            const itemToRemove = this.thresholdItems.pop();
            this.legendItemsContainer.removeChild(itemToRemove);
        }

        // Adjust styling for below-min item
        var belowMinItem = this.thresholdItems[this.thresholdItems.length - 2];
        belowMinItem.style.marginTop = '2px';
        belowMinItem.children[0].style.borderStyle = 'dashed';
        
        // Finally, ensure the error item is at the end
        this.errorItem = this.thresholdItems[this.thresholdItems.length - 1];
        // ensure some spacing above the error item
        this.errorItem.style.marginTop = '3px';
    }

    build() {
        // Leave most elements minimally styled to begin with

        this.container = document.createElement('div');
        this.container.id = `threshold-legend-container`;
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.paddingTop = '0px';
        this.container.style.paddingBottom = '0px';
        this.container.style.paddingLeft = '4px';


        this.legendTitle = document.createElement('div');
        this.legendTitle.style.marginBottom = '8px';

        this.legendItemsContainer = document.createElement('div');
        this.legendItemsContainer.style.display = 'flex';
        this.legendItemsContainer.style.flexDirection = 'column';

        this.updateThresholds(this.thresholds, this.threshold_units);

        this.container.appendChild(this.legendTitle);
        this.container.appendChild(this.legendItemsContainer);
        this.appendChild(this.container);
    }
}
threshold_legend.id = 0;
customElements.define('threshold-legend', threshold_legend);