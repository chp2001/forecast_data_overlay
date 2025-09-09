
// On page load, we use the `tryget_resume_session` endpoint to check if there is a session to resume
function updateWithResumedSession(data) {
  if (!data) {
    console.error('No data received for resumed session.');
    return;
  }
  if (data.selected_time) {
    var selectedTime = data.selected_time;
    // Received value is YYYYMMDD, convert it to YYYY-MM-DDTHH:MM
    selectedTime = selectedTime.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3T00:00');
    document.getElementById('selected-time').textContent = selectedTime;
    document.getElementById('target-time').value = selectedTime;
  }
  if (data.lead_time) {
    document.getElementById('selected-lead-time').textContent = data.lead_time;
    document.getElementById('lead-time').value = data.lead_time;
  }
  if (data.forecast_cycle) {
    document.getElementById('selected-forecast-cycle').textContent = data.forecast_cycle;
    document.getElementById('forecast-cycle').value = data.forecast_cycle;
  }
  if (data.scaleX) {
    document.getElementById('set-scale-x-value').textContent = data.scaleX;
  }
  if (data.scaleY) {
    document.getElementById('set-scale-y-value').textContent = data.scaleY;
  }
  if (data.forecasted_forcing_data_dict) {
    console.log('Resuming session with forecasted forcing data:', data.forecasted_forcing_data_dict);
    updateForecastLayer(data.forecasted_forcing_data_dict);
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