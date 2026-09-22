/* ============================================================
   Termatika — client-side (sem backend)
   Geração de equações e verificação feitas localmente.
   ============================================================ */

/* ---------------- Gerador de equações ---------------- */
function generateEquation(length) {
  const ops = ['+', '-', '*', '/'];
  const candidates = [];

  for (let attempt = 0; attempt < 2000 && candidates.length < 20; attempt++) {
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, result;

    if (op === '+') {
      a = Math.floor(Math.random() * 998) + 1;
      b = Math.floor(Math.random() * 998) + 1;
      result = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 998) + 1;
      b = Math.floor(Math.random() * a) + 1;
      result = a - b;
    } else if (op === '*') {
      a = Math.floor(Math.random() * 98) + 2;
      b = Math.floor(Math.random() * 98) + 2;
      result = a * b;
    } else {
      b = Math.floor(Math.random() * 48) + 2;
      result = Math.floor(Math.random() * 98) + 1;
      a = b * result;
    }

    if (result < 0) continue;
    const eq = `${a}${op}${b}=${result}`;
    if (eq.length === length) candidates.push(eq);
  }

  if (candidates.length === 0) {
    // fallback seguro
    return '12+34=46';
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function gradeGuess(guess, target) {
  const grading = new Array(guess.length).fill('gray');
  const targetUsed = new Array(target.length).fill(false);
  const guessUsed = new Array(guess.length).fill(false);

  // verde: posição exata
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === target[i]) {
      grading[i] = 'green';
      targetUsed[i] = true;
      guessUsed[i] = true;
    }
  }

  // dourado: caractere certo, posição errada
  for (let i = 0; i < guess.length; i++) {
    if (guessUsed[i]) continue;
    for (let j = 0; j < target.length; j++) {
      if (!targetUsed[j] && guess[i] === target[j]) {
        grading[i] = 'gold';
        targetUsed[j] = true;
        break;
      }
    }
  }

  return grading;
}

function isValidEquation(str) {
  const match = str.match(/^(\d+)([\+\-\*\/])(\d+)=(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  const result = Number(match[4]);

  let expected;
  if (op === '+') expected = a + b;
  else if (op === '-') expected = a - b;
  else if (op === '*') expected = a * b;
  else if (op === '/') expected = (b !== 0 && a % b === 0) ? a / b : NaN;

  return expected === result;
}

/* Gera template para modo Resultado */
function generateTargetTemplate(length) {
  const eq = generateEquation(length);
  const template = [];
  for (let i = 0; i < eq.length; i++) {
    const ch = eq[i];
    const isOp = ['+', '-', '*', '/', '='].includes(ch);
    // fixa operadores, = e os dígitos do resultado (após o =)
    const eqIdx = eq.indexOf('=');
    const isResult = i > eqIdx;
    template.push({ fixed: isOp || isResult, char: ch });
  }
  return { equation: eq, template };
}

/* ---------------- Estado ---------------- */
let mode = 'guess';
let busy = false;

const guessState = {
  target: '',
  length: 8,
  maxAttempts: 6,
  cells: [],
  cursor: 0,
  attempts: [],
  gameOver: true,
  keyStatus: {}
};

const targetState = {
  equation: '',
  template: [],
  maxAttempts: 6,
  values: [],
  cursor: 0,
  attempts: [],
  gameOver: true
};

const boardEl = document.getElementById('board');
const messageEl = document.getElementById('message');
const triesEl = document.getElementById('tries');
const keyboardEl = document.getElementById('keyboard');
const subtitleEl = document.getElementById('subtitle');
const newGameBtn = document.getElementById('newgame');

function setMessage(text) { messageEl.textContent = text; }

/* ---------------- Modo: Adivinhar ---------------- */
function guessStart() {
  guessState.attempts = [];
  guessState.keyStatus = {};
  guessState.target = generateEquation(guessState.length);
  guessState.cells = new Array(guessState.length).fill('');
  guessState.cursor = 0;
  guessState.gameOver = false;
  setMessage('');
  render();
}

function guessMoveCursor(delta) {
  guessState.cursor = Math.min(guessState.length - 1, Math.max(0, guessState.cursor + delta));
}

function guessTypeChar(ch) {
  if (guessState.gameOver || busy) return;
  guessState.cells[guessState.cursor] = ch;
  if (guessState.cursor < guessState.length - 1) guessState.cursor++;
  render();
}

function guessBackspace() {
  if (guessState.gameOver || busy) return;
  if (guessState.cells[guessState.cursor] !== '') {
    guessState.cells[guessState.cursor] = '';
  } else if (guessState.cursor > 0) {
    guessState.cursor--;
    guessState.cells[guessState.cursor] = '';
  }
  render();
}

function guessSubmit() {
  if (guessState.gameOver || busy) return;
  if (guessState.cells.includes('')) {
    setMessage('Preencha todas as casas.');
    shakeCurrentRow();
    return;
  }
  const guess = guessState.cells.join('');

  if (!isValidEquation(guess)) {
    setMessage('A equação precisa ser matematicamente válida.');
    shakeCurrentRow();
    return;
  }

  const grading = gradeGuess(guess, guessState.target);
  guessState.attempts.push({ guess, grading });
  updateKeyboardColors(guess, grading);

  const isCorrect = grading.every(g => g === 'green');
  const attemptsUsed = guessState.attempts.length;

  if (isCorrect) {
    guessState.gameOver = true;
    setMessage('Isso aí! Você acertou em ' + attemptsUsed + (attemptsUsed === 1 ? ' tentativa.' : ' tentativas.'));
  } else if (attemptsUsed >= guessState.maxAttempts) {
    guessState.gameOver = true;
    setMessage('Não foi dessa vez. Era: ' + guessState.target);
  } else {
    setMessage('');
  }

  guessState.cells = new Array(guessState.length).fill('');
  guessState.cursor = 0;
  render();
}

/* ---------------- Modo: Resultado ---------------- */
function targetStart() {
  targetState.attempts = [];
  const { equation, template } = generateTargetTemplate(8);
  targetState.equation = equation;
  targetState.template = template;
  targetState.values = template.map(() => '');
  targetState.cursor = template.findIndex(c => !c.fixed);
  if (targetState.cursor === -1) targetState.cursor = 0;
  targetState.gameOver = false;
  setMessage('');
  render();
}

function targetFirstBlank(from) {
  const n = targetState.template.length;
  for (let i = from; i < n; i++) if (!targetState.template[i].fixed) return i;
  for (let i = 0; i < from; i++) if (!targetState.template[i].fixed) return i;
  return from;
}

function targetPrevBlank(from) {
  for (let i = from - 1; i >= 0; i--) if (!targetState.template[i].fixed) return i;
  for (let i = targetState.template.length - 1; i > from; i--) if (!targetState.template[i].fixed) return i;
  return from;
}

function targetMoveCursor(delta) {
  targetState.cursor = delta > 0
    ? targetFirstBlank(targetState.cursor + 1)
    : targetPrevBlank(targetState.cursor);
}

function targetTypeChar(ch) {
  if (targetState.gameOver || busy) return;
  if (!/^[0-9]$/.test(ch)) return;
  if (targetState.template[targetState.cursor].fixed) return;
  targetState.values[targetState.cursor] = ch;
  targetState.cursor = targetFirstBlank(targetState.cursor + 1);
  render();
}

function targetBackspace() {
  if (targetState.gameOver || busy) return;
  if (targetState.values[targetState.cursor] !== '') {
    targetState.values[targetState.cursor] = '';
  } else {
    targetState.cursor = targetPrevBlank(targetState.cursor);
    targetState.values[targetState.cursor] = '';
  }
  render();
}

function targetSubmit() {
  if (targetState.gameOver || busy) return;
  const hasEmpty = targetState.template.some((c, i) => !c.fixed && targetState.values[i] === '');
  if (hasEmpty) {
    setMessage('Preencha todos os espaços em branco.');
    shakeCurrentRow();
    return;
  }

  // Monta a equação com os valores preenchidos
  const filled = targetState.template.map((c, i) => c.fixed ? c.char : targetState.values[i]).join('');
  const isCorrect = isValidEquation(filled);

  targetState.attempts.push({ values: targetState.values.slice(), correct: isCorrect });
  const attemptsUsed = targetState.attempts.length;

  if (isCorrect) {
    targetState.gameOver = true;
    setMessage('Fechou! ' + filled + ' — resolvido em ' + attemptsUsed + (attemptsUsed === 1 ? ' tentativa.' : ' tentativas.'));
  } else if (attemptsUsed >= targetState.maxAttempts) {
    targetState.gameOver = true;
    setMessage('Não fechou em ' + targetState.maxAttempts + ' tentativas. Uma solução possível: ' + targetState.equation);
  } else {
    setMessage('Ainda não bate. Próxima tentativa.');
  }

  targetState.values = targetState.template.map(() => '');
  targetState.cursor = targetState.template.findIndex(c => !c.fixed);
  if (targetState.cursor === -1) targetState.cursor = 0;
  render();
}

/* ---------------- UI compartilhada ---------------- */
function shakeCurrentRow() {
  const rowIdx = mode === 'guess' ? guessState.attempts.length : targetState.attempts.length;
  const row = document.getElementById('row-' + rowIdx);
  if (!row) return;
  row.querySelectorAll('.tile').forEach(t => {
    t.classList.remove('shake');
    void t.offsetWidth;
    t.classList.add('shake');
  });
}

const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '-', '*', '/', '='],
  ['ENTER', '⌫']
];

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEY_ROWS.forEach(rowKeys => {
    const krow = document.createElement('div');
    krow.className = 'krow';
    rowKeys.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.textContent = k;
      btn.dataset.key = k;
      if (k === 'ENTER' || k === '⌫') btn.classList.add('wide');
      btn.addEventListener('click', () => handleKey(k));
      krow.appendChild(btn);
    });
    keyboardEl.appendChild(krow);
  });
}

function updateKeyboardColors(guess, grading) {
  const rank = { gray: 0, gold: 1, green: 2 };
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    if (ch === '=') continue;
    const status = grading[i];
    if (!guessState.keyStatus[ch] || rank[status] > rank[guessState.keyStatus[ch]]) {
      guessState.keyStatus[ch] = status;
    }
  }
}

function refreshKeyboardVisuals() {
  document.querySelectorAll('.key').forEach(btn => {
    const k = btn.dataset.key;
    btn.classList.remove('green', 'gold', 'gray', 'disabled');
    if (mode === 'guess') {
      if (guessState.keyStatus[k]) btn.classList.add(guessState.keyStatus[k]);
    } else {
      if (['+', '-', '*', '/', '='].includes(k)) btn.classList.add('disabled');
    }
  });
  const enterBtn = document.querySelector('.key[data-key="ENTER"]');
  if (enterBtn) enterBtn.textContent = mode === 'guess' ? 'ENTER' : 'VERIFICAR';
}

function handleKey(k) {
  if (k === 'ENTER') {
    mode === 'guess' ? guessSubmit() : targetSubmit();
    return;
  }
  if (k === '⌫') {
    mode === 'guess' ? guessBackspace() : targetBackspace();
    return;
  }
  if (mode === 'target' && !/^[0-9]$/.test(k)) return;
  mode === 'guess' ? guessTypeChar(k) : targetTypeChar(k);
}

function render() {
  boardEl.innerHTML = '';

  if (mode === 'guess') {
    for (let r = 0; r < guessState.maxAttempts; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.id = 'row-' + r;

      if (r < guessState.attempts.length) {
        const { guess, grading } = guessState.attempts[r];
        for (let c = 0; c < guessState.length; c++) {
          const tile = document.createElement('div');
          tile.className = 'tile filled ' + grading[c];
          tile.textContent = guess[c];
          row.appendChild(tile);
        }
      } else if (r === guessState.attempts.length && !guessState.gameOver) {
        for (let c = 0; c < guessState.length; c++) {
          const tile = document.createElement('div');
          const ch = guessState.cells[c];
          tile.className = 'tile editable' + (ch ? ' filled' : '') + (c === guessState.cursor ? ' cursor' : '');
          tile.textContent = ch;
          tile.addEventListener('click', () => { if (busy) return; guessState.cursor = c; render(); });
          row.appendChild(tile);
        }
      } else {
        for (let c = 0; c < guessState.length; c++) {
          const tile = document.createElement('div');
          tile.className = 'tile';
          row.appendChild(tile);
        }
      }
      boardEl.appendChild(row);
    }
    triesEl.textContent = '';
  } else {
    const tLen = targetState.template.length;
    for (let r = 0; r < targetState.maxAttempts; r++) {
      const row = document.createElement('div');
      row.className = 'row';
      row.id = 'row-' + r;

      if (r < targetState.attempts.length) {
        const { values, correct } = targetState.attempts[r];
        for (let c = 0; c < tLen; c++) {
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if (cell.fixed) {
            tile.className = 'tile fixed';
            tile.textContent = cell.char;
          } else {
            tile.className = 'tile filled ' + (correct ? 'green' : 'gray');
            tile.textContent = values[c];
          }
          row.appendChild(tile);
        }
      } else if (r === targetState.attempts.length && !targetState.gameOver) {
        for (let c = 0; c < tLen; c++) {
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if (cell.fixed) {
            tile.className = 'tile fixed';
            tile.textContent = cell.char;
          } else {
            const val = targetState.values[c];
            tile.className = 'tile editable' + (val ? ' filled' : '') + (c === targetState.cursor ? ' cursor' : '');
            tile.textContent = val;
            tile.addEventListener('click', () => { if (busy) return; targetState.cursor = c; render(); });
          }
          row.appendChild(tile);
        }
      } else {
        for (let c = 0; c < tLen; c++) {
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if (cell.fixed) {
            tile.className = 'tile fixed';
            tile.textContent = cell.char;
          } else {
            tile.className = 'tile';
          }
          row.appendChild(tile);
        }
      }
      boardEl.appendChild(row);
    }
    triesEl.textContent = targetState.attempts.length > 0
      ? 'Tentativas: ' + targetState.attempts.length + ' / ' + targetState.maxAttempts
      : '';
  }

  refreshKeyboardVisuals();
}

function switchMode(newMode) {
  if (busy) return;
  mode = newMode;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  subtitleEl.textContent = mode === 'guess'
    ? 'Descubra a equação secreta de 8 caracteres. Verde é posição certa, dourado é caractere certo em outro lugar.'
    : 'O resultado e os operadores já estão dados. Preencha os números que faltam até a conta fechar.';
  setMessage('');
  startCurrentMode();
}

function startCurrentMode() {
  mode === 'guess' ? guessStart() : targetStart();
}

document.getElementById('tab-guess').addEventListener('click', () => switchMode('guess'));
document.getElementById('tab-target').addEventListener('click', () => switchMode('target'));
newGameBtn.addEventListener('click', () => { if (busy) return; setMessage(''); startCurrentMode(); });

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'Enter') { handleKey('ENTER'); return; }
  if (k === 'Backspace') { handleKey('⌫'); return; }
  if (k === 'ArrowLeft') { mode === 'guess' ? guessMoveCursor(-1) : targetMoveCursor(-1); render(); return; }
  if (k === 'ArrowRight') { mode === 'guess' ? guessMoveCursor(1) : targetMoveCursor(1); render(); return; }
  if (/^[0-9]$/.test(k) || ['+', '-', '*', '/', '='].includes(k)) {
    handleKey(k);
  }
});

buildKeyboard();
switchMode('guess');
