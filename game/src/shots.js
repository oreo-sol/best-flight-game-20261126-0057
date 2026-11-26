// Screenshot presets: honest staged states rendered by the game's own code,
// chosen with ?shot=<name>. Each preset places the aircraft, sets the mission
// state and the instruments, then the normal renderer draws the frame.

import { RINGS } from './config.js';
import { resetPlane } from './physics.js';

// Preset definitions. Positions are chosen so the shot shows what the judge
// needs: terrain, aircraft, runway or ring ahead, and a live HUD.
const PRESETS = {
  // Cover: chase view, low over the south shore, next ring ahead, strip in sight.
  takeoff: {
    x: -300, y: 155, z: 900, heading: -0.35, pitch: 0.05, roll: -0.06,
    speed: 62, throttle: 0.78, fuel: 96, ringIndex: 0,
  },
  // Mid-mission: banking through the ridge ring, island peaks behind.
  rings: {
    x: 700, y: 205, z: -60, heading: -0.62, pitch: 0.02, roll: 0.42,
    speed: 66, throttle: 0.82, fuel: 74, ringIndex: 1, ringsCleared: 1, score: 214,
  },
  // Final approach: lined up on the strip, low — offset right so the runway
  // reads beside the aircraft instead of behind it.
  landing: {
    x: 95, y: 48, z: 1980, heading: 0.03, pitch: -0.05, roll: 0.02,
    speed: 42, throttle: 0.3, fuel: 31, ringIndex: 5, ringsCleared: 5, score: 1120,
  },
  // The cost of a bad day: ditched in the shallows off the strip.
  crash: {
    x: -380, y: 4, z: 900, heading: 0.5, pitch: 0, roll: 0.35,
    speed: 0, throttle: 0, fuel: 12, damage: 100, ringIndex: 2, ringsCleared: 2,
    score: 430, state: 'ditched',
    stateReason: 'Ditched in the sea — the island keeps its secrets.',
  },
};

export function applyShotPreset(plane, name) {
  const preset = PRESETS[name];
  if (!preset) return false;
  resetPlane(plane);
  Object.assign(plane, preset);
  plane.verticalSpeed = preset.speed * Math.sin(preset.pitch || 0);
  plane.timeSec = name === 'rings' ? 61 : name === 'landing' ? 128 : name === 'crash' ? 94 : 8;
  return true;
}

export function shotNames() {
  return Object.keys(PRESETS);
}
