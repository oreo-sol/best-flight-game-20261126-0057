// Flight model: a forgiving arcade prop-plane sim. Throttle sets speed, pitch
// sets climb, roll banks the turn, rudder nudges the nose. Fuel burns, hard
// touchdowns bend the airframe, and stalling drops you out of the sky.

import { FLIGHT, WORLD, RINGS } from './config.js';
import { groundHeight, isSea } from './terrain.js';

export function makePlane() {
  return {
    // Position and attitude (heading 0 = north, -z; pitch + = nose up).
    x: 0, y: 130, z: 1650,
    heading: 0, pitch: 0, roll: 0,
    speed: FLIGHT.startSpeed,
    throttle: 0.62,
    fuel: FLIGHT.startFuel,
    damage: FLIGHT.startDamage,
    verticalSpeed: 0,
    // Mission state
    ringIndex: 0,
    ringsCleared: 0,
    score: 0,
    timeSec: 0,
    state: 'flying', // flying | landed | crashed | ditched
    stateReason: '',
    landedQuality: '',
    // Landing helpers
    onGround: false,
    lastTouchdownVs: 0,
  };
}

export function resetPlane(plane, spawn) {
  const fresh = makePlane();
  if (spawn) Object.assign(fresh, spawn);
  Object.assign(plane, fresh);
}

// One simulation step. input: { pitch: -1..1, roll: -1..1, yaw: -1..1,
// throttle: -1..1 (delta), throttleSet: 0..1 | null }.
export function stepFlight(plane, input, dt) {
  if (plane.state !== 'flying') return;
  const F = FLIGHT;
  plane.timeSec += dt;

  // --- Throttle ------------------------------------------------------------
  if (input.throttleSet !== null && input.throttleSet !== undefined) {
    plane.throttle = input.throttleSet;
  } else {
    plane.throttle = clamp(plane.throttle + input.throttle * dt * 0.7, 0, 1);
  }

  // --- Speed: throttle pushes, drag pulls, climbing costs speed ------------
  const thrust = plane.throttle * F.throttleAccel;
  const drag = F.drag * plane.speed * plane.speed * 0.09;
  const climbCost = Math.sin(plane.pitch) * 6.5;
  plane.speed += (thrust - drag - climbCost) * dt;
  plane.speed = clamp(plane.speed, 0, F.maxSpeed);

  // --- Attitude -------------------------------------------------------------
  const rollAuthority = 0.55 + 0.45 * Math.min(1, plane.speed / F.cruiseSpeed);
  plane.roll += input.roll * F.rollRate * rollAuthority * dt;
  plane.roll = clamp(plane.roll, -1.25, 1.25);
  // Roll bleeds back toward level hands-off; pitch is trimmed, not springy.
  plane.roll -= plane.roll * 0.25 * dt;
  plane.pitch += input.pitch * F.pitchRate * dt;
  plane.pitch = clamp(plane.pitch, -0.55, 0.6);

  // Coordinated turn: bank turns the nose; rudder adds a flat yaw.
  const turnRate = -Math.sin(plane.roll) * F.yawFromRoll * (plane.speed / F.cruiseSpeed);
  plane.heading += (turnRate + input.yaw * F.rudderYaw) * dt;
  plane.heading = wrapAngle(plane.heading);

  // --- Position ---------------------------------------------------------------
  const flying = plane.speed > F.minSpeed;
  const climbRate = flying
    ? Math.sin(plane.pitch) * plane.speed * F.climbFromPitch
    : -F.gravitySink * (1 - plane.speed / F.minSpeed);
  plane.verticalSpeed = climbRate;
  plane.y += climbRate * dt;
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  plane.x += fx * plane.speed * dt;
  plane.z += fz * plane.speed * dt;

  // --- Fuel -------------------------------------------------------------------
  const burn = (F.fuelBurnBase + F.fuelBurnThrottle * plane.throttle) * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);
  if (plane.fuel <= 0 && plane.throttle > 0.15) plane.throttle = 0.15;

  // --- Ground contact ---------------------------------------------------------
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y <= ground + 1.2) {
    plane.y = ground + 1.2;
    plane.onGround = true;
    touchdown(plane, ground);
  } else {
    plane.onGround = false;
  }

  // --- Ring check ---------------------------------------------------------------
  const ring = RINGS[plane.ringIndex];
  if (ring) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.r + 6) clearRing(plane, ring);
  }
}

function clearRing(plane, ring) {
  plane.ringsCleared += 1;
  plane.ringIndex += 1;
  const timeBonus = Math.max(0, Math.round((150 - plane.timeSec) * 0.25));
  plane.score += 200 + timeBonus;
  plane.ringFlash = 1.0;
  plane.lastRingName = ring.name;
}

function touchdown(plane, ground) {
  const vs = -plane.verticalSpeed; // positive = descending fast
  plane.lastTouchdownVs = vs;
  const rw = WORLD.runway;
  const onStrip = Math.abs(plane.x - rw.x) < rw.width / 2 + 6
    && Math.abs(plane.z - rw.z) < rw.length / 2 + 6;
  const aligned = Math.abs(wrapAngle(plane.heading - Math.PI)) < 0.35
    || Math.abs(wrapAngle(plane.heading)) < 0.35;
  const gentle = vs < 26 && plane.speed < 78;

  if (isSea(plane.x, plane.z)) {
    plane.state = 'ditched';
    plane.stateReason = 'Ditched in the sea — the island keeps its secrets.';
    plane.damage = 100;
    return;
  }
  if (!onStrip) {
    // Off-runway ground contact: survivable only if slow and gentle.
    if (vs > 30 || plane.speed > 70) {
      plane.state = 'crashed';
      plane.stateReason = 'Crashed into rough ground off the strip.';
      plane.damage = 100;
    } else {
      plane.damage = Math.min(100, plane.damage + 35);
      plane.speed *= 0.4;
      plane.state = 'crashed';
      plane.stateReason = 'Forced landing in the scrub — airframe bent, sortie over.';
      plane.damage = 100;
    }
    return;
  }
  if (!gentle || !aligned) {
    plane.damage = Math.min(100, plane.damage + 45);
    if (vs > 34 || plane.speed > 82) {
      plane.state = 'crashed';
      plane.stateReason = 'Too fast, too steep — the landing broke the plane.';
      plane.damage = 100;
      return;
    }
    // Hard but survivable: bounce back up, damaged.
    plane.y = ground + 6;
    plane.verticalSpeed = 6;
    plane.pitch = 0.12;
    plane.speed *= 0.75;
    return;
  }
  // A real landing.
  plane.state = 'landed';
  const quality = vs < 8 && Math.abs(plane.roll) < 0.15 ? 'perfect'
    : vs < 16 ? 'good' : 'rough';
  plane.landedQuality = quality;
  const bonus = quality === 'perfect' ? 500 : quality === 'good' ? 300 : 120;
  plane.score += bonus;
  plane.stateReason = quality === 'perfect'
    ? 'Greased it — a perfect landing.'
    : quality === 'good'
      ? 'Down safe — a good landing.'
      : 'Down, but the airframe felt that one.';
}

export function missionText(plane) {
  if (plane.state === 'landed') return `SORTIE COMPLETE — ${plane.stateReason}`;
  if (plane.state === 'crashed' || plane.state === 'ditched') return `SORTIE OVER — ${plane.stateReason}`;
  if (plane.ringIndex < RINGS.length) {
    const ring = RINGS[plane.ringIndex];
    return `FLY THROUGH ${ring.name} — ${plane.ringsCleared}/5 RINGS`;
  }
  return 'ALL RINGS CLEAR — LAND ON THE STRIP (HEADING SOUTH)';
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
