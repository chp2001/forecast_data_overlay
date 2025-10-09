
// On page load, we use the `tryget_resume_session` endpoint to check if there is a session to resume
function updateWithResumedSession(data) {
    if (!data) {
        console.error('No data received for resumed session.');
        return;
    }
    // if (data.selected_time) {
    //     var selectedTime = data.selected_time;
    //     // Received value is YYYYMMDD, convert it to YYYY-MM-DDTHH:MM
    //     selectedTime = selectedTime.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3T00:00');
    //     document.getElementById('selected-time').textContent = selectedTime;
    //     document.getElementById('target-time').value = selectedTime;
    // }
    // if (data.lead_time) {
    //     document.getElementById('selected-lead-time').textContent = data.lead_time;
    //     document.getElementById('lead-time').value = data.lead_time;
    // }
    // if (data.forecast_cycle) {
    //     document.getElementById('selected-forecast-cycle').textContent = data.forecast_cycle;
    //     document.getElementById('forecast-cycle').value = data.forecast_cycle;
    // }
    // Update time config using the new component
    if (data.selected_time || data.lead_time || data.forecast_cycle) {
        var timeConfigArgs = {};
        if (data.selected_time) {
            var selectedTime = data.selected_time;
            // Received value is YYYYMMDD, convert it to YYYY-MM-DD
            selectedTime = selectedTime.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
            timeConfigArgs['target_time'] = selectedTime;
        }
        if (data.lead_time) {
            timeConfigArgs['lead_time'] = data.lead_time;
        }
        if (data.forecast_cycle) {
            timeConfigArgs['forecast_cycle'] = data.forecast_cycle;
        }
        if (data.range_mode) {
            timeConfigArgs['range_mode'] = data.range_mode;
        }
        if (data.lead_time_end) {
            timeConfigArgs['lead_time_end'] = data.lead_time_end;
        }
        timeConfigElement.externallySetFull(timeConfigArgs);
    }


    // if (data.scaleX) {
    //     document.getElementById('set-scale-x-value').textContent = data.scaleX;
    // }
    // if (data.scaleY) {
    //     document.getElementById('set-scale-y-value').textContent = data.scaleY;
    // }
    if (data.scaleX || data.scaleY) {
        // Rather than update individual elements, we can use the scaleConfigElement's setFull method
        // to update both values at once, preserving any unchanged values.
        // This also ensures the sliders and labels are all updated consistently.
        scaleConfigElement.setFull({
            xScale: data.scaleX || null,
            yScale: data.scaleY || null
        });
    }
    if (data.rowMin && data.rowMax && data.colMin && data.colMax) {
        externalSetRegionBounds(
            data.regionRowMin, data.regionRowMax,
            data.regionColMin, data.regionColMax,
            16, 16
        )
        externalSetRegionValues(
            data.rowMin, data.rowMax,
            data.colMin, data.colMax
        )
    }
    if (data.forecasted_forcing_data_dict) {
        var data_forcing_dict = JSON.parse(data.forecasted_forcing_data_dict);
        var geoms_for_print = data_forcing_dict['geometries'];
        if (geoms_for_print.length > 3) {
            geoms_for_print = geoms_for_print.slice(0, 3);
            geoms_for_print.push('... (truncated from ' + data_forcing_dict['geometries'].length + ' total)');
        }
        var values_for_print = data_forcing_dict['values'];
        if (values_for_print.length > 3) {
            values_for_print = values_for_print.slice(0, 3);
            values_for_print.push('... (truncated from ' + data_forcing_dict['values'].length + ' total)');
        }
        console.log('Resuming session with geometries:', geoms_for_print);
        console.log('Resuming session with values:', values_for_print);
        // updateForecastLayer(data.forecasted_forcing_data_dict);
        updateForecastLayer(data_forcing_dict);
    }
    // If there are any other session data to resume, handle them here
}

// If response is 200, we update the page with the resumed session data
// If response is 404, we do nothing, there is no session to resume
function fetchResumeSession() {
    fetch('/tryget_resume_session')
        .then(response => {
            if (response.status === 200) {
                return response.json();
            } else if (response.status === 404) {
                console.log('No session to resume.');
                return null;
            } else {
                throw new Error('Unexpected response status: ' + response.status);
            }
        })
        .then(data => {
            if (data) {
                updateWithResumedSession(data);
            }
        })
        .catch(error => {
            console.error('Error fetching resumed session data:', error);
        }
        );
}
// On page load, we check if there is a session to resume
// document.addEventListener('DOMContentLoaded', fetchResumeSession);
// still too early, errors due to map not being ready
map.on('load', fetchResumeSession);