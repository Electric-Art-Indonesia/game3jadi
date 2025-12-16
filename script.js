
/* Magical Princess Duel 3x3 — Full logic:
   - 3x3 board, two players X (player) & O (com)
   - Each player may place up to 3 tokens. After both have 3, movement phase starts.
   - Movement: move ONE of your tokens to an adjacent empty cell (8 directions).
   - If moveCount >= 10 and no winner: if center occupied, center becomes empty.
   - Modes: pvp, aiEasy, aiMed, aiHard. COM obeys same rules.
   - Undo, animations, sounds, glitter on win.
*/

const gameEl = document.getElementById('game');
const turnEl = document.getElementById('turn');
const modeSelect = document.getElementById('modeSelect');
const firstSelect = document.getElementById('firstSelect');
const startBtn = document.getElementById('startBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const muteBtn = document.getElementById('muteBtn');
const panel = document.getElementById('panel');
const glitter = document.getElementById('glitter');

const popSound = document.getElementById('popSound');
const slideSound = document.getElementById('slideSound');
const winSound = document.getElementById('winSound');
const bgMusic = document.getElementById('bgMusic');

let muted = false;
let board = Array(9).fill(null); // null or icon
const cuteIcons = ["🐱","🐶","⭐","❤️"];
let playerIcons = { X: null, O: null }; // X = human player, O = opponent (player2 or COM)
let current = 'X'; // 'X' or 'O'
let mode = 'pvp'; // pvp / aiEasy / aiMed / aiHard
let phase = 'placement'; // placement or movement
let placed = { X:0, O:0 };
let selectedPiece = null; // index chosen for move
let moveCount = 0; // counts movement moves only
let history = []; // small snapshots for undo
let gameOver = false;
let aiThinking = false;
let centerOnlyMode = false; 
let lastAIMove = null; 

// neighbors map
const neighbors = {
  0:[1,3,4],        1:[0,2,3,4,5],      2:[1,4,5],
  3:[0,1,4,6,7],    4:[0,1,2,3,5,6,7,8], 5:[1,2,4,7,8],
  6:[3,4,7],        7:[3,4,5,6,8],      8:[4,5,7]
};

// init UI board cells
function createBoardUI(){
  gameEl.innerHTML = '';
  for(let i=0;i<9;i++){
    const c = document.createElement('div');
    c.className = 'cell';
    c.dataset.idx = i;
    c.addEventListener('click', ()=>onCellClick(i));
    gameEl.appendChild(c);
  }
}

// utilities
function playSound(s){
  if(muted) return;
  try { s.currentTime = 0; s.play(); } catch(e){}
}
function snapshot(){
  return {
    board: board.slice(), current, phase, placed: {...placed}, selectedPiece, moveCount, gameOver
  };
}
function pushHistory(){ history.push(snapshot()); if(history.length>12) history.shift(); }
function restoreHistory(){
  if(history.length===0) return;
  const s = history.pop();
  board = s.board; current = s.current; phase = s.phase; placed = s.placed;
  selectedPiece = s.selectedPiece; moveCount = s.moveCount; gameOver = s.gameOver;
  render();
}

// render board UI
function render(){
  for(let i=0;i<9;i++){
    const c = gameEl.children[i];
    c.textContent = board[i] || '';
    c.classList.remove('selected','canmove','move-anim');
    c.style.background = ''; // reset highlight
  }

  // highlight selection and possible moves
  if(phase === 'movement' && selectedPiece !== null){
    const sel = gameEl.children[selectedPiece];
    sel.classList.add('selected');
    neighbors[selectedPiece].forEach(n => {
      if(!board[n]) gameEl.children[n].classList.add('canmove');
    });
  }

  // update turn text
  turnEl.textContent = gameOver ? 'Selesai' : `Giliran: ${current} ${playerIcons[current] || ''} ${phase === 'placement' ? '(letakkan)' : '(geser)'}`;

  // mute button text
  muteBtn.textContent = muted ? '🔇' : '🔈';
}


// check win
function checkWinner(b = board){
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for(const [a,b1,c] of lines){
    if(b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  return null;
}

// cell click handler (human)
function onCellClick(i){
  if(gameOver || aiThinking) return;
  // if mode is COM and current is O and COM mode active -> ignore human click
  if(mode.startsWith('ai') && current === 'O' && mode !== 'pvp') return;

  const myIcon = playerIcons[current];

  // placement phase
  if(phase === 'placement'){
    if(board[i]) return; // occupied
    pushHistory();
    board[i] = myIcon;
    placed[current]++;
    playSound(popSound);
    // check immediate win
    const w = checkWinner();
    if(w){ finishWithWinner(w); return; }
    // if both placed 3 each -> movement
    if(placed.X + placed.O >= 6){
      phase = 'movement';
      selectedPiece = null;
    }
    // switch
    current = (current === 'X') ? 'O' : 'X';
    render();

    // if now COM's turn -> trigger AI
    maybeTriggerAI();
    return;
  }

  // movement phase
    // if no selection yet -> select own piece
    if(selectedPiece === null){
      if(board[i] === myIcon){
    
        // ⛔ jika centerOnlyMode aktif, hanya pion di tengah boleh dipilih
        if(centerOnlyMode && i !== 4) return;
    
        selectedPiece = i;
        render();
      }
      return;
    }

  
  

  // if clicked own piece -> change selection
  if(board[i] === myIcon){
    selectedPiece = i;
    render();
    return;
  }

  // clicked empty cell -> check if neighbor of selectedPiece
  if(!board[i] && neighbors[selectedPiece].includes(i)){
    pushHistory();
    // move with animation
    const sourceIdx = selectedPiece;
    const destIdx = i;
    board[destIdx] = board[sourceIdx];
    board[sourceIdx] = null;
    selectedPiece = null;
    
        if(centerOnlyMode && sourceIdx === 4){
        centerOnlyMode = false;
        moveCount = 0;
        }
    
    moveCount++;
    playSound(slideSound);
        if(moveCount >= 19 && board[4]){
          centerOnlyMode = true;
        }
    // quick animate dest
    gameEl.children[destIdx].classList.add('move-anim');
    render();
    // check winner
    const w = checkWinner();
    if(w){ finishWithWinner(w); return; }



    // switch
    current = (current === 'X') ? 'O' : 'X';
    render();
    maybeTriggerAI();
    return;
  }

  // invalid click -> ignore
}



// game over handling
function finishWithWinner(winnerIcon){
  gameOver = true;
  render();
  // glitter + sparkles
  panel.classList.add('win');
  spawnSparks(14);
  playSound(winSound);
  // highlight winning player's cells slightly (optional)
  setTimeout(()=>{ alert(`🎉 Pemenang: ${winnerIcon}`); }, 10);
}


// spawn sparkle particles (overlay)
function spawnSparks(n=8){
  for(let i=0;i<n;i++){
    const s = document.createElement('div');
    s.className = 'sparkle';
    // random position within panel
    const rect = panel.getBoundingClientRect();
    const left = Math.random() * (rect.width - 20);
    const top = Math.random() * (rect.height - 20);
    s.style.left = `${left}px`;
    s.style.top = `${top}px`;
    panel.appendChild(s);
    // remove after animation
    setTimeout(()=> s.remove(), 900);
  }
}

// reset or start
function startNew(){
  history = [];
  board = Array(9).fill(null);
  placed = { X:0, O:0 };
  selectedPiece = null;
  moveCount = 0;
  gameOver = false;
  panel.classList.remove('win');
  // random icons but ensure different
  const a = cuteIcons[Math.floor(Math.random()*cuteIcons.length)];
  let b = cuteIcons[Math.floor(Math.random()*cuteIcons.length)];
  while(b === a) b = cuteIcons[Math.floor(Math.random()*cuteIcons.length)];
  // assign X always human icon, O is opponent (COM or Player2)
  playerIcons.X = a;
  playerIcons.O = b;

  mode = modeSelect.value;
  current = (firstSelect.value === 'com') ? 'O' : 'X';
  phase = 'placement';
  render();
  maybeTriggerAI();
}

// Undo
undoBtn.addEventListener('click', ()=>{
  restoreHistory();
});

// reset
resetBtn.addEventListener('click', ()=>{
  startNew();
  lastAIMove = null;

});

// mute toggle
muteBtn.addEventListener('click', ()=>{
  muted = !muted;
  if(!muted){
    bgMusic.volume = 0.18;
    try{ bgMusic.play(); }catch(e){}
  } else {
    try{ bgMusic.pause(); }catch(e){}
  }
  render();
});

// start button
startBtn.addEventListener('click', ()=>{
  startNew();
  lastAIMove = null;

});

// ensure board cells present
createBoardUI();
startNew();




// AI integration
function maybeTriggerAI(){
  if(gameOver) return;
  if(!mode.startsWith('ai')) return;
  if(current === 'O'){ // COM's turn
    aiThinking = true;
    // small delay for feel
    setTimeout(()=>{ aiPlay(mode); aiThinking = false; }, 450 + Math.random()*380);
  }
}


function aiPlay(modeStr){
  // if placement phase: choose placement
  if(phase === 'placement'){
    // (TIDAK BERUBAH)
    const myIcon = playerIcons.O;
    for(let i=0;i<9;i++){
      if(!board[i]){
        board[i] = myIcon;
        if(checkWinner(board) === myIcon){
          pushHistory();
          placed.O++;
          playSound(popSound);
          const w = checkWinner();
          if(w) { finishWithWinner(w); return; }
          if(placed.X + placed.O >= 6) phase = 'movement';
          current = 'X';
          render(); return;
        }
        board[i] = null;
      }
    }
    const opp = playerIcons.X;
    for(let i=0;i<9;i++){
      if(!board[i]){
        board[i] = opp;
        if(checkWinner(board) === opp){
          board[i] = myIcon;
          pushHistory();
          placed.O++;
          playSound(popSound);
          if(placed.X + placed.O >= 6) phase = 'movement';
          current = 'X';
          render(); return;
        }
        board[i] = null;
      }
    }

    // difficulty placement (unchanged)
    if(modeStr === 'aiEasy'){
      const empties = board.map((v,i)=> v?null:i).filter(x=>x!==null);
      const pick = empties[Math.floor(Math.random()*empties.length)];
      pushHistory(); board[pick] = myIcon; placed.O++; playSound(popSound);
      if(placed.X + placed.O >= 6) phase = 'movement';
      current = 'X'; render(); return;
    } 
    else if(modeStr === 'aiMed'){
      let pick = null;
      if(!board[4]) pick = 4;
      const corners = [0,2,6,8].filter(i=> !board[i]);
      if(!pick && corners.length>0) pick = corners[Math.floor(Math.random()*corners.length)];
      if(!pick){
        const empties = board.map((v,i)=> v?null:i).filter(x=>x!==null);
        pick = empties[Math.floor(Math.random()*empties.length)];
      }
      pushHistory(); board[pick]=myIcon; placed.O++; playSound(popSound);
      if(placed.X + placed.O >= 6) phase='movement';
      current='X'; render(); return;
    } 
    else {
      const pick = minimaxPlacement(playerIcons.O, 6);
      pushHistory(); board[pick] = myIcon; placed.O++; playSound(popSound);
      if(placed.X + placed.O >= 6) phase='movement';
      current='X'; render(); return;
    }
  } 

  // ================= MOVEMENT PHASE =================
  else {
    const myIcon = playerIcons.O;
    let moves = collectAllMovesFor(myIcon, board);
            if (lastAIMove) {
          moves = moves.filter(m =>
            !(m.from === lastAIMove.to && m.to === lastAIMove.from)
          );
        }

        const centerOwner = ownerOfCenter();
            if(moveCount >= 19 && centerOwner === current){
              // jika player klik pion BUKAN tengah → ignore
              if(selectedPiece !== null && selectedPiece !== 4) return;
            }


    if(moves.length === 0){
      current = 'X'; render(); return;
    }

    // 🔁 helper kecil untuk CENTER RULE
         function afterAIMove(from){
          const centerOwner = ownerOfCenter();
        
          // jika AI adalah pemilik pion tengah & sudah >=20 langkah
          if(centerOwner === 'O' && from === 4){
            // AI menggeser pion tengah
            moveCount = 0;
          }
        }


    // ===== immediate win =====
    for(const m of moves){
      const nb = board.slice(); nb[m.to] = nb[m.from]; nb[m.from] = null;
      if(checkWinner(nb) === myIcon){
        pushHistory();
        board[m.to] = board[m.from];
        board[m.from] = null;
        moveCount++;
        lastAIMove = { from: m.from, to: m.to };

        playSound(slideSound);
        gameEl.children[m.to].classList.add('move-anim');

        afterAIMove(m.from);

        render();
        finishWithWinner(myIcon);
        return;
      }
    }

    // ===== block opponent =====
    const oppIcon = playerIcons.X;
    for(const m of moves){
      const nb = board.slice(); nb[m.to] = nb[m.from]; nb[m.from] = null;
      const oppMoves = collectAllMovesFor(oppIcon, nb);
      let bad = false;
      for(const om of oppMoves){
        const nb2 = nb.slice(); nb2[om.to] = nb2[om.from]; nb2[om.from] = null;
        if(checkWinner(nb2) === oppIcon){ bad = true; break; }
      }
      if(!bad){
        pushHistory();
        board[m.to] = board[m.from];
        lastAIMove = { from: m.from, to: m.to };

        board[m.from] = null;
        moveCount++;
        playSound(slideSound);
        gameEl.children[m.to].classList.add('move-anim');

        afterAIMove(m.from);

        render(); current='X'; return;
      }
    }

    // ===== fallback =====
    const m = moves[Math.floor(Math.random()*moves.length)];
    pushHistory();
    board[m.to] = board[m.from];
    board[m.from] = null;
    moveCount++;
    lastAIMove = { from: m.from, to: m.to };

    playSound(slideSound);
    gameEl.children[m.to].classList.add('move-anim');

    afterAIMove(m.from);

    render(); current='X'; return;
  }
}






// helpers: collect movement moves for icon on given board
function collectAllMovesFor(icon, b){
  const res=[];
  for(let i=0;i<9;i++){
    if(b[i] === icon){
      for(const n of neighbors[i]){
        if(!b[n]) res.push({from:i,to:n});
      }
    }
  }
  return res;
}

function ownerOfCenter(){
  if(!board[4]) return null;
  if(board[4] === playerIcons.X) return 'X';
  if(board[4] === playerIcons.O) return 'O';
  return null;
}


// heuristic score (simple)
function heuristicScore(b, icon){
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  let score = 0;
  if(b[4] === icon) score += 30;
  for(const ln of lines){
    const vals = ln.map(i=>b[i]);
    const cnt = vals.filter(v=>v===icon).length;
    const oppcnt = vals.filter(v=>v && v !== icon).length;
    if(cnt>0 && oppcnt===0){
      score += (cnt===2) ? 70 : 10;
    }
  }
  return score;
}


// minimax for placement (small depth)
function minimaxPlacement(icon, depth){
  const opp = icon === playerIcons.X ? playerIcons.O : playerIcons.X;
  function evalBoard(b){
    const w = checkWinner(b);
    if(w === icon) return 1000;
    if(w === opp) return -1000;
    return heuristicScore(b, icon) - heuristicScore(b, opp);
  }
  let bestScore = -Infinity; let bestMove = null;
  for(let i=0;i<9;i++){
    if(!board[i]){
      const nb = board.slice(); nb[i] = icon;
      const sc = minimaxPlaceRec(nb, depth-1, false);
      if(sc > bestScore){ bestScore=sc; bestMove=i; }
    }
  }
  if(bestMove === null){
    // fallback center or random
    if(!board[4]) return 4;
    const empties = board.map((v,i)=> v?null:i).filter(x=>x!==null);
    return empties[Math.floor(Math.random()*empties.length)];
  }
  return bestMove;

  function minimaxPlaceRec(b, d, maximize){
    const w = checkWinner(b); if(w) return (w===icon)?1000:-1000;
    if(d<=0) return evalBoard(b);
    const empties = b.map((v,i)=> v?null:i).filter(x=>x!==null);
    if(empties.length===0) return evalBoard(b);
    if(maximize){
      let v = -Infinity;
      for(const e of empties){
        const nb = b.slice(); nb[e] = icon;
        v = Math.max(v, minimaxPlaceRec(nb, d-1, false));
      }
      return v;
    } else {
      let v = Infinity;
      for(const e of empties){
        const nb = b.slice(); nb[e] = opp;
        v = Math.min(v, minimaxPlaceRec(nb, d-1, true));
      }
      return v;
    }
  }
}

// minimax for movement (returns {from,to})
function minimaxMovement(bstate, playerLetter, maxDepth){
  const myIcon = playerIcons.O; // hard-coded since we call for O
  const oppIcon = playerIcons.X;
  function evalB(b){
    const w = checkWinner(b);
    if(w === myIcon) return 1000;
    if(w === oppIcon) return -1000;
    return heuristicScore(b,myIcon) - heuristicScore(b,oppIcon);
  }


  function generateMoves(b, whoIcon){
    // movement phase only
    const res=[];
    for(let i=0;i<9;i++){
      if(b[i] === whoIcon){
        for(const n of neighbors[i]){
          if(!b[n]) res.push({from:i,to:n});
        }
      }
    }
    return res;
  }

  function ab(b, depth, alpha, beta, maximizing){
    const w = checkWinner(b);
    if(w) return (w===myIcon)?1000:-1000;
    if(depth===0) return evalB(b);
    const moves = generateMoves(b, maximizing?myIcon:oppIcon);
    if(moves.length===0) return evalB(b);
    if(maximizing){
      let value = -Infinity;
      for(const m of moves){
        const nb = b.slice(); nb[m.to] = nb[m.from]; nb[m.from] = null;
        value = Math.max(value, ab(nb, depth-1, alpha, beta, false));
        alpha = Math.max(alpha, value);
        if(alpha >= beta) break;
      }
      return value;
    } else {
      let value = Infinity;
      for(const m of moves){
        const nb = b.slice(); nb[m.to] = nb[m.from]; nb[m.from] = null;
        value = Math.min(value, ab(nb, depth-1, alpha, beta, true));
        beta = Math.min(beta, value);
        if(alpha >= beta) break;
      }
      return value;
    }
  }

  // try each move and evaluate
  const moves = generateMoves(bstate, myIcon);
  let best = null; let bestScore = -Infinity;
  for(const m of moves){
    const nb = bstate.slice(); nb[m.to] = nb[m.from]; nb[m.from] = null;
    const score = ab(nb, maxDepth-1, -Infinity, Infinity, false);
    if(score > bestScore){ bestScore = score; best = m; }
  }
  return best;
}

// event listeners for keyboard hints (optional)
document.addEventListener('keydown', (e)=>{
  if(e.key === 'm'){ muted = !muted; muteBtn.click(); }
});

// initial music
bgMusic.volume = 0.18;
bgMusic.loop = true;
try{ bgMusic.play(); }catch(e){}

/* END SCRIPT */

