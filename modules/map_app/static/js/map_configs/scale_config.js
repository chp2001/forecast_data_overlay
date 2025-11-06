// Modify to use the new scale-config component
/**
 * @import {scale_config} from '../components/scale_config_element.js';
 */

/**
 * @type {scale_config}
 */
const scaleConfigElement = document.getElementById('scale-config');
// Nearly all logic is now handled in components/scale_config_element.js
// Cache interaction is not handled in the component, so we still need to set that up here
// by preparing a callback for when the scales are set
if (!scaleConfigElement) {
    throw new Error('Scale config element not found');
}
// scaleConfigElement.addOnScaleSetFunction(
scaleConfigElement.scaleSetCallbacks.add(
    'scale-config-cache-update',
    ({xScale = null, yScale = null}={}) => {
        if (xScale !== null) {
            var prev_scaleX = local_cache["scaleX"];
            local_cache["scaleX"] = xScale;
            console.log('Updated local_cache scaleX from', prev_scaleX, 'to:', xScale);
        }
        if (yScale !== null) {
            var prev_scaleY = local_cache["scaleY"];
            local_cache["scaleY"] = yScale;
            console.log('Updated local_cache scaleY from', prev_scaleY, 'to:', yScale);
        }
    }
)