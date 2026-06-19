document.addEventListener('DOMContentLoaded', () => {
  const gameArea = document.getElementById('gameArea');
  const player = document.getElementById('player');
  const message = document.getElementById('message');
  const timeText = document.getElementById('time');
  const hpText = document.getElementById('hp');
  const scoreText = document.getElementById('score');

  let gameRunning = false;
  let playerX = 0;
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

  function clearTimers() {
    clearInterval(gameTimer);
    clearInterval(patternTimer);
    clearInterval(scoreTimer);
    cancelAnimationFrame(animationId);
  }

  function resetGame() {
    clearTimers();
    gameRunning = false;
    hp = 3;
    timeLeft = 60;
    score = 0;
    keys = {};
    patterns = [];

    hpText.textContent = hp;
    timeText.textContent = timeLeft;
    scoreText.textContent = score;

    playerX = gameArea.clientWidth / 2 - player.clientWidth / 2;
    player.style.left = `${playerX}px`;

    document.querySelectorAll('.pattern, .warning-line').forEach((el) => el.remove());
  }

  function startGame() {
    resetGame();
    gameRunning = true;
    message.classList.add('hidden');

    gameTimer = setInterval(() => {
      timeLeft -= 1;
      timeText.textContent = timeLeft;

      if (timeLeft <= 0) {
        endGame(true);
      }
    }, 1000);

    scoreTimer = setInterval(() => {
      score += 10;
      scoreText.textContent = score;
    }, 1000);

    patternTimer = setInterval(createRaidPattern, 780);
    gameLoop();
  }

  function gameLoop() {
    if (!gameRunning) return;

    movePlayer();
    movePatterns();
    checkCollision();

    animationId = requestAnimationFrame(gameLoop);
  }

  function movePlayer() {
    if (keys.ArrowLeft) playerX -= playerSpeed;
    if (keys.ArrowRight) playerX += playerSpeed;

    const maxX = gameArea.clientWidth - player.clientWidth;
    playerX = Math.max(0, Math.min(maxX, playerX));
    player.style.left = `${playerX}px`;
  }

  function createRaidPattern() {
    if (!gameRunning) return;

    const warningWidth = 56;
    const x = Math.random() * (gameArea.clientWidth - warningWidth);

    const warning = document.createElement('div');
    warning.className = 'warning-line';
    warning.style.left = `${x}px`;
    gameArea.appendChild(warning);

    setTimeout(() => {
      if (!gameRunning) {
        warning.remove();
        return;
      }

      warning.remove();

      const pattern = document.createElement('div');
      pattern.className = 'pattern';
      pattern.style.left = `${x + 10}px`;
      pattern.style.top = '0px';
      gameArea.appendChild(pattern);

      patterns.push({
        element: pattern,
        y: 0,
        speed: 5 + Math.random() * 3,
        hit: false,
      });
    }, 430);
  }

  function movePatterns() {
    for (let i = patterns.length - 1; i >= 0; i -= 1) {
      const pattern = patterns[i];
      pattern.y += pattern.speed;
      pattern.element.style.top = `${pattern.y}px`;

      if (pattern.y > gameArea.clientHeight) {
        pattern.element.remove();
        patterns.splice(i, 1);
      }
    }
  }

  function checkCollision() {
    const playerRect = player.getBoundingClientRect();

    for (let i = patterns.length - 1; i >= 0; i -= 1) {
      const pattern = patterns[i];
      const patternRect = pattern.element.getBoundingClientRect();

      const isHit =
        playerRect.left < patternRect.right &&
        playerRect.right > patternRect.left &&
        playerRect.top < patternRect.bottom &&
        playerRect.bottom > patternRect.top;

      if (isHit && !pattern.hit) {
        pattern.hit = true;
        hp -= 1;
        hpText.textContent = hp;
        pattern.element.remove();
        patterns.splice(i, 1);
        player.classList.add('damaged');
        setTimeout(() => player.classList.remove('damaged'), 220);

        if (hp <= 0) endGame(false);
      }
    }
  }

  function endGame(isWin) {
    gameRunning = false;
    clearTimers();
    document.querySelectorAll('.pattern, .warning-line').forEach((el) => el.remove());

    message.classList.remove('hidden');
    message.innerHTML = `
      <div class="start-card result-card">
        <p class="raid-label">${isWin ? 'RAID CLEAR' : 'RAID FAILED'}</p>
        <h2>${isWin ? '토벌 성공!' : '토벌 실패'}</h2>
        <p class="desc">최종 점수: ${score}</p>
        <button id="restartBtn" type="button">다시 도전</button>
      </div>
    `;
  }

  message.addEventListener('click', (event) => {
    if (event.target.id === 'startBtn' || event.target.id === 'restartBtn') {
      startGame();
    }
  });

  window.addEventListener('keydown', (event) => {
    keys[event.key] = true;

    if (event.code === 'Space' && !gameRunning) {
      event.preventDefault();
      startGame();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
  });

  resetGame();
});
