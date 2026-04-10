// 🔊 FIXED SOUND SYSTEM
let audioCtx = null;
let audioEnabled = false;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  if (!audioEnabled || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === "coin") osc.frequency.value = 700;
  if (type === "hit") osc.frequency.value = 150;

  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
}

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// RESPONSIVE CANVAS
function resize() {
