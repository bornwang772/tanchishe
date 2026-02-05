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
const PARTICLE_TTL = 0.45;

let state = createGameState({ rows: 20, cols: 20, rngSeed: 42 });
let pendingDir = null;
let lastTick = performance.now();
let paused = false;
let particles = [];
let lastRenderTime = performance.now();

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

function spawnEatParticles(cell) {
  const centerX = cell.c * CELL_SIZE + CELL_SIZE / 2;
  const centerY = cell.r * CELL_SIZE + CELL_SIZE / 2;
  const count = 14;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const speed = 60 + Math.random() * 80;
    particles.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      ttl: PARTICLE_TTL + Math.random() * 0.1,
      size: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(dt) {
  particles = particles.filter((particle) => {
    particle.life += dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.98;
    particle.vy *= 0.98;
    return particle.life < particle.ttl;
  });
}

function drawParticles(foodColor, accentColor) {
  particles.forEach((particle, idx) => {
    const t = particle.life / particle.ttl;
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = idx % 2 === 0 ? foodColor : accentColor;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function render(now = performance.now()) {
  const dt = Math.min(0.05, (now - lastRenderTime) / 1000);
  lastRenderTime = now;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  const snakeColor = getComputedStyle(document.documentElement).getPropertyValue("--snake");
  const foodColor = getComputedStyle(document.documentElement).getPropertyValue("--food");
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent");

  if (!paused && !state.gameOver) {
    updateParticles(dt);
  }

  state.snake.forEach((cell, idx) => {
    drawCell(cell, idx === 0 ? snakeColor : "#3b3b3b");
  });

  if (state.food) {
    drawCell(state.food, foodColor);
  }

  drawParticles(foodColor, accentColor);

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
    spawnEatParticles(prevFood);
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
  particles = [];
  lastRenderTime = performance.now();
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
