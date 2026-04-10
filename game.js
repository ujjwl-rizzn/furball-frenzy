const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// AUDIO
const hitSound = new Audio("https://www.soundjay.com/button/beep-07.wav");
const coinSound = new Audio("https://www.soundjay.com/button/beep-09.wav");

// PLAYER
let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  size: 20,
  speed: 5
};

// DATA
let coins = parseInt(localStorage.getItem("coins")) || 0;
let ownedSkins = JSON.parse(localStorage.getItem("skins")) || ["lime"];
let currentSkin = localStorage.getItem("currentSkin") || "lime";

let enemies = [];
let score = 0;
let gameRunning = false;

// INPUT
let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

let touchX = null, touchY = null;
canvas.addEventListener("touchmove", e => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
});

// START GAME
function startGame() {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("ui").classList.remove("hidden");
  gameRunning = true;
}

// SHOP
function toggleShop() {
  document.getElementById("shop").classList.toggle("hidden");
}

function buySkin(color, cost) {
  if (ownedSkins.includes(color)) {
    currentSkin = color;
    localStorage.setItem("currentSkin", currentSkin);
    return;
  }

  if (coins >= cost) {
    coins -= cost;
    coinSound.play();
    ownedSkins.push(color);
    currentSkin = color;

    localStorage.setItem("coins", coins);
    localStorage.setItem("skins", JSON.stringify(ownedSkins));
    localStorage.setItem("currentSkin", currentSkin);
  } else {
    alert("Not enough coins!");
  }
}

// ENEMIES
function spawnEnemy() {
  if (!gameRunning) return;

  let edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = 0; y = Math.random()*canvas.height; }
  if (edge === 1) { x = canvas.width; y = Math.random()*canvas.height; }
  if (edge === 2) { x = Math.random()*canvas.width; y = 0; }
  if (edge === 3) { x = Math.random()*canvas.width; y = canvas.height; }

  enemies.push({ x, y, size: 15, speed: 2 + Math.random()*2 });
}

// MOVE
function movePlayer() {
  if (keys["ArrowUp"] || keys["w"]) player.y -= player.speed;
  if (keys["ArrowDown"] || keys["s"]) player.y += player.speed;
  if (keys["ArrowLeft"] || keys["a"]) player.x -= player.speed;
  if (keys["ArrowRight"] || keys["d"]) player.x += player.speed;

  if (touchX !== null) {
    let dx = touchX - player.x;
    let dy = touchY - player.y;
    player.x += dx * 0.05;
    player.y += dy * 0.05;
  }
}

// UPDATE
function update() {
  if (!gameRunning) return;

  movePlayer();

  enemies.forEach(e => {
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let dist = Math.sqrt(dx*dx + dy*dy);

    e.x += dx / dist * e.speed;
    e.y += dy / dist * e.speed;

    if (dist < player.size + e.size) {
      hitSound.play();
      gameRunning = false;
      document.getElementById("gameOver").classList.remove("hidden");
    }
  });

  score++;
  if (score % 100 === 0) {
    coins++;
    coinSound.play();
  }

  document.getElementById("score").innerText = score;
  document.getElementById("coins").innerText = coins;
}

// DRAW
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = currentSkin;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = "red";
  enemies.forEach(e => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI*2);
    ctx.fill();
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
  score = 0;
  document.getElementById("gameOver").classList.add("hidden");
  gameRunning = true;
}

// SPAWN LOOP
setInterval(spawnEnemy, 1000);

gameLoop();
