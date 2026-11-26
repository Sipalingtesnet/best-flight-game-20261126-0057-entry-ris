// Aircraft instruments, drawn with canvas paths: airspeed, altimeter, vertical speed,
// compass card, throttle lever and fuel. Each dial is a small function of the flight
// state, so the needles move with the plane rather than being decoration.

import { FLIGHT, PALETTE } from './config.js';

const TAU = Math.PI * 2;

function bezel(ctx, cx, cy, r, label) {
  ctx.save();
  // Machined rim.
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, '#3b4d5c');
  rim.addColorStop(0.5, '#1a252e');
  rim.addColorStop(1, '#0a1117');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, TAU);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  const face = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  face.addColorStop(0, '#16232c');
  face.addColorStop(1, PALETTE.dialFace);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150,200,225,0.35)';
  ctx.stroke();
  if (label) {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.52);
  }
  ctx.restore();
}

function ticks(ctx, cx, cy, r, count, start, end, majorEvery, len, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i <= count; i += 1) {
    const a = start + ((end - start) * i) / count;
    const major = i % majorEvery === 0;
    ctx.lineWidth = major ? 2 : 1;
    const r0 = r - (major ? len : len * 0.55);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
    ctx.stroke();
  }
  ctx.restore();
}

function needle(ctx, cx, cy, angle, r, color = PALETTE.needle, width = 2.6) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, -width);
  ctx.lineTo(r, -width * 0.34);
  ctx.lineTo(r, width * 0.34);
  ctx.lineTo(-r * 0.18, width);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.4, 0, TAU);
  ctx.fillStyle = '#0a1117';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Airspeed in knots, 0..120, with the flap band and the never-exceed arc. */
export function drawAirspeed(ctx, cx, cy, r, speedKt) {
  bezel(ctx, cx, cy, r, 'AIRSPEED');
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  ticks(ctx, cx, cy, r, 12, a0, a1, 1, 7, 'rgba(200,230,245,0.75)');
  // Green safe band and red line, drawn on the rim.
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(90,210,140,0.65)';
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, a0 + (a1 - a0) * (52 / 120), a0 + (a1 - a0) * (100 / 120));
  ctx.stroke();
  ctx.strokeStyle = PALETTE.warning;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, a0 + (a1 - a0) * (100 / 120), a0 + (a1 - a0) * (106 / 120));
  ctx.stroke();
  ctx.restore();
  const clamped = Math.max(0, Math.min(120, speedKt));
  needle(ctx, cx, cy, a0 + (a1 - a0) * (clamped / 120), r - 12);
  ctx.save();
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(speedKt)).padStart(3, ' '), cx, cy + r * 0.3);
  ctx.restore();
}

/** Altimeter: a long needle for hundreds of feet and a short one for thousands. */
export function drawAltimeter(ctx, cx, cy, r, altitudeFt) {
  bezel(ctx, cx, cy, r, 'ALT FT');
  ticks(ctx, cx, cy, r, 10, -Math.PI / 2, -Math.PI / 2 + TAU, 1, 7, 'rgba(200,230,245,0.75)');
  const ft = Math.max(0, altitudeFt);
  const hundreds = ((ft % 1000) / 1000) * TAU - Math.PI / 2;
  const thousands = ((ft % 10000) / 10000) * TAU - Math.PI / 2;
  needle(ctx, cx, cy, thousands, r * 0.5, '#9fd8e8', 3);
  needle(ctx, cx, cy, hundreds, r - 12);
  ctx.save();
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(ft)), cx, cy + r * 0.3);
  ctx.restore();
}

/** Vertical speed, -2000..+2000 feet per minute, needle up for climb. */
export function drawVsi(ctx, cx, cy, r, fpm) {
  bezel(ctx, cx, cy, r, 'VSI');
  ticks(ctx, cx, cy, r, 8, Math.PI * 0.75, Math.PI * 2.25, 1, 7, 'rgba(200,230,245,0.7)');
  const clamped = Math.max(-2000, Math.min(2000, fpm));
  const a0 = Math.PI * 0.75;
  const a1 = Math.PI * 2.25;
  needle(ctx, cx, cy, a0 + (a1 - a0) * ((clamped + 2000) / 4000), r - 12, PALETTE.needle, 2);
  ctx.save();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${clamped >= 0 ? '+' : ''}${Math.round(clamped)}`, cx, cy + r * 0.3);
  ctx.restore();
}

/** Compass card: the rose turns under a fixed bug, as a heading indicator does. */
export function drawCompass(ctx, cx, cy, r, headingDeg) {
  bezel(ctx, cx, cy, r, 'HDG');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-headingDeg * Math.PI) / 180);
  for (let i = 0; i < 36; i += 1) {
    const a = (i / 36) * TAU;
    const major = i % 9 === 0;
    ctx.strokeStyle = major ? 'rgba(220,245,255,0.9)' : 'rgba(160,200,225,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (r - (major ? 10 : 5)), -Math.cos(a) * (r - (major ? 10 : 5)));
    ctx.lineTo(Math.sin(a) * (r - 2), -Math.cos(a) * (r - 2));
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const names = ['N', 'E', 'S', 'W'];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * TAU;
    ctx.fillText(names[i], Math.sin(a) * (r - 19), -Math.cos(a) * (r - 19));
  }
  ctx.restore();
  // Fixed lubber line.
  ctx.save();
  ctx.fillStyle = PALETTE.ringNext;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r + 1);
  ctx.lineTo(cx - 4, cy - r - 6);
  ctx.lineTo(cx + 4, cy - r - 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Throttle lever in a slot, with the percentage under it. */
export function drawThrottle(ctx, x, y, w, h, throttle) {
  ctx.save();
  const face = ctx.createLinearGradient(x, y, x + w, y + h);
  face.addColorStop(0, '#1b2833');
  face.addColorStop(1, PALETTE.panelFace);
  ctx.fillStyle = face;
  ctx.strokeStyle = PALETTE.panelRim;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  const slotX = x + w / 2;
  ctx.strokeStyle = '#0a1117';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(slotX, y + 12);
  ctx.lineTo(slotX, y + h - 26);
  ctx.stroke();

  const knobY = y + h - 26 - (h - 40) * Math.max(0, Math.min(1, throttle));
  const knob = ctx.createLinearGradient(slotX - 12, knobY - 9, slotX + 12, knobY + 9);
  knob.addColorStop(0, '#ffe6a8');
  knob.addColorStop(1, '#c98b25');
  ctx.fillStyle = knob;
  ctx.strokeStyle = '#6d4a10';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(slotX - 13, knobY - 8, 26, 16, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THR', slotX, y + h - 12);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.fillText(`${Math.round(throttle * 100)}%`, slotX, y + h - 1);
  ctx.restore();
}

/** Fuel gauge: a bar that turns amber then red as the tank drains. */
export function drawFuel(ctx, x, y, w, h, fuelPct) {
  ctx.save();
  ctx.fillStyle = PALETTE.panelFace;
  ctx.strokeStyle = PALETTE.panelRim;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.stroke();
  const level = Math.max(0, Math.min(1, fuelPct / 100));
  const color = level < 0.18 ? PALETTE.warning : level < 0.35 ? PALETTE.fuel : '#5ad28c';
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3 + (h - 6) * (1 - level), w - 6, (h - 6) * level, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FUEL', x + w / 2, y + h + 9);
  ctx.restore();
}

/** Convenience: knots and feet from the model's units. */
export function toKnots(mps) {
  return mps * FLIGHT.mpsToKt;
}
export function toFeet(m) {
  return m * FLIGHT.mToFt;
}
export function toFpm(mps) {
  return mps * FLIGHT.mToFt * 60;
}
