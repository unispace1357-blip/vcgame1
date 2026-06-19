document.addEventListener('DOMContentLoaded', () => {
  const gameArea = document.getElementById('gameArea');
  const player = document.getElementById('player');
  const boss = document.getElementById('boss');
  const message = document.getElementById('message');
  const hpText = document.getElementById('hp');
  const scoreText = document.getElementById('score');
  const levelText = document.getElementById('level');
  const swordCountText = document.getElementById('swordCount');
  const bossName = document.getElementById('bossName');
  const bossHpText = document.getElementById('bossHpText');
  const bossMaxHpText = document.getElementById('bossMaxHpText');
  const bossHpBar = document.getElementById('bossHpBar');
  const clearEffect = document.getElementById('clearEffect');
  const bgmVolumeControl = document.getElementById('bgmVolume');
  const sfxVolumeControl = document.getElementById('sfxVolume');
  const muteBtn = document.getElementById('muteBtn');

  const MAX_HP = 2;
  const SWORD_DAMAGE = 8;

  let gameRunning = false;
  let isLevelChanging = false;
  let playerX = 0;
  let playerY = 0;
  let playerSpeed = 7;
  let hp = MAX_HP;
  let level = 1;
  let score = 0;
  let bossMaxHp = 200;
  let bossHp = bossMaxHp;
  let keys = {};
  let hazards = [];
  let swords = [];
  let timers = [];
  let animationId = null;

  let audioCtx = null;
  let masterGain = null;
  let bgmGain = null;
  let sfxGain = null;
  let bgmTimer = null;
  let bgmStep = 0;
  let isMuted = false;
  let lastBossHitSoundTime = 0;

  const AUDIO_STORAGE_KEY = 'dungeonRaidAudioSettings';

  function ensureAudioContext() {
    if (audioCtx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    bgmGain = audioCtx.createGain();
    sfxGain = audioCtx.createGain();

    bgmGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = 1;

    updateAudioLevels();
  }

  function loadAudioSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY));
      if (!saved) return;

      if (bgmVolumeControl && Number.isFinite(Number(saved.bgm))) {
        bgmVolumeControl.value = saved.bgm;
      }

      if (sfxVolumeControl && Number.isFinite(Number(saved.sfx))) {
        sfxVolumeControl.value = saved.sfx;
      }

      isMuted = saved.muted === true;
    } catch (error) {
      // 저장된 설정이 깨져 있어도 게임 실행은 계속됩니다.
    }
  }

  function saveAudioSettings() {
    try {
      localStorage.setItem(
        AUDIO_STORAGE_KEY,
        JSON.stringify({
          bgm: bgmVolumeControl ? Number(bgmVolumeControl.value) : 55,
          sfx: sfxVolumeControl ? Number(sfxVolumeControl.value) : 70,
          muted: isMuted,
        }),
      );
    } catch (error) {
      // localStorage를 사용할 수 없는 환경에서도 게임은 정상 작동합니다.
    }
  }

  function updateAudioLevels(shouldSave = false) {
    const bgmVolume = bgmVolumeControl ? Number(bgmVolumeControl.value) / 100 : 0.55;
    const sfxVolume = sfxVolumeControl ? Number(sfxVolumeControl.value) / 100 : 0.7;

    if (bgmGain) bgmGain.gain.value = isMuted ? 0 : bgmVolume * 0.54;
    if (sfxGain) sfxGain.gain.value = isMuted ? 0 : sfxVolume * 0.5;
    if (muteBtn) muteBtn.textContent = isMuted ? '음소거 ON' : '음소거 OFF';

    if (shouldSave) saveAudioSettings();
  }

  function startAudioSystem() {
    ensureAudioContext();

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    updateAudioLevels();
    startBgm();
  }

  function playTone(
    frequency,
    duration,
    type = 'sine',
    volume = 0.4,
    target = 'sfx',
    delay = 0,
    attack = 0.018,
    release = 0.07,
  ) {
    if (!audioCtx) return;

    const output = target === 'bgm' ? bgmGain : sfxGain;
    if (!output) return;

    const now = audioCtx.currentTime + delay;
    const end = now + duration;
    const attackEnd = Math.min(now + attack, end);
    const releaseStart = Math.max(attackEnd, end - release);
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);

    // 급격한 시작/종료는 브라우저에서 지직거리는 클릭 노이즈를 만들 수 있어
    // 선형 페이드 인/아웃으로 부드럽게 처리합니다.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(Math.max(volume, 0), attackEnd);
    gain.gain.setValueAtTime(Math.max(volume * 0.82, 0), releaseStart);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(now);
    oscillator.stop(end + 0.03);
  }

  function startBgm() {
    if (!audioCtx || bgmTimer) return;

    // 지직거리는 느낌을 줄이기 위해 BGM에는 square/saw 계열을 쓰지 않고,
    // 낮은 sine 드론과 부드러운 triangle 단조 음형만 사용합니다.
    const dungeonPattern = [
      65.41, 73.42, 87.31, 73.42,
      61.74, 65.41, 73.42, 55.0,
      65.41, 87.31, 98.0, 73.42,
    ];

    const playBgmStep = () => {
      const note = dungeonPattern[bgmStep % dungeonPattern.length];

      // 낮게 깔리는 던전 드론음
      if (bgmStep % 8 === 0) {
        playTone(32.7, 2.2, 'sine', 0.16, 'bgm', 0, 0.18, 0.55);
      }

      // 어두운 던전 메인 음형
      playTone(note, 0.48, 'triangle', 0.22, 'bgm', 0, 0.055, 0.18);

      // 공간감용 저음 보조음
      if (bgmStep % 4 === 2) {
        playTone(49.0, 0.42, 'sine', 0.075, 'bgm', 0.02, 0.08, 0.18);
      }

      // 아주 약한 긴장감 레이어. 고음 금속성 노이즈가 거슬리지 않도록 볼륨을 낮췄습니다.
      if (bgmStep % 6 === 3) {
        playTone(note * 1.5, 0.26, 'sine', 0.035, 'bgm', 0.06, 0.06, 0.14);
      }

      bgmStep += 1;
    };

    playBgmStep();
    bgmTimer = setInterval(playBgmStep, 520);
  }

  function stopBgm() {
    if (!bgmTimer) return;

    clearInterval(bgmTimer);
    bgmTimer = null;
  }

  function playPlayerHitSound() {
    playTone(185, 0.08, 'sawtooth', 0.5);
    playTone(92, 0.14, 'square', 0.22, 'sfx', 0.05);
  }

  function playPlayerDeathSound() {
    playTone(260, 0.13, 'sawtooth', 0.46);
    playTone(170, 0.2, 'sawtooth', 0.42, 'sfx', 0.14);
    playTone(82, 0.36, 'square', 0.32, 'sfx', 0.35);
  }

  function playBossClearSound() {
    playTone(330, 0.12, 'triangle', 0.42);
    playTone(494, 0.15, 'triangle', 0.42, 'sfx', 0.12);
    playTone(659, 0.24, 'triangle', 0.48, 'sfx', 0.27);
  }

  function playBossHitSound() {
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    if (now - lastBossHitSoundTime < 0.08) return;
    lastBossHitSoundTime = now;

    playTone(720, 0.045, 'triangle', 0.18, 'sfx');
    playTone(410, 0.06, 'sine', 0.12, 'sfx', 0.025);
  }

  function playLevelStartSound() {
    playTone(392, 0.11, 'triangle', 0.28);
    playTone(523, 0.14, 'triangle', 0.32, 'sfx', 0.1);
  }

  function playLaserWarningSound() {
    playTone(740, 0.09, 'square', 0.2);
    playTone(520, 0.11, 'triangle', 0.16, 'sfx', 0.09);
  }

  function getSwordCount() {
    return Math.min(level, 6);
  }

  function getBossMaxHp() {
    // 초반 이탈 방지를 위해 LV1~2는 클리어 시간을 살짝 짧게 설정했습니다.
    // LV3부터는 기존 성장 곡선을 유지해서 무한 레벨 도전의 긴장감을 살립니다.
    if (level === 1) return 160;
    if (level === 2) return 360;

    const swordCount = getSwordCount();
    return swordCount * 200 + Math.max(0, level - 1) * 15;
  }

  function getTopFallSpeed() {
    return 5.05 + level * 0.22;
  }

  function setTimer(callback, delay, isInterval = true) {
    const timer = isInterval ? setInterval(callback, delay) : setTimeout(callback, delay);
    timers.push({ timer, isInterval });
    return timer;
  }

  function clearTimers(stopAnimation = true) {
    timers.forEach(({ timer, isInterval }) => {
      if (isInterval) clearInterval(timer);
      else clearTimeout(timer);
    });
    timers = [];

    // 레벨 전환 시에는 게임 루프(requestAnimationFrame)를 멈추면 안 됩니다.
    // 게임 루프가 멈추면 워닝 사인은 생성되지만 공/레이저가 이동하지 않는 문제가 생깁니다.
    if (stopAnimation && animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function removeRaidObjects() {
    document
      .querySelectorAll('.pattern, .warning-line, .side-warning, .floor-warning, .floor-blast, .tracking-warning, .tracking-blast, .laser-warning, .laser-beam, .sword-wave, .damage-text, .boss-explosion')
      .forEach((el) => el.remove());
    hazards = [];
    swords = [];
  }

  function updateHud() {
    const swordCount = getSwordCount();
    hpText.textContent = hp;
    scoreText.textContent = score;
    levelText.textContent = level;
    swordCountText.textContent = swordCount;
    bossName.textContent = `LV.${level} 어둠의 마왕`;
    bossHpText.textContent = Math.max(0, Math.ceil(bossHp));
    bossMaxHpText.textContent = bossMaxHp;
    bossHpBar.style.width = `${Math.max(0, (bossHp / bossMaxHp) * 100)}%`;
  }

  function resetGame() {
    clearTimers();
    removeRaidObjects();
    gameRunning = false;
    isLevelChanging = false;
    hp = MAX_HP;
    level = 1;
    score = 0;
    bossMaxHp = getBossMaxHp();
    bossHp = bossMaxHp;
    keys = {};

    playerX = gameArea.clientWidth / 2 - player.clientWidth / 2;
    playerY = gameArea.clientHeight - player.clientHeight - 30;
    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    boss.classList.remove('boss-dead', 'boss-hit');
    clearEffect.classList.add('hidden');
    updateHud();
  }

  function startGame() {
    resetGame();
    startAudioSystem();
    gameRunning = true;
    message.classList.add('hidden');
    startLevelTimers();
    gameLoop();
  }

  function startLevelTimers() {
    clearTimers(false);
    removeRaidObjects();

    setTimer(() => {
      if (!gameRunning || isLevelChanging) return;
      createTopFalls(2);
    }, Math.max(660, 1080 - level * 34));

    setTimer(() => {
      if (!gameRunning || isLevelChanging) return;
      fireSwordWaves();
    }, 850);

    setTimer(() => {
      if (!gameRunning || isLevelChanging) return;
      score += 10 + level * 2;
      updateHud();
    }, 1000);

    if (level >= 2) {
      setTimer(() => {
        if (!gameRunning || isLevelChanging) return;
        createSideAttack();
      }, Math.max(1120, 2050 - level * 62));
    }

    if (level >= 3) {
      setTimer(() => {
        if (!gameRunning || isLevelChanging) return;
        createFloorZone(false);
      }, Math.max(1580, 2750 - level * 52));
    }

    if (level >= 4) {
      setTimer(() => {
        if (!gameRunning || isLevelChanging) return;
        createFloorZone(true);
      }, Math.max(2050, 3350 - level * 58));
    }

    if (level >= 5) {
      setTimer(() => {
        if (!gameRunning || isLevelChanging) return;
        createLaser();
      }, Math.max(2950, 5050 - level * 85));
    }
  }

  function gameLoop() {
    if (!gameRunning) return;

    movePlayer();
    moveHazards();
    moveSwords();
    checkPlayerCollision();
    checkSwordCollision();

    animationId = requestAnimationFrame(gameLoop);
  }

  function movePlayer() {
    if (keys.ArrowLeft || keys.a || keys.A) playerX -= playerSpeed;
    if (keys.ArrowRight || keys.d || keys.D) playerX += playerSpeed;
    if (keys.ArrowUp || keys.w || keys.W) playerY -= playerSpeed;
    if (keys.ArrowDown || keys.s || keys.S) playerY += playerSpeed;

    const maxX = gameArea.clientWidth - player.clientWidth;
    const maxY = gameArea.clientHeight - player.clientHeight;
    const minY = 118;

    playerX = Math.max(0, Math.min(maxX, playerX));
    playerY = Math.max(minY, Math.min(maxY - 18, playerY));
    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;
  }

  function createTopFalls(count) {
    for (let i = 0; i < count; i += 1) {
      setTimer(() => createTopFall(), i * 130, false);
    }
  }

  function createTopFall() {
    const warningWidth = 56;
    const x = Math.random() * (gameArea.clientWidth - warningWidth);

    const warning = document.createElement('div');
    warning.className = 'warning-line';
    warning.style.left = `${x}px`;
    gameArea.appendChild(warning);

    setTimer(() => {
      warning.remove();
      if (!gameRunning || isLevelChanging) return;

      const pattern = document.createElement('div');
      pattern.className = 'pattern falling-pattern';
      pattern.style.left = `${x + 10}px`;
      pattern.style.top = '0px';
      gameArea.appendChild(pattern);

      hazards.push({
        element: pattern,
        x: x + 10,
        y: 0,
        vx: 0,
        vy: getTopFallSpeed() + Math.random() * 1.4,
        hit: false,
        removeOutside: true,
      });
    }, 430, false);
  }

  function createSideAttack() {
    const fromLeft = Math.random() > 0.5;
    const warningHeight = 32;
    const minY = 125;
    const maxY = gameArea.clientHeight - 48;
    let y;

    // 하단에 붙어 있는 플레이를 막기 위해 좌우 패턴은 일정 확률로 플레이어의 현재 높이를 직접 겨냥합니다.
    // 이번 밸런스 수정: 최하단 근처에 있을수록 겨냥 확률을 조금 더 높여 W/S 회피를 유도합니다.
    const isNearBottom = playerY > gameArea.clientHeight - player.clientHeight - 95;
    const targetPlayerChance = isNearBottom ? 0.68 : 0.54;

    if (Math.random() < targetPlayerChance) {
      y = playerY + player.clientHeight / 2 - warningHeight / 2 + (Math.random() * 34 - 17);
    } else {
      y = minY + Math.random() * (maxY - minY);
    }

    y = Math.max(minY, Math.min(maxY, y));

    const warning = document.createElement('div');
    warning.className = `side-warning ${fromLeft ? 'left-side' : 'right-side'}`;
    warning.style.top = `${y}px`;
    gameArea.appendChild(warning);

    setTimer(() => {
      warning.remove();
      if (!gameRunning || isLevelChanging) return;

      const pattern = document.createElement('div');
      pattern.className = 'pattern side-pattern';
      pattern.style.left = fromLeft ? '-40px' : `${gameArea.clientWidth + 6}px`;
      pattern.style.top = `${y}px`;
      gameArea.appendChild(pattern);

      hazards.push({
        element: pattern,
        x: fromLeft ? -40 : gameArea.clientWidth + 6,
        y,
        vx: fromLeft ? 5.75 + level * 0.17 : -(5.75 + level * 0.17),
        vy: 0,
        hit: false,
        removeOutside: true,
      });
    }, 500, false);
  }

  function createFloorZone(isTracking) {
    const size = isTracking ? 94 : 86;
    const x = isTracking
      ? playerX + player.clientWidth / 2 - size / 2
      : Math.random() * (gameArea.clientWidth - size);
    const y = isTracking
      ? playerY + player.clientHeight / 2 - size / 2
      : 170 + Math.random() * (gameArea.clientHeight - 235);

    const warning = document.createElement('div');
    warning.className = isTracking ? 'tracking-warning' : 'floor-warning';
    warning.style.left = `${Math.max(0, Math.min(gameArea.clientWidth - size, x))}px`;
    warning.style.top = `${Math.max(120, Math.min(gameArea.clientHeight - size, y))}px`;
    gameArea.appendChild(warning);

    setTimer(() => {
      if (!gameRunning || isLevelChanging) {
        warning.remove();
        return;
      }

      warning.remove();
      const blast = document.createElement('div');
      blast.className = isTracking ? 'tracking-blast' : 'floor-blast';
      blast.style.left = warning.style.left;
      blast.style.top = warning.style.top;
      gameArea.appendChild(blast);

      const hazard = { element: blast, x: 0, y: 0, vx: 0, vy: 0, hit: false, removeOutside: false };
      hazards.push(hazard);

      setTimer(() => {
        blast.remove();
        hazards = hazards.filter((item) => item !== hazard);
      }, 420, false);
    }, isTracking ? 720 : 850, false);
  }

  function createLaser() {
    const y = 150 + Math.random() * (gameArea.clientHeight - 250);

    const warning = document.createElement('div');
    warning.className = 'laser-warning';
    warning.style.top = `${y}px`;
    gameArea.appendChild(warning);
    playLaserWarningSound();

    setTimer(() => {
      if (!gameRunning || isLevelChanging) {
        warning.remove();
        return;
      }

      warning.remove();
      const laser = document.createElement('div');
      laser.className = 'laser-beam';
      laser.style.top = `${y}px`;
      gameArea.appendChild(laser);

      const hazard = { element: laser, x: 0, y: 0, vx: 0, vy: 0, hit: false, removeOutside: false };
      hazards.push(hazard);

      setTimer(() => {
        laser.remove();
        hazards = hazards.filter((item) => item !== hazard);
      }, 520, false);
    }, 820, false);
  }

  function fireSwordWaves() {
    const count = getSwordCount();
    const areaRect = gameArea.getBoundingClientRect();
    const bossRect = boss.getBoundingClientRect();
    const targetBaseX = bossRect.left - areaRect.left + bossRect.width / 2;
    const targetBaseY = bossRect.top - areaRect.top + bossRect.height / 2;
    const startX = playerX + player.clientWidth / 2;
    const startY = playerY - 18;
    const spacing = 18;
    const firstOffset = -((count - 1) * spacing) / 2;

    for (let i = 0; i < count; i += 1) {
      const sword = document.createElement('div');
      sword.className = 'sword-wave homing-sword';

      const x = startX + firstOffset + i * spacing - 9;
      const y = startY;
      const targetX = targetBaseX + firstOffset + i * spacing;
      const targetY = targetBaseY;
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const speed = 9.5 + level * 0.08;
      const vx = (dx / distance) * speed;
      const vy = (dy / distance) * speed;
      const rotateDeg = Math.atan2(vy, vx) * (180 / Math.PI) + 90;

      sword.style.left = `${x}px`;
      sword.style.top = `${y}px`;
      sword.style.transform = `rotate(${rotateDeg}deg)`;
      gameArea.appendChild(sword);

      swords.push({ element: sword, x, y, vx, vy, hit: false });
    }
  }

  function moveHazards() {
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      hazard.x += hazard.vx;
      hazard.y += hazard.vy;

      if (hazard.vx !== 0 || hazard.vy !== 0) {
        hazard.element.style.left = `${hazard.x}px`;
        hazard.element.style.top = `${hazard.y}px`;
      }

      const out =
        hazard.x < -90 ||
        hazard.x > gameArea.clientWidth + 90 ||
        hazard.y < -90 ||
        hazard.y > gameArea.clientHeight + 90;

      if (hazard.removeOutside && out) {
        hazard.element.remove();
        hazards.splice(i, 1);
      }
    }
  }

  function moveSwords() {
    for (let i = swords.length - 1; i >= 0; i -= 1) {
      const sword = swords[i];
      sword.x += sword.vx;
      sword.y += sword.vy;
      sword.element.style.left = `${sword.x}px`;
      sword.element.style.top = `${sword.y}px`;

      const out =
        sword.x < -80 ||
        sword.x > gameArea.clientWidth + 80 ||
        sword.y < -80 ||
        sword.y > gameArea.clientHeight + 80;

      if (out) {
        sword.element.remove();
        swords.splice(i, 1);
      }
    }
  }

  function isColliding(rectA, rectB) {
    return (
      rectA.left < rectB.right &&
      rectA.right > rectB.left &&
      rectA.top < rectB.bottom &&
      rectA.bottom > rectB.top
    );
  }

  function damagePlayer(hazard) {
    if (hazard.hit || isLevelChanging) return;
    hazard.hit = true;
    hp -= 1;
    playPlayerHitSound();
    updateHud();
    player.classList.add('damaged');
    setTimer(() => player.classList.remove('damaged'), 240, false);

    if (hazard.removeOutside) {
      hazard.element.remove();
      hazards = hazards.filter((item) => item !== hazard);
    }

    if (hp <= 0) endGame();
  }

  function checkPlayerCollision() {
    const playerRect = player.getBoundingClientRect();

    hazards.forEach((hazard) => {
      if (hazard.hit) return;
      const hazardRect = hazard.element.getBoundingClientRect();
      if (isColliding(playerRect, hazardRect)) {
        damagePlayer(hazard);
      }
    });
  }

  function showDamageText(amount) {
    const areaRect = gameArea.getBoundingClientRect();
    const bossRect = boss.getBoundingClientRect();
    const damageText = document.createElement('div');
    damageText.className = 'damage-text';
    damageText.textContent = `-${amount}`;
    damageText.style.left = `${bossRect.left - areaRect.left + bossRect.width / 2}px`;
    damageText.style.top = `${bossRect.top - areaRect.top + 6}px`;
    gameArea.appendChild(damageText);

    setTimer(() => damageText.remove(), 650, false);
  }

  function showBossExplosion() {
    const areaRect = gameArea.getBoundingClientRect();
    const bossRect = boss.getBoundingClientRect();
    const explosion = document.createElement('div');
    explosion.className = 'boss-explosion';
    explosion.textContent = '✦';
    explosion.style.left = `${bossRect.left - areaRect.left + bossRect.width / 2}px`;
    explosion.style.top = `${bossRect.top - areaRect.top + bossRect.height / 2}px`;
    gameArea.appendChild(explosion);

    setTimer(() => explosion.remove(), 900, false);
  }

  function checkSwordCollision() {
    if (isLevelChanging) return;
    const bossRect = boss.getBoundingClientRect();

    for (let i = swords.length - 1; i >= 0; i -= 1) {
      const sword = swords[i];
      if (sword.hit) continue;

      const swordRect = sword.element.getBoundingClientRect();
      if (isColliding(swordRect, bossRect)) {
        sword.hit = true;
        sword.element.remove();
        swords.splice(i, 1);
        bossHp -= SWORD_DAMAGE;
        score += 3 + level;
        showDamageText(SWORD_DAMAGE);
        playBossHitSound();
        boss.classList.add('boss-hit');
        setTimer(() => boss.classList.remove('boss-hit'), 180, false);
        updateHud();

        if (bossHp <= 0) {
          clearBoss();
          break;
        }
      }
    }
  }

  function clearBoss() {
    if (isLevelChanging) return;
    isLevelChanging = true;
    bossHp = 0;
    score += 500 + level * 120;
    playBossClearSound();
    updateHud();
    clearTimers(false);
    removeRaidObjects();

    showBossExplosion();
    boss.classList.add('boss-dead');
    clearEffect.classList.remove('hidden');
    clearEffect.textContent = `LEVEL ${level} BOSS CLEAR!`;

    setTimer(() => {
      if (!gameRunning) return;
      level += 1;
      bossMaxHp = getBossMaxHp();
      bossHp = bossMaxHp;
      hp = Math.min(MAX_HP, hp + 1);
      updateHud();
      clearEffect.textContent = `LEVEL ${level} START!`;
      playLevelStartSound();
    }, 1200, false);

    setTimer(() => {
      if (!gameRunning) return;
      isLevelChanging = false;
      boss.classList.remove('boss-dead');
      clearEffect.classList.add('hidden');
      updateHud();
      startLevelTimers();
    }, 2100, false);
  }

  function endGame() {
    gameRunning = false;
    isLevelChanging = false;
    playPlayerDeathSound();
    stopBgm();
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

  if (bgmVolumeControl) {
    bgmVolumeControl.addEventListener('input', () => updateAudioLevels(true));
  }

  if (sfxVolumeControl) {
    sfxVolumeControl.addEventListener('input', () => updateAudioLevels(true));
  }

  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      updateAudioLevels(true);
    });
  }

  loadAudioSettings();
  updateAudioLevels(false);

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
