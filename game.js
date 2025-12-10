const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const restartBtn = document.getElementById('restartBtn');
const scoreEl = document.getElementById('score');

// Load apple crunch sound
const eatSound = new Audio("crunch.wav");
eatSound.preload = "auto";
eatSound.volume = 1.0; // full volume or adjust as you like


// ===== Game config =====
const tileCount = 13;          // 20 x 20 grid
const baseSpeed = 5;           // moves per second (grid steps)
let tileSize;                  // computed from canvas size

let lastTime = 0;
let moveInterval = 1000 / baseSpeed;
let accumulator = 0;

// ===== Game state =====
let snake = [];
let previousSnake = null;
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = null;
let score = 0;
let isRunning = false;
let isGameOver = false;
let eatAnimMs = 0;   // eating animation timer in ms

// ===== Audio =====
let audioCtx = null;

function ensureAudio() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playBeep(freq, duration, type = 'sine', volume = 0.25) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  osc.start(now);
  gain.gain.setTargetAtTime(0, now + duration * 0.5, duration * 0.3);
  osc.stop(now + duration);
}

function playEat() {
  // Restart sound every time it plays
  eatSound.currentTime = 0;
  eatSound.play().catch(e => console.log("Sound blocked until user interaction", e));
}


function playGameOver() {
  playBeep(260, 0.25, 'sawtooth', 0.3);
  setTimeout(() => playBeep(180, 0.35, 'sawtooth', 0.25), 120);
}

// ===== Resize canvas (responsive & square) =====
function resizeCanvas() {
  const wrapper = document.querySelector('.game-wrapper');
  const size = Math.min(wrapper.clientWidth - 16, wrapper.clientHeight - 16);
  const finalSize = Math.max(260, size);
  canvas.width = canvas.height = finalSize;
  tileSize = canvas.width / tileCount;
  drawEverything(0);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ===== Game init / reset =====
function initGame() {
  ensureAudio();

  const startX = Math.floor(tileCount / 4);
  const startY = Math.floor(tileCount / 2);

  snake = [
    { x: startX,     y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];
  previousSnake = snake.map(seg => ({ ...seg }));

  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };

  score = 0;
  scoreEl.textContent = score;

  eatAnimMs = 0;
  placeFood();

  isRunning = true;
  isGameOver = false;
  overlay.classList.add('hidden');

  lastTime = performance.now();
  accumulator = 0;
  requestAnimationFrame(gameLoop);
}

function placeFood() {
  while (true) {
    const x = Math.floor(Math.random() * tileCount);
    const y = Math.floor(Math.random() * tileCount);
    const onSnake = snake.some(seg => seg.x === x && seg.y === y);
    if (!onSnake) {
      food = { x, y };
      return;
    }
  }
}

// ===== Main loop with interpolation =====
function gameLoop(timestamp) {
  if (!isRunning) return;

  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;

  while (accumulator >= moveInterval) {
    accumulator -= moveInterval;
    step();
    if (!isRunning) break;
  }

  // decay eating animation timer
  if (eatAnimMs > 0) {
    eatAnimMs -= delta;
    if (eatAnimMs < 0) eatAnimMs = 0;
  }

  const interp = Math.min(1, accumulator / moveInterval); // 0 → 1 between tiles
  drawEverything(interp);

  if (isRunning) {
    requestAnimationFrame(gameLoop);
  }
}

function step() {
  // store previous positions
  if (!previousSnake || previousSnake.length !== snake.length) {
    previousSnake = snake.map(seg => ({ ...seg }));
  } else {
    for (let i = 0; i < snake.length; i++) {
      previousSnake[i].x = snake[i].x;
      previousSnake[i].y = snake[i].y;
    }
  }

  direction = nextDirection;

  const head = snake[0];
  const newHead = {
    x: head.x + direction.x,
    y: head.y + direction.y
  };

  // collisions
  if (
    newHead.x < 0 || newHead.x >= tileCount ||
    newHead.y < 0 || newHead.y >= tileCount
  ) {
    return gameOver();
  }

  if (snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
    return gameOver();
  }

  snake.unshift(newHead);

  if (newHead.x === food.x && newHead.y === food.y) {
    score++;
    scoreEl.textContent = score;
    playEat();
    eatAnimMs = 200; // 200 ms mouth-open animation
    placeFood();
  } else {
    snake.pop();
  }
}

function gameOver() {
  isRunning = false;
  isGameOver = true;
  overlayTitle.textContent = 'Game over';
  overlayText.textContent = 'Sathi’s snake crashed 😢 Tap Play to try again.';
  overlay.classList.remove('hidden');
  playGameOver();
}

// ===== Drawing =====
function drawEverything(interp = 0) {
  if (!ctx) return;

  drawBoard();

  if (food) drawFood();
  if (snake.length > 0) drawSnake(interp);
}

function drawBoard() {
  for (let y = 0; y < tileCount; y++) {
    for (let x = 0; x < tileCount; x++) {
      const isLight = (x + y) % 2 === 0;
      ctx.fillStyle = isLight ? '#b1dd66' : '#a3d159';
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
}

function drawFood() {
  const cx = (food.x + 0.5) * tileSize;
  const cy = (food.y + 0.5) * tileSize;
  const r = tileSize * 0.35;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = tileSize * 0.08;

  const gradient = ctx.createRadialGradient(
    cx - r * 0.3, cy - r * 0.3, r * 0.1,
    cx, cy, r
  );
  gradient.addColorStop(0, '#ffb6b6');
  gradient.addColorStop(0.5, '#ff3b30');
  gradient.addColorStop(1, '#b01212');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3b5b1a';
  ctx.beginPath();
  ctx.ellipse(
    cx + r * 0.3,
    cy - r * 0.9,
    r * 0.25,
    r * 0.15,
    -0.7,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = '#3b5b1a';
  ctx.lineWidth = Math.max(2, tileSize * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.9);
  ctx.lineTo(cx + r * 0.2, cy - r * 1.2);
  ctx.stroke();

  ctx.restore();
}

// ===== Smooth joined pink snake with snake-like head =====
function drawSnake(interp = 0) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = tileSize * 0.08;

  const bodyColor = '#ff4fa0';
  const headColor = '#ff82c0';

  const from = previousSnake || snake;
  const to = snake;

  // interpolated centers
  const centers = [];
  for (let i = 0; i < to.length; i++) {
    const cur = to[i];
    const prev = from[i] || cur;
    const sx = (prev.x + (cur.x - prev.x) * interp + 0.5) * tileSize;
    const sy = (prev.y + (cur.y - prev.y) * interp + 0.5) * tileSize;
    centers.push({ x: sx, y: sy });
  }

  // body tube: tail -> head
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = bodyColor;
  ctx.lineWidth = tileSize * 0.8;

  ctx.beginPath();
  ctx.moveTo(centers[centers.length - 1].x, centers[centers.length - 1].y);
  for (let i = centers.length - 2; i >= 0; i--) {
    ctx.lineTo(centers[i].x, centers[i].y);
  }
  ctx.stroke();

  // ==== Head: capsule shape with small snout and animated mouth ====
  const head = centers[0];

  const headLength = tileSize * 1.0;  // slightly longer than wide
  const headWidth  = tileSize * 0.9;
  const neckShrink = tileSize * 0.15; // small narrowing at neck

  ctx.fillStyle = headColor;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = tileSize * 0.05;

  ctx.beginPath();

  if (direction.x === 1) {
    // moving right
    const x0 = head.x - headLength * 0.5;
    const y0 = head.y - headWidth / 2;
    const x1 = x0 + headLength;

    ctx.moveTo(x0, head.y - (headWidth / 2 - neckShrink));
    ctx.lineTo(x0, head.y + (headWidth / 2 - neckShrink));

    ctx.quadraticCurveTo(
      (x0 + x1) / 2,
      y0 + headWidth + neckShrink * 0.2,
      x1,
      head.y
    );

    ctx.quadraticCurveTo(
      (x0 + x1) / 2,
      y0 - neckShrink * 0.2,
      x0,
      head.y - (headWidth / 2 - neckShrink)
    );
  } else if (direction.x === -1) {
    // moving left
    const x1 = head.x + headLength * 0.5;
    const y0 = head.y - headWidth / 2;
    const x0 = x1 - headLength;

    ctx.moveTo(x1, head.y - (headWidth / 2 - neckShrink));
    ctx.lineTo(x1, head.y + (headWidth / 2 - neckShrink));

    ctx.quadraticCurveTo(
      (x0 + x1) / 2,
      y0 + headWidth + neckShrink * 0.2,
      x0,
      head.y
    );

    ctx.quadraticCurveTo(
      (x0 + x1) / 2,
      y0 - neckShrink * 0.2,
      x1,
      head.y - (headWidth / 2 - neckShrink)
    );
  } else if (direction.y === 1) {
    // moving down
    const x0 = head.x - headWidth / 2;
    const y0 = head.y - headLength * 0.5;
    const y1 = y0 + headLength;

    ctx.moveTo(head.x - (headWidth / 2 - neckShrink), y0);
    ctx.lineTo(head.x + (headWidth / 2 - neckShrink), y0);

    ctx.quadraticCurveTo(
      x0 + headWidth + neckShrink * 0.2,
      (y0 + y1) / 2,
      head.x,
      y1
    );

    ctx.quadraticCurveTo(
      x0 - neckShrink * 0.2,
      (y0 + y1) / 2,
      head.x - (headWidth / 2 - neckShrink),
      y0
    );
  } else {
    // moving up
    const x0 = head.x - headWidth / 2;
    const y1 = head.y + headLength * 0.5;
    const y0 = y1 - headLength;

    ctx.moveTo(head.x - (headWidth / 2 - neckShrink), y1);
    ctx.lineTo(head.x + (headWidth / 2 - neckShrink), y1);

    ctx.quadraticCurveTo(
      x0 + headWidth + neckShrink * 0.2,
      (y0 + y1) / 2,
      head.x,
      y0
    );

    ctx.quadraticCurveTo(
      x0 - neckShrink * 0.2,
      (y0 + y1) / 2,
      head.x - (headWidth / 2 - neckShrink),
      y1
    );
  }

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // ==== Mouth "bite" animation ====
  const mouthOpen = eatAnimMs > 0;
  if (mouthOpen) {
    const t = Math.min(1, eatAnimMs / 200); // 1 at start → 0 at end
    const mouthRadius = tileSize * (0.25 + 0.15 * t);
    const mouthAngle = Math.PI / 4; // 45°

    ctx.save();
    ctx.fillStyle = '#b1dd66'; // board color so it looks like an open mouth

    ctx.beginPath();
    if (direction.x === 1) {
      const mx = head.x + headLength * 0.45;
      const my = head.y;
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, mouthRadius, -mouthAngle, mouthAngle);
    } else if (direction.x === -1) {
      const mx = head.x - headLength * 0.45;
      const my = head.y;
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, mouthRadius, Math.PI - mouthAngle, Math.PI + mouthAngle);
    } else if (direction.y === 1) {
      const mx = head.x;
      const my = head.y + headLength * 0.45;
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, mouthRadius, Math.PI / 2 - mouthAngle, Math.PI / 2 + mouthAngle);
    } else {
      const mx = head.x;
      const my = head.y - headLength * 0.45;
      ctx.moveTo(mx, my);
      ctx.arc(mx, my, mouthRadius, -Math.PI / 2 - mouthAngle, -Math.PI / 2 + mouthAngle);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ==== Eyes ====
  const eyeRadius = tileSize * 0.14;
  const pupilRadius = tileSize * 0.07;

  let offsetX = 0, offsetY = 0;
  if (direction.x === 1) offsetX = tileSize * 0.18;
  else if (direction.x === -1) offsetX = -tileSize * 0.18;
  else if (direction.y === 1) offsetY = tileSize * 0.18;
  else if (direction.y === -1) offsetY = -tileSize * 0.18;

  const eyeCenterX = head.x;
  const eyeCenterY = head.y;

  const eye1x = eyeCenterX - tileSize * 0.12 + offsetX;
  const eye2x = eyeCenterX + tileSize * 0.12 + offsetX;
  const eyeY  = eyeCenterY - tileSize * 0.1  + offsetY;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eye1x, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.arc(eye2x, eyeY, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#333333';
  ctx.beginPath();
  ctx.arc(eye1x, eyeY, pupilRadius, 0, Math.PI * 2);
  ctx.arc(eye2x, eyeY, pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ===== Controls (keyboard + swipe) =====
document.addEventListener('keydown', e => {
  if (!isRunning && !isGameOver && (e.key.startsWith('Arrow') || /[wasd]/i.test(e.key))) {
    initGame();
  }

  switch (e.key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
      break;
    case 'ArrowDown':
    case 's':
    case 'S':
      if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
      break;
    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
      break;
    case 'ArrowRight':
    case 'd':
    case 'D':
      if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
      break;
  }
});

let touchStartX = null;
let touchStartY = null;

canvas.addEventListener('touchstart', e => {
  ensureAudio();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (touchStartX === null || touchStartY === null) return;

  if (!isRunning && !isGameOver) {
    initGame();
  }

  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction.x !== -1) {
      nextDirection = { x: 1, y: 0 };
    } else if (dx < 0 && direction.x !== 1) {
      nextDirection = { x: -1, y: 0 };
    }
  } else {
    if (dy > 0 && direction.y !== -1) {
      nextDirection = { x: 0, y: 1 };
    } else if (dy < 0 && direction.y !== 1) {
      nextDirection = { x: 0, y: -1 };
    }
  }

  touchStartX = touchStartY = null;
});

// Overlay button
restartBtn.addEventListener('click', () => {
  ensureAudio();
  initGame();
});

// Start screen text
overlayTitle.textContent = 'Sathi Snake';
overlayText.textContent = 'Swipe or use arrow keys to move the pink snake and eat the apples.';
overlay.classList.remove('hidden');
drawEverything(0);
