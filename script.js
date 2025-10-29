document.getElementById("start-btn").addEventListener("click", startGame);
// Game constants
const GAME_DURATION = 30; // seconds
const SPAWN_INTERVAL = 700; // ms between spawn attempts
const MIN_FALL_TIME = 3500; // ms
const MAX_FALL_TIME = 6000; // ms

// State
let score = 0;
let timeLeft = GAME_DURATION;
let running = false;
let spawnIntervalId = null;
let countdownIntervalId = null;
let canIntervalId = null;

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

  // Spawn drops periodically
  spawnIntervalId = setInterval(() => spawnDrop(), SPAWN_INTERVAL);
  // Spawn a water can every 10 seconds
  canIntervalId = setInterval(() => spawnCan(), 10000);

  // Start countdown timer that updates every second
  countdownIntervalId = setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
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

  // Remove remaining drops with a short fade
  const drops = Array.from(gameContainer.querySelectorAll('.drop'));
  drops.forEach(d => d.remove());

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
  const fallTime = randInt(MIN_FALL_TIME + 800, MAX_FALL_TIME + 1200);
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

// Create a single drop. Randomly decides clean vs polluted.
function spawnDrop() {
  if (!running) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('drop');

  // Decide type: clean more likely than polluted
  const isPolluted = Math.random() < 0.28; // ~28% polluted
  const img = document.createElement('img');
  img.src = isPolluted ? 'img/polluted-drop.svg' : 'img/clean-drop.svg';
  img.alt = isPolluted ? 'Polluted drop' : 'Clean drop';

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
  const fallTime = randInt(MIN_FALL_TIME, MAX_FALL_TIME);
  wrapper.style.animation = `fall ${fallTime}ms linear forwards`;

  // Click or tap to collect. Use pointerdown for responsiveness.
  const onCollect = (ev) => {
    ev.stopPropagation();
    wrapper.classList.add('collected');
    if (isPolluted) score = Math.max(-9999, score - 1);
    else score += 1;
    scoreEl.textContent = score;
    // Floating feedback
    showFloatingScore(x + size / 2, wrapper.getBoundingClientRect().top + 10, isPolluted ? '-1' : '+1', isPolluted ? '#ff6b6b' : '#1ec6ff');

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
