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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseColor(input) {
  if (!input) return { r: 255, g: 255, b: 255 };
  const value = input.trim();
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b };
    }
  }
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    const [r = 255, g = 255, b = 255] = parts;
    return { r, g, b };
  }
  return { r: 255, g: 255, b: 255 };
}

function mixColor(base, target, weight) {
  const w = clamp(weight, 0, 1);
  return {
    r: Math.round(base.r + (target.r - base.r) * w),
    g: Math.round(base.g + (target.g - base.g) * w),
    b: Math.round(base.b + (target.b - base.b) * w),
  };
}

function rgbString(color) {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function drawRoundedRect(x, y, size, radius) {
  const r = Math.min(radius, size / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + size - r, y);
  ctx.quadraticCurveTo(x + size, y, x + size, y + r);
  ctx.lineTo(x + size, y + size - r);
  ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
  ctx.lineTo(x + r, y + size);
  ctx.quadraticCurveTo(x, y + size, x, y + size - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

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

function drawCandyBlock(cell, baseColor, intensity = 0.8) {
  const rgb = parseColor(baseColor);
  const highlight = mixColor(rgb, { r: 255, g: 255, b: 255 }, 0.55);
  const mid = mixColor(rgb, { r: 255, g: 255, b: 255 }, 0.18);
  const shadow = mixColor(rgb, { r: 0, g: 0, b: 0 }, 0.2);

  const x = cell.c * CELL_SIZE + 1;
  const y = cell.r * CELL_SIZE + 1;
  const size = CELL_SIZE - 2;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 7 * intensity;
  ctx.shadowOffsetY = 3 * intensity;

  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, rgbString(highlight));
  gradient.addColorStop(0.45, rgbString(mid));
  gradient.addColorStop(1, rgbString(shadow));
  ctx.fillStyle = gradient;
  drawRoundedRect(x, y, size, 7);
  ctx.fill();

  const jellyGlow = ctx.createRadialGradient(centerX, centerY, size * 0.1, centerX, centerY, size * 0.7);
  jellyGlow.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  jellyGlow.addColorStop(0.5, `rgba(${highlight.r}, ${highlight.g}, ${highlight.b}, 0.25)`);
  jellyGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = jellyGlow;
  drawRoundedRect(x + 1, y + 1, size - 2, 6);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.stroke();

  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.ellipse(x + size * 0.33, y + size * 0.28, size * 0.22, size * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCandyFood(cell, baseColor) {
  const rgb = parseColor(baseColor);
  const bright = mixColor(rgb, { r: 255, g: 255, b: 255 }, 0.55);
  const dark = mixColor(rgb, { r: 0, g: 0, b: 0 }, 0.2);
  const x = cell.c * CELL_SIZE + CELL_SIZE / 2;
  const y = cell.r * CELL_SIZE + CELL_SIZE / 2;
  const radius = CELL_SIZE * 0.42;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  const gradient = ctx.createRadialGradient(x - radius * 0.4, y - radius * 0.4, radius * 0.2, x, y, radius);
  gradient.addColorStop(0, rgbString(bright));
  gradient.addColorStop(0.6, rgbString(rgb));
  gradient.addColorStop(1, rgbString(dark));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.arc(x, y + radius * 0.15, radius * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.2, y - radius * 0.3, radius * 0.35, radius * 0.22, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  const snakeBodyColor = getComputedStyle(document.documentElement).getPropertyValue("--snake-body");
  const foodColor = getComputedStyle(document.documentElement).getPropertyValue("--food");
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue("--accent");

  if (!paused && !state.gameOver) {
    updateParticles(dt);
  }

  state.snake.forEach((cell, idx) => {
    const base = idx === 0 ? snakeColor : snakeBodyColor;
    drawCandyBlock(cell, base, idx === 0 ? 1 : 0.7);
  });

  if (state.food) {
    drawCandyFood(state.food, foodColor);
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
