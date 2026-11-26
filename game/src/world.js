// The world: one plain object holding the plane, the islands, the rings and the run's
// state, plus the small queries the HUD and the autopilot need. No DOM here, so the
// headless simulator imports this file unchanged.

import { FLIGHT, COURSE, TIME } from './config.js';
import { makeRng } from './random.js';
import { terrainHeight, groundHeight, wrapAngle, clamp } from './terrain.js';
import { buildIslands, plantPalms, buildRunway, buildRings, startState, relativeBearing } from './course.js';

/** A fresh run for a seed: islands, rings, runway and the plane on approach. */
export function createWorld(seed) {
  const rng = makeRng(seed);
  const islands = buildIslands(rng);
  const runway = buildRunway(islands);
  plantPalms(rng, islands, runway);
  const rings = buildRings(rng, islands, runway);
  const start = startState(rings);
  const plane = {
    x: start.x,
    y: start.y,
    z: start.z,
    speed: FLIGHT.cruiseSpeed,
    pitch: 0,
    roll: 0,
    heading: start.heading,
    throttle: 0.62,
    vspeed: 0,
    stall: false,
    fuel: FLIGHT.fuelStart,
  };
  return {
    seed,
    phase: 'fly',            // fly | landed | crashed
    time: 0,                 // elapsed seconds, always increasing
    timeLeft: TIME.startTimeLeft,   // the run clock; rings add to it
    plane,
    islands,
    rings,
    runway,
    nextRing: 0,
    ringsHit: [],
    score: 0,
    bounces: 0,
    landQuality: null,
    crashReason: '',
    events: [],
    distanceFlown: 0,
    touchdownSink: 0,
    maxAltitude: plane.y,
  };
}

/** The next thing to fly at: the next ring, then the runway threshold. */
export function currentTarget(world) {
  if (world.nextRing < world.rings.length) {
    const r = world.rings[world.nextRing];
    return { kind: 'ring', x: r.x, y: r.y, z: r.z, radius: r.radius };
  }
  const rw = world.runway;
  return {
    kind: 'runway',
    x: rw.x - rw.dirX * rw.halfLength * 0.6,
    y: rw.elevation,
    z: rw.z - rw.dirZ * rw.halfLength * 0.6,
    radius: 0,
  };
}

/** Bearing to the target and how far off the nose it sits, for the HUD arrow. */
export function guidance(world) {
  const target = currentTarget(world);
  const plane = world.plane;
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  return {
    target,
    dist: Math.hypot(dx, dz),
    bearing: Math.atan2(dz, dx),
    relative: relativeBearing(plane, target),
    altitudeDelta: target.y - plane.y,
  };
}

/** Queue a one-shot event; audio and the effect layer drain these each frame. */
export function emit(world, kind, data = {}) {
  world.events.push({ kind, ...data });
}

export function drainEvents(world) {
  const out = world.events;
  world.events = [];
  return out;
}

/** Score as shown to the player: never negative, whatever the run did. */
export function finalScore(world) {
  return Math.max(0, Math.round(world.score));
}

export { terrainHeight, groundHeight, wrapAngle, clamp, TIME };
