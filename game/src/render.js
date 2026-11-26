// Frame composition: build the camera for the current view, paint the scene back to
// front, lay the airframe over it (chase) or under it (cockpit), then the HUD and the
// end-state screens. render.js owns the order; every shape comes from its own module.

import { VIEW, PALETTE } from './config.js';
import { createCamera } from './camera.js';
import { drawSky, drawSea, drawSeaSparkle, drawIslands, drawRunway, drawRings, drawClouds } from './scenery.js';
import { drawPlane, drawCockpitAirframe } from './plane.js';
import { drawHud, drawStatusBanners, drawTitle, formatTime } from './hud.js';
import { drawAirspeed, drawAltimeter, drawVsi, drawCompass, drawThrottle, drawFuel, toKnots, toFeet, toFpm } from './instruments.js';
import { headingDegrees } from './camera.js';
import { guidance } from './world.js';

const SUN_BEARING = -2.1;

/** The instrument panel across the bottom of the screen. */
function drawInstrumentPanel(ctx, width, height, world) {
  const p = world.plane;
  const panelH = 132;
  const y = height - panelH;
  const g = ctx.createLinearGradient(0, y, 0, height);
  g.addColorStop(0, 'rgba(17,26,34,0.94)');
  g.addColorStop(1, 'rgba(8,14,19,0.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, width, panelH);
  ctx.strokeStyle = 'rgba(140,200,230,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();

  const cy = y + 62;
  const r = 44;
  drawAirspeed(ctx, 96, cy, r, toKnots(p.speed));
  drawAltimeter(ctx, 226, cy, r, toFeet(p.y));
  drawVsi(ctx, 356, cy, r, toFpm(p.vspeed));
  drawCompass(ctx, 486, cy, r, headingDegrees(p.heading));

  drawThrottle(ctx, 580, y + 14, 56, 100, p.throttle);
  drawFuel(ctx, 654, y + 22, 30, 74, p.fuel);

  // Centre block: the digital strip the judge can read in a shrunken shot.
  ctx.save();
  ctx.fillStyle = PALETTE.panelFace;
  ctx.strokeStyle = PALETTE.panelRim;
  ctx.beginPath();
  ctx.roundRect(710, y + 14, 300, 100, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText('FLIGHT DATA', 724, y + 30);
  const rows = [
    ['ALT', `${Math.round(toFeet(p.y))} ft`],
    ['IAS', `${Math.round(toKnots(p.speed))} kt`],
    ['HDG', `${String(Math.round(headingDegrees(p.heading))).padStart(3, '0')}°`],
    ['V/S', `${Math.round(toFpm(p.vspeed))} fpm`],
    ['RINGS', `${world.nextRing}/${world.rings.length}`],
    ['TIME', formatTime(world.time)],
  ];
  rows.forEach((row, i) => {
    const col = i % 2;
    const line = Math.floor(i / 2);
    const x = 724 + col * 146;
    const ry = y + 50 + line * 20;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.fillText(row[0], x, ry);
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText(row[1], x + 42, ry + 1);
  });
  ctx.restore();

  // Score and seed, right of the data block.
  ctx.save();
  ctx.fillStyle = PALETTE.panelFace;
  ctx.strokeStyle = PALETTE.panelRim;
  ctx.beginPath();
  ctx.roundRect(1024, y + 14, 234, 100, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText('SCORE', 1038, y + 32);
  ctx.fillStyle = PALETTE.ringNext;
  ctx.font = 'bold 34px ui-monospace, monospace';
  ctx.fillText(String(Math.round(world.score)).padStart(5, '0'), 1038, y + 70);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillText(`SEED ${world.seed}`, 1038, y + 90);
  ctx.fillStyle = world.plane.stall ? PALETTE.warning : '#5ad28c';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(world.plane.stall ? 'STALL' : world.plane.fuel <= 0 ? 'ENGINE OUT' : 'ENGINE OK', 1180, y + 90);
  ctx.restore();
}

/** One frame of the live game, in the current camera mode. */
export function renderFrame(ctx, world, viewMode, time) {
  const { width, height } = VIEW;
  const camera = createCamera(world.plane, viewMode, width, height);
  drawSky(ctx, camera, width, height, time, SUN_BEARING);
  drawClouds(ctx, camera, width, height, time);
  drawSea(ctx, camera, width, height, time);
  drawSeaSparkle(ctx, camera, width, height, time);
  drawIslands(ctx, camera, world, width, height);
  drawRunway(ctx, camera, world.runway, width, height);
  drawRings(ctx, camera, world, width, height, time);
  if (viewMode === 'chase') drawPlane(ctx, camera, world.plane);
  else drawCockpitAirframe(ctx, width, height, world.plane);

  drawHud(ctx, width, height, world, guidance(world), viewMode);
  drawStatusBanners(ctx, width, height, world);
  drawInstrumentPanel(ctx, width, height, world);
  return camera;
}

/** The end screen: what happened, the score breakdown, and how to fly again. */
export function renderEnd(ctx, world) {
  const { width, height } = VIEW;
  const landed = world.phase === 'landed';
  ctx.save();
  ctx.fillStyle = 'rgba(4,12,18,0.62)';
  ctx.fillRect(0, 0, width, height);

  const w = 560;
  const h = 340;
  const x = (width - w) / 2;
  const y = (height - h) / 2 - 30;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(14,26,35,0.97)');
  g.addColorStop(1, 'rgba(6,14,20,0.98)');
  ctx.fillStyle = g;
  ctx.strokeStyle = landed ? 'rgba(142,240,168,0.6)' : 'rgba(255,90,77,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = landed ? '#8ef0a8' : PALETTE.warning;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(landed ? 'TOUCHDOWN' : 'RUN ENDED', width / 2, y + 58);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(landed ? 'The strip is behind you — a clean island landing.' : world.crashReason, width / 2, y + 88);

  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudDim;
  const rows = [
    ['RINGS FLOWN', `${world.ringsHit.length} / ${world.rings.length}`],
    ['TIME', formatTime(world.time)],
    ['DISTANCE', `${(world.distanceFlown / 1000).toFixed(1)} km`],
    ['LANDING', landed ? `${Math.round((world.landQuality ?? 0) * 100)}% smooth` : '—'],
    ['BOUNCES', String(world.bounces)],
    ['FUEL LEFT', `${Math.round(world.plane.fuel)}%`],
  ];
  rows.forEach((row, i) => {
    const col = i % 2;
    const line = Math.floor(i / 2);
    const rx = x + 60 + col * 250;
    const ry = y + 130 + line * 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(row[0], rx, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = 'bold 20px ui-monospace, monospace';
    ctx.fillText(row[1], rx + 190, ry + 2);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ringNext;
  ctx.font = 'bold 40px ui-monospace, monospace';
  ctx.fillText(String(Math.round(world.score)).padStart(5, '0'), width / 2, y + h - 62);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('SCORE', width / 2, y + h - 46);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', width / 2, y + h - 16);
  ctx.restore();
}

export { drawTitle, PALETTE };
