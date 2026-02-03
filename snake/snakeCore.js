const DIRS = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

const OPPOSITE = new Map([
  ["up", "down"],
  ["down", "up"],
  ["left", "right"],
  ["right", "left"],
]);

function lcgNext(state) {
  const next = (1664525 * state + 1013904223) >>> 0;
  return next;
}

function randomInt(rngState, max) {
  const next = lcgNext(rngState);
  return { rngState: next, value: next % max };
}

function cellsEqual(a, b) {
  return a.r === b.r && a.c === b.c;
}

function isInBounds(rows, cols, cell) {
  return cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols;
}

function snakeContains(snake, cell, ignoreTail) {
  const end = ignoreTail ? snake.length - 1 : snake.length;
  for (let i = 0; i < end; i += 1) {
    if (cellsEqual(snake[i], cell)) return true;
  }
  return false;
}

function emptyCells(rows, cols, snake) {
  const empty = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = { r, c };
      if (!snakeContains(snake, cell, false)) {
        empty.push(cell);
      }
    }
  }
  return empty;
}

function spawnFood(rows, cols, snake, rngState) {
  const empty = emptyCells(rows, cols, snake);
  if (empty.length === 0) {
    return { food: null, rngState, win: true };
  }
  const { rngState: nextRng, value } = randomInt(rngState, empty.length);
  return { food: empty[value], rngState: nextRng, win: false };
}

export function createGameState({
  rows = 20,
  cols = 20,
  rngSeed = 1,
} = {}) {
  const start = {
    r: Math.floor(rows / 2),
    c: Math.floor(cols / 2),
  };
  const snake = [start, { r: start.r, c: start.c - 1 }];
  const { food, rngState, win } = spawnFood(rows, cols, snake, rngSeed >>> 0);
  return {
    rows,
    cols,
    snake,
    dir: "right",
    food,
    score: 0,
    gameOver: false,
    win,
    rngState,
  };
}

export function advance(state, inputDir) {
  if (state.gameOver) return state;

  let dir = state.dir;
  if (inputDir && inputDir !== OPPOSITE.get(state.dir)) {
    dir = inputDir;
  }

  const delta = DIRS[dir];
  const head = state.snake[0];
  const nextHead = { r: head.r + delta.r, c: head.c + delta.c };
  const willGrow = state.food && cellsEqual(nextHead, state.food);
  const hitsWall = !isInBounds(state.rows, state.cols, nextHead);
  const hitsSelf = snakeContains(state.snake, nextHead, !willGrow);

  if (hitsWall || hitsSelf) {
    return {
      ...state,
      dir,
      gameOver: true,
      win: false,
    };
  }

  const nextSnake = [nextHead, ...state.snake];
  if (!willGrow) {
    nextSnake.pop();
  }

  let nextFood = state.food;
  let nextRng = state.rngState;
  let nextWin = state.win;
  let nextScore = state.score;

  if (willGrow) {
    nextScore += 1;
    const spawn = spawnFood(state.rows, state.cols, nextSnake, state.rngState);
    nextFood = spawn.food;
    nextRng = spawn.rngState;
    nextWin = spawn.win;
  }

  const gameOver = nextWin ? true : false;
  return {
    ...state,
    dir,
    snake: nextSnake,
    food: nextFood,
    score: nextScore,
    rngState: nextRng,
    win: nextWin,
    gameOver,
  };
}

export function dirFromKey(key) {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    default:
      return null;
  }
}

export function normalizeDir(value) {
  return DIRS[value] ? value : null;
}
