document.addEventListener('DOMContentLoaded', () => {
  const gameArea = document.getElementById('gameArea');
  const player = document.getElementById('player');
  const boss = document.getElementById('boss');
  const message = document.getElementById('message');
  const hpText = document.getElementById('hp');
  const scoreText = document.getElementById('score');
  const levelText = document.getElementById('level');
  const bossName = document.getElementById('bossName');
  const bossHpText = document.getElementById('bossHpText');
  const bossHpBar = document.getElementById('bossHpBar');
  const clearEffect = document.getElementById('clearEffect');

  const MAX_HP = 2;
  const BOSS_MAX_HP = 100;

  let gameRunning = false;
  let isLevelChanging = false;
  let playerX = 0;
  let playerY = 0;
  let playerSpeed = 7;
  let hp = MAX_HP;
  let level = 1;
  let bossHp = BOSS_MAX_HP;
  let score = 0;
  let keys = {};
  let patterns = [];
  let bossTimer = null;
  let patternTimer = null;
  let scoreTimer = null;
  let animationId = null;

  function clearTimers() {
    clearInterval(bossTimer);
    clearInterval(patternTimer);
    clearInterval(scoreTimer);
    cancelAnimationFrame(animationId);
  }

  function removeRaidObjects() {
    document.querySelectorAll('.pattern, .warning-line').forEach((el) => el.remove());
    patterns = [];
  }

  function updateHud() {
    hpText.textContent = hp;
    scoreText.textContent = score;
    levelText.textContent = level;
    bossName.textContent = `LV.${level} 어둠의 마왕`;
    bossHpText.textContent = Math.max(0, Math.ceil(bossHp));
    bossHpBar.style.width = `${Math.max(0, bossHp)}%`;
  }

  function resetGame() {
    clearTimers();
    removeRaidObjects();
    gameRunning = false;
    isLevelChanging = false;
    hp = MAX_HP;
    level = 1;
    bossHp = BOSS_MAX_HP;
    score = 0;
    keys = {};

    playerX = gameArea.clientWidth / 2 - player.clientWidth / 2;
    playerY = gameArea.clientHeight - player.clientHeight - 28;
    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    boss.classList.remove('boss-dead');
    clearEffect.classList.add('hidden');
    updateHud();
  }

  function startGame() {
    resetGame();
    gameRunning = true;
    message.classList.add('hidden');
    startLevelTimers();
    gameLoop();
  }

  function startLevelTimers() {
    clearInterval(bossTimer);
    clearInterval(patternTimer);
    clearInterval(scoreTimer);

    bossTimer = setInterval(() => {
      if (!gameRunning || isLevelChanging) return;
      const damagePerSecond = 4 + level * 0.45;
      bossHp -= damagePerSecond;
      updateHud();

      if (bossHp <= 0) {
        clearBoss();
      }
    }, 1000);

    scoreTimer = setInterval(() => {
      if (!gameRunning || isLevelChanging) return;
      score += 10 + level * 3;
      updateHud();
    }, 1000);

    const interval = Math.max(360, 850 - level * 45);
    patternTimer = setInterval(() => {
      if (!gameRunning || isLevelChanging) return;
      const count = Math.min(1 + Math.floor(level / 2), 5);
      for (let i = 0; i < count; i += 1) {
        setTimeout(createRaidPattern, i * 130);
      }
    }, interval);
  }

  function gameLoop() {
    if (!gameRunning) return;

    movePlayer();
    movePatterns();
    checkCollision();

    animationId = requestAnimationFrame(gameLoop);
  }

  function movePlayer() {
    if (keys.ArrowLeft || keys.a || keys.A) playerX -= playerSpeed;
    if (keys.ArrowRight || keys.d || keys.D) playerX += playerSpeed;
    if (keys.ArrowUp || keys.w || keys.W) playerY -= playerSpeed;
    if (keys.ArrowDown || keys.s || keys.S) playerY += playerSpeed;

    const maxX = gameArea.clientWidth - player.clientWidth;
    const maxY = gameArea.clientHeight - player.clientHeight;
    const minY = 120;

    playerX = Math.max(0, Math.min(maxX, playerX));
    playerY = Math.max(minY, Math.min(maxY - 18, playerY));
    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;
  }

  function createRaidPattern() {
    if (!gameRunning || isLevelChanging) return;

    const warningWidth = 56;
    const x = Math.random() * (gameArea.clientWidth - warningWidth);

    const warning = document.createElement('div');
    warning.className = 'warning-line';
    warning.style.left = `${x}px`;
    gameArea.appendChild(warning);

    setTimeout(() => {
      if (!gameRunning || isLevelChanging) {
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
        speed: 4.5 + Math.random() * 2.5 + level * 0.25,
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
        updateHud();
        pattern.element.remove();
        patterns.splice(i, 1);
        player.classList.add('damaged');
        setTimeout(() => player.classList.remove('damaged'), 220);

        if (hp <= 0) endGame();
      }
    }
  }

  function clearBoss() {
    if (isLevelChanging) return;
    isLevelChanging = true;
    bossHp = 0;
    score += 500 + level * 100;
    updateHud();
    removeRaidObjects();

    boss.classList.add('boss-dead');
    clearEffect.classList.remove('hidden');
    clearEffect.textContent = `LEVEL ${level} BOSS CLEAR!`;

    setTimeout(() => {
      if (!gameRunning) return;
      level += 1;
      bossHp = BOSS_MAX_HP;
      hp = Math.min(MAX_HP, hp + 1);
      isLevelChanging = false;
      boss.classList.remove('boss-dead');
      clearEffect.classList.add('hidden');
      updateHud();
      startLevelTimers();
    }, 1800);
  }

  function endGame() {
    gameRunning = false;
    isLevelChanging = false;
    clearTimers();
    removeRaidObjects();

    message.classList.remove('hidden');
    message.innerHTML = `
      <div class="start-card result-card">
        <p class="raid-label">RAID FAILED</p>
        <h2>기사 전투 불능</h2>
        <p class="desc">도달 레벨: ${level}<br />최종 점수: ${score}</p>
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

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'Space' && !gameRunning) {
      startGame();
    }
  });

  window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
  });

  resetGame();
});
