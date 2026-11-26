// Course generation: the island chain, the runway on the last atoll, and the eight
// target rings strung between the islands. Seeded, so ?seed=1 is always the same run.

import { COURSE, ISLANDS, RUNWAY } from './config.js';
import { makeRng } from './random.js';
import { wrapAngle } from './terrain.js';

const TAU = Math.PI * 2;

/** A wandering chain of cone islands heading roughly east-north-east. */
export function buildIslands(rng) {
  const islands = [];
  let x = 0;
  let z = 0;
  let bearing = ISLANDS.baseBearing;
  for (let i = 0; i < ISLANDS.count; i += 1) {
    const last = i === ISLANDS.count - 1;
    islands.push({
      x,
      z,
      radius: last ? ISLANDS.lastRadius : rng.range(ISLANDS.radiusMin, ISLANDS.radiusMax),
      height: last ? ISLANDS.lastHeight : rng.range(ISLANDS.heightMin, ISLANDS.heightMax),
      seed: Math.floor(rng.next() * 100000),
      palms: [],
    });
    if (last) break;
    bearing += rng.signed(ISLANDS.bearingDrift);
    const step = rng.range(ISLANDS.spacingMin, ISLANDS.spacingMax);
    x += Math.cos(bearing) * step;
    z += Math.sin(bearing) * step;
  }
  return islands;
}

/** Palm clusters on the green interior of each island, kept off the strip. */
export function plantPalms(rng, islands, runway) {
  for (const island of islands) {
    const n = island.radius > 200 ? 9 : ISLANDS.palmsPerIsland;
    for (let i = 0; i < n; i += 1) {
      const ang = rng.next() * TAU;
      const r = island.radius * rng.range(0.34, 0.72);
      const px = island.x + Math.cos(ang) * r;
      const pz = island.z + Math.sin(ang) * r;
      if (runway) {
        const dx = px - runway.x;
        const dz = pz - runway.z;
        const along = dx * runway.dirX + dz * runway.dirZ;
        const across = -dx * runway.dirZ + dz * runway.dirX;
        if (Math.abs(along) < runway.halfLength + 24 && Math.abs(across) < runway.halfWidth + 20) continue;
      }
      island.palms.push({ x: px, z: pz, h: rng.range(0.7, 1.3) });
    }
  }
}

/** The strip runs along the chain's last leg, so the approach lines up naturally. */
export function buildRunway(islands) {
  const last = islands[islands.length - 1];
  const prev = islands[islands.length - 2] || last;
  const dx = last.x - prev.x;
  const dz = last.z - prev.z;
  const len = Math.hypot(dx, dz) || 1;
  const dirX = dx / len;
  const dirZ = dz / len;
  return {
    x: last.x + dirX * last.radius * RUNWAY.offsetFrac,
    z: last.z + dirZ * last.radius * RUNWAY.offsetFrac,
    dirX,
    dirZ,
    halfLength: RUNWAY.halfLength,
    halfWidth: RUNWAY.halfWidth,
    elevation: RUNWAY.elevation,
    heading: Math.atan2(dirZ, dirX),
  };
}

/**
 * Eight rings along the chain, each facing the next island, climbing gently. The
 * last one sits on the strip centre line, far enough out that the descent to the
 * threshold is a comfortable glide rather than a dive.
 */
export function buildRings(rng, islands, runway) {
  const rings = [];
  for (let i = 0; i < COURSE.ringCount; i += 1) {
    const t = (i + 1) / (COURSE.ringCount + 1);
    const seg = t * (islands.length - 1);
    const i0 = Math.min(islands.length - 2, Math.floor(seg));
    const f = seg - i0;
    const a = islands[i0];
    const b = islands[i0 + 1];
    const x = a.x + (b.x - a.x) * f + rng.signed(70);
    const z = a.z + (b.z - a.z) * f + rng.signed(70);
    const y = COURSE.ringBaseHeight + i * COURSE.ringHeightStep + rng.signed(6);
    const ahead = islands[Math.min(islands.length - 1, i0 + 1)];
    rings.push({
      x,
      y,
      z,
      radius: COURSE.ringRadius,
      heading: Math.atan2(ahead.z - z, ahead.x - x),
      index: i,
    });
  }
  // The final ring sits on the approach path, so the last pass already
  // points the nose down the runway.
  const last = rings[rings.length - 1];
  if (runway && last) {
    const out = COURSE.finalRingDistance;
    last.x = runway.x - runway.dirX * (runway.halfLength + out);
    last.z = runway.z - runway.dirZ * (runway.halfLength + out);
    last.y = runway.elevation + COURSE.finalRingHeight;
    last.heading = runway.heading;
  }
  return rings;
}

/**
 * Where the run begins: a short hop west of the first ring, already at cruise
 * altitude and pointed down the course, so the player has flying room at once.
 */
export function startState(rings) {
  const first = rings[0];
  const x = first.x - Math.cos(first.heading) * 210;
  const z = first.z - Math.sin(first.heading) * 210;
  return { x, z, y: COURSE.startAltitude, heading: first.heading };
}

/** Ring geometry in the plane of the ring: distance along and off-centre. */
export function ringOffset(ring, x, y, z) {
  const dx = x - ring.x;
  const dy = y - ring.y;
  const dz = z - ring.z;
  return {
    along: dx * Math.cos(ring.heading) + dz * Math.sin(ring.heading),
    lateral: -dx * Math.sin(ring.heading) + dz * Math.cos(ring.heading),
    vertical: dy,
  };
}

/** Which way to turn to reach the next target, in radians. */
export function relativeBearing(plane, target) {
  return wrapAngle(Math.atan2(target.z - plane.z, target.x - plane.x) - plane.heading);
}
