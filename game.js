diff --git a/game.js b/game.js
index 9b8fd20587b171aaffd65b7ae97c6aa2094847e2..d88779b36ea7895b263958d25c9e82542b919c5c 100644
--- a/game.js
+++ b/game.js
@@ -1,232 +1,504 @@
 const canvas = document.getElementById("game");
 const ctx = canvas.getContext("2d");
 
-// RESPONSIVE CANVAS
+const scoreEl = document.getElementById("score");
+const highScoreEl = document.getElementById("highScore");
+const coinsEl = document.getElementById("coins");
+const powerTimersEl = document.getElementById("powerTimers");
+const pauseToggleBtn = document.getElementById("pauseToggle");
+const soundToggleBtn = document.getElementById("soundToggle");
+
+const GAME_CONFIG = {
+  player: {
+    size: 20,
+    baseSpeed: 5,
+    speedBoost: 8
+  },
+  progression: {
+    difficultyRate: 0.001,
+    coinEveryScore: 100
+  },
+  spawn: {
+    enemyMs: 1000,
+    powerUpMs: 5000
+  },
+  powerUps: {
+    shieldMs: 5000,
+    speedMs: 3000
+  },
+  particles: {
+    count: 10,
+    life: 30
+  },
+  enemies: {
+    baseChaserSpeed: 2,
+    chaserScale: 0.45,
+    zigzagScale: 0.35,
+    tankScale: 0.3
+  },
+  skins: [
+    { color: "lime", price: 0, label: "Default" },
+    { color: "cyan", price: 5, label: "Cyan" },
+    { color: "yellow", price: 10, label: "Yellow" },
+    { color: "red", price: 20, label: "Red" }
+  ]
+};
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
+  color: localStorage.getItem("selectedSkin") || "lime"
 };
 
-// DATA
-let coins = parseInt(localStorage.getItem("coins")) || 0;
+let coins = parseInt(localStorage.getItem("coins"), 10) || 0;
+let highScore = parseInt(localStorage.getItem("highScore"), 10) || 0;
+const ownedSkins = new Set(JSON.parse(localStorage.getItem("ownedSkins") || '["lime"]'));
+
 let enemies = [];
 let particles = [];
 let powerUps = [];
 
 let score = 0;
 let gameRunning = false;
+let paused = false;
 let difficulty = 1;
+let audioCtx = null;
+let soundEnabled = localStorage.getItem("soundEnabled") !== "false";
+let shieldUntil = 0;
+let speedUntil = 0;
 
-// INPUT
 let keys = {};
-window.addEventListener("keydown", e => keys[e.key] = true);
-window.addEventListener("keyup", e => keys[e.key] = false);
+let touchX = null;
+let touchY = null;
+
+window.addEventListener("keydown", e => {
+  keys[e.key] = true;
+  if (e.key === "Escape") {
+    togglePause();
+  }
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
+
+canvas.addEventListener("touchend", () => {
+  touchX = null;
+  touchY = null;
 });
 
-// START
+function updateTopBar() {
+  scoreEl.innerText = Math.floor(score);
+  highScoreEl.innerText = highScore;
+  coinsEl.innerText = coins;
+
+  const now = Date.now();
+  const shieldRemaining = Math.max(0, (shieldUntil - now) / 1000);
+  const speedRemaining = Math.max(0, (speedUntil - now) / 1000);
+  powerTimersEl.innerText = `Shield: ${shieldRemaining.toFixed(1)}s | Speed: ${speedRemaining.toFixed(1)}s`;
+}
+
+function updatePauseButton() {
+  if (pauseToggleBtn) {
+    pauseToggleBtn.innerText = paused ? "Resume" : "Pause";
+  }
+}
+
+function updateSoundButton() {
+  if (soundToggleBtn) {
+    soundToggleBtn.innerText = `Sound: ${soundEnabled ? "On" : "Off"}`;
+  }
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
+
+    if (equipped) suffix = " - Equipped";
+    else if (owned) suffix = " - Owned";
+
+    btn.innerText = `${skin.label} (${skin.price})${suffix}`;
+  }
+}
+
 function startGame() {
   document.getElementById("menu").classList.add("hidden");
   document.getElementById("ui").classList.remove("hidden");
+  initAudio();
+  playSound("start");
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
+  if (!ownedSkins.has(color)) {
+    if (coins < price) {
+      playSound("error");
+      return;
+    }
+    coins -= price;
+    ownedSkins.add(color);
+    playSound("purchase");
+  } else {
+    playSound("click");
+  }
+
+  player.color = color;
+  localStorage.setItem("coins", coins.toString());
+  localStorage.setItem("selectedSkin", color);
+  localStorage.setItem("ownedSkins", JSON.stringify(Array.from(ownedSkins)));
+
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
+  if (slideTo) {
+    osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
+  }
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
+}
+
+function toggleSound() {
+  soundEnabled = !soundEnabled;
+  localStorage.setItem("soundEnabled", soundEnabled.toString());
+  updateSoundButton();
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
   player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
   player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
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
+  if (difficulty > 2.5 && roll > 0.7) type = "zigzag";
+  if (difficulty > 4.5 && roll > 0.88) type = "tank";
+
+  const base = GAME_CONFIG.enemies.baseChaserSpeed;
+  const speedByType = {
+    chaser: base + difficulty * GAME_CONFIG.enemies.chaserScale,
+    zigzag: base + difficulty * GAME_CONFIG.enemies.zigzagScale,
+    tank: base + difficulty * GAME_CONFIG.enemies.tankScale
+  };
+
+  const sizeByType = {
+    chaser: 15,
+    zigzag: 11,
+    tank: 22
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
+    zigzagPhase: Math.random() * Math.PI * 2
   });
 }
 
-// POWER UPS
 function spawnPowerUp() {
-  if (!gameRunning) return;
+  if (!gameRunning || paused) return;
 
-  let types = ["shield", "speed"];
-  let type = types[Math.floor(Math.random()*types.length)];
+  const types = ["shield", "speed"];
+  const type = types[Math.floor(Math.random() * types.length)];
 
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
-function update() {
-  if (!gameRunning) return;
+function updatePlayerPowerStates() {
+  const now = Date.now();
 
-  movePlayer();
+  if (shieldUntil > now) {
+    player.shield = true;
+  } else {
+    player.shield = false;
+  }
 
-  // DIFFICULTY INCREASE 🔥
-  difficulty += 0.001;
+  if (speedUntil > now) {
+    player.speed = GAME_CONFIG.player.speedBoost;
+  } else {
+    player.speed = GAME_CONFIG.player.baseSpeed;
+  }
+}
 
-  // ENEMIES
-  enemies.forEach(e => {
-    let dx = player.x - e.x;
-    let dy = player.y - e.y;
-    let dist = Math.sqrt(dx*dx + dy*dy);
+function update() {
+  if (!gameRunning || paused) return;
+
+  movePlayer();
+  updatePlayerPowerStates();
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
       } else {
         gameRunning = false;
+        paused = false;
+        updatePauseButton();
+        playSound("gameover");
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
 
   score++;
-  if (score % 100 === 0) coins++;
+  if (score > highScore) {
+    highScore = score;
+    localStorage.setItem("highScore", Math.floor(highScore).toString());
+  }
+
+  if (score % GAME_CONFIG.progression.coinEveryScore === 0) {
+    coins++;
+    localStorage.setItem("coins", coins.toString());
+    playSound("coin");
+  }
 
-  document.getElementById("score").innerText = Math.floor(score);
-  document.getElementById("coins").innerText = coins;
+  updateTopBar();
 }
 
-// DRAW
 function draw() {
   ctx.clearRect(0, 0, canvas.width, canvas.height);
 
-  // PLAYER
-  ctx.fillStyle = player.shield ? "cyan" : "lime";
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
+    else ctx.fillStyle = "red";
+
     ctx.beginPath();
-    ctx.arc(e.x, e.y, e.size, 0, Math.PI*2);
+    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
     ctx.fill();
   });
 
-  // POWER UPS
   powerUps.forEach(p => {
     ctx.fillStyle = p.type === "shield" ? "blue" : "yellow";
     ctx.beginPath();
-    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
+    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
     ctx.fill();
   });
 
-  // PARTICLES
   ctx.fillStyle = "white";
   particles.forEach(p => {
     ctx.fillRect(p.x, p.y, 2, 2);
   });
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
   score = 0;
   difficulty = 1;
-  player.speed = 5;
+  shieldUntil = 0;
+  speedUntil = 0;
+
+  player.speed = GAME_CONFIG.player.baseSpeed;
   player.shield = false;
 
   document.getElementById("gameOver").classList.add("hidden");
   gameRunning = true;
+  paused = false;
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
