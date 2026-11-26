// Sound: everything is synthesized with WebAudio — no audio files, no network.
// Engine hum (two detuned saws through a low-pass), wind (filtered noise that
// grows with speed), a ring chime and a touchdown thud.

export function makeAudio() {
  return {
    ctx: null,
    master: null,
    engineOscA: null,
    engineOscB: null,
    engineGain: null,
    engineFilter: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

export function ensureAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    audio.ctx = ctx;
    audio.master = ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(ctx.destination);

    // --- Engine: two saws a few Hz apart, low-passed -------------------------
    audio.engineFilter = ctx.createBiquadFilter();
    audio.engineFilter.type = 'lowpass';
    audio.engineFilter.frequency.value = 420;
    audio.engineFilter.Q.value = 1.2;
    audio.engineGain = ctx.createGain();
    audio.engineGain.gain.value = 0.0;
    audio.engineOscA = ctx.createOscillator();
    audio.engineOscA.type = 'sawtooth';
    audio.engineOscA.frequency.value = 82;
    audio.engineOscB = ctx.createOscillator();
    audio.engineOscB.type = 'sawtooth';
    audio.engineOscB.frequency.value = 86;
    audio.engineOscA.connect(audio.engineFilter);
    audio.engineOscB.connect(audio.engineFilter);
    audio.engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOscA.start();
    audio.engineOscB.start();

    // --- Wind: looped noise buffer through a band-pass -----------------------
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 700;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = ctx.createGain();
    audio.windGain.gain.value = 0.0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();

    audio.started = true;
  } catch {
    // Audio is decoration: a silent game is still a game.
    audio.started = false;
  }
}

// Per-frame update: engine pitch follows throttle, wind follows airspeed.
export function updateAudio(audio, plane) {
  if (!audio.started || !audio.ctx) return;
  const t = audio.ctx.currentTime;
  const targetEngine = audio.muted ? 0 : 0.05 + plane.throttle * 0.11;
  const targetFreq = 62 + plane.throttle * 70 + plane.speed * 0.35;
  audio.engineGain.gain.setTargetAtTime(targetEngine, t, 0.1);
  audio.engineOscA.frequency.setTargetAtTime(targetFreq, t, 0.1);
  audio.engineOscB.frequency.setTargetAtTime(targetFreq * 1.045, t, 0.1);
  audio.engineFilter.frequency.setTargetAtTime(320 + plane.throttle * 500, t, 0.15);
  const wind = audio.muted ? 0 : Math.max(0, (plane.speed - 30) / 70) * 0.16;
  audio.windGain.gain.setTargetAtTime(wind, t, 0.2);
  audio.windFilter.frequency.setTargetAtTime(500 + plane.speed * 9, t, 0.2);
}

function blip(audio, freq, dur, type, vol, when = 0) {
  if (!audio.started || !audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Two-note golden chime when a ring is cleared.
export function playRingChime(audio) {
  blip(audio, 880, 0.35, 'sine', 0.22);
  blip(audio, 1318.5, 0.5, 'sine', 0.18, 0.09);
}

// Low thud on touchdown, pitched by how hard it was.
export function playTouchdown(audio, hard) {
  if (!audio.started || !audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(hard ? 90 : 70, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.18);
  gain.gain.setValueAtTime(hard ? 0.5 : 0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

// Short fanfare for a completed sortie.
export function playLandingFanfare(audio) {
  blip(audio, 523.25, 0.3, 'triangle', 0.2);
  blip(audio, 659.25, 0.3, 'triangle', 0.2, 0.12);
  blip(audio, 783.99, 0.55, 'triangle', 0.22, 0.24);
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  return audio.muted;
}
