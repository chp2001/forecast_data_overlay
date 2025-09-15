// Lead time selector
document.getElementById('lead-time-value').textContent = document.getElementById('lead-time').value;
document.getElementById('lead-time').addEventListener('input', function () {
    document.getElementById('lead-time-value').textContent = this.value;
});
// Forecast cycle selector
document.getElementById('forecast-cycle-value').textContent = document.getElementById('forecast-cycle').value;
document.getElementById('forecast-cycle').addEventListener('input', function () {
    document.getElementById('forecast-cycle-value').textContent = this.value;
});


// set-time button logic
document.getElementById('set-time').addEventListener('click', function () {
  const targetTime = document.getElementById('target-time').value;
  const leadTime = document.getElementById('lead-time').value;
  const forecastCycle = document.getElementById('forecast-cycle').value;
  const prevTime = document.getElementById('selected-time').textContent;
  const prevLeadTime = document.getElementById('selected-lead-time').textContent;
  const prevForecastCycle = document.getElementById('selected-forecast-cycle').textContent
  var changed = false;
  // Check if any of the values have changed
  if (targetTime !== prevTime || leadTime !== prevLeadTime || forecastCycle !== prevForecastCycle) {
    changed = true;
  }
  if (changed) {
    document.getElementById('selected-time').textContent = targetTime;
    document.getElementById('selected-lead-time').textContent = leadTime;
    document.getElementById('selected-forecast-cycle').textContent = forecastCycle;

    // Need to send the time as YYYYMMDD, but input provides it as YYYY-MM-DDTHH:MM
    var formattedTime = targetTime.replace(/-/g, '');
    const Tindex = formattedTime.indexOf('T');
    if (Tindex !== -1) {
      formattedTime = formattedTime.substring(0, Tindex);
    }


    // Trigger the time change event
    fetch('/set_time', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_time: formattedTime,
        lead_time: leadTime,
        forecast_cycle: forecastCycle
      })
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        console.log('Time set successfully:', data);
      })
      .then(() => {
        // Fetch and update the forecasted precipitation data
        updateForecastedPrecipOverlay();
      })
      .catch(error => {
        console.error('Error setting time:', error);
      });
  }
});
