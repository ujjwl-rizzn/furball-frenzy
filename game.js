diff --git a/game.js b/game.js
index 9b8fd20587b171aaffd65b7ae97c6aa2094847e2..73e3f430bb5f52018daeb40a1fcb1184983a083d 100644
--- a/game.js
+++ b/game.js
@@ -1,232 +1,650 @@
+"use strict";
+
 const canvas = document.getElementById("game");
 const ctx = canvas.getContext("2d");
 
-// RESPONSIVE CANVAS
+const scoreEl = document.getElementById("score");
+const highScoreEl = document.getElementById("highScore");
+const coinsEl = document.getElementById("coins");
+const multiplierEl = document.getElementById("multiplier");
+const missionTextEl = document.getElementById("missionText");
+const powerTimersEl = document.getElementById("powerTimers");
+const pauseToggleBtn = document.getElementById("pauseToggle");
+const soundToggleBtn = document.getElementById("soundToggle");
+const popupEl = document.getElementById("popup");
+
+const GAME_CONFIG = Object.freeze({
+  player: Object.freeze({
+    size: 20,
+    baseSpeed: 5,
+    speedBoost: 8
+  }),
+  progression: Object.freeze({
+    difficultyRate: 0.0012,
+    coinEveryScore: 90,
+    multiplierStepMs: 9000,
+    maxMultiplier: 4
+  }),
+  spawn: Object.freeze({
+    enemyMs: 900,
+    powerUpMs: 4800
+  }),
+  powerUps: Object.freeze({
+    shieldMs: 5000,
+    speedMs: 3500
+  }),
+  particles: Object.freeze({
+    count: 12,
+    life: 30
+  }),
+  enemies: Object.freeze({
+    baseChaserSpeed: 2,
+    chaserScale: 0.48,
+    zigzagScale: 0.38,
+    tankScale: 0.28,
+    sniperScale: 0.33
+  }),
+  skins: Object.freeze([
+    Object.freeze({ color: "lime", price: 0, label: "Default" }),
+    Object.freeze({ color: "cyan", price: 5, label: "Cyan" }),
+    Object.freeze({ color: "yellow", price: 10, label: "Yellow" }),
+    Object.freeze({ color: "red", price: 20, label: "Red" }),
+    Object.freeze({ color: "magenta", price: 35, label: "Magenta" })
+  ])
+});
+
+const VALID_SKINS = new Set(GAME_CONFIG.skins.map(s => s.color));
+
+function clamp(num, min, max) {
+  return Math.max(min, Math.min(max, num));
+}
+
+function safeInt(key, fallback, min = 0, max = 99999999) {
+  const raw = localStorage.getItem(key);
+  const val = Number.parseInt(raw, 10);
+  if (!Number.isFinite(val)) return fallback;
+  return clamp(val, min, max);
+}
+
+function safeBool(key, fallback = true) {
+  const raw = localStorage.getItem(key);
+  if (raw === null) return fallback;
+  return raw === "true";
+}
+
+function safeOwnedSkins() {
+  const raw = localStorage.getItem("ownedSkins");
+  if (!raw) return new Set(["lime"]);
+  try {
+    const arr = JSON.parse(raw);
+    if (!Array.isArray(arr)) return new Set(["lime"]);
+    const valid = arr.filter(c => typeof c === "string" && VALID_SKINS.has(c));
+    if (!valid.includes("lime")) valid.push("lime");
+    return new Set(valid);
+  } catch {
+    return new Set(["lime"]);
+  }
+}
+
+function checksumState(nextCoins, nextHighScore, ownedCount) {
+  return String((nextCoins * 31 + nextHighScore * 17 + ownedCount * 13) % 1000003);
+}
+
+function verifyStateOrRepair() {
+  const stored = localStorage.getItem("stateChecksum");
+  const expected = checksumState(coins, highScore, ownedSkins.size);
+  if (stored && stored !== expected) {
+    coins = 0;
+    highScore = Math.max(0, highScore);
+    ownedSkins.clear();
+    ownedSkins.add("lime");
+    player.color = "lime";
+    persistState();
+    showPopup("Save data was invalid and has been repaired.", "warn");
+  }
+}
+
+function persistState() {
+  localStorage.setItem("coins", String(coins));
+  localStorage.setItem("highScore", String(highScore));
+  localStorage.setItem("selectedSkin", player.color);
+  localStorage.setItem("ownedSkins", JSON.stringify(Array.from(ownedSkins)));
+  localStorage.setItem("soundEnabled", String(soundEnabled));
+  localStorage.setItem("stateChecksum", checksumState(coins, highScore, ownedSkins.size));
+}
+
 function resize() {
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;
 }
 resize();
 window.addEventListener("resize", resize);
 
-// PLAYER
 let player = {
   x: canvas.width / 2,
   y: canvas.height / 2,
-  size: 20,
-  speed: 5,
-  shield: false
+  size: GAME_CONFIG.player.size,
+  speed: GAME_CONFIG.player.baseSpeed,
+  shield: false,
+  color: VALID_SKINS.has(localStorage.getItem("selectedSkin")) ? localStorage.getItem("selectedSkin") : "lime"
 };
 
-// DATA
-let coins = parseInt(localStorage.getItem("coins")) || 0;
+let coins = safeInt("coins", 0);
+let highScore = safeInt("highScore", 0);
+const ownedSkins = safeOwnedSkins();
+let soundEnabled = safeBool("soundEnabled", true);
+
 let enemies = [];
 let particles = [];
 let powerUps = [];
 
 let score = 0;
 let gameRunning = false;
+let paused = false;
 let difficulty = 1;
+let audioCtx = null;
+let shieldUntil = 0;
+let speedUntil = 0;
+let survivalChainMs = 0;
+let multiplier = 1;
+let mission = {
+  targetSec: 30,
+  reward: 12,
+  done: false
+};
+
+verifyStateOrRepair();
+
+function maybeGrantDailyReward() {
+  const now = new Date();
+  const todayKey = `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
+  const last = localStorage.getItem("dailyRewardDate");
+  if (last !== todayKey) {
+    coins += 5;
+    localStorage.setItem("dailyRewardDate", todayKey);
+    persistState();
+    showPopup("Daily reward: +5 coins", "success");
+    playSound("purchase");
+  }
+}
 
-// INPUT
-let keys = {};
-window.addEventListener("keydown", e => keys[e.key] = true);
-window.addEventListener("keyup", e => keys[e.key] = false);
+let keys = Object.create(null);
+let touchX = null;
+let touchY = null;
+
+window.addEventListener("keydown", e => {
+  keys[e.key] = true;
+  if (e.key === "Escape") togglePause();
+});
+window.addEventListener("keyup", e => {
+  keys[e.key] = false;
+});
 
-let touchX = null, touchY = null;
 canvas.addEventListener("touchmove", e => {
+  e.preventDefault();
   touchX = e.touches[0].clientX;
   touchY = e.touches[0].clientY;
+}, { passive: false });
+canvas.addEventListener("touchend", () => {
+  touchX = null;
+  touchY = null;
 });
 
-// START
+function showPopup(message, type = "info") {
+  if (!popupEl) return;
+  popupEl.innerText = message;
+  popupEl.classList.remove("hidden");
+  popupEl.style.borderColor = type === "success" ? "#84ffb0" : type === "warn" ? "#ffd27f" : "#97a8ff";
+  clearTimeout(showPopup.timer);
+  showPopup.timer = setTimeout(() => popupEl.classList.add("hidden"), 1800);
+}
+showPopup.timer = null;
+
+function updateTopBar() {
+  scoreEl.innerText = Math.floor(score);
+  highScoreEl.innerText = highScore;
+  coinsEl.innerText = coins;
+  multiplierEl.innerText = `${multiplier.toFixed(1)}x`;
+  missionTextEl.innerText = mission.done
+    ? `Completed! +${mission.reward} coins`
+    : `Survive ${mission.targetSec}s (${Math.floor(score / 60)}s)`;
+
+  const now = Date.now();
+  const shieldRemaining = Math.max(0, (shieldUntil - now) / 1000);
+  const speedRemaining = Math.max(0, (speedUntil - now) / 1000);
+  powerTimersEl.innerText = `Shield: ${shieldRemaining.toFixed(1)}s | Speed: ${speedRemaining.toFixed(1)}s`;
+}
+
+function updatePauseButton() {
+  if (pauseToggleBtn) pauseToggleBtn.innerText = paused ? "Resume" : "Pause";
+}
+
+function updateSoundButton() {
+  if (soundToggleBtn) soundToggleBtn.innerText = `Sound: ${soundEnabled ? "On" : "Off"}`;
+}
+
+function updateShopButtons() {
+  for (const skin of GAME_CONFIG.skins) {
+    const btn = document.getElementById(`skin-${skin.color}`);
+    if (!btn) continue;
+
+    const owned = ownedSkins.has(skin.color);
+    const equipped = player.color === skin.color;
+    let suffix = "";
+    if (equipped) suffix = " - Equipped";
+    else if (owned) suffix = " - Owned";
+
+    btn.innerText = `${skin.label} (${skin.price})${suffix}`;
+    btn.disabled = !owned && coins < skin.price;
+  }
+}
+
 function startGame() {
   document.getElementById("menu").classList.add("hidden");
   document.getElementById("ui").classList.remove("hidden");
+
+  maybeGrantDailyReward();
+  initAudio();
+  playSound("start");
+
   gameRunning = true;
+  paused = false;
+  updatePauseButton();
+  updateShopButtons();
+}
+
+function togglePause() {
+  if (!gameRunning) return;
+  paused = !paused;
+  updatePauseButton();
+  playSound("click");
+}
+
+function toggleShop() {
+  playSound("click");
+  document.getElementById("shop").classList.toggle("hidden");
+  updateShopButtons();
+}
+
+function buySkin(color, price) {
+  if (!VALID_SKINS.has(color)) {
+    showPopup("Invalid skin selection", "warn");
+    return;
+  }
+
+  if (!ownedSkins.has(color)) {
+    if (coins < price) {
+      playSound("error");
+      showPopup("Not enough coins", "warn");
+      return;
+    }
+    coins -= price;
+    ownedSkins.add(color);
+    playSound("purchase");
+    showPopup(`Unlocked ${color} skin!`, "success");
+  } else {
+    playSound("click");
+  }
+
+  player.color = color;
+  persistState();
+  updateTopBar();
+  updateShopButtons();
+}
+
+function initAudio() {
+  if (!audioCtx) {
+    const AudioContext = window.AudioContext || window.webkitAudioContext;
+    if (!AudioContext) return;
+    audioCtx = new AudioContext();
+  }
+  if (audioCtx.state === "suspended") {
+    audioCtx.resume();
+  }
+}
+
+function tone({ freq = 440, type = "sine", duration = 0.12, volume = 0.06, slideTo = null }) {
+  if (!soundEnabled) return;
+  initAudio();
+  if (!audioCtx) return;
+
+  const now = audioCtx.currentTime;
+  const osc = audioCtx.createOscillator();
+  const gain = audioCtx.createGain();
+
+  osc.type = type;
+  osc.frequency.setValueAtTime(freq, now);
+  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
+
+  gain.gain.setValueAtTime(0.0001, now);
+  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
+  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
+
+  osc.connect(gain);
+  gain.connect(audioCtx.destination);
+  osc.start(now);
+  osc.stop(now + duration + 0.02);
+}
+
+function playSound(kind) {
+  if (kind === "start") tone({ freq: 300, slideTo: 600, duration: 0.16, type: "triangle" });
+  if (kind === "coin") tone({ freq: 840, slideTo: 1200, duration: 0.1, type: "square", volume: 0.05 });
+  if (kind === "powerup") tone({ freq: 520, slideTo: 920, duration: 0.13, type: "triangle", volume: 0.05 });
+  if (kind === "hit") tone({ freq: 180, slideTo: 120, duration: 0.18, type: "sawtooth", volume: 0.07 });
+  if (kind === "gameover") tone({ freq: 260, slideTo: 90, duration: 0.35, type: "sawtooth", volume: 0.08 });
+  if (kind === "click") tone({ freq: 500, slideTo: 420, duration: 0.06, type: "triangle", volume: 0.04 });
+  if (kind === "purchase") tone({ freq: 600, slideTo: 1000, duration: 0.14, type: "square", volume: 0.05 });
+  if (kind === "error") tone({ freq: 220, slideTo: 160, duration: 0.12, type: "sawtooth", volume: 0.06 });
+  if (kind === "levelup") tone({ freq: 450, slideTo: 850, duration: 0.2, type: "triangle", volume: 0.06 });
+}
+
+function toggleSound() {
+  soundEnabled = !soundEnabled;
+  updateSoundButton();
+  persistState();
+  playSound("click");
 }
 
-// MOVE PLAYER (WITH BOUNDARY FIX)
 function movePlayer() {
-  if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
-  if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
-  if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
-  if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;
+  if (keys.ArrowUp || keys.w) player.y -= player.speed;
+  if (keys.ArrowDown || keys.s) player.y += player.speed;
+  if (keys.ArrowLeft || keys.a) player.x -= player.speed;
+  if (keys.ArrowRight || keys.d) player.x += player.speed;
 
   if (touchX !== null) {
     player.x += (touchX - player.x) * 0.08;
     player.y += (touchY - player.y) * 0.08;
   }
 
-  // KEEP INSIDE SCREEN ✅
-  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
-  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
+  player.x = clamp(player.x, player.size, canvas.width - player.size);
+  player.y = clamp(player.y, player.size, canvas.height - player.size);
 }
 
-// ENEMY SPAWN (SCALES WITH DIFFICULTY)
-function spawnEnemy() {
-  if (!gameRunning) return;
-
-  let edge = Math.floor(Math.random() * 4);
-  let x, y;
+function randomEdgeSpawn() {
+  const edge = Math.floor(Math.random() * 4);
+  if (edge === 0) return { x: 0, y: Math.random() * canvas.height };
+  if (edge === 1) return { x: canvas.width, y: Math.random() * canvas.height };
+  if (edge === 2) return { x: Math.random() * canvas.width, y: 0 };
+  return { x: Math.random() * canvas.width, y: canvas.height };
+}
 
-  if (edge === 0) { x = 0; y = Math.random()*canvas.height; }
-  if (edge === 1) { x = canvas.width; y = Math.random()*canvas.height; }
-  if (edge === 2) { x = Math.random()*canvas.width; y = 0; }
-  if (edge === 3) { x = Math.random()*canvas.width; y = canvas.height; }
+function spawnEnemy() {
+  if (!gameRunning || paused) return;
+
+  const { x, y } = randomEdgeSpawn();
+  const roll = Math.random();
+  let type = "chaser";
+  if (difficulty > 2.2 && roll > 0.65) type = "zigzag";
+  if (difficulty > 4.2 && roll > 0.84) type = "tank";
+  if (difficulty > 6.2 && roll > 0.93) type = "sniper";
+
+  const base = GAME_CONFIG.enemies.baseChaserSpeed;
+  const speedByType = {
+    chaser: base + difficulty * GAME_CONFIG.enemies.chaserScale,
+    zigzag: base + difficulty * GAME_CONFIG.enemies.zigzagScale,
+    tank: base + difficulty * GAME_CONFIG.enemies.tankScale,
+    sniper: base + difficulty * GAME_CONFIG.enemies.sniperScale
+  };
+
+  const sizeByType = {
+    chaser: 15,
+    zigzag: 11,
+    tank: 22,
+    sniper: 13
+  };
 
   enemies.push({
-    x, y,
-    size: 15,
-    speed: 2 + difficulty * 0.5
+    x,
+    y,
+    type,
+    size: sizeByType[type],
+    speed: speedByType[type],
+    zigzagPhase: Math.random() * Math.PI * 2,
+    pulseTimer: 0
   });
 }
 
-// POWER UPS
 function spawnPowerUp() {
-  if (!gameRunning) return;
-
-  let types = ["shield", "speed"];
-  let type = types[Math.floor(Math.random()*types.length)];
+  if (!gameRunning || paused) return;
 
+  const type = Math.random() > 0.5 ? "shield" : "speed";
   powerUps.push({
     x: Math.random() * canvas.width,
     y: Math.random() * canvas.height,
     type,
     size: 12
   });
 }
 
-// PARTICLES
 function createParticles(x, y) {
-  for (let i = 0; i < 10; i++) {
+  for (let i = 0; i < GAME_CONFIG.particles.count; i++) {
     particles.push({
-      x, y,
-      dx: (Math.random()-0.5)*4,
-      dy: (Math.random()-0.5)*4,
-      life: 30
+      x,
+      y,
+      dx: (Math.random() - 0.5) * 4,
+      dy: (Math.random() - 0.5) * 4,
+      life: GAME_CONFIG.particles.life
     });
   }
 }
 
-// UPDATE
+function updatePlayerPowerStates() {
+  const now = Date.now();
+  player.shield = shieldUntil > now;
+  player.speed = speedUntil > now ? GAME_CONFIG.player.speedBoost : GAME_CONFIG.player.baseSpeed;
+}
+
+function updateMultiplier() {
+  survivalChainMs += 1000 / 60;
+  const next = 1 + Math.floor(survivalChainMs / GAME_CONFIG.progression.multiplierStepMs) * 0.3;
+  const clamped = clamp(next, 1, GAME_CONFIG.progression.maxMultiplier);
+  if (clamped > multiplier) {
+    multiplier = clamped;
+    playSound("levelup");
+    showPopup(`Multiplier up: ${multiplier.toFixed(1)}x`, "success");
+  }
+}
+
+function handleMission() {
+  if (mission.done) return;
+  const sec = score / 60;
+  if (sec >= mission.targetSec) {
+    mission.done = true;
+    coins += mission.reward;
+    persistState();
+    showPopup(`Mission complete! +${mission.reward} coins`, "success");
+    playSound("purchase");
+  }
+}
+
 function update() {
-  if (!gameRunning) return;
+  if (!gameRunning || paused) return;
 
   movePlayer();
+  updatePlayerPowerStates();
+  updateMultiplier();
+
+  difficulty += GAME_CONFIG.progression.difficultyRate;
+
+  for (let i = enemies.length - 1; i >= 0; i--) {
+    const e = enemies[i];
+    const dx = player.x - e.x;
+    const dy = player.y - e.y;
+    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
+
+    let nx = dx / dist;
+    let ny = dy / dist;
+
+    if (e.type === "zigzag") {
+      e.zigzagPhase += 0.12;
+      const perpX = -ny;
+      const perpY = nx;
+      const wave = Math.sin(e.zigzagPhase) * 0.9;
+      nx += perpX * wave;
+      ny += perpY * wave;
+      const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
+      nx /= nLen;
+      ny /= nLen;
+    }
 
-  // DIFFICULTY INCREASE 🔥
-  difficulty += 0.001;
-
-  // ENEMIES
-  enemies.forEach(e => {
-    let dx = player.x - e.x;
-    let dy = player.y - e.y;
-    let dist = Math.sqrt(dx*dx + dy*dy);
+    if (e.type === "sniper") {
+      e.pulseTimer += 1;
+      if (e.pulseTimer % 90 < 10) {
+        nx *= 2;
+        ny *= 2;
+      }
+    }
 
-    e.x += dx / dist * e.speed;
-    e.y += dy / dist * e.speed;
+    e.x += nx * e.speed;
+    e.y += ny * e.speed;
 
-    if (dist < player.size + e.size) {
+    const hitRange = player.size + e.size;
+    if (dist < hitRange) {
       if (player.shield) {
+        shieldUntil = 0;
         player.shield = false;
         createParticles(e.x, e.y);
+        enemies.splice(i, 1);
+        playSound("hit");
+        score += 30 * multiplier;
       } else {
         gameRunning = false;
+        paused = false;
+        updatePauseButton();
+        playSound("gameover");
+        showPopup("Game Over", "warn");
         document.getElementById("gameOver").classList.remove("hidden");
       }
     }
-  });
+  }
 
-  // POWER UPS COLLISION
-  powerUps.forEach((p, i) => {
-    let dx = player.x - p.x;
-    let dy = player.y - p.y;
-    let dist = Math.sqrt(dx*dx + dy*dy);
+  for (let i = powerUps.length - 1; i >= 0; i--) {
+    const p = powerUps[i];
+    const dx = player.x - p.x;
+    const dy = player.y - p.y;
+    const dist = Math.sqrt(dx * dx + dy * dy);
 
     if (dist < player.size + p.size) {
-      if (p.type === "shield") player.shield = true;
-      if (p.type === "speed") player.speed = 8;
-
-      setTimeout(() => player.speed = 5, 3000);
+      const now = Date.now();
+      if (p.type === "shield") shieldUntil = now + GAME_CONFIG.powerUps.shieldMs;
+      if (p.type === "speed") speedUntil = now + GAME_CONFIG.powerUps.speedMs;
+      playSound("powerup");
+      showPopup(`${p.type.toUpperCase()} activated`, "success");
 
       powerUps.splice(i, 1);
       createParticles(p.x, p.y);
     }
-  });
+  }
 
-  // PARTICLES UPDATE
-  particles.forEach((p, i) => {
+  for (let i = particles.length - 1; i >= 0; i--) {
+    const p = particles[i];
     p.x += p.dx;
     p.y += p.dy;
     p.life--;
-
     if (p.life <= 0) particles.splice(i, 1);
-  });
+  }
 
-  score++;
-  if (score % 100 === 0) coins++;
+  score += multiplier;
 
-  document.getElementById("score").innerText = Math.floor(score);
-  document.getElementById("coins").innerText = coins;
+  if (score > highScore) {
+    highScore = Math.floor(score);
+    persistState();
+  }
+
+  if (Math.floor(score) % GAME_CONFIG.progression.coinEveryScore === 0 && Math.floor(score) !== 0) {
+    coins += 1;
+    persistState();
+    playSound("coin");
+  }
+
+  handleMission();
+  updateTopBar();
+  updateShopButtons();
 }
 
-// DRAW
 function draw() {
   ctx.clearRect(0, 0, canvas.width, canvas.height);
 
-  // PLAYER
-  ctx.fillStyle = player.shield ? "cyan" : "lime";
+  const glow = ctx.createRadialGradient(player.x, player.y, 3, player.x, player.y, player.size * 3);
+  glow.addColorStop(0, "rgba(255,255,255,0.7)");
+  glow.addColorStop(1, "rgba(255,255,255,0)");
+  ctx.fillStyle = glow;
+  ctx.beginPath();
+  ctx.arc(player.x, player.y, player.size * 2.4, 0, Math.PI * 2);
+  ctx.fill();
+
+  ctx.fillStyle = player.shield ? "cyan" : player.color;
   ctx.beginPath();
-  ctx.arc(player.x, player.y, player.size, 0, Math.PI*2);
+  ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
   ctx.fill();
 
-  // ENEMIES
-  ctx.fillStyle = "red";
   enemies.forEach(e => {
+    if (e.type === "tank") ctx.fillStyle = "#ff3b3b";
+    else if (e.type === "zigzag") ctx.fillStyle = "#ff8c42";
+    else if (e.type === "sniper") ctx.fillStyle = "#d058ff";
+    else ctx.fillStyle = "red";
+
     ctx.beginPath();
-    ctx.arc(e.x, e.y, e.size, 0, Math.PI*2);
+    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
     ctx.fill();
   });
 
-  // POWER UPS
   powerUps.forEach(p => {
-    ctx.fillStyle = p.type === "shield" ? "blue" : "yellow";
+    ctx.fillStyle = p.type === "shield" ? "#46a8ff" : "#ffd84a";
     ctx.beginPath();
-    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
+    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
     ctx.fill();
   });
 
-  // PARTICLES
   ctx.fillStyle = "white";
-  particles.forEach(p => {
-    ctx.fillRect(p.x, p.y, 2, 2);
-  });
+  particles.forEach(p => ctx.fillRect(p.x, p.y, 2, 2));
+
+  if (paused && gameRunning) {
+    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
+    ctx.fillRect(0, 0, canvas.width, canvas.height);
+    ctx.fillStyle = "white";
+    ctx.font = "bold 48px Arial";
+    ctx.textAlign = "center";
+    ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
+  }
 }
 
-// LOOP
 function gameLoop() {
   update();
   draw();
   requestAnimationFrame(gameLoop);
 }
 
-// RESTART
 function restartGame() {
+  playSound("start");
   enemies = [];
   powerUps = [];
   particles = [];
+
   score = 0;
   difficulty = 1;
-  player.speed = 5;
+  shieldUntil = 0;
+  speedUntil = 0;
+  multiplier = 1;
+  survivalChainMs = 0;
+  mission = { targetSec: 30 + Math.floor(Math.random() * 20), reward: 10 + Math.floor(Math.random() * 12), done: false };
+
+  player.speed = GAME_CONFIG.player.baseSpeed;
   player.shield = false;
 
   document.getElementById("gameOver").classList.add("hidden");
   gameRunning = true;
+  paused = false;
+
+  updatePauseButton();
+  updateTopBar();
 }
 
-// SPAWN SYSTEM
-setInterval(spawnEnemy, 1000);
-setInterval(spawnPowerUp, 5000);
+setInterval(spawnEnemy, GAME_CONFIG.spawn.enemyMs);
+setInterval(spawnPowerUp, GAME_CONFIG.spawn.powerUpMs);
 
+updateSoundButton();
+updatePauseButton();
+updateShopButtons();
+updateTopBar();
 gameLoop();
