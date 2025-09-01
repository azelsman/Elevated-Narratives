function updateProgress(currentStep, totalSteps = 7) {
  const bar = document.getElementById('progress-bar');
  const percent = Math.round((currentStep / totalSteps) * 100);
  bar.style.setProperty('--progress', `${percent}%`);
  bar.setAttribute('aria-valuenow', currentStep);
}