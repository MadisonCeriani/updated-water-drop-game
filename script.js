// Game constants
const GAME_DURATION = 30; // seconds
const SPAWN_INTERVAL = 700; // ms between spawn attempts
const MIN_FALL_TIME = 3500; // ms
const MAX_FALL_TIME = 6000; // ms

// Difficulty configuration (values chosen to feel meaningfully different)
const DIFFICULTY_SETTINGS = {
  easy:  { spawnInterval: 800,  minFall: 4400, maxFall: 7900 },
  medium:{ spawnInterval: 600,  minFall: 3400, maxFall: 5900 },
  hard:  { spawnInterval: 580,  minFall: 2600, maxFall: 4200 }
};

// Current runtime values (initialized to medium defaults)
let currentSpawnInterval = SPAWN_INTERVAL;
let currentMinFallTime = MIN_FALL_TIME;
let currentMaxFallTime = MAX_FALL_TIME;
let difficulty = 'medium';

// State
let score = 0;
let timeLeft = GAME_DURATION;
let running = false;
let spawnIntervalId = null;
let countdownIntervalId = null;
let canIntervalId = null;
// oil spill feature removed
let halfwayShown = false;
let halfwayTimeoutId = null;
// Bomb mechanic: shows a bomb in medium/hard mode; clicking it makes all drops polluted for 3s
let bombIntervalId = null;
let bombActive = false;
let bombTimeoutId = null;

// Elements
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const resetBtn = document.getElementById('reset-btn');
const pauseBtn = document.getElementById('pause-btn');
let paused = false;
// Splash sound element (for clean drops)
const splashSfxEl = document.getElementById && document.getElementById('splash-sfx');
const splashSfx = splashSfxEl ? splashSfxEl : new Audio('splash-effect-229315.mp3');
splashSfx.preload = 'auto';
splashSfx.volume = 0.75;

function playSplash() {
  try {
    // clone so multiple plays can overlap
    const s = splashSfx.cloneNode();
    s.volume = splashSfx.volume;
    s.play().catch(() => {});
  } catch (err) {
    // fallback
    const s = new Audio(splashSfx.src || 'splash-effect-229315.mp3');
    s.volume = splashSfx.volume;
    s.play().catch(() => {});
  }
}

// Utility: random integer in [min, max]
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Start the game: reset state and begin spawning + countdown
function startGame() {
  if (running) return; // prevent double-start
  running = true;
  score = 0;
  timeLeft = GAME_DURATION;
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  // reset paused/halfway state
  paused = false;
  if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.setAttribute('aria-pressed', 'false'); }
  halfwayShown = false;
  if (halfwayTimeoutId) { clearTimeout(halfwayTimeoutId); halfwayTimeoutId = null; }
  const existingHalf = document.querySelector('.halfway-msg');
  if (existingHalf) existingHalf.remove();
  // Read difficulty selector (if present) and apply settings
  const select = document.getElementById('difficulty-select');
  if (select && select.value && DIFFICULTY_SETTINGS[select.value]) {
    difficulty = select.value;
    const s = DIFFICULTY_SETTINGS[difficulty];
    currentSpawnInterval = s.spawnInterval;
    currentMinFallTime = s.minFall;
    currentMaxFallTime = s.maxFall;
  } else {
    // fallback to medium/defaults
    difficulty = difficulty || 'medium';
    currentSpawnInterval = DIFFICULTY_SETTINGS[difficulty].spawnInterval || SPAWN_INTERVAL;
    currentMinFallTime = DIFFICULTY_SETTINGS[difficulty].minFall || MIN_FALL_TIME;
    currentMaxFallTime = DIFFICULTY_SETTINGS[difficulty].maxFall || MAX_FALL_TIME;
  }

  startSpawning();
  startCountdownInterval();
}

function startSpawning() {
  // Spawn drops periodically (using currentSpawnInterval)
  if (spawnIntervalId) clearInterval(spawnIntervalId);
  spawnIntervalId = setInterval(() => spawnDrop(), currentSpawnInterval);
  // Spawn a water can every 10 seconds
  if (canIntervalId) clearInterval(canIntervalId);
  canIntervalId = setInterval(() => spawnCan(), 10000);
  // Bomb: spawn every 5 seconds on medium & hard
  if (bombIntervalId) { clearInterval(bombIntervalId); bombIntervalId = null; }
  if (difficulty === 'medium' || difficulty === 'hard') {
    bombIntervalId = setInterval(() => spawnBomb(), 5000);
  }
}

function startCountdownInterval() {
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;
    // Show halfway message once when we reach half the game duration
    if (!halfwayShown && timeLeft === Math.floor(GAME_DURATION / 2)) {
      halfwayShown = true;
      showHalfwayMessage();
    }
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// Show a transient halfway message in the middle of the game
function showHalfwayMessage() {
  // clear any existing
  const existing = document.querySelector('.halfway-msg');
  if (existing) existing.remove();
  if (halfwayTimeoutId) { clearTimeout(halfwayTimeoutId); halfwayTimeoutId = null; }

  const el = document.createElement('div');
  el.className = 'halfway-msg';
  el.textContent = "Halfway There 🎊";
  document.body.appendChild(el);

  // trigger show animation
  requestAnimationFrame(() => el.classList.add('show'));

  // remove after 3s
  halfwayTimeoutId = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
    halfwayTimeoutId = null;
  }, 3000);
}

function pauseGame() {
  if (!running || paused) return;
  paused = true;
  // stop spawning and countdown
  if (spawnIntervalId) { clearInterval(spawnIntervalId); spawnIntervalId = null; }
  if (canIntervalId) { clearInterval(canIntervalId); canIntervalId = null; }
  if (bombIntervalId) { clearInterval(bombIntervalId); bombIntervalId = null; }
  if (bombTimeoutId) { clearTimeout(bombTimeoutId); bombTimeoutId = null; bombActive = false; }
  if (bombIntervalId) { clearInterval(bombIntervalId); bombIntervalId = null; }

  // remove any bomb elements and clear bomb timeouts
  const bombs = Array.from(gameContainer.querySelectorAll('.bomb'));
  bombs.forEach(b => b.remove());
  if (bombTimeoutId) { clearTimeout(bombTimeoutId); bombTimeoutId = null; }
  if (countdownIntervalId) { clearInterval(countdownIntervalId); countdownIntervalId = null; }
  if (bombIntervalId) { clearInterval(bombIntervalId); bombIntervalId = null; }
  // visually pause animations and block interactions inside game container
  gameContainer.classList.add('paused');
  if (pauseBtn) { pauseBtn.textContent = 'Resume'; pauseBtn.setAttribute('aria-pressed', 'true'); }
}

function resumeGame() {
  if (!running || !paused) return;
  paused = false;
  // restart spawning and countdown
  startSpawning();
  startCountdownInterval();
  gameContainer.classList.remove('paused');
  if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.setAttribute('aria-pressed', 'false'); }
}

// Update the water rectangle inside the can to visually reflect canFill.
// (can feature removed)

// End the game: stop timers, clear drops, and show overlay
function endGame() {
  running = false;
  clearInterval(spawnIntervalId);
  clearInterval(countdownIntervalId);
  if (canIntervalId) { clearInterval(canIntervalId); canIntervalId = null; }
  spawnIntervalId = null;
  countdownIntervalId = null;

  // clear halfway message timeout and remove element if present
  if (halfwayTimeoutId) { clearTimeout(halfwayTimeoutId); halfwayTimeoutId = null; }
  const halfwayEl = document.querySelector('.halfway-msg');
  if (halfwayEl) halfwayEl.remove();

  // reset paused state and update pause button
  if (paused) paused = false;
  if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.setAttribute('aria-pressed', 'false'); }
  // ensure any visual paused state is cleared
  gameContainer.classList.remove('paused');

  // Remove remaining drops with a short fade
  const drops = Array.from(gameContainer.querySelectorAll('.drop'));
  drops.forEach(d => d.remove());

  // remove any bomb elements
  const bombs = Array.from(gameContainer.querySelectorAll('.bomb'));
  bombs.forEach(b => b.remove());

  // Show overlay with final score
  finalScoreEl.textContent = score;
  overlayTitle.textContent = timeLeft <= 0 ? "Time's up!" : "Game over";
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  // trigger confetti celebration
  launchConfetti(80);
  // stop confetti after a few seconds
  setTimeout(() => stopConfetti(), 4200);
}

/* ----------------- Confetti system ----------------- */
const confettiCanvas = document.getElementById('confetti-canvas');
let confettiCtx = null;
let confettiParticles = [];
let confettiAnimating = false;

function initConfetti() {
  if (!confettiCanvas) return;
  confettiCtx = confettiCanvas.getContext('2d');
  resizeConfettiCanvas();
  window.addEventListener('resize', resizeConfettiCanvas);
}

function resizeConfettiCanvas() {
  if (!confettiCanvas) return;
  confettiCanvas.width = confettiCanvas.clientWidth * devicePixelRatio;
  confettiCanvas.height = confettiCanvas.clientHeight * devicePixelRatio;
  if (confettiCtx) confettiCtx.scale(devicePixelRatio, devicePixelRatio);
}

function randomRange(a, b) { return a + Math.random() * (b - a); }

function createParticle(x, y) {
  const colors = ['#FFD166', '#06B6D4', '#EF476F', '#2EC4B6', '#FFA07A', '#8AD2FF'];
  return {
    x, y,
    vx: randomRange(-2.5, 2.5),
    vy: randomRange(-6, -2),
    size: randomRange(6, 12),
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: randomRange(0, Math.PI * 2),
    vr: randomRange(-0.15, 0.15),
    life: 0,
    ttl: randomRange(80, 140)
  };
}

function drawConfetti() {
  if (!confettiCtx) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  const ctx = confettiCtx;
  confettiParticles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });
}

function stepConfetti() {
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.vy += 0.18; // gravity
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life++;
    if (p.life > p.ttl) confettiParticles.splice(i, 1);
  }
  drawConfetti();
  if (confettiAnimating) requestAnimationFrame(stepConfetti);
}

function launchConfetti(count = 60) {
  if (!confettiCanvas) return;
  if (!confettiCtx) initConfetti();
  const rect = confettiCanvas.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * rect.width;
    const y = rect.height * 0.15 + Math.random() * rect.height * 0.1; // spawn from near top
    confettiParticles.push(createParticle(x, y));
  }
  if (!confettiAnimating) {
    confettiAnimating = true;
    requestAnimationFrame(stepConfetti);
  }
}

function stopConfetti() {
  confettiAnimating = false;
  if (confettiCtx && confettiCanvas) {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles = [];
  }
}

// Initialize canvas sizing on load
initConfetti();

/* ----------------- end confetti ----------------- */

// Reset the game immediately: stop timers, clear drops/floating UI, then start fresh
function resetGame() {
  // stop existing timers
  running = false;
  if (spawnIntervalId) { clearInterval(spawnIntervalId); spawnIntervalId = null; }
  if (countdownIntervalId) { clearInterval(countdownIntervalId); countdownIntervalId = null; }
  if (canIntervalId) { clearInterval(canIntervalId); canIntervalId = null; }

  // clear drops
  const drops = Array.from(gameContainer.querySelectorAll('.drop'));
  drops.forEach(d => d.remove());

  // clear any transient floating score elements (they're appended to body)
  const floats = Array.from(document.querySelectorAll('body > div'))
    .filter(el => el && el.textContent && (/^[+-]\d+$/.test(el.textContent.trim())));
  floats.forEach(f => f.remove());

  // hide overlay if visible
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');

  // remove any existing cans
  const cans = Array.from(gameContainer.querySelectorAll('.drop.can'));
  cans.forEach(c => c.remove());
  
  // clear halfway message timeout and remove element if present
  if (halfwayTimeoutId) { clearTimeout(halfwayTimeoutId); halfwayTimeoutId = null; }
  const halfwayEl = document.querySelector('.halfway-msg');
  if (halfwayEl) halfwayEl.remove();
  // reset paused state and update pause button
  if (paused) paused = false;
  if (pauseBtn) { pauseBtn.textContent = 'Pause'; pauseBtn.setAttribute('aria-pressed', 'false'); }
  gameContainer.classList.remove('paused');

  // restart the game fresh
  startGame();
}

// Create and spawn a water can drop worth +3 points
function spawnCan() {
  if (!running) return;
  const wrapper = document.createElement('div');
  wrapper.classList.add('drop', 'can');

  const img = document.createElement('img');
  img.src = 'img/water-can.png';
  img.alt = 'Water can';
  img.style.width = '64px';
  wrapper.appendChild(img);

  // place randomly like other drops
  const containerRect = gameContainer.getBoundingClientRect();
  const size = 64;
  const x = Math.random() * (containerRect.width - size - 8) + 4;
  wrapper.style.left = x + 'px';

  // fall with slightly slower animation so players can tap it
  const fallTime = randInt(currentMinFallTime + 800, currentMaxFallTime + 1200);
  wrapper.style.animation = `fall ${fallTime}ms linear forwards`;

  const onCollect = (ev) => {
    ev.stopPropagation();
    wrapper.classList.add('collected');
    score += 3; // can gives +3 points
    scoreEl.textContent = score;
    showFloatingScore(x + size / 2, wrapper.getBoundingClientRect().top + 10, '+3', '#ffd166');
    setTimeout(() => wrapper.remove(), 260);
  };

  wrapper.addEventListener('pointerdown', onCollect, { once: true });
  wrapper.addEventListener('animationend', () => wrapper.remove());
  gameContainer.appendChild(wrapper);
}

// Spawn a clickable bomb in the game container. Clicking it makes all drops polluted for 3s.
function spawnBomb() {
  if (!running) return;
  // avoid multiple bombs at once
  if (gameContainer.querySelector('.bomb')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'bomb';
  wrapper.textContent = '💣';

  const containerRect = gameContainer.getBoundingClientRect();
  const size = 52;
  const x = Math.random() * (containerRect.width - size - 8) + 4;
  wrapper.style.left = x + 'px';

  // Give the bomb a fall animation similar to drops so it falls from top to bottom
  const fallTime = randInt(currentMinFallTime + 400, currentMaxFallTime + 900);
  wrapper.style.animation = `fall ${fallTime}ms linear forwards`;

  // random rotation for personality
  const rotClass = Math.random() > 0.5 ? 'rotate-1' : 'rotate-2';
  wrapper.classList.add(rotClass);

  // When clicked, activate polluted state for 3s and remove bomb
  wrapper.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    activateBombPollution();
    wrapper.remove();
  }, { once: true });

  // Remove when reaches bottom
  wrapper.addEventListener('animationend', () => wrapper.remove());

  // Safety: auto-remove after a reasonable time if something prevents animationend
  setTimeout(() => { if (wrapper.parentNode) wrapper.remove(); }, fallTime + 500);

  gameContainer.appendChild(wrapper);
}

// Turn all drops polluted for a short duration, then restore their original state
function activateBombPollution() {
  if (bombActive) return;
  bombActive = true;

  // visually and logically mark all current drops as polluted
  const dropWrappers = gameContainer.querySelectorAll('.drop');
  dropWrappers.forEach(w => {
    w.dataset.polluted = 'true';
    const img = w.querySelector('img');
    if (img) { img.src = 'img/polluted-drop.svg'; img.alt = 'Polluted drop'; }
  });

  // clear any existing bomb timeout
  if (bombTimeoutId) { clearTimeout(bombTimeoutId); bombTimeoutId = null; }

  bombTimeoutId = setTimeout(() => {
    bombActive = false;
    // restore each drop to its original pollution state
    const drops = gameContainer.querySelectorAll('.drop');
    drops.forEach(w => {
      const orig = w.dataset.origPolluted === 'true';
      w.dataset.polluted = orig ? 'true' : 'false';
      const img = w.querySelector('img');
      if (img) {
        img.src = orig ? 'img/polluted-drop.svg' : 'img/clean-drop.svg';
        img.alt = orig ? 'Polluted drop' : 'Clean drop';
      }
    });
    bombTimeoutId = null;
  }, 3000);
}

// oil spill feature removed

// Create a single drop. Randomly decides clean vs polluted.
function spawnDrop() {
  if (!running) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('drop');

  // Decide type: clean more likely than polluted
  const isPolluted = Math.random() < 0.28; // ~28% polluted
  // if a bomb is active, new drops should be polluted while it lasts
  const effectivePolluted = bombActive || isPolluted;
  const img = document.createElement('img');
  img.src = effectivePolluted ? 'img/polluted-drop.svg' : 'img/clean-drop.svg';
  img.alt = effectivePolluted ? 'Polluted drop' : 'Clean drop';

  // record original pollution state so we can restore after a bomb
  wrapper.dataset.origPolluted = isPolluted ? 'true' : 'false';
  wrapper.dataset.polluted = effectivePolluted ? 'true' : 'false';

  // Slight random rotation class for personality
  const rotClass = Math.random() > 0.5 ? 'rotate-1' : 'rotate-2';
  wrapper.classList.add(rotClass);

  wrapper.appendChild(img);

  // Random horizontal position inside the container
  const containerRect = gameContainer.getBoundingClientRect();
  // Choose size based on container width for responsiveness
  let sizeMin = 36, sizeMax = 68;
  if (containerRect.width <= 360) { sizeMin = 30; sizeMax = 46; }
  else if (containerRect.width <= 520) { sizeMin = 34; sizeMax = 54; }
  else if (containerRect.width >= 1000) { sizeMin = 46; sizeMax = 84; }
  const size = randInt(sizeMin, sizeMax); // choose a visual size for the SVG
  img.style.width = size + 'px';
  const x = Math.random() * (containerRect.width - size - 8) + 4;
  wrapper.style.left = x + 'px';

  // Random fall duration so drops feel natural
  const fallTime = randInt(currentMinFallTime, currentMaxFallTime);
  wrapper.style.animation = `fall ${fallTime}ms linear forwards`;

  // Click or tap to collect. Use pointerdown for responsiveness.
  const onCollect = (ev) => {
    ev.stopPropagation();
    wrapper.classList.add('collected');
    // Evaluate pollution status at click time. Bombs temporarily force pollution.
    const nowPolluted = bombActive || wrapper.dataset.polluted === 'true';
    if (nowPolluted) score = Math.max(-9999, score - 1);
    else {
      score += 1;
      // play splash sound for clean drops
      playSplash();
    }
    scoreEl.textContent = score;
    // Floating feedback
    showFloatingScore(x + size / 2, wrapper.getBoundingClientRect().top + 10, nowPolluted ? '-1' : '+1', nowPolluted ? '#ff6b6b' : '#1ec6ff');

    // no can logic: just update score

    setTimeout(() => wrapper.remove(), 260);
  };

  wrapper.addEventListener('pointerdown', onCollect, { once: true });

  // Remove when reaches bottom
  wrapper.addEventListener('animationend', () => wrapper.remove());

  gameContainer.appendChild(wrapper);
}

// Small helper that shows a floating +1 or -1 where the drop was collected
function showFloatingScore(x, y, text, color) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.left = (x - 12) + 'px';
  el.style.top = (y - 6) + 'px';
  el.style.color = color;
  el.style.fontWeight = '800';
  el.style.pointerEvents = 'none';
  el.style.transition = 'transform 700ms ease, opacity 700ms ease';
  el.style.transform = 'translateY(0px)';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(-40px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 800);
}

// Wiring: Start and Restart buttons
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => startGame());
if (resetBtn) resetBtn.addEventListener('click', resetGame);
if (pauseBtn) pauseBtn.addEventListener('click', () => { if (paused) resumeGame(); else pauseGame(); });

// Accessibility: pressing Space/Enter while overlay focused restarts
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') startGame();
});

// Defensive: if user navigates away or resizing causes odd sizes, clear drops on large resize
window.addEventListener('resize', () => {
  // remove offscreen drops occasionally to avoid buildup
  const drops = gameContainer.querySelectorAll('.drop');
  if (drops.length > 200) drops.forEach(d => d.remove());
});
