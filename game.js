let audioEnabled = false;

function playSound(type) {
  if (!audioEnabled) return;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === "coin") osc.frequency.value = 800;
  if (type === "hit") osc.frequency.value = 200;

  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// RESPONSIVE CANVAS
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// PLAYER
let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 5,
  shield: false
};

// DATA
let coins = parseInt(localStorage.getItem("coins")) || 0;
let enemies = [];
let particles = [];
let powerUps = [];

let score = 0;
let gameRunning = false;
let difficulty = 1;

// INPUT
let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

let touchX = null, touchY = null;
canvas.addEventListener("touchmove", e => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
});

// START
function startGame() {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("ui").classList.remove("hidden");
  gameRunning = true;
  audioEnabled = true;
}

// MOVE PLAYER (WITH BOUNDARY FIX)
function movePlayer() {
  if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
  if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
  if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;

  if (touchX !== null) {
    player.x += (touchX - player.x) * 0.08;
    player.y += (touchY - player.y) * 0.08;
  }

  // KEEP INSIDE SCREEN ✅
  player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
}

// ENEMY SPAWN (SCALES WITH DIFFICULTY)
function spawnEnemy() {
  if (!gameRunning) return;

  let edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = 0; y = Math.random()*canvas.height; }
  if (edge === 1) { x = canvas.width; y = Math.random()*canvas.height; }
  if (edge === 2) { x = Math.random()*canvas.width; y = 0; }
  if (edge === 3) { x = Math.random()*canvas.width; y = canvas.height; }

  enemies.push({
    x, y,
    size: 15,
    speed: 2 + difficulty * 0.5
  });
}

// POWER UPS
function spawnPowerUp() {
  if (!gameRunning) return;

  let types = ["shield", "speed"];
  let type = types[Math.floor(Math.random()*types.length)];

  powerUps.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    type,
    size: 12
  });
}

// PARTICLES
function createParticles(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      dx: (Math.random()-0.5)*4,
      dy: (Math.random()-0.5)*4,
      life: 30
    });
  }
}

// UPDATE
function update() {
  if (!gameRunning) return;

  movePlayer();

  // DIFFICULTY INCREASE 🔥
  difficulty += 0.001;

  // ENEMIES
  enemies.forEach(e => {
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let dist = Math.sqrt(dx*dx + dy*dy);

    e.x += dx / dist * e.speed;
    e.y += dy / dist * e.speed;

    if (dist < player.size + e.size) {
      if (player.shield) {
        player.shield = false;
        createParticles(e.x, e.y);
      } else {
        playSound("hit");
        gameRunning = false;
        document.getElementById("gameOver").classList.remove("hidden");
      }
    }
  });

  // POWER UPS COLLISION
  powerUps.forEach((p, i) => {
    let dx = player.x - p.x;
    let dy = player.y - p.y;
    let dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < player.size + p.size) {
      if (p.type === "shield") player.shield = true;
      if (p.type === "speed") player.speed = 8;

      setTimeout(() => player.speed = 5, 3000);

      playSound("coin");
      powerUps.splice(i, 1);
      createParticles(p.x, p.y);
    }
  });

  // PARTICLES UPDATE
  particles.forEach((p, i) => {
    p.x += p.dx;
    p.y += p.dy;
    p.life--;

    if (p.life <= 0) particles.splice(i, 1);
  });

  score++;
  
if (score % 100 === 0) 
{
  coins++;
  playSound("coin"); // 🔊 ADD THIS
}


  document.getElementById("score").innerText = Math.floor(score);
  document.getElementById("coins").innerText = coins;
}

// DRAW
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // PLAYER
  ctx.fillStyle = player.shield ? "cyan" : "lime";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI*2);
  ctx.fill();

  // ENEMIES
  ctx.fillStyle = "red";
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI*2);
    ctx.fill();
  });

  // POWER UPS
  powerUps.forEach(p => {
    ctx.fillStyle = p.type === "shield" ? "blue" : "yellow";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  });

  // PARTICLES
  ctx.fillStyle = "white";
  particles.forEach(p => {
    ctx.fillRect(p.x, p.y, 2, 2);
  });
}

// LOOP
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// RESTART
function restartGame() {
  enemies = [];
  powerUps = [];
  particles = [];
  score = 0;
  difficulty = 1;
  player.speed = 5;
  player.shield = false;

  document.getElementById("gameOver").classList.add("hidden");
  gameRunning = true;
}

// SPAWN SYSTEM
setInterval(spawnEnemy, 1000);
setInterval(spawnPowerUp, 5000);

gameLoop();
