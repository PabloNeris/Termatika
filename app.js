/* ---------------- Estado ---------------- */
let mode = 'guess';
let busy = false; // trava input enquanto uma requisição está em andamento

const guessState = {
  token: null,
  length: 8,
  maxAttempts: 6,
  cells: [],
  cursor: 0,
  attempts: [],   // {guess, grading}
  gameOver: true, // começa travado até a primeira resposta da API chegar
  keyStatus: {}
};

const targetState = {
  token: null,
  template: [],   // [{fixed, char?}]
  maxAttempts: 6,
  values: [],
  cursor: 0,
  attempts: [],   // {values, correct}
  gameOver: true
};

const boardEl = document.getElementById('board');
const messageEl = document.getElementById('message');
const triesEl = document.getElementById('tries');
const keyboardEl = document.getElementById('keyboard');
const subtitleEl = document.getElementById('subtitle');
const newGameBtn = document.getElementById('newgame');

function setMessage(text){ messageEl.textContent = text; }

/* ---------------- Chamadas à API ---------------- */
async function apiPost(path, body){
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  let data = null;
  try { data = await res.json(); } catch(e) { /* corpo vazio ou inválido */ }
  if(!res.ok){
    throw new Error((data && data.error) || 'Erro de comunicação com o servidor.');
  }
  return data;
}

/* ---------------- Modo: Adivinhar ---------------- */
async function guessStart(){
  guessState.attempts = [];
  guessState.gameOver = true; // trava enquanto carrega
  guessState.cells = new Array(guessState.length).fill('');
  guessState.cursor = 0;
  guessState.keyStatus = {};
  setMessage('Carregando novo jogo...');
  render();

  busy = true;
  try{
    const data = await apiPost('/api/guess/new', {});
    guessState.token = data.token;
    guessState.length = data.length;
    guessState.maxAttempts = data.maxAttempts;
    guessState.cells = new Array(data.length).fill('');
    guessState.gameOver = false;
    setMessage('');
  }catch(e){
    setMessage('Não consegui iniciar o jogo: ' + e.message);
  }
  busy = false;
  render();
}

function guessMoveCursor(delta){
  guessState.cursor = Math.min(guessState.length-1, Math.max(0, guessState.cursor + delta));
}

function guessTypeChar(ch){
  if(guessState.gameOver || busy) return;
  guessState.cells[guessState.cursor] = ch;
  if(guessState.cursor < guessState.length - 1) guessState.cursor++;
  render();
}

function guessBackspace(){
  if(guessState.gameOver || busy) return;
  if(guessState.cells[guessState.cursor] !== ''){
    guessState.cells[guessState.cursor] = '';
  } else if(guessState.cursor > 0){
    guessState.cursor--;
    guessState.cells[guessState.cursor] = '';
  }
  render();
}

async function guessSubmit(){
  if(guessState.gameOver || busy) return;
  if(guessState.cells.includes('')){
    setMessage('Preencha todas as casas.');
    shakeCurrentRow();
    return;
  }
  const guess = guessState.cells.join('');

  busy = true;
  setMessage('Conferindo...');
  render();
  try{
    const data = await apiPost('/api/guess/guess', { token: guessState.token, guess });
    guessState.token = data.token;
    guessState.attempts.push({ guess, grading: data.grading });
    updateKeyboardColors(guess, data.grading);
    guessState.gameOver = data.gameOver;

    if(data.correct){
      setMessage('Isso aí! Você acertou em ' + data.attempts + (data.attempts===1 ? ' tentativa.' : ' tentativas.'));
    } else if(data.gameOver){
      setMessage('Não foi dessa vez. Era: ' + data.target);
    } else {
      setMessage('');
    }
    guessState.cells = new Array(guessState.length).fill('');
    guessState.cursor = 0;
  }catch(e){
    setMessage(e.message);
    shakeCurrentRow();
  }
  busy = false;
  render();
}

/* ---------------- Modo: Resultado ---------------- */
async function targetStart(){
  targetState.attempts = [];
  targetState.gameOver = true; // trava enquanto carrega
  setMessage('Carregando novo desafio...');
  render();

  busy = true;
  try{
    const data = await apiPost('/api/target/new', {});
    targetState.token = data.token;
    targetState.template = data.template;
    targetState.maxAttempts = data.maxAttempts;
    targetState.values = data.template.map(() => '');
    targetState.cursor = targetState.template.findIndex(c => !c.fixed);
    if(targetState.cursor === -1) targetState.cursor = 0;
    targetState.gameOver = false;
    setMessage('');
  }catch(e){
    setMessage('Não consegui iniciar o desafio: ' + e.message);
  }
  busy = false;
  render();
}

function targetFirstBlank(from){
  const n = targetState.template.length;
  for(let i=from; i<n; i++) if(!targetState.template[i].fixed) return i;
  for(let i=0; i<from; i++) if(!targetState.template[i].fixed) return i;
  return from;
}
function targetPrevBlank(from){
  for(let i=from-1; i>=0; i--) if(!targetState.template[i].fixed) return i;
  for(let i=targetState.template.length-1; i>from; i--) if(!targetState.template[i].fixed) return i;
  return from;
}

function targetMoveCursor(delta){
  targetState.cursor = delta > 0
    ? targetFirstBlank(targetState.cursor+1)
    : targetPrevBlank(targetState.cursor);
}

function targetTypeChar(ch){
  if(targetState.gameOver || busy) return;
  if(!/^[0-9]$/.test(ch)) return;
  if(targetState.template[targetState.cursor].fixed) return;
  targetState.values[targetState.cursor] = ch;
  targetState.cursor = targetFirstBlank(targetState.cursor+1);
  render();
}

function targetBackspace(){
  if(targetState.gameOver || busy) return;
  if(targetState.values[targetState.cursor] !== ''){
    targetState.values[targetState.cursor] = '';
  } else {
    targetState.cursor = targetPrevBlank(targetState.cursor);
    targetState.values[targetState.cursor] = '';
  }
  render();
}

async function targetSubmit(){
  if(targetState.gameOver || busy) return;
  const hasEmpty = targetState.template.some((c,i) => !c.fixed && targetState.values[i] === '');
  if(hasEmpty){
    setMessage('Preencha todos os espaços em branco.');
    shakeCurrentRow();
    return;
  }

  busy = true;
  setMessage('Conferindo...');
  render();
  try{
    const data = await apiPost('/api/target/check', { token: targetState.token, values: targetState.values });
    targetState.token = data.token;
    targetState.attempts.push({ values: targetState.values.slice(), correct: data.correct });
    targetState.gameOver = data.gameOver;

    if(data.correct){
      setMessage('Fechou! ' + data.equation + ' — resolvido em ' + data.attempts + (data.attempts===1 ? ' tentativa.' : ' tentativas.'));
    } else if(data.gameOver){
      setMessage('Não fechou em ' + targetState.maxAttempts + ' tentativas. Uma solução possível: ' + data.solutionExample);
    } else {
      setMessage('Ainda não bate. Próxima tentativa.');
    }
    targetState.values = targetState.template.map(() => '');
    targetState.cursor = targetState.template.findIndex(c => !c.fixed);
    if(targetState.cursor === -1) targetState.cursor = 0;
  }catch(e){
    setMessage(e.message);
    shakeCurrentRow();
  }
  busy = false;
  render();
}

/* ---------------- UI compartilhada ---------------- */
function shakeCurrentRow(){
  const rowIdx = mode === 'guess' ? guessState.attempts.length : targetState.attempts.length;
  const row = document.getElementById('row-' + rowIdx);
  if(!row) return;
  row.querySelectorAll('.tile').forEach(t => {
    t.classList.remove('shake');
    void t.offsetWidth;
    t.classList.add('shake');
  });
}

const KEY_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['+','-','*','/','='],
  ['ENTER','⌫']
];

function buildKeyboard(){
  keyboardEl.innerHTML = '';
  KEY_ROWS.forEach(rowKeys => {
    const krow = document.createElement('div');
    krow.className = 'krow';
    rowKeys.forEach(k => {
      const btn = document.createElement('button');
      btn.className = 'key';
      btn.textContent = k;
      btn.dataset.key = k;
      if(k === 'ENTER' || k === '⌫') btn.classList.add('wide');
      btn.addEventListener('click', () => handleKey(k));
      krow.appendChild(btn);
    });
    keyboardEl.appendChild(krow);
  });
}

function updateKeyboardColors(guess, grading){
  const rank = {gray:0, gold:1, green:2};
  for(let i=0;i<guess.length;i++){
    const ch = guess[i];
    if(ch === '=') continue;
    const status = grading[i];
    if(!guessState.keyStatus[ch] || rank[status] > rank[guessState.keyStatus[ch]]){
      guessState.keyStatus[ch] = status;
    }
  }
}

function refreshKeyboardVisuals(){
  document.querySelectorAll('.key').forEach(btn => {
    const k = btn.dataset.key;
    btn.classList.remove('green','gold','gray','disabled');
    if(mode === 'guess'){
      if(guessState.keyStatus[k]) btn.classList.add(guessState.keyStatus[k]);
    } else {
      if(['+','-','*','/','='].includes(k)) btn.classList.add('disabled');
    }
  });
  const enterBtn = document.querySelector('.key[data-key="ENTER"]');
  if(enterBtn) enterBtn.textContent = mode === 'guess' ? 'ENTER' : 'VERIFICAR';
}

function handleKey(k){
  if(k === 'ENTER'){
    mode === 'guess' ? guessSubmit() : targetSubmit();
    return;
  }
  if(k === '⌫'){
    mode === 'guess' ? guessBackspace() : targetBackspace();
    return;
  }
  if(mode === 'target' && !/^[0-9]$/.test(k)) return;
  mode === 'guess' ? guessTypeChar(k) : targetTypeChar(k);
}

function render(){
  boardEl.innerHTML = '';

  if(mode === 'guess'){
    for(let r=0; r<guessState.maxAttempts; r++){
      const row = document.createElement('div');
      row.className = 'row';
      row.id = 'row-' + r;

      if(r < guessState.attempts.length){
        const {guess, grading} = guessState.attempts[r];
        for(let c=0; c<guessState.length; c++){
          const tile = document.createElement('div');
          tile.className = 'tile filled ' + grading[c];
          tile.textContent = guess[c];
          row.appendChild(tile);
        }
      } else if(r === guessState.attempts.length && !guessState.gameOver){
        for(let c=0; c<guessState.length; c++){
          const tile = document.createElement('div');
          const ch = guessState.cells[c];
          tile.className = 'tile editable' + (ch ? ' filled' : '') + (c === guessState.cursor ? ' cursor' : '');
          tile.textContent = ch;
          tile.addEventListener('click', () => { if(busy) return; guessState.cursor = c; render(); });
          row.appendChild(tile);
        }
      } else {
        for(let c=0; c<guessState.length; c++){
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
    for(let r=0; r<targetState.maxAttempts; r++){
      const row = document.createElement('div');
      row.className = 'row';
      row.id = 'row-' + r;

      if(r < targetState.attempts.length){
        const {values, correct} = targetState.attempts[r];
        for(let c=0; c<tLen; c++){
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if(cell.fixed){
            tile.className = 'tile fixed';
            tile.textContent = cell.char;
          } else {
            tile.className = 'tile filled ' + (correct ? 'green' : 'gray');
            tile.textContent = values[c];
          }
          row.appendChild(tile);
        }
      } else if(r === targetState.attempts.length && !targetState.gameOver){
        for(let c=0; c<tLen; c++){
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if(cell.fixed){
            tile.className = 'tile fixed';
            tile.textContent = cell.char;
          } else {
            const val = targetState.values[c];
            tile.className = 'tile editable' + (val ? ' filled' : '') + (c === targetState.cursor ? ' cursor' : '');
            tile.textContent = val;
            tile.addEventListener('click', () => { if(busy) return; targetState.cursor = c; render(); });
          }
          row.appendChild(tile);
        }
      } else {
        for(let c=0; c<tLen; c++){
          const cell = targetState.template[c];
          const tile = document.createElement('div');
          if(cell.fixed){
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

function switchMode(newMode){
  if(busy) return;
  mode = newMode;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  subtitleEl.textContent = mode === 'guess'
    ? 'Descubra a equação secreta de 8 caracteres. Verde é posição certa, dourado é caractere certo em outro lugar.'
    : 'O resultado e os operadores já estão dados. Preencha os números que faltam até a conta fechar.';
  setMessage('');
  startCurrentMode();
}

function startCurrentMode(){
  mode === 'guess' ? guessStart() : targetStart();
}

document.getElementById('tab-guess').addEventListener('click', () => switchMode('guess'));
document.getElementById('tab-target').addEventListener('click', () => switchMode('target'));
newGameBtn.addEventListener('click', () => { if(busy) return; setMessage(''); startCurrentMode(); });

document.addEventListener('keydown', (e) => {
  const k = e.key;
  if(k === 'Enter'){ handleKey('ENTER'); return; }
  if(k === 'Backspace'){ handleKey('⌫'); return; }
  if(k === 'ArrowLeft'){ mode === 'guess' ? guessMoveCursor(-1) : targetMoveCursor(-1); render(); return; }
  if(k === 'ArrowRight'){ mode === 'guess' ? guessMoveCursor(1) : targetMoveCursor(1); render(); return; }
  if(/^[0-9]$/.test(k) || ['+','-','*','/','='].includes(k)){
    handleKey(k);
  }
});

buildKeyboard();
switchMode('guess');
