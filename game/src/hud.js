// HUD: the instruments a pilot reads — altitude, speed, heading, fuel,
// damage, score and mission — plus the artificial horizon, compass strip and
// the title / end-of-sortie overlays. Everything is drawn, nothing is an image.

import { PALETTE, RINGS, WORLD } from './config.js';
import { missionText, wrapAngle } from './physics.js';

const AMBER = PALETTE.hudAmber;
const GREEN = PALETTE.hudGreen;
const RED = PALETTE.hudRed;
const WHITE = PALETTE.hudWhite;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 22, 0.58)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 200, 69, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function fmt(n, digits = 0) {
  return n.toFixed(digits);
}

function knots(ms) {
  return Math.round(ms * 1.94384);
}

function headingDeg(plane) {
  // heading 0 = north; compass degrees clockwise from north.
  const deg = ((-plane.heading * 180) / Math.PI) % 360;
  return (deg + 360) % 360;
}

function compassPoint(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}

// --- Artificial horizon ------------------------------------------------------------
function drawHorizon(ctx, x, y, r, plane) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-plane.roll);
  const pitchPx = plane.pitch * r * 1.4;
  // Sky half.
  ctx.fillStyle = '#3a6ea8';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r);
  // Ground half.
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, pitchPx, r * 2, r);
  // Horizon line.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  // Pitch ladder ticks.
  ctx.lineWidth = 1;
  for (const deg of [-20, -10, 10, 20]) {
    const yy = pitchPx - (deg * Math.PI / 180) * r * 1.4;
    const wdt = deg % 20 === 0 ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(-wdt, yy);
    ctx.lineTo(wdt, yy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker + rim.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + 3);
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', x, y + r + 13);
}

// --- Compass strip -------------------------------------------------------------------
function drawCompass(ctx, w, plane) {
  const cx = w / 2;
  const y = 14;
  const hdg = headingDeg(plane);
  panel(ctx, cx - 190, y, 380, 30);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 190, y, 380, 30);
  ctx.clip();
  for (let d = -60; d <= 60; d += 5) {
    const deg = Math.round((hdg + d) / 5) * 5;
    const norm = ((deg % 360) + 360) % 360;
    // Wrap the tick offset so the strip works across the 0/360 boundary.
    const diff = ((norm - hdg + 540) % 360) - 180;
    const px = cx + diff * 3.1;
    if (px < cx - 190 || px > cx + 190) continue;
    const major = norm % 45 === 0;
    ctx.strokeStyle = major ? WHITE : 'rgba(245, 241, 230, 0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(px, y + 20);
    ctx.lineTo(px, y + (major ? 8 : 13));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(compassPoint(norm), px, y + 30 - 6);
    }
  }
  ctx.restore();
  // Centre caret + readout.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 2);
  ctx.lineTo(cx + 6, y + 2);
  ctx.lineTo(cx, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = AMBER;
  ctx.fillText(`${String(Math.round(hdg)).padStart(3, '0')}°`, cx, y + 46);
}

// --- Main HUD --------------------------------------------------------------------------
export function drawHud(ctx, w, h, plane, timeSec) {
  const hdg = headingDeg(plane);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Compass across the top.
  drawCompass(ctx, w, plane);
  // drawCompass leaves textAlign 'center' (its heading readout); restore
  // 'left' or the panel labels/numbers below centre on their x and spill
  // past the canvas edges.
  ctx.textAlign = 'left';

  // Left panel: airspeed + altitude.
  panel(ctx, 12, 12, 212, 92);
  ctx.fillStyle = 'rgba(245,241,230,0.7)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('AIRSPEED', 24, 30);
  ctx.fillText('ALTITUDE', 24, 72);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`${knots(plane.speed)}`, 24, 56);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('kt', 96, 56);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`${Math.max(0, Math.round(plane.y * 3.28084))}`, 24, 98);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('ft', 112, 98);
  // Vertical speed, right of the airspeed value.
  const vs = plane.verticalSpeed;
  ctx.fillStyle = vs > 0.5 ? GREEN : vs < -0.5 ? RED : WHITE;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText(vs > 0.5 ? `▲ ${Math.abs(Math.round(vs))} m/s` : vs < -0.5 ? `▼ ${Math.abs(Math.round(vs))} m/s` : '— level', 140, 56);

  // Right panel: fuel, damage, score, time.
  panel(ctx, w - 192, 12, 180, 92);
  ctx.fillStyle = 'rgba(245,241,230,0.7)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('FUEL', w - 180, 30);
  ctx.fillText('DAMAGE', w - 180, 58);
  ctx.fillText('SCORE', w - 180, 86);
  // Fuel bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 128, 20, 80, 10);
  ctx.fillStyle = plane.fuel > 25 ? GREEN : plane.fuel > 10 ? AMBER : RED;
  ctx.fillRect(w - 128, 20, 80 * (plane.fuel / 100), 10);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(plane.fuel)}%`, w - 20, 30);
  // Damage bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 128, 48, 80, 10);
  ctx.fillStyle = plane.damage < 30 ? GREEN : plane.damage < 70 ? AMBER : RED;
  ctx.fillRect(w - 128, 48, 80 * (plane.damage / 100), 10);
  ctx.fillText(`${Math.round(plane.damage)}%`, w - 20, 58);
  // Score + time.
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${plane.score}`, w - 128, 86);
  ctx.fillStyle = 'rgba(245,241,230,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  const mm = Math.floor(timeSec / 60);
  const ss = Math.floor(timeSec % 60);
  ctx.textAlign = 'right';
  ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, w - 20, 86);
  ctx.textAlign = 'left';

  // Artificial horizon, bottom left.
  drawHorizon(ctx, 62, h - 62, 42, plane);
  // drawHorizon leaves textAlign 'center' (its 'ATT' label); restore 'left'
  // or the throttle labels below centre on their x and drift off the panel.
  ctx.textAlign = 'left';

  // Throttle gauge, bottom right.
  panel(ctx, w - 132, h - 96, 120, 84);
  ctx.fillStyle = 'rgba(245,241,230,0.7)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('THROTTLE', w - 120, h - 78);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(w - 120, h - 70, 14, 46);
  ctx.fillStyle = AMBER;
  const th = plane.throttle * 46;
  ctx.fillRect(w - 120, h - 24 - th, 14, th);
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, w - 100, h - 32);

  // Mission text, bottom centre — only while flying; the end card says it
  // once the sortie is over.
  if (plane.state === 'flying') {
    const msg = missionText(plane);
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(msg).width;
    panel(ctx, w / 2 - tw / 2 - 14, h - 40, tw + 28, 28);
    ctx.fillStyle = plane.ringIndex >= RINGS.length ? GREEN : WHITE;
    ctx.textAlign = 'center';
    ctx.fillText(msg, w / 2, h - 21);
    ctx.textAlign = 'left';
  }

  // Ring flash + last ring banner.
  if (plane.ringFlash > 0 && plane.lastRingName) {
    ctx.globalAlpha = Math.min(1, plane.ringFlash);
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd24d';
    ctx.fillText(`✓ ${plane.lastRingName} CLEAR  +200`, w / 2, 92);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  // Low-fuel warning.
  if (plane.fuel < 15 && plane.state === 'flying') {
    const blink = Math.sin(timeSec * 6) > 0;
    if (blink) {
      ctx.fillStyle = RED;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ LOW FUEL — LAND SOON', w / 2, 122);
      ctx.textAlign = 'left';
    }
  }

  // Centre reticle (only while flying).
  if (plane.state === 'flying') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w / 2 - 16, h * 0.52);
    ctx.lineTo(w / 2 - 6, h * 0.52);
    ctx.moveTo(w / 2 + 6, h * 0.52);
    ctx.lineTo(w / 2 + 16, h * 0.52);
    ctx.stroke();
  }

  // Runway distance hint when all rings are done.
  if (plane.ringIndex >= RINGS.length && plane.state === 'flying') {
    const rw = WORLD.runway;
    const d = Math.round(Math.hypot(plane.x - rw.x, plane.z - rw.z));
    ctx.fillStyle = 'rgba(245,241,230,0.85)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`RUNWAY ${d}m — LINE UP SOUTH, KEEP IT SLOW`, w / 2, h - 52);
    ctx.textAlign = 'left';
  }
}

// --- Overlays ------------------------------------------------------------------------------
export function drawTitle(ctx, w, h, plane) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd24d';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('GOLDEN HOUR ISLAND RUN', w / 2, h * 0.3);
  ctx.fillStyle = WHITE;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Thread five golden rings over the island, then land on the strip.', w / 2, h * 0.3 + 36);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(245,241,230,0.9)';
  ctx.fillText('↑ / W climb · ↓ / S descend · ← → / A D bank · Q / E rudder', w / 2, h * 0.3 + 72);
  ctx.fillText('SHIFT throttle up · CTRL throttle down · drag mouse to look around', w / 2, h * 0.3 + 96);
  ctx.fillText('Fuel burns. Hard landings bend the plane. Grease it for the bonus.', w / 2, h * 0.3 + 120);
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Press ENTER or click to fly', w / 2, h * 0.3 + 168);
  ctx.textAlign = 'left';
}

export function drawEndCard(ctx, w, h, plane) {
  const won = plane.state === 'landed';
  ctx.fillStyle = 'rgba(8, 10, 20, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? GREEN : RED;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText(won ? 'SORTIE COMPLETE' : 'SORTIE OVER', w / 2, h * 0.32);
  ctx.fillStyle = WHITE;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(plane.stateReason, w / 2, h * 0.32 + 34);
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillStyle = AMBER;
  ctx.fillText(`RINGS ${plane.ringsCleared}/5   ·   SCORE ${plane.score}`, w / 2, h * 0.32 + 78);
  if (won) {
    ctx.fillStyle = WHITE;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`Landing: ${plane.landedQuality.toUpperCase()}  ·  Fuel left ${Math.round(plane.fuel)}%`, w / 2, h * 0.32 + 108);
  }
  ctx.fillStyle = 'rgba(245,241,230,0.9)';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Press R to fly again', w / 2, h * 0.32 + 148);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 10, 20, 0.5)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Press P to resume', w / 2, h / 2 + 30);
  ctx.textAlign = 'left';
}
