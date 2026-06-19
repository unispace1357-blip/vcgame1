const gameArea = document.getElementById('gameArea');
const player = document.getElementById('player');
const message = document.getElementById('message');
const startBtn = document.getElementById('startBtn');
const timeText = document.getElementById('time');
const hpText = document.getElementById('hp');
const scoreText = document.getElementById('score');

let gameRunning = false;
let playerX = 390;
let playerSpeed = 8;
let hp = 3;
let timeLeft = 60;
let score = 0;
let keys = {};
let patterns = [];
let gameTimer = null;
let patternTimer = null;
let scoreTimer = null;
let animationId = null;

function startGame() {
  resetGame();
  gameRunning = true;
  message.classList.add('hidden');

  gameTimer = setInterval(() => {
    timeLeft--;
    timeText.textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame(true);
    }
  }, 1000);

  scoreTimer = setInterval(() => {
    score++;
    scoreText.textContent = score;
  }, 1000);

  patternTimer = setInterval(createRaidPattern, 850);
  gameLoop();
}

function resetGame() {
  gameRunning = false;
  playerX = gameArea.clientWidth / 2 - player.clientWidth / 2;
  hp = 3;
  timeLeft = 60;
  score = 0;
  patterns = [];

  hpText.textContent = hp;
  timeText.textContent = timeLeft;
  scoreText.textContent = score;
  player.style.left = playerX + 'px';

  document.querySelectorAll('.pattern, .warning-line').forEach((el) => el.remove());
  clearTimers();
}

function clearTimers() {
  clearInterval(gameTimer);
  clearInterval(patternTimer);
  clearInterval(scoreTimer);
  cancelAnimationFrame(animationId);
}

function gameLoop() {
  if (!gameRunning) return;

  movePlayer();
  movePatterns();
  checkCollision();

  animationId = requestAnimationFrame(gameLoop);
}

function movePlayer() {
  if (keys['ArrowLeft']) {
    playerX -= playerSpeed;
  }

  if (keys['ArrowRight']) {
    playerX += playerSpeed;
  }

  const minX = 0;
  const maxX = gameArea.clientWidth - player.clientWidth;
  playerX = Math.max(minX, Math.min(maxX, playerX));
  player.style.left = playerX + 'px';
}

function createRaidPattern() {
  const x = Math.random() * (gameArea.clientWidth - 44);

  const warning = document.createElement('div');
  warning.classList.add('warning-line');
  warning.style.left = x + 'px';
  gameArea.appendChild(warning);

  setTimeout(() => {
    if (!gameRunning) return;

    warning.remove();

    const pattern = document.createElement('div');
    pattern.classList.add('pattern');
    pattern.style.left = x + 4 + 'px';
    pattern.style.top = '0px';
    gameArea.appendChild(pattern);

    patterns.push({
      element: pattern,
      x: x + 4,
      y: 0,
      speed: 5 + Math.random() * 3,
      hit: false,
    });
  }, 450);
}

function movePatterns() {
  patterns.forEach((pattern, index) => {
    pattern.y += pattern.speed;
    pattern.element.style.top = pattern.y + 'px';

    if (pattern.y > gameArea.clientHeight) {
      pattern.element.remove();
      patterns.splice(index, 1);
    }
  });
}

function checkCollision() {
  const playerRect = player.getBoundingClientRect();

  patterns.forEach((pattern) => {
    const patternRect = pattern.element.getBoundingClientRect();

    const isHit =
      playerRect.left < patternRect.right &&
      playerRect.right > patternRect.left &&
      playerRect.top < patternRect.bottom &&
      playerRect.bottom > patternRect.top;

    if (isHit && !pattern.hit) {
      pattern.hit = true;
      hp--;
      hpText.textContent = hp;
      pattern.element.remove();

      if (hp <= 0) {
        endGame(false);
      }
    }
  });
}

function endGame(isWin) {
  gameRunning = false;
  clearTimers();

  document.querySelectorAll('.pattern, .warning-line').forEach((el) => el.remove());

  message.classList.remove('hidden');

  if (isWin) {
    message.innerHTML = `
      <h2>RAID CLEAR!</h2>
      <p>60초 동안 생존했습니다. 최종 점수: ${score}</p>
      <button id="restartBtn">다시 도전</button>
    `;
  } else {
    message.innerHTML = `
      <h2>FAILED</h2>
      <p>HP가 모두 소진되었습니다. 최종 점수: ${score}</p>
      <button id="restartBtn">다시 도전</button>
    `;
  }

  document.getElementById('restartBtn').addEventListener('click', startGame);
}

startBtn.addEventListener('click', startGame);

window.addEventListener('keydown', (event) => {
  keys[event.key] = true;

  if (event.code === 'Space' && !gameRunning) {
    startGame();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key] = false;
});
