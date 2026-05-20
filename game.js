// ============================================================
//  TETRIS  —  game.js
//  12 unique pieces, each with its own colour
//  Drop this file next to index.html on your website
// ============================================================

(function () {
  "use strict";

  // ── Grid dimensions ────────────────────────────────────
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30; // px per cell

  // ── All 12 pieces ──────────────────────────────────────
  // Standard 7 Tetrominoes + 5 bonus pentomino-inspired pieces
  const PIECES = {

    // ── Standard 7 ──
    I: {
      color: "#00d4f0",   // cyan
      glow:  "rgba(0,212,240,0.5)",
      matrix: [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
      ]
    },
    O: {
      color: "#f5c518",   // yellow
      glow:  "rgba(245,197,24,0.5)",
      matrix: [
        [1,1],
        [1,1]
      ]
    },
    T: {
      color: "#c44dff",   // purple
      glow:  "rgba(196,77,255,0.5)",
      matrix: [
        [0,1,0],
        [1,1,1],
        [0,0,0]
      ]
    },
    S: {
      color: "#33dd77",   // green
      glow:  "rgba(51,221,119,0.5)",
      matrix: [
        [0,1,1],
        [1,1,0],
        [0,0,0]
      ]
    },
    Z: {
      color: "#ff4455",   // red
      glow:  "rgba(255,68,85,0.5)",
      matrix: [
        [1,1,0],
        [0,1,1],
        [0,0,0]
      ]
    },
    J: {
      color: "#4488ff",   // blue
      glow:  "rgba(68,136,255,0.5)",
      matrix: [
        [1,0,0],
        [1,1,1],
        [0,0,0]
      ]
    },
    L: {
      color: "#ff8833",   // orange
      glow:  "rgba(255,136,51,0.5)",
      matrix: [
        [0,0,1],
        [1,1,1],
        [0,0,0]
      ]
    },

    // ── Bonus 5 (pentomino-inspired, 3×3 bounding box) ──
    U: {
      color: "#ff69b4",   // hot pink
      glow:  "rgba(255,105,180,0.5)",
      matrix: [
        [1,0,1],
        [1,1,1],
        [0,0,0]
      ]
    },
    P: {
      color: "#00ffcc",   // mint
      glow:  "rgba(0,255,204,0.5)",
      matrix: [
        [1,1,0],
        [1,1,0],
        [1,0,0]
      ]
    },
    F: {
      color: "#ffd700",   // gold
      glow:  "rgba(255,215,0,0.5)",
      matrix: [
        [0,1,1],
        [1,1,0],
        [0,1,0]
      ]
    },
    Y: {
      color: "#e040fb",   // magenta
      glow:  "rgba(224,64,251,0.5)",
      matrix: [
        [0,1],
        [1,1],
        [0,1],
        [0,1]
      ]
    },
    N: {
      color: "#40c4ff",   // sky blue
      glow:  "rgba(64,196,255,0.5)",
      matrix: [
        [0,1],
        [1,1],
        [1,0],
        [1,0]
      ]
    }
  };

  const PIECE_KEYS = Object.keys(PIECES);

  // Scoring: points per lines cleared × level
  const LINE_SCORES = [0, 100, 300, 500, 800];

  // Drop interval (ms) per level
  const SPEEDS = [900, 800, 680, 560, 440, 340, 260, 200, 150, 110, 80];

  // SRS wall-kick data (for non-I pieces)
  const KICKS = [
    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]]
  ];
  // SRS wall-kick data for I piece
  const KICKS_I = [
    [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    [[0,0],[1,0],[-2,0],[1,-2],[-2,1]]
  ];

  // ── Canvas references ──────────────────────────────────
  const canvas   = document.getElementById("gameCanvas");
  const ctx      = canvas.getContext("2d");
  const nextCvs  = document.getElementById("nextCanvas");
  const nCtx     = nextCvs.getContext("2d");
  const holdCvs  = document.getElementById("holdCanvas");
  const hCtx     = holdCvs.getContext("2d");
  const gameWrap = document.getElementById("gameWrap");

  // ── Game state ─────────────────────────────────────────
  let board, piece, nextPiece, heldType, canHold;
  let score, lines, level, best;
  let running, paused, rotIndex;
  let dropAccum, dropInterval, rafId, lastTs;

  best = Number(localStorage.getItem("tetris_best") || 0);
  document.getElementById("bestVal").textContent = best;

  // ── Utility functions ──────────────────────────────────

  function newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function cloneMatrix(m) {
    return m.map(r => [...r]);
  }

  function randomKey() {
    return PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  }

  function spawnPiece(type) {
    const m = cloneMatrix(PIECES[type].matrix);
    return {
      type,
      matrix: m,
      x: Math.floor(COLS / 2) - Math.floor(m[0].length / 2),
      y: 0
    };
  }

  // Rotate matrix clockwise
  function rotateCW(matrix) {
    const n = matrix.length;
    return matrix[0].map((_, c) =>
      matrix.map((_, r) => matrix[n - 1 - r][c])
    );
  }

  // Rotate matrix counter-clockwise
  function rotateCCW(matrix) {
    const n = matrix.length;
    return matrix[0].map((_, c) =>
      matrix.map((_, r) => matrix[r][n - 1 - c])
    );
  }

  // Check if a position+matrix is valid on the board
  function isValid(p, dx, dy, mat) {
    const m = mat || p.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const nx = p.x + c + dx;
        const ny = p.y + r + dy;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && board[ny][nx]) return false;
      }
    }
    return true;
  }

  // Calculate the ghost (shadow) Y position
  function ghostRow() {
    let dy = 0;
    while (isValid(piece, 0, dy + 1)) dy++;
    return piece.y + dy;
  }

  // ── Rotation with SRS wall kicks ──────────────────────

  function tryRotate(dir) {
    const newMat = dir === 1 ? rotateCW(piece.matrix) : rotateCCW(piece.matrix);
    const table  = piece.type === "I" ? KICKS_I : KICKS;
    const from   = rotIndex % 4;
    const to     = (rotIndex + (dir === 1 ? 1 : 3)) % 4;
    const kicks  = dir === 1
      ? table[from]
      : table[to].map(([x, y]) => [-x, -y]);

    for (const [dx, dy] of kicks) {
      if (isValid(piece, dx, dy, newMat)) {
        piece.matrix  = newMat;
        piece.x      += dx;
        piece.y      += dy;
        rotIndex      = to;
        return;
      }
    }
  }

  // ── Locking & line clears ──────────────────────────────

  function lockPiece() {
    // Write piece into the board
    piece.matrix.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) {
          board[piece.y + r][piece.x + c] = piece.type;
        }
      });
    });

    clearLines();

    // Advance pieces
    piece     = nextPiece;
    nextPiece = spawnPiece(randomKey());
    canHold   = true;
    rotIndex  = 0;

    drawMini(nCtx, nextPiece.type);

    // Check top-out (game over)
    if (!isValid(piece, 0, 0)) {
      endGame();
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(v => v !== null)) {
        flashRow(r);
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        r++; // recheck same index after splice
      }
    }
    if (!cleared) return;

    score        += LINE_SCORES[Math.min(cleared, 4)] * level;
    lines        += cleared;
    level         = Math.min(Math.floor(lines / 10) + 1, SPEEDS.length);
    dropInterval  = SPEEDS[level - 1];
    updateHUD();
  }

  function flashRow(row) {
    const div = document.createElement("div");
    div.className   = "line-fx";
    div.style.top   = row * CELL + "px";
    gameWrap.appendChild(div);
    setTimeout(() => div.remove(), 320);
  }

  // ── Hold ───────────────────────────────────────────────

  function holdPiece() {
    if (!canHold) return;
    canHold = false;

    if (heldType === null) {
      heldType  = piece.type;
      piece     = nextPiece;
      nextPiece = spawnPiece(randomKey());
      drawMini(nCtx, nextPiece.type);
    } else {
      const swap = heldType;
      heldType   = piece.type;
      piece      = spawnPiece(swap);
      rotIndex   = 0;
    }
    drawMini(hCtx, heldType);
  }

  // ── Hard drop ─────────────────────────────────────────

  function hardDrop() {
    let dy = 0;
    while (isValid(piece, 0, dy + 1)) dy++;
    piece.y  += dy;
    score    += dy * 2;
    updateHUD();
    lockPiece();
  }

  // ── Game loop ──────────────────────────────────────────

  function gameLoop(ts) {
    if (!running) return;

    const elapsed = ts - lastTs;
    lastTs = ts;

    if (!paused) {
      dropAccum += elapsed;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (isValid(piece, 0, 1)) {
          piece.y++;
        } else {
          lockPiece();
        }
      }
      draw();
    }

    rafId = requestAnimationFrame(gameLoop);
  }

  // ── Start / End / Pause ───────────────────────────────

  function startGame() {
    board        = newBoard();
    piece        = spawnPiece(randomKey());
    nextPiece    = spawnPiece(randomKey());
    heldType     = null;
    canHold      = true;
    rotIndex     = 0;
    score        = 0;
    lines        = 0;
    level        = 1;
    dropInterval = SPEEDS[0];
    dropAccum    = 0;
    running      = true;
    paused       = false;

    document.getElementById("overlay").style.display    = "none";
    document.getElementById("finalScore").style.display = "none";
    updateHUD();
    drawMini(nCtx, nextPiece.type);
    clearMini(hCtx);

    cancelAnimationFrame(rafId);
    rafId  = requestAnimationFrame(ts => { lastTs = ts; gameLoop(ts); });
  }

  function endGame() {
    running = false;
    cancelAnimationFrame(rafId);

    if (score > best) {
      best = score;
      localStorage.setItem("tetris_best", best);
      document.getElementById("bestVal").textContent = best;
    }

    const fs = document.getElementById("finalScore");
    document.getElementById("overlayTitle").textContent  = "GAME OVER";
    document.getElementById("overlayInfo").innerHTML     =
      "Lines cleared: " + lines + "<br>Level reached: " + level;
    fs.textContent    = score;
    fs.style.display  = "block";
    document.getElementById("actionBtn").textContent     = "PLAY AGAIN";
    document.getElementById("overlay").style.display     = "flex";
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;

    if (paused) {
      cancelAnimationFrame(rafId);
      document.getElementById("overlayTitle").textContent  = "PAUSED";
      document.getElementById("overlayInfo").textContent   = "Press P to resume";
      document.getElementById("finalScore").style.display  = "none";
      document.getElementById("actionBtn").textContent     = "RESUME";
      document.getElementById("overlay").style.display     = "flex";
    } else {
      document.getElementById("overlay").style.display = "none";
      rafId = requestAnimationFrame(ts => { lastTs = ts; gameLoop(ts); });
    }
  }

  // ── HUD ───────────────────────────────────────────────

  function updateHUD() {
    document.getElementById("scoreVal").textContent = score;
    document.getElementById("linesVal").textContent = lines;
    document.getElementById("levelVal").textContent = level;
    if (score > best) {
      document.getElementById("bestVal").textContent = score;
    }
  }

  // ── Drawing ───────────────────────────────────────────

  // Draw a single locked/active cell at grid position (col, row) in pixels
  function drawCell(context, px, py, type, alpha) {
    const p = PIECES[type];
    context.save();
    context.globalAlpha = alpha !== undefined ? alpha : 1;

    // Dark background
    context.fillStyle = "#05060d";
    context.fillRect(px, py, CELL, CELL);

    // Glow
    context.shadowColor = p.glow;
    context.shadowBlur  = 10;

    // Main fill
    context.fillStyle = p.color;
    context.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);

    context.shadowBlur = 0;

    // Highlight (top-left bevel)
    context.fillStyle = "rgba(255,255,255,0.20)";
    context.fillRect(px + 1, py + 1, CELL - 2, 4);
    context.fillRect(px + 1, py + 1, 4, CELL - 2);

    // Shadow (bottom-right bevel)
    context.fillStyle = "rgba(0,0,0,0.28)";
    context.fillRect(px + 1,        py + CELL - 4, CELL - 2, 3);
    context.fillRect(px + CELL - 4, py + 1,        3,        CELL - 4);

    context.restore();
  }

  // Main board render
  function draw() {
    // Background
    ctx.fillStyle = "#05060d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth   = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0,            r * CELL);
      ctx.lineTo(canvas.width, r * CELL);
      ctx.stroke();
    }

    // Locked cells
    board.forEach((row, r) => {
      row.forEach((type, c) => {
        if (type) drawCell(ctx, c * CELL, r * CELL, type);
      });
    });

    if (!piece) return;

    // Ghost piece
    const gy = ghostRow();
    piece.matrix.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const ghostY = gy + r;
        if (ghostY < 0) return;
        // Only draw ghost if it's below the actual piece
        if (ghostY > piece.y + r) {
          ctx.save();
          ctx.globalAlpha   = 0.17;
          ctx.strokeStyle   = PIECES[piece.type].color;
          ctx.lineWidth     = 1.5;
          ctx.strokeRect(
            (piece.x + c) * CELL + 2,
            ghostY * CELL + 2,
            CELL - 4,
            CELL - 4
          );
          ctx.restore();
        }
      });
    });

    // Active piece
    piece.matrix.forEach((row, r) => {
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) {
          drawCell(ctx, (piece.x + c) * CELL, (piece.y + r) * CELL, piece.type);
        }
      });
    });
  }

  // Draw a piece preview in a mini canvas (Next / Hold)
  function drawMini(context, type) {
    const W = context.canvas.width;
    const H = context.canvas.height;
    context.fillStyle = "#05060d";
    context.fillRect(0, 0, W, H);
    if (!type) return;

    const m    = PIECES[type].matrix;
    const size = 22; // cell size for preview
    const cols = m[0].length;
    const rows = m.length;
    const ox   = Math.floor((W - cols * size) / 2);
    const oy   = Math.floor((H - rows * size) / 2);

    m.forEach((row, r) => {
      row.forEach((v, c) => {
        if (!v) return;
        const px = ox + c * size;
        const py = oy + r * size;

        context.save();
        context.shadowColor = PIECES[type].glow;
        context.shadowBlur  = 7;
        context.fillStyle   = PIECES[type].color;
        context.fillRect(px + 1, py + 1, size - 2, size - 2);
        context.shadowBlur  = 0;
        context.fillStyle   = "rgba(255,255,255,0.18)";
        context.fillRect(px + 1, py + 1, size - 2, 3);
        context.fillRect(px + 1, py + 1, 3, size - 2);
        context.restore();
      });
    });
  }

  function clearMini(context) {
    context.fillStyle = "#05060d";
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }

  // ── Keyboard input ────────────────────────────────────

  document.addEventListener("keydown", function (e) {
    // Allow start/resume even when not running
    if (e.code === "Enter") { if (!running || paused) document.getElementById("actionBtn").click(); return; }
    if (e.code === "KeyP")  { togglePause(); return; }
    if (!running || paused) return;

    switch (e.code) {
      case "ArrowLeft":
        if (isValid(piece, -1, 0)) { piece.x--; draw(); }
        e.preventDefault(); break;

      case "ArrowRight":
        if (isValid(piece, 1, 0)) { piece.x++; draw(); }
        e.preventDefault(); break;

      case "ArrowDown":
        if (isValid(piece, 0, 1)) { piece.y++; score += 1; updateHUD(); draw(); }
        else lockPiece();
        e.preventDefault(); break;

      case "ArrowUp":
      case "KeyX":
        tryRotate(1); draw();
        e.preventDefault(); break;

      case "KeyZ":
        tryRotate(-1); draw();
        e.preventDefault(); break;

      case "Space":
        hardDrop(); draw();
        e.preventDefault(); break;

      case "ShiftLeft":
      case "ShiftRight":
        holdPiece(); draw();
        e.preventDefault(); break;
    }
  });

  // ── Button / overlay ─────────────────────────────────

  document.getElementById("actionBtn").addEventListener("click", function () {
    if (paused) { togglePause(); }
    else        { startGame();   }
  });

  // ── Mobile touch controls ─────────────────────────────

  function addTouchBtn(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("touchstart", function (e) {
      e.preventDefault();
      if (running && !paused) fn();
    }, { passive: false });
    el.addEventListener("mousedown", function (e) {
      e.preventDefault();
      if (running && !paused) fn();
    });
  }

  addTouchBtn("tbLeft",  () => { if (isValid(piece,-1,0)) { piece.x--; draw(); } });
  addTouchBtn("tbRight", () => { if (isValid(piece, 1,0)) { piece.x++; draw(); } });
  addTouchBtn("tbDown",  () => { if (isValid(piece, 0,1)) { piece.y++; score++; updateHUD(); draw(); } else lockPiece(); });
  addTouchBtn("tbUp",    () => { tryRotate(1);  draw(); });
  addTouchBtn("tbRotR",  () => { tryRotate(1);  draw(); });
  addTouchBtn("tbRotL",  () => { tryRotate(-1); draw(); });
  addTouchBtn("tbDrop",  () => { hardDrop(); draw(); });
  addTouchBtn("tbHold",  () => { holdPiece(); draw(); });

  // ── Initial render ─────────────────────────────────────
  draw();

})(); // end IIFE