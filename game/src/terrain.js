// Terrain: a single island in a wide sea, built from layered sine hills so the
// height function is pure and deterministic — the same (x, z) always gives the
// same height, which keeps screenshots reproducible.

import { WORLD, PALETTE } from './config.js';

// Deterministic pseudo-noise from layered sines (no Math.random at run time).
function hillNoise(x, z) {
  const a = Math.sin(x * 0.0011 + 1.7) * Math.cos(z * 0.0009 - 0.6);
  const b = Math.sin(x * 0.0027 - 0.4) * Math.cos(z * 0.0023 + 2.1);
  const c = Math.sin((x + z) * 0.00053 + 4.2) * Math.cos((x - z) * 0.00041 - 1.3);
  return a * 0.55 + b * 0.3 + c * 0.15;
}

// Height of the ground at world (x, z). Sea level is 0; the island rises from
// it, with a ridge of hills along the north side and a flat apron by the strip.
export function groundHeight(x, z) {
  const dx = x - WORLD.islandX;
  const dz = z - WORLD.islandZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const r = WORLD.islandRadius;
  if (dist >= r) return -6; // sea floor, safely below the water line
  // Smooth island falloff: 1 at the centre, 0 at the shoreline.
  const t = dist / r;
  const falloff = Math.pow(Math.cos(t * Math.PI * 0.5), 1.4);
  // Northern ridge: taller ground when z is negative (north).
  const ridge = 1 + 0.55 * Math.max(0, -dz / r);
  let h = WORLD.peakHeight * falloff * ridge * (0.55 + 0.45 * hillNoise(x, z));
  // Flatten the airstrip apron so the runway sits on level ground.
  const rw = WORLD.runway;
  const along = Math.abs(z - rw.z);
  const across = Math.abs(x - rw.x);
  if (along < rw.length * 0.75 && across < 190) {
    const blend = Math.min(1, Math.max(0, 1 - (across - 60) / 130));
    h = h * (1 - blend) + 8 * blend;
  }
  return Math.max(h, 2.5);
}

// Is (x, z) over water?
export function isSea(x, z) {
  const dx = x - WORLD.islandX;
  const dz = z - WORLD.islandZ;
  return Math.sqrt(dx * dx + dz * dz) >= WORLD.islandRadius;
}

// Terrain colour for a height, blended toward sand near the shore.
export function terrainColour(h, x, z) {
  if (h < 4) return PALETTE.sand;
  if (h < 90) return blendColour(PALETTE.grassLow, PALETTE.grassHigh, h / 90);
  if (h < 160) return blendColour(PALETTE.grassHigh, PALETTE.rock, (h - 90) / 70);
  if (h < 230) return PALETTE.rock;
  return PALETTE.snow;
}

export function blendColour(c1, c2, t) {
  const a = hexRgb(c1);
  const b = hexRgb(c2);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Shade a colour by a light factor (0.6 dark … 1.15 bright) for slope facing.
// Accepts both '#rrggbb' and 'rgb(r,g,b)' inputs.
export function shadeColour(colour, factor) {
  let r, g, b;
  if (colour.startsWith('#')) {
    const n = parseInt(colour.slice(1), 16);
    r = (n >> 16) & 255;
    g = (n >> 8) & 255;
    b = n & 255;
  } else {
    const m = colour.match(/\d+/g);
    if (!m) return colour;
    r = +m[0];
    g = +m[1];
    b = +m[2];
  }
  r = Math.min(255, Math.round(r * factor));
  g = Math.min(255, Math.round(g * factor));
  b = Math.min(255, Math.round(b * factor));
  return `rgb(${r},${g},${b})`;
}
