// Terrain queries: the archipelago's shape as a pure function of position.
// The renderer draws the horizon from these same numbers, so a hill the player
// sees is exactly a hill the plane can hit.

import { RUNWAY } from './config.js';

export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x < -Math.PI) x += TAU;
  return x;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function planarDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Smooth cone islands with a low sandy rim, so beaches read from the air. */
export function terrainHeight(world, x, z) {
  let best = 0;
  for (const island of world.islands) {
    const d = Math.hypot(x - island.x, z - island.z);
    if (d > island.radius) continue;
    const t = 1 - d / island.radius;
    const shore = clamp(t / 0.18, 0, 1);
    const cone = Math.pow(clamp((t - 0.02) / 0.98, 0, 1), 1.35);
    const h = island.height * cone * shore;
    if (h > best) best = h;
  }
  return best;
}

/** Surface the wheels would meet: terrain, or the runway deck laid on the atoll. */
export function groundHeight(world, x, z) {
  let h = terrainHeight(world, x, z);
  const rw = world.runway;
  if (rw) {
    const along = (x - rw.x) * rw.dirX + (z - rw.z) * rw.dirZ;
    const across = -(x - rw.x) * rw.dirZ + (z - rw.z) * rw.dirX;
    if (Math.abs(along) <= rw.halfLength && Math.abs(across) <= rw.halfWidth) {
      h = Math.max(h, rw.elevation);
    }
  }
  return h;
}

/** Local strip coordinates: along the centre line and across it. */
export function runwayFrame(rw, x, z) {
  const dx = x - rw.x;
  const dz = z - rw.z;
  return {
    along: dx * rw.dirX + dz * rw.dirZ,
    across: -dx * rw.dirZ + dz * rw.dirX,
  };
}

/** Is a point over the raised strip deck? */
export function onRunway(world, x, z) {
  const f = runwayFrame(world.runway, x, z);
  return Math.abs(f.along) <= world.runway.halfLength && Math.abs(f.across) <= world.runway.halfWidth;
}

export { RUNWAY };
