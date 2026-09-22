let audioEnabled = true;

function speak(text) {
  if (!audioEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function setupAccessibilityToggles() {
  const contrastBtn = document.getElementById('toggle-contrast');
  const dyslexiaBtn = document.getElementById('toggle-dyslexia');
  const audioBtn = document.getElementById('toggle-audio');
  const largeTextBtn = document.getElementById('toggle-large-text');

  contrastBtn.addEventListener('click', () => {
    const isOn = contrastBtn.getAttribute('aria-pressed') === 'true';
    contrastBtn.setAttribute('aria-pressed', String(!isOn));
    document.body.classList.toggle('high-contrast', !isOn);
  });

  dyslexiaBtn.addEventListener('click', () => {
    const isOn = dyslexiaBtn.getAttribute('aria-pressed') === 'true';
    dyslexiaBtn.setAttribute('aria-pressed', String(!isOn));
    document.body.classList.toggle('dyslexia-friendly', !isOn);
  });

  audioBtn.addEventListener('click', () => {
    audioEnabled = audioBtn.getAttribute('aria-pressed') !== 'true';
    audioBtn.setAttribute('aria-pressed', String(audioEnabled));
    if (!audioEnabled) window.speechSynthesis.cancel();
  });

  if (largeTextBtn) {
    largeTextBtn.addEventListener('click', () => {
      const isOn = largeTextBtn.getAttribute('aria-pressed') === 'true';
      largeTextBtn.setAttribute('aria-pressed', String(!isOn));
      document.body.classList.toggle('large-text', !isOn);
    });
  }
}
