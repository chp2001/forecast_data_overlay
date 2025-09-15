function updateYScale(value) {
    const yScaleInput = document.getElementById('scale-y');
    yScaleInput.value = value;
    document.getElementById('scale-y-value').textContent = value;
}
function updateXScale(value) {
    const xScaleInput = document.getElementById('scale-x');
    xScaleInput.value = value;
    document.getElementById('scale-x-value').textContent = value;
}
document.getElementById('scale-axis-lock').addEventListener('change', function () {
    if (this.checked) {
        // If locking is enabled, set both to the max of the two
        const maxScale = Math.max(parseInt(document.getElementById('scale-x').value), parseInt(document.getElementById('scale-y').value));
        updateXScale(maxScale);
        updateYScale(maxScale);
    }
});

updateXScale(document.getElementById('scale-x').value);
document.getElementById('scale-x').addEventListener('input', function () {
    updateXScale(this.value);
    if (document.getElementById('scale-axis-lock').checked) {
        updateYScale(this.value);
    }
});

updateYScale(document.getElementById('scale-y').value);
document.getElementById('scale-y').addEventListener('input', function () {
    updateYScale(this.value);
    if (document.getElementById('scale-axis-lock').checked) {
        updateXScale(this.value);
    }
});


function setScaleLogic() {
    // Get the temporary scale values from scale-y-value and scale-x-value spans
    // Then we try to set the scale values server-side.
    // If it succeeds, we try to update the map with the new scale values.
    // If that succeeds, we update the scale values in the UI.
    const scaleX = document.getElementById('scale-x-value').textContent;
    const scaleY = document.getElementById('scale-y-value').textContent;
    const oldScaleX = document.getElementById('set-scale-x-value').textContent;
    const oldScaleY = document.getElementById('set-scale-y-value').textContent
    // Check if the scale values have changed
    if (scaleX === oldScaleX && scaleY === oldScaleY) {
        console.log('Scale values have not changed, skipping update.');
        return; // No need to update if the values haven't changed
    }
    console.log('Setting scale to:', scaleX, scaleY);
    result = sendScaleValues(scaleX, scaleY);
    // If the set-time values are set, we can try to update the forecasted precipitation overlay
    var selectedTime = document.getElementById('selected-time').textContent;
    var doForecastedPrecip = selectedTime !== "None";
    result = result.then(data => {
        if (data) {
            console.log('Gridlines updated successfully with new scale values');
            console.log('Trying to update the forecasted precipitation overlay with the new scale values');
            if (doForecastedPrecip) {
                return updateForecastedPrecipOverlay();
            }
            else {
                console.log('Skipping forecasted precipitation overlay update as selected time is None');
                return true; // Continue the promise chain
            }
        } else {
            throw new Error('Failed to update gridlines with new scale values');
        }
    });
    result = result.then(data => {
        if (data) {
            if (doForecastedPrecip) {
                console.log('Forecasted precipitation overlay updated successfully with new scale values');
            }
            // Update the UI with the new scale values
            document.getElementById('set-scale-x-value').textContent = scaleX;
            document.getElementById('set-scale-y-value').textContent = scaleY;
            console.log('Scale values updated in the UI:', scaleX, scaleY);
        } else {
            throw new Error('Failed to update forecasted precipitation overlay with new scale values');
        }
    });
    result = result.catch(error => {
        console.error('Error setting scale:', error);
    });
    return result; // Return the promise chain for further handling if needed
}

// set-scale button logic
document.getElementById('set-scale').addEventListener('click', setScaleLogic);
