const KICKS_PER_ROUND = 3;

const state = {
  grade: DEFAULT_GRADE,
  score: 0,
  kicksThisRound: 0,
  timerInterval: null,
  phaserGame: null,
  scene: null,
  awaitingAnswer: false,
  currentQuestion: null,
};

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => el.setAttribute('hidden', ''));
  document.getElementById(id).removeAttribute('hidden');
}

let currentNickname = generateNickname();

function refreshNicknamePreview() {
  currentNickname = generateNickname();
  document.getElementById('nickname-preview').textContent = currentNickname.full;
}

function populateTeamSelect() {
  const select = document.getElementById('team-select');
  select.innerHTML = TEAMS.map((t) => `<option value="${t}">${t}</option>`).join('');
}

function populateGradeGrid() {
  const grid = document.getElementById('grade-grid');
  grid.innerHTML = '';
  GRADE_ORDER.forEach((key) => {
    const cfg = GRADE_LEVELS[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-card';
    btn.dataset.grade = key;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(key === state.grade));
    if (key === state.grade) btn.classList.add('selected');
    btn.innerHTML = `<span class="grade-card-number">${cfg.short}</span><span class="grade-card-label">${cfg.label}</span>`;
    btn.addEventListener('click', () => selectGrade(key));
    grid.appendChild(btn);
  });
}

function selectGrade(key) {
  state.grade = key;
  document.querySelectorAll('.grade-card').forEach((el) => {
    const isSelected = el.dataset.grade === key;
    el.classList.toggle('selected', isSelected);
    el.setAttribute('aria-checked', String(isSelected));
  });
}

function updateGradeBadge() {
  const cfg = GRADE_LEVELS[state.grade] || GRADE_LEVELS[DEFAULT_GRADE];
  document.getElementById('grade-display').textContent = cfg.label;
}

function initPhaserIfNeeded() {
  if (state.phaserGame) return;

  const config = {
    type: Phaser.AUTO,
    width: 720,
    height: 380,
    parent: 'phaser-container',
    backgroundColor: '#1b7a4d',
    scene: [PenaltyScene],
  };
  state.phaserGame = new Phaser.Game(config);
  state.phaserGame.events.once('ready', () => {
    state.scene = state.phaserGame.scene.getScene('PenaltyScene');
  });
}

function startGame() {
  initPhaserIfNeeded();
  showScreen('game-screen');
  updateGradeBadge();

  // Carrega progresso salvo do localStorage
  try {
    const saved = localStorage.getItem('mathgol_progress');
    if (saved) {
      const progress = JSON.parse(saved);
      state.score = progress.score || 0;
      if (progress.grade && GRADE_LEVELS[progress.grade]) {
        state.grade = progress.grade;
        updateGradeBadge();
      }
    }
  } catch (e) {
    console.warn('Não foi possível carregar progresso salvo.', e);
  }

  state.kicksThisRound = 0;
  updateHUD();
  nextQuestion();
}

function updateHUD() {
  document.getElementById('score-display').textContent = `Pontos: ${state.score}`;
}

function nextQuestion() {
  if (state.kicksThisRound >= KICKS_PER_ROUND) {
    finishRound();
    return;
  }

  const q = generateQuestion(state.grade);
  state.currentQuestion = q;
  state.awaitingAnswer = true;

  document.getElementById('question-text').textContent = q.text;
  speak(`Quanto é ${q.text.replace('?', '')}`);

  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => handleAnswer(opt, btn));
    grid.appendChild(btn);
  });

  document.getElementById('feedback-text').textContent = '';
  startTimer(30);
}

function startTimer(seconds) {
  clearInterval(state.timerInterval);
  let remaining = seconds;
  const display = document.getElementById('timer-display');
  display.textContent = `${remaining}s`;
  display.classList.remove('urgent');

  state.timerInterval = setInterval(() => {
    remaining -= 1;
    display.textContent = `${remaining}s`;
    if (remaining <= 10) display.classList.add('urgent');
    if (remaining <= 0) {
      clearInterval(state.timerInterval);
      if (state.awaitingAnswer) handleAnswer(null, null);
    }
  }, 1000);
}

function handleAnswer(chosen, btnEl) {
  if (!state.awaitingAnswer) return;
  state.awaitingAnswer = false;
  clearInterval(state.timerInterval);

  const isCorrect = chosen === state.currentQuestion.correctAnswer;

  document.querySelectorAll('.option-btn').forEach((b) => (b.disabled = true));
  if (btnEl) btnEl.classList.add(isCorrect ? 'correct' : 'try-again');

  const feedback = document.getElementById('feedback-text');
  if (isCorrect) {
    feedback.textContent = 'Isso aí! Resposta certa. ⚽';
    speak('Isso aí! Resposta certa.');
    state.score += 10;
  } else if (chosen === null) {
    feedback.textContent = 'Tempo esgotado — sem problema, próxima!';
    speak('Tempo esgotado. Sem problema, vamos para a próxima.');
  } else {
    feedback.textContent = 'Quase! Essa não era a resposta certa.';
    speak('Quase! Essa não era a resposta certa.');
  }

  updateHUD();
  state.kicksThisRound += 1;

  if (state.scene) {
    state.scene.animateKick(isCorrect, () => {
      setTimeout(nextQuestion, 300);
    });
  } else {
    setTimeout(nextQuestion, 1500);
  }
}

function finishRound() {
  const gradeLabel = (GRADE_LEVELS[state.grade] || GRADE_LEVELS[DEFAULT_GRADE]).label;
  document.getElementById('question-text').textContent = `Rodada do ${gradeLabel} concluída! 🏆`;
  document.getElementById('options-grid').innerHTML = '';
  document.getElementById('feedback-text').textContent = 'Progresso salvo.';
  speak('Rodada concluída! Progresso salvo.');

  try {
    localStorage.setItem('mathgol_progress', JSON.stringify({
      score: state.score,
      grade: state.grade,
    }));
  } catch (e) {
    console.error('Erro ao salvar progresso:', e);
  }

  setTimeout(() => showScreen('main-menu-screen'), 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  setupAccessibilityToggles();
  populateTeamSelect();
  populateGradeGrid();
  refreshNicknamePreview();

  document.getElementById('btn-instructions').addEventListener('click', () => {
    showScreen('instructions-screen');
  });
  document.getElementById('btn-back-from-instructions').addEventListener('click', () => showScreen('main-menu-screen'));
  document.getElementById('btn-play-instructions').addEventListener('click', () => {
    speak('Escolha a série que você estuda, depois responda a conta de matemática antes que o tempo acabe, e a bola vai pro gol. Errar não é problema, é só tentar de novo.');
  });

  document.getElementById('btn-accessibility').addEventListener('click', () => showScreen('accessibility-screen'));
  document.getElementById('btn-back-from-accessibility').addEventListener('click', () => showScreen('main-menu-screen'));

  document.getElementById('btn-avatar').addEventListener('click', () => showScreen('avatar-screen'));
  document.getElementById('btn-reroll').addEventListener('click', refreshNicknamePreview);

  document.getElementById('btn-confirm-avatar').addEventListener('click', () => {
    populateGradeGrid();
    showScreen('grade-screen');
  });

  document.getElementById('btn-back-from-grade').addEventListener('click', () => showScreen('avatar-screen'));

  document.getElementById('btn-confirm-grade').addEventListener('click', () => {
    startGame();
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    showScreen('avatar-screen');
  });
});
