// Renderer: a chase-view pseudo-3D world on Canvas 2D. The camera sits behind
// the aircraft; terrain is a projected heightfield grid, the sea is a shaded
// plane, the runway and the rings are projected 3D shapes, and the aircraft
// itself is drawn as a built little prop plane banking with the stick.

import { WORLD, RINGS, VIEW, PALETTE } from './config.js';
import { groundHeight, terrainColour, shadeColour, blendColour } from './terrain.js';
import { wrapAngle } from './physics.js';

// --- Camera ------------------------------------------------------------------
// Returns camera basis vectors from the plane's attitude. Forward is the
// direction the nose points; right and up follow the bank.
export function cameraBasis(plane, lookX, lookY) {
  const heading = plane.heading + (lookX || 0);
  const pitch = plane.pitch + (lookY || 0);
  const roll = plane.roll;
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Forward (nose) vector.
  const fwd = { x: sh * cp, y: sp, z: -ch * cp };
  // Right vector, rolled around the forward axis.
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const right = { x: ch * cr, y: sr, z: sh * cr };
  // Up = right x forward.
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  return { fwd, right, up };
}

export function cameraPosition(plane, basis) {
  return {
    x: plane.x - basis.fwd.x * VIEW.camDistance + basis.up.x * VIEW.camHeight,
    y: plane.y - basis.fwd.y * VIEW.camDistance + basis.up.y * VIEW.camHeight,
    z: plane.z - basis.fwd.z * VIEW.camDistance + basis.up.z * VIEW.camHeight,
  };
}

function makeProjector(ctx, cam, basis, w, h) {
  const focal = (h / 2) / Math.tan((VIEW.fovDeg * Math.PI / 180) / 2);
  const cx = w / 2;
  const cy = h * 0.52;
  return function project(p) {
    const dx = p.x - cam.x;
    const dy = p.y - cam.y;
    const dz = p.z - cam.z;
    const fx = dx * basis.fwd.x + dy * basis.fwd.y + dz * basis.fwd.z;
    if (fx < 2) return null; // behind the camera
    const rx = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
    const ux = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
    const s = focal / fx;
    return { x: cx + rx * s, y: cy - ux * s, depth: fx, scale: s };
  };
}

// --- Sky -----------------------------------------------------------------------
function drawSky(ctx, w, h, plane, basis) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.42, PALETTE.skyMid);
  g.addColorStop(0.62, PALETTE.skyHorizon);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Low sun, west of the island, with a warm glow.
  const sunDir = { x: -0.55, y: 0.16, z: 0.45 };
  const sx = sunDir.x * basis.right.x + sunDir.y * basis.right.y + sunDir.z * basis.right.z;
  const sy = sunDir.x * basis.up.x + sunDir.y * basis.up.y + sunDir.z * basis.up.z;
  const sz = sunDir.x * basis.fwd.x + sunDir.y * basis.fwd.y + sunDir.z * basis.fwd.z;
  if (sz > 0.05) {
    const focal = (h / 2) / Math.tan((VIEW.fovDeg * Math.PI / 180) / 2);
    const px = w / 2 + (sx / sz) * focal;
    const py = h * 0.52 - (sy / sz) * focal;
    const glow = ctx.createRadialGradient(px, py, 4, px, py, 150);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 179, 71, 0.55)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 160, py - 160, 320, 320);
    ctx.fillStyle = PALETTE.sunCore;
    ctx.beginPath();
    ctx.arc(px, py, 17, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few slow clouds, placed in the sky by heading so they stay put.
  drawClouds(ctx, w, h, plane, basis);
}

function drawClouds(ctx, w, h, plane, basis) {
  const clouds = [
    { a: -0.9, y: 420, d: 2400, s: 150 },
    { a: -0.35, y: 520, d: 3000, s: 220 },
    { a: 0.25, y: 380, d: 2200, s: 130 },
    { a: 0.75, y: 470, d: 2800, s: 190 },
    { a: 1.25, y: 400, d: 2600, s: 160 },
    { a: 2.4, y: 500, d: 3200, s: 240 },
  ];
  const focal = (h / 2) / Math.tan((VIEW.fovDeg * Math.PI / 180) / 2);
  for (const c of clouds) {
    const dir = {
      x: Math.sin(plane.heading + c.a) * Math.cos(0.12),
      y: Math.sin(0.12) + (c.y - plane.y) / c.d,
      z: -Math.cos(plane.heading + c.a) * Math.cos(0.12),
    };
    const sx = dir.x * basis.right.x + dir.y * basis.right.y + dir.z * basis.right.z;
    const sy = dir.x * basis.up.x + dir.y * basis.up.y + dir.z * basis.up.z;
    const sz = dir.x * basis.fwd.x + dir.y * basis.fwd.y + dir.z * basis.fwd.z;
    if (sz < 0.15) continue;
    const px = w / 2 + (sx / sz) * focal;
    const py = h * 0.52 - (sy / sz) * focal;
    const size = (c.s / c.d) * focal;
    if (px < -size * 2 || px > w + size * 2 || py < -size || py > h * 0.7) continue;
    ctx.fillStyle = 'rgba(255, 226, 190, 0.85)';
    ctx.beginPath();
    ctx.ellipse(px, py, size, size * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(px - size * 0.5, py + size * 0.06, size * 0.6, size * 0.24, 0, 0, Math.PI * 2);
    ctx.ellipse(px + size * 0.55, py + size * 0.05, size * 0.65, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Sea base ----------------------------------------------------------------------
// A big flat sea plane at y = 0, drawn under the terrain grid so the water
// fills every gap below the horizon — including the ground right under the
// camera, which the grid starts ahead of.
export function drawSeaBase(ctx, w, h, cam, basis, project) {
  const reach = 3800;
  const near = 60;
  const corners = [
    { x: cam.x + basis.fwd.x * near - basis.right.x * reach, y: 0, z: cam.z + basis.fwd.z * near - basis.right.z * reach },
    { x: cam.x + basis.fwd.x * near + basis.right.x * reach, y: 0, z: cam.z + basis.fwd.z * near + basis.right.z * reach },
    { x: cam.x + basis.fwd.x * reach + basis.right.x * reach, y: 0, z: cam.z + basis.fwd.z * reach + basis.right.z * reach },
    { x: cam.x + basis.fwd.x * reach - basis.right.x * reach, y: 0, z: cam.z + basis.fwd.z * reach - basis.right.z * reach },
  ].map(project);
  if (corners.some((p) => !p)) return;
  const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, PALETTE.seaShallow);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
}

// --- Terrain -------------------------------------------------------------------
// Projected heightfield: rows ahead of the camera, columns either side, drawn
// far-to-near so near quads cover far ones. Sea is drawn as flat blue quads.
export function drawTerrain(ctx, w, h, plane, basis, cam, project) {
  const step = VIEW.terrainStep;
  const rows = VIEW.terrainAhead;
  const cols = VIEW.terrainSide;
  // Camera-forward ground anchor.
  const ax = cam.x + basis.fwd.x * step;
  const az = cam.z + basis.fwd.z * step;
  for (let r = rows; r >= 0; r--) {
    const dist = (r + 1) * step;
    for (let c = -cols; c < cols; c++) {
      const gx = ax + basis.fwd.x * dist + basis.right.x * c * step;
      const gz = az + basis.fwd.z * dist + basis.right.z * c * step;
      const gx2 = gx + basis.right.x * step;
      const gz2 = gz + basis.right.z * step;
      const gxF = gx + basis.fwd.x * step;
      const gzF = gz + basis.fwd.z * step;
      const gxF2 = gxF + basis.right.x * step;
      const gzF2 = gzF + basis.right.z * step;
      const h00 = groundHeight(gx, gz);
      const h10 = groundHeight(gx2, gz2);
      const h01 = groundHeight(gxF, gzF);
      const h11 = groundHeight(gxF2, gzF2);
      const y00 = Math.max(h00, 0);
      const y10 = Math.max(h10, 0);
      const y01 = Math.max(h01, 0);
      const y11 = Math.max(h11, 0);
      const p00 = project({ x: gx, y: y00, z: gz });
      const p10 = project({ x: gx2, y: y10, z: gz2 });
      const p01 = project({ x: gxF, y: y01, z: gzF });
      const p11 = project({ x: gxF2, y: y11, z: gzF2 });
      if (!p00 || !p10 || !p01 || !p11) continue;
      const avgH = (h00 + h10 + h01 + h11) / 4;
      let colour;
      if (avgH <= 0.5) {
        // Sea: depth tint by distance so the horizon reads.
        const depth = Math.min(1, dist / 2600);
        colour = blendColour(PALETTE.seaShallow, PALETTE.seaDeep, depth);
      } else {
        colour = terrainColour(avgH, gx, gz);
        // Simple slope shading: a quad tilted away from the sun is darker.
        const slope = (h01 - h00) / step;
        colour = shadeColour(colour, 1 - Math.max(-0.18, Math.min(0.18, slope * 0.9)));
      }
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// --- Runway ----------------------------------------------------------------------
export function drawRunway(ctx, plane, project) {
  const rw = WORLD.runway;
  const halfL = rw.length / 2;
  const halfW = rw.width / 2;
  const corners = [
    { x: rw.x - halfW, y: 3, z: rw.z - halfL },
    { x: rw.x + halfW, y: 3, z: rw.z - halfL },
    { x: rw.x + halfW, y: 3, z: rw.z + halfL },
    { x: rw.x - halfW, y: 3, z: rw.z + halfL },
  ].map(project);
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.strokeStyle = PALETTE.runwayLine;
  ctx.lineWidth = 2;
  for (let d = -halfL + 60; d < halfL - 40; d += 120) {
    const a = project({ x: rw.x, y: 3.4, z: rw.z + d });
    const b = project({ x: rw.x, y: 3.4, z: rw.z + d + 55 });
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  ctx.lineWidth = 3;
  for (const end of [-halfL + 18, halfL - 18]) {
    const a = project({ x: rw.x - halfW + 4, y: 3.4, z: rw.z + end });
    const b = project({ x: rw.x + halfW - 4, y: 3.4, z: rw.z + end });
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

// --- Rings -------------------------------------------------------------------------
export function drawRings(ctx, plane, project, timeSec) {
  for (let i = 0; i < RINGS.length; i++) {
    const ring = RINGS[i];
    const done = i < plane.ringIndex;
    const next = i === plane.ringIndex;
    if (done) continue;
    const centre = project({ x: ring.x, y: ring.y, z: ring.z });
    if (!centre) continue;
    // Ring plane faces the approaching aircraft: build a rim in the plane
    // perpendicular to the direction from the ring to the aircraft.
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const nx = dx / len, ny = dy / len, nz = dz / len;
    // Two orthogonal rim axes.
    let ax = -nz, ay = 0, az = nx;
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al; ay /= al; az /= al;
    const bx = ny * az - nz * ay;
    const by = nz * ax - nx * az;
    const bz = nx * ay - ny * ax;
    const pulse = next ? 1 + 0.06 * Math.sin(timeSec * 4) : 1;
    const radius = ring.r * pulse;
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const px = ring.x + (ax * Math.cos(a) + bx * Math.sin(a)) * radius;
      const py = ring.y + (ay * Math.cos(a) + by * Math.sin(a)) * radius;
      const pz = ring.z + (az * Math.cos(a) + bz * Math.sin(a)) * radius;
      const p = project({ x: px, y: py, z: pz });
      if (p) pts.push(p);
    }
    if (pts.length < 8) continue;
    ctx.lineWidth = next ? 7 : 4;
    ctx.strokeStyle = next ? '#ffd24d' : 'rgba(255, 210, 77, 0.55)';
    ctx.shadowColor = next ? 'rgba(255, 180, 60, 0.9)' : 'transparent';
    ctx.shadowBlur = next ? 16 : 0;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Distance + label above the next ring (only while flying, so the label
    // never crowds the end-of-sortie card).
    if (next && plane.state === 'flying') {
      const dist = Math.round(len);
      const label = `${ring.name} · ${dist}m`;
      ctx.font = 'bold 15px system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10, 14, 24, 0.65)';
      ctx.fillRect(centre.x - tw / 2 - 8, centre.y - 44, tw + 16, 24);
      ctx.fillStyle = '#ffd24d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, centre.x, centre.y - 32);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }
}

// --- Aircraft ------------------------------------------------------------------------
// The little prop plane, drawn from behind and slightly above, banking with
// the roll. Built from plain canvas shapes: fuselage, wings, tail, cowling.
export function drawAircraft(ctx, w, h, plane, propAngle) {
  const cx = w / 2;
  const cy = h * 0.66;
  const bank = plane.roll * 0.9;
  const pitchBob = -plane.pitch * 26;
  ctx.save();
  ctx.translate(cx, cy + pitchBob);
  ctx.rotate(bank);
  const s = Math.min(w, h) / 480; // scale with canvas size
  // Shadow on the ground far below (a soft ellipse that tracks the plane).
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy + pitchBob);
  ctx.rotate(bank);
  // Tailplane.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(-58 * s, -34 * s);
  ctx.lineTo(58 * s, -34 * s);
  ctx.lineTo(46 * s, -22 * s);
  ctx.lineTo(-46 * s, -22 * s);
  ctx.closePath();
  ctx.fill();
  // Wings — broad, cream with amber tips.
  ctx.fillStyle = '#f3e3c0';
  ctx.beginPath();
  ctx.moveTo(-150 * s, 6 * s);
  ctx.lineTo(150 * s, 6 * s);
  ctx.lineTo(128 * s, 26 * s);
  ctx.lineTo(-128 * s, 26 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8a33d';
  ctx.beginPath();
  ctx.moveTo(-150 * s, 6 * s);
  ctx.lineTo(-128 * s, 6 * s);
  ctx.lineTo(-118 * s, 24 * s);
  ctx.lineTo(-128 * s, 26 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(150 * s, 6 * s);
  ctx.lineTo(128 * s, 6 * s);
  ctx.lineTo(118 * s, 24 * s);
  ctx.lineTo(128 * s, 26 * s);
  ctx.closePath();
  ctx.fill();
  // Fuselage — warm red with a cream spine stripe.
  ctx.fillStyle = '#c94f2e';
  ctx.beginPath();
  ctx.moveTo(-20 * s, -52 * s);
  ctx.quadraticCurveTo(0, -62 * s, 20 * s, -52 * s);
  ctx.lineTo(24 * s, 30 * s);
  ctx.quadraticCurveTo(0, 44 * s, -24 * s, 30 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f3e3c0';
  ctx.fillRect(-7 * s, -50 * s, 14 * s, 74 * s);
  // Cockpit canopy.
  ctx.fillStyle = '#1d3a52';
  ctx.beginPath();
  ctx.ellipse(0, -18 * s, 13 * s, 17 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(180, 220, 255, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-3 * s, -22 * s, 6 * s, 9 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Vertical tail fin.
  ctx.fillStyle = '#a83d22';
  ctx.beginPath();
  ctx.moveTo(-10 * s, -48 * s);
  ctx.lineTo(10 * s, -48 * s);
  ctx.lineTo(4 * s, -78 * s);
  ctx.lineTo(-4 * s, -78 * s);
  ctx.closePath();
  ctx.fill();
  // Spinning prop blur at the nose (seen as a faint disc edge-on from behind).
  const prop = Math.abs(Math.sin(propAngle)) * 0.5 + 0.5;
  ctx.fillStyle = `rgba(240, 240, 240, ${0.25 + prop * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(0, -58 * s, 26 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Navigation lights.
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(-150 * s, 16 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7dff9a';
  ctx.beginPath();
  ctx.arc(150 * s, 16 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Frame ------------------------------------------------------------------------------
export function renderFrame(ctx, w, h, plane, input, timeSec, propAngle) {
  const basis = cameraBasis(plane, input.lookX, input.lookY);
  const cam = cameraPosition(plane, basis);
  const project = makeProjector(ctx, cam, basis, w, h);
  drawSky(ctx, w, h, plane, basis);
  drawSeaBase(ctx, w, h, cam, basis, project);
  drawTerrain(ctx, w, h, plane, basis, cam, project);
  drawRunway(ctx, plane, project);
  drawRings(ctx, plane, project, timeSec);
  drawAircraft(ctx, w, h, plane, propAngle);
}
