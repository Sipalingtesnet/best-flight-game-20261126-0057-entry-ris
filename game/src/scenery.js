// Scenery: sky and sun, the sea with its moving sparkle, the islands with beaches,
// cliffs and palms, the runway strip, the glowing rings and drifting clouds. Every
// shape is drawn in code and sorted back to front, so nearer land covers farther.

import { PALETTE, COURSE, VIEW } from './config.js';
import { terrainHeight } from './terrain.js';
import { horizonPoints } from './camera.js';

const TAU = Math.PI * 2;

/** Sky gradient and sun, painted to the whole canvas before anything else. */
export function drawSky(ctx, camera, width, height, time, sunBearing) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.55, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);

  // The sun sits at a fixed compass bearing so it feels anchored to the world.
  const sunDist = 9000;
  const sun = camera.project(
    camera.pos[0] + Math.cos(sunBearing) * sunDist,
    3400,
    camera.pos[2] + Math.sin(sunBearing) * sunDist,
  );
  if (sun.visible) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 8, sun.x, sun.y, 220);
    glow.addColorStop(0, 'rgba(255,250,214,0.95)');
    glow.addColorStop(0.25, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255,244,196,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 220, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 34, 0, TAU);
    ctx.fill();
  }
}

/** The sea: a flat gradient under the horizon, banded to fake depth. */
export function drawSea(ctx, camera, width, height, time) {
  const horizon = horizonPoints(camera, width, height, 10);
  const topY = Math.min(...horizon.map((p) => p.y));
  const g = ctx.createLinearGradient(0, topY, 0, height);
  g.addColorStop(0, PALETTE.seaShallow);
  g.addColorStop(0.35, PALETTE.seaMid);
  g.addColorStop(1, PALETTE.seaDeep);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, horizon[0].y);
  for (const p of horizon) ctx.lineTo(p.x, p.y);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  return topY;
}

/** Sparkle: short glints laid on a world grid so they drift with the camera. */
export function drawSeaSparkle(ctx, camera, width, height, time) {
  const cell = 46;
  const px = camera.pos[0];
  const pz = camera.pos[2];
  const i0 = Math.floor(px / cell) - 26;
  const i1 = Math.floor(px / cell) + 26;
  const j0 = Math.floor(pz / cell) - 26;
  const j1 = Math.floor(pz / cell) + 26;
  ctx.save();
  ctx.strokeStyle = 'rgba(220,250,255,0.5)';
  ctx.lineWidth = 1.4;
  for (let i = i0; i <= i1; i += 1) {
    for (let j = j0; j <= j1; j += 1) {
      const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
      const r = h - Math.floor(h);
      if (r > 0.14) continue;
      const wx = i * cell + (r * 40);
      const wz = j * cell + (Math.sin(time * 0.7 + i * 0.4) * 9);
      const p = camera.project(wx, 0.4, wz);
      if (!p.visible || p.x < -20 || p.x > width + 20 || p.y < 0 || p.y > height) continue;
      const len = Math.max(1.5, Math.min(7, p.scale * 0.9));
      const bob = Math.sin(time * 2.2 + i + j) * len * 0.3;
      ctx.globalAlpha = Math.min(0.75, 0.2 + p.scale * 0.02);
      ctx.beginPath();
      ctx.moveTo(p.x - len, p.y + bob);
      ctx.lineTo(p.x + len, p.y + bob);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Islands, far to near: each is a fan of triangles from its summit down to the
 * waterline, with a beach ring and a green interior. Palms go on top.
 */
export function drawIslands(ctx, camera, world, width, height) {
  const items = [];
  for (const island of world.islands) {
    const p = camera.project(island.x, island.height * 0.5, island.z);
    if (!p.visible) continue;
    const dist = Math.hypot(island.x - camera.pos[0], island.z - camera.pos[2]);
    items.push({ island, dist, screen: p });
  }
  items.sort((a, b) => b.dist - a.dist);
  for (const item of items) drawOneIsland(ctx, camera, item.island, width, height);
  return items;
}

function drawOneIsland(ctx, camera, island, width, height) {
  const segs = 30;
  const rim = [];
  for (let i = 0; i <= segs; i += 1) {
    const a = (i / segs) * TAU;
    const x = island.x + Math.cos(a) * island.radius;
    const z = island.z + Math.sin(a) * island.radius;
    const p = camera.project(x, 0, z);
    rim.push(p);
  }
  // Beach skirt: the island's footprint at the waterline.
  ctx.beginPath();
  let started = false;
  for (const p of rim) {
    if (!p.visible) continue;
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else ctx.lineTo(p.x, p.y);
  }
  if (started) {
    ctx.closePath();
    const sand = ctx.createLinearGradient(0, height * 0.35, 0, height);
    sand.addColorStop(0, PALETTE.sand);
    sand.addColorStop(1, PALETTE.sandDark);
    ctx.fillStyle = sand;
    ctx.fill();
  }

  // Green interior: a shrunken ring lifted to the shore height, plus the summit fan.
  const inner = [];
  for (let i = 0; i <= segs; i += 1) {
    const a = (i / segs) * TAU;
    const r = island.radius * 0.82;
    const x = island.x + Math.cos(a) * r;
    const z = island.z + Math.sin(a) * r;
    const y = terrainHeight({ islands: [island] }, x, z) * 0.9;
    inner.push(camera.project(x, y, z));
  }
  ctx.beginPath();
  started = false;
  for (const p of inner) {
    if (!p.visible) continue;
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else ctx.lineTo(p.x, p.y);
  }
  if (started) {
    ctx.closePath();
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fill();
  }

  // Slopes: triangles from the summit out to the inner rim, shaded by facing.
  const summit = camera.project(island.x, island.height, island.z);
  if (summit.visible) {
    for (let i = 0; i < segs; i += 1) {
      const a = inner[i];
      const b = inner[i + 1];
      if (!a.visible || !b.visible) continue;
      const ang = (i / segs) * TAU;
      const light = 0.5 + 0.5 * Math.cos(ang - 2.3);
      const shade = Math.round(40 + light * 60);
      ctx.beginPath();
      ctx.moveTo(summit.x, summit.y);
      ctx.lineTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.fillStyle = `rgb(${Math.round(45 + light * 40)}, ${Math.round(120 + light * 70)}, ${Math.round(60 + light * 40)})`;
      ctx.fill();
      if (island.height > 40 && light < 0.45) {
        // A cliff band on the shaded side.
        ctx.fillStyle = `rgba(${shade},${shade - 12},${shade - 30},0.5)`;
        ctx.fill();
      }
    }
  }

  // Palms: trunk and a crown of fronds, sized by depth.
  for (const palm of island.palms) {
    const base = camera.project(palm.x, terrainHeight({ islands: [island] }, palm.x, palm.z), palm.z);
    if (!base.visible || base.scale < 0.6) continue;
    const h = Math.max(3, Math.min(26, base.scale * 2.1 * palm.h));
    drawPalm(ctx, base.x, base.y, h);
  }
}

function drawPalm(ctx, x, y, h) {
  ctx.save();
  ctx.strokeStyle = PALETTE.palmTrunk;
  ctx.lineWidth = Math.max(1, h * 0.09);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + h * 0.1, y - h * 0.6, x + h * 0.16, y - h);
  ctx.stroke();
  const tipX = x + h * 0.16;
  const tipY = y - h;
  ctx.strokeStyle = PALETTE.palmLeaf;
  ctx.lineWidth = Math.max(1, h * 0.07);
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.52;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      tipX + Math.cos(a) * h * 0.34,
      tipY + Math.sin(a) * h * 0.34,
      tipX + Math.cos(a) * h * 0.6,
      tipY + Math.sin(a) * h * 0.42 + h * 0.12,
    );
    ctx.stroke();
  }
  ctx.restore();
}

/** The runway: a deck on the last atoll with thresholds, centre line and numbers. */
export function drawRunway(ctx, camera, rw, width, height) {
  const corners = [
    [rw.x - rw.dirX * rw.halfLength - rw.dirZ * rw.halfWidth, rw.elevation, rw.z - rw.dirZ * rw.halfLength + rw.dirX * rw.halfWidth],
    [rw.x + rw.dirX * rw.halfLength - rw.dirZ * rw.halfWidth, rw.elevation, rw.z + rw.dirZ * rw.halfLength + rw.dirX * rw.halfWidth],
    [rw.x + rw.dirX * rw.halfLength + rw.dirZ * rw.halfWidth, rw.elevation, rw.z + rw.dirZ * rw.halfLength - rw.dirX * rw.halfWidth],
    [rw.x - rw.dirX * rw.halfLength + rw.dirZ * rw.halfWidth, rw.elevation, rw.z - rw.dirZ * rw.halfLength - rw.dirX * rw.halfWidth],
  ].map((c) => camera.project(c[0], c[1], c[2]));
  if (corners.some((c) => !c.visible)) return;

  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath();
  ctx.fillStyle = PALETTE.runway;
  ctx.fill();
  ctx.strokeStyle = PALETTE.runwayEdge;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Centre line dashes and the two threshold bars.
  ctx.save();
  for (let i = -4; i <= 4; i += 1) {
    const f = i / 5;
    const a = camera.project(
      rw.x + rw.dirX * rw.halfLength * f - rw.dirZ * 0.7,
      rw.elevation,
      rw.z + rw.dirZ * rw.halfLength * f + rw.dirX * 0.7,
    );
    const b = camera.project(
      rw.x + rw.dirX * rw.halfLength * f + rw.dirZ * 0.7,
      rw.elevation,
      rw.z + rw.dirZ * rw.halfLength * f - rw.dirX * 0.7,
    );
    if (!a.visible || !b.visible) continue;
    ctx.strokeStyle = 'rgba(250,248,238,0.85)';
    ctx.lineWidth = Math.max(1, a.scale * 0.5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const end of [-1, 1]) {
    for (let k = -3; k <= 3; k += 1) {
      if (k === 0) continue;
      const px = rw.x + rw.dirX * rw.halfLength * end * 0.88 + rw.dirZ * k * 1.6;
      const pz = rw.z + rw.dirZ * rw.halfLength * end * 0.88 - rw.dirX * k * 1.6;
      const p = camera.project(px, rw.elevation, pz);
      if (!p.visible) continue;
      const s = Math.max(1, p.scale * 1.1);
      ctx.fillStyle = 'rgba(250,248,238,0.9)';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  ctx.restore();
}

/**
 * Rings: a glowing torus drawn as an ellipse in its own plane. The next ring is hot
 * amber with a pulsing halo; passed rings dim; future rings show as pale outlines.
 */
export function drawRings(ctx, camera, world, width, height, time) {
  const order = world.rings
    .map((r, i) => ({ r, i, d: Math.hypot(r.x - camera.pos[0], r.z - camera.pos[2]) }))
    .sort((a, b) => b.d - a.d);
  for (const { r, i } of order) drawRing(ctx, camera, r, i, world.nextRing, time);
}

function drawRing(ctx, camera, ring, index, nextRing, time) {
  const cx = camera.project(ring.x, ring.y, ring.z);
  if (!cx.visible) return;
  // Two points across the ring give its screen radius and orientation.
  const rx = Math.cos(ring.heading + Math.PI / 2);
  const rz = Math.sin(ring.heading + Math.PI / 2);
  const edge = camera.project(ring.x + rx * ring.radius, ring.y, ring.z + rz * ring.radius);
  const top = camera.project(ring.x, ring.y + ring.radius, ring.z);
  if (!edge.visible || !top.visible) return;
  const radiusX = Math.hypot(edge.x - cx.x, edge.y - cx.y);
  const radiusY = Math.hypot(top.x - cx.x, top.y - cx.y);
  const rot = Math.atan2(edge.y - cx.y, edge.x - cx.x);
  if (radiusX < 2 || radiusY < 1.5) return;

  const passed = index < nextRing;
  const isNext = index === nextRing;
  ctx.save();
  ctx.translate(cx.x, cx.y);
  ctx.rotate(rot);

  if (isNext) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 3.4);
    const halo = ctx.createRadialGradient(0, 0, radiusX * 0.2, 0, 0, radiusX * 1.5);
    halo.addColorStop(0, 'rgba(255,209,102,0.0)');
    halo.addColorStop(0.62, `rgba(255,209,102,${0.1 + pulse * 0.12})`);
    halo.addColorStop(1, 'rgba(255,209,102,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.ellipse(0, 0, radiusX * 1.5, radiusY * 1.5, 0, 0, TAU);
    ctx.fill();
  }

  const stroke = isNext ? PALETTE.ringNext : passed ? 'rgba(126,249,212,0.35)' : 'rgba(126,249,212,0.8)';
  const lineW = Math.max(2, Math.min(14, radiusX * 0.075));
  ctx.lineWidth = lineW;
  ctx.strokeStyle = stroke;
  ctx.shadowColor = isNext ? PALETTE.ringNext : PALETTE.ring;
  ctx.shadowBlur = isNext ? 26 : passed ? 4 : 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, TAU);
  ctx.stroke();

  // Inner highlight arc, and the ring number under it.
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, lineW * 0.3);
  ctx.strokeStyle = isNext ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX * 0.93, radiusY * 0.93, 0, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.restore();

  if (radiusX > 14) {
    ctx.save();
    ctx.fillStyle = isNext ? PALETTE.ringNext : PALETTE.hudDim;
    ctx.font = `bold ${Math.max(10, Math.min(22, radiusX * 0.18))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(index + 1), cx.x, cx.y + radiusY + Math.max(14, radiusX * 0.16));
    ctx.restore();
  }
}

/** Clouds: flat cumulus puffs on a world grid, drifting slowly with the wind. */
export function drawClouds(ctx, camera, width, height, time) {
  const layer = [
    { alt: 150, scale: 1.0, cell: 420, alpha: 0.92 },
    { alt: 320, scale: 1.6, cell: 620, alpha: 0.8 },
    { alt: 520, scale: 2.3, cell: 860, alpha: 0.62 },
  ];
  const items = [];
  for (let li = 0; li < layer.length; li += 1) {
    const { alt, scale, cell, alpha } = layer[li];
    const i0 = Math.floor((camera.pos[0] - 1500) / cell);
    const i1 = Math.floor((camera.pos[0] + 1500) / cell);
    const j0 = Math.floor((camera.pos[2] - 1500) / cell);
    const j1 = Math.floor((camera.pos[2] + 1500) / cell);
    for (let i = i0; i <= i1; i += 1) {
      for (let j = j0; j <= j1; j += 1) {
        const h = Math.sin(i * 127.1 + j * 311.7 + li * 74.7) * 43758.5453;
        const r = h - Math.floor(h);
        if (r > 0.34) continue;
        const wx = i * cell + r * cell + time * 2.4;
        const wz = j * cell + (1 - r) * cell;
        const wy = alt + r * 40;
        const p = camera.project(wx, wy, wz);
        if (!p.visible) continue;
        items.push({ p, scale: scale * (0.7 + r), alpha, dist: p.depth });
      }
    }
  }
  items.sort((a, b) => b.dist - a.dist);
  for (const c of items) {
    const w = c.p.scale * 26 * c.scale;
    const h = w * 0.42;
    if (w < 6 || c.p.x < -w || c.p.x > width + w || c.p.y < -h || c.p.y > height + h) continue;
    ctx.save();
    ctx.globalAlpha = c.alpha * 0.85;
    const grad = ctx.createLinearGradient(0, c.p.y - h, 0, c.p.y + h);
    grad.addColorStop(0, 'rgba(255,255,255,0.98)');
    grad.addColorStop(0.6, 'rgba(240,248,255,0.92)');
    grad.addColorStop(1, 'rgba(206,226,240,0.8)');
    ctx.fillStyle = grad;
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.ellipse(c.p.x + k * w * 0.32, c.p.y + Math.abs(k) * h * 0.16, w * (0.42 - Math.abs(k) * 0.08), h * (0.62 - Math.abs(k) * 0.1), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** A short faded trail behind the plane, drawn in world space. */
export function drawTrail(ctx, camera, trail, width, height) {
  if (trail.length < 2) return;
  ctx.save();
  for (let i = 1; i < trail.length; i += 1) {
    const a = camera.project(trail[i - 1].x, trail[i - 1].y, trail[i - 1].z);
    const b = camera.project(trail[i].x, trail[i].y, trail[i].z);
    if (!a.visible || !b.visible) continue;
    const t = i / trail.length;
    ctx.strokeStyle = `rgba(255,255,255,${0.02 + t * 0.1})`;
    ctx.lineWidth = Math.max(1, 8 * t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

export { VIEW };
