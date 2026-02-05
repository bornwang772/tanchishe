import { advance, createGameState, dirFromKey, normalizeDir } from "./snakeCore.js";

const canvas = document.getElementById("board");
const scoreEl = document.getElementById("score");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySubtitle = document.getElementById("overlay-subtitle");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const touchControls = document.querySelector(".touch-controls");

const ctx = canvas.getContext("2d");
const CELL_SIZE = 20;
const TICK_MS = 120;
const EAT_EFFECT_MS = 240;

let state = createGameState({ rows: 20, cols: 20, rngSeed: 42 });
let pendingDir = null;
let lastTick = performance.now();
let paused = false;
let eatEffect = null;

function resizeCanvas() {
  canvas.width = state.cols * CELL_SIZE;
  canvas.height = state.rows * CELL_SIZE;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--grid");
  ctx.lineWidth = 1;
  for (let r = 0; r <= state.rows; r += 1) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL_SIZE);
    ctx.lineTo(canvas.width, r * CELL_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= state.cols; c += 1) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, canvas.height);
    ctx.stroke();
  }
}

function drawCell(cell, color) {
  ctx.fillStyle = color;
  ctx.fillRect(
    cell.c * CELL_SIZE + 1,
    cell.r * CELL_SIZE + 1,
    CELL_SIZE - 2,
    CELL_SIZE - 2
  );
}

function drawEatEffect(now, foodColor, accentColor) {
  if (!eatEffect) return;
  const elapsed = now - eatEffect.startedAt;
  if (elapsed > EAT_EFFECT_MS) {
    eatEffect = null;
    return;
  }

  const t = elapsed / EAT_EFFECT_MS;
  const centerX = eatEffect.cell.c * CELL_SIZE + CELL_SIZE / 2;
  const centerY = eatEffect.cell.r * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE * (0.2 + 0.8 * t);

  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.lineWidth = 2;
  ctx.strokeStyle = accentColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  glow.addColorStop(0.4, foodColor);
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function render(now = performance.now()) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const snakeColor = getComputedStyle(document.documentElement).getPropertyValue("--snake");
  const foodColor = getComputedStyle(document.documentElement).getPropertyValue("--food");
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent");

  state.snake.forEach((cell, idx) => {
    drawCell(cell, idx === 0 ? snakeColor : "#3b3b3b");
  });

  if (state.food) {
    drawCell(state.food, foodColor);
  }

  drawEatEffect(now, foodColor, accentColor);

  scoreEl.textContent = String(state.score);
  overlay.classList.toggle("hidden", !state.gameOver && !paused);
  if (paused && !state.gameOver) {
    overlayTitle.textContent = "Paused";
    overlaySubtitle.textContent = "Press Space to resume";
  } else if (state.gameOver) {
    overlayTitle.textContent = state.win ? "You Win" : "Game Over";
    overlaySubtitle.textContent = "Press R or Restart";
  }
}

function tick(now) {
  requestAnimationFrame(tick);
  if (paused || state.gameOver) {
    render(now);
    return;
  }

  if (now - lastTick < TICK_MS) {
    return;
  }

  lastTick = now;
  const prevFood = state.food;
  const prevScore = state.score;
  state = advance(state, pendingDir);
  if (state.score > prevScore && prevFood) {
    eatEffect = { cell: prevFood, startedAt: now };
  }
  pendingDir = null;
  render(now);
}

function setPendingDir(dir) {
  if (!dir) return;
  pendingDir = dir;
}

function restart() {
  state = createGameState({ rows: 20, cols: 20, rngSeed: 42 });
  pendingDir = null;
  paused = false;
  lastTick = performance.now();
  eatEffect = null;
  render();
}

window.addEventListener("keydown", (event) => {
  const dir = dirFromKey(event.key);
  if (dir) {
    event.preventDefault();
    setPendingDir(dir);
    return;
  }
  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    paused = !paused;
    pauseBtn.textContent = paused ? "Resume" : "Pause";
    render();
  }
  if (event.key === "r" || event.key === "R") {
    restart();
  }
});

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
  render();
});

restartBtn.addEventListener("click", restart);

touchControls.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const dir = normalizeDir(target.dataset.dir);
  setPendingDir(dir);
});

resizeCanvas();
render();
requestAnimationFrame(tick);
