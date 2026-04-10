const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

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
  speed: 5
};

// GAME DATA
let enemies = [];
let score = 0;
let coins = parseInt(localStorage.getItem("coins")) || 0;
let gameOver = false;

// INPUT
let keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// TOUCH
let touchX = null, touchY = null;
canvas.addEventListener("touchmove", e => {
  touchX = e.touches[0].clientX;
  touchY = e.touches[0].clientY;
});

// SPAWN ENEMY
function spawnEnemy() {
  let edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = 0; y = Math.random()*canvas.height; }
  if (edge === 1) { x = canvas.width; y = Math.random()*canvas.height; }
  if (edge === 2) { x = Math.random()*canvas.width; y = 0; }
  if (edge === 3) { x = Math.random()*canvas.width; y = canvas.height; }

  enemies.push({ x, y, size: 15, speed: 2 + Math.random()*2 });
}

// MOVE PLAYER
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
  if (gameOver) return;

  movePlayer();

  enemies.forEach(e => {
    let dx = player.x - e.x;
    let dy = player.y - e.y;
    let dist = Math.sqrt(dx*dx + dy*dy);

    e.x += dx / dist * e.speed;
    e.y += dy / dist * e.speed;

    if (dist < player.size + e.size) {
      gameOver = true;
      localStorage.setItem("coins", coins);
      alert("Game Over!");
    }
  });

  score++;
  if (score % 100 === 0) coins++;

  document.getElementById("score").innerText = score;
  document.getElementById("coins").innerText = coins;
}

// DRAW
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Player
  ctx.fillStyle = "lime";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.size, 0, Math.PI*2);
  ctx.fill();

  // Enemies
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
  gameOver = false;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
}

// SPAWN LOOP
setInterval(spawnEnemy, 1000);

gameLoop();
