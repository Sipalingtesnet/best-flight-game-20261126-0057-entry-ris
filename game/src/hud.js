// The head-up layer: altitude, airspeed, heading tape, throttle, vertical speed, the
// ring counter, timer, score and fuel, plus the target arrow and its distance. All of
// it is drawn flat over the scene so it reads at a glance in both camera views.

import { PALETTE, COURSE } from './config.js';
import { headingDegrees } from './camera.js';
import { toKnots, toFeet, toFpm } from './instruments.js';

function glassPanel(ctx, x, y, w, h, radius = 10) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(9,20,28,0.72)');
  g.addColorStop(1, 'rgba(6,14,20,0.58)');
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(140,200,230,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function label(ctx, text, x, y, size = 10, color = PALETTE.hudDim, align = 'left') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function readout(ctx, text, x, y, size = 26, color = PALETTE.hudInk, align = 'left') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Compass tape across the top: a moving strip with the cardinal points on it. */
function compassTape(ctx, width, headingDeg) {
  const cx = width / 2;
  const y = 26;
  const w = 520;
  const h = 34;
  glassPanel(ctx, cx - w / 2, y - h / 2, w, h, 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - h / 2, w, h);
  ctx.clip();
  const pxPerDeg = 4.2;
  for (let d = -70; d <= 70; d += 5) {
    const deg = ((headingDeg + d) % 360 + 360) % 360;
    const x = cx + d * pxPerDeg;
    const major = Math.round(deg / 10) * 10 === deg;
    const cardinal = deg % 90 === 0;
    ctx.strokeStyle = cardinal ? PALETTE.hudInk : 'rgba(180,215,235,0.55)';
    ctx.lineWidth = cardinal ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + (major ? 6 : 2));
    ctx.stroke();
    if (major && !cardinal) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = 'bold 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.round(deg / 10) % 36), x, y + 17);
    }
    if (cardinal) {
      ctx.fillStyle = PALETTE.hudInk;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(['N', 'E', 'S', 'W'][Math.round(deg / 90) % 4], x, y + 18);
    }
  }
  ctx.restore();
  // Fixed bug and the digital heading under the tape.
  ctx.save();
  ctx.fillStyle = PALETTE.ringNext;
  ctx.beginPath();
  ctx.moveTo(cx, y - h / 2 - 2);
  ctx.lineTo(cx - 6, y - h / 2 - 12);
  ctx.lineTo(cx + 6, y - h / 2 - 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  readout(ctx, `${String(Math.round(headingDeg)).padStart(3, '0')}°`, cx, y + h / 2 + 20, 18, PALETTE.hudInk, 'center');
}

/** The target arrow: turns with the relative bearing, with the distance beside it. */
function targetArrow(ctx, cx, cy, relative, dist, kind, isFinal) {
  const size = 26;
  const color = kind === 'runway' ? '#8ef0a8' : PALETTE.ringNext;
  ctx.save();
  ctx.translate(cx, cy);
  // Keep the arrow pointing up when the target is dead ahead; rotate for the rest.
  ctx.rotate(relative + Math.PI / 2);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, size * 0.62);
  ctx.lineTo(0, size * 0.24);
  ctx.lineTo(-size * 0.72, size * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 15px ui-monospace, monospace';
  ctx.fillText(`${dist < 1000 ? Math.round(dist) : (dist / 1000).toFixed(1)}${dist < 1000 ? ' m' : ' km'}`, cx, cy + 46);
  ctx.fillStyle = color;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText(kind === 'runway' ? 'RUNWAY' : `RING ${isFinal + 1}`, cx, cy + 60);
  ctx.restore();
}

/** The whole HUD for the fly and end states. */
export function drawHud(ctx, width, height, world, guidance, viewMode) {
  const p = world.plane;
  const knots = toKnots(p.speed);
  const feet = toFeet(p.y);
  const fpm = toFpm(p.vspeed);
  const hdg = headingDegrees(p.heading);

  compassTape(ctx, width, hdg);

  // Airspeed, top left.
  glassPanel(ctx, 22, 26, 150, 74);
  label(ctx, 'AIRSPEED', 34, 46);
  readout(ctx, String(Math.round(knots)).padStart(3, '0'), 34, 84, 34);
  label(ctx, 'KT', 138, 84, 14, PALETTE.hudDim, 'right');
  if (p.stall) label(ctx, 'STALL', 34, 95, 11, PALETTE.warning);
  else if (knots > 140) label(ctx, 'OVERSPEED', 34, 95, 11, PALETTE.warning);

  // Altitude, top right.
  glassPanel(ctx, width - 172, 26, 150, 74);
  label(ctx, 'ALTITUDE', width - 160, 46);
  readout(ctx, String(Math.round(feet)).padStart(4, '0'), width - 160, 84, 34);
  label(ctx, 'FT', width - 34, 84, 14, PALETTE.hudDim, 'right');
  const vsText = `${fpm >= 0 ? '+' : ''}${Math.round(fpm / 10) * 10}`;
  label(ctx, `${vsText} FPM`, width - 160, 95, 11, fpm < -900 ? PALETTE.warning : PALETTE.hudDim);

  // Throttle bar, left under the airspeed.
  glassPanel(ctx, 22, 110, 150, 46);
  label(ctx, 'THROTTLE', 34, 128, 9);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(34, 134, 126, 10, 4);
  ctx.fill();
  ctx.fillStyle = p.throttle < 0.2 ? PALETTE.warning : '#ffd166';
  ctx.beginPath();
  ctx.roundRect(34, 134, Math.max(2, 126 * p.throttle), 10, 4);
  ctx.fill();
  ctx.restore();
  readout(ctx, `${Math.round(p.throttle * 100)}%`, 164, 152, 13, PALETTE.hudInk, 'right');

  // Fuel bar under the throttle.
  glassPanel(ctx, 22, 162, 150, 40);
  label(ctx, 'FUEL', 34, 178, 9);
  const fuelFrac = p.fuel / 100;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(34, 184, 126, 10, 4);
  ctx.fill();
  ctx.fillStyle = fuelFrac < 0.18 ? PALETTE.warning : fuelFrac < 0.35 ? PALETTE.fuel : '#5ad28c';
  ctx.beginPath();
  ctx.roundRect(34, 184, Math.max(2, 126 * fuelFrac), 10, 4);
  ctx.fill();
  ctx.restore();

  // Ring counter, score, timer: top centre under the compass, in one row.
  glassPanel(ctx, width / 2 - 210, 88, 420, 44, 9);
  label(ctx, 'RINGS', width / 2 - 196, 104, 9);
  readout(ctx, `${world.nextRing}/${world.rings.length}`, width / 2 - 196, 124, 18);
  label(ctx, 'SCORE', width / 2 - 90, 104, 9);
  readout(ctx, String(Math.round(world.score)).padStart(5, '0'), width / 2 - 90, 124, 18);
  label(ctx, 'TIME LEFT', width / 2 + 40, 104, 9);
  readout(ctx, formatTime(world.timeLeft), width / 2 + 40, 124, 18);

  // Target arrow, right of centre so it never hides the flight path.
  if (world.phase === 'fly') {
    const target = guidance.target;
    targetArrow(ctx, width / 2 + 250, height * 0.36, guidance.relative, guidance.dist, target.kind, world.nextRing);
  }

  // Bottom bar: a hint line, kept small so it never crowds the view.
  const hint = viewMode === 'cockpit'
    ? 'C  chase view   ·   R  retry   ·   M  mute'
    : 'W/S  throttle   ·   ARROWS  pitch & bank   ·   C  cockpit   ·   M  mute';
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(hint, width / 2, height - 8);
  ctx.restore();
}

/** The waypoint banner: the ring number, the distance and the fuel warning. */
export function drawStatusBanners(ctx, width, height, world) {
  if (world.plane.fuel <= 0) {
    banner(ctx, width / 2, height * 0.2, 'ENGINE OUT — GLIDE TO THE STRIP', PALETTE.warning);
  } else if (world.plane.fuel < 22) {
    banner(ctx, width / 2, height * 0.2, 'LOW FUEL', PALETTE.fuel);
  }
  if (world.plane.stall) {
    banner(ctx, width / 2, height * 0.28, 'STALL — LOWER THE NOSE, ADD POWER', PALETTE.warning);
  }
  if (world.bounces > 0 && world.phase === 'fly') {
    banner(ctx, width / 2, height * 0.34, `BOUNCED ${world.bounces}×  —  EASE OFF AND SETTLE`, PALETTE.fuel);
  }
}

function banner(ctx, cx, y, text, color) {
  ctx.save();
  ctx.font = 'bold 20px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 40;
  glassPanel(ctx, cx - w / 2, y - 24, w, 34, 8);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
  ctx.restore();
}

export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** The title card, drawn over the live scene so the first shot is never empty. */
export function drawTitle(ctx, width, height, seed) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, 'rgba(4,14,22,0.55)');
  g.addColorStop(0.5, 'rgba(4,14,22,0.2)');
  g.addColorStop(1, 'rgba(4,14,22,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fdf6e3';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText('ARCHIPELAGO RUN', width / 2, height * 0.34);
  ctx.shadowBlur = 0;

  ctx.fillStyle = PALETTE.ringNext;
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText('A bush-plane island hop — eight rings, then the strip', width / 2, height * 0.41);

  const lines = [
    'W / S  or  ↑ ↓        throttle up and down',
    'ARROW UP / DOWN      pitch — nose up, nose down',
    'ARROW LEFT / RIGHT   bank left and right (A / D too)',
    'MOUSE DRAG           steer;  WHEEL  sets the throttle',
    'C  cockpit / chase      R  retry      M  mute',
  ];
  ctx.font = '15px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(234,246,255,0.9)';
  lines.forEach((line, i) => ctx.fillText(line, width / 2, height * 0.53 + i * 26));

  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY', width / 2, height * 0.83);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '12px ui-monospace, monospace';
  ctx.fillText(`course seed ${seed}`, width / 2, height * 0.88);
  ctx.restore();
}

export { COURSE };
