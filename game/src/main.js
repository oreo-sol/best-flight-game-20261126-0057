// Golden Hour Island Run — main loop. Owns the canvas, the game states
// (title / flying / paused / landed / crashed), the per-frame update and the
// screenshot presets. All rendering lives in render.js, all HUD in hud.js.

import { GAME_NAME } from './config.js';
import { makePlane, stepFlight, resetPlane } from './physics.js';
import { renderFrame } from './render.js';
import { drawHud, drawTitle, drawEndCard, drawPaused } from './hud.js';
import { makeInput, attachInput, readControls, wasPressed, endFrame } from './input.js';
import { makeAudio, ensureAudio, updateAudio, playRingChime, playTouchdown, playLandingFanfare, toggleMute } from './audio.js';
import { applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const plane = makePlane();
const input = makeInput();
attachInput(input, canvas);
const audio = makeAudio();

let screen = 'title'; // title | flying | paused | ended
let propAngle = 0;
let lastTime = performance.now();
let shotMode = null;
let prevRings = 0;
let prevState = 'flying';

// --- Screenshot mode -----------------------------------------------------------
// ?shot=takeoff|rings|landing|crash renders one staged frame and holds it, so
// headless Chromium can capture the game's own rendering deterministically.
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
if (shotName) {
  shotMode = applyShotPreset(plane, shotName) ? shotName : null;
  screen = 'flying';
  if (plane.state !== 'flying') screen = 'ended';
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startFlight() {
  resetPlane(plane);
  screen = 'flying';
  prevRings = 0;
  prevState = 'flying';
  ensureAudio(audio);
  announce(`${GAME_NAME}: fly through the five golden rings, then land on the strip.`);
}

function update(dt) {
  if (screen === 'title') {
    if (wasPressed(input, 'enter') || input.mouseDown) startFlight();
    return;
  }
  if (screen === 'flying') {
    if (wasPressed(input, 'p')) {
      screen = 'paused';
      return;
    }
    if (wasPressed(input, 'm')) toggleMute(audio);
    if (wasPressed(input, 'r')) {
      startFlight();
      return;
    }
    const controls = readControls(input);
    stepFlight(plane, controls, dt);
    propAngle += dt * (18 + plane.throttle * 40);
    if (plane.ringFlash > 0) plane.ringFlash -= dt * 1.4;
    // Ring cleared → chime.
    if (plane.ringsCleared > prevRings) {
      playRingChime(audio);
      prevRings = plane.ringsCleared;
    }
    // Touchdown / crash → thud, landing → fanfare.
    if (plane.state !== prevState) {
      if (plane.state === 'landed') {
        playTouchdown(audio, false);
        playLandingFanfare(audio);
      } else if (plane.state === 'crashed' || plane.state === 'ditched') {
        playTouchdown(audio, true);
      }
      prevState = plane.state;
      if (plane.state !== 'flying') {
        screen = 'ended';
        announce(`Sortie over. Score ${plane.score}. Press R to fly again.`);
      }
    }
    updateAudio(audio, plane);
    return;
  }
  if (screen === 'paused') {
    if (wasPressed(input, 'p')) screen = 'flying';
    return;
  }
  if (screen === 'ended') {
    if (wasPressed(input, 'r') || wasPressed(input, 'enter')) startFlight();
  }
}

function draw(timeSec) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  // In shot mode the frame is already staged; draw it once and hold.
  renderFrame(ctx, w, h, plane, input, timeSec, propAngle);
  if (screen === 'title') {
    drawHud(ctx, w, h, plane, timeSec);
    drawTitle(ctx, w, h, plane);
  } else if (screen === 'paused') {
    drawHud(ctx, w, h, plane, timeSec);
    drawPaused(ctx, w, h);
  } else if (screen === 'ended') {
    drawHud(ctx, w, h, plane, timeSec);
    drawEndCard(ctx, w, h, plane);
  } else {
    drawHud(ctx, w, h, plane, timeSec);
  }
  ctx.restore();
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const timeSec = now / 1000;
  if (!shotMode) update(dt);
  draw(timeSec);
  endFrame(input);
  requestAnimationFrame(frame);
}

document.title = GAME_NAME;
requestAnimationFrame(frame);
