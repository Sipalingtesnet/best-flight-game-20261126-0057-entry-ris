// Staged scenes for the screenshots. Reads ?shot= and ?seed=, builds the world from the
// seed, then flies it forward with the shared autopilot until the scene's moment, so
// every render is a real game state and every seed gives the same frame.

import { COURSE, LANDING } from './config.js';
import { createWorld } from './world.js';
import { stepPlane } from './flight.js';
import { autopilotInput, approachGeometry } from './autopilot.js';

const DT = 1 / 60;

/** Advance the world with the autopilot for a number of simulated seconds. */
export function flyFor(world, seconds, opts = {}) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps && world.phase === 'fly'; i += 1) {
    stepPlane(world, autopilotInput(world, opts), DT);
  }
  return world;
}

/** Advance until the next ring is taken, or a step budget runs out. */
function flyUntilNextRing(world, opts, maxSeconds = 90) {
  const before = world.nextRing;
  const steps = Math.round(maxSeconds / DT);
  for (let i = 0; i < steps && world.phase === 'fly'; i += 1) {
    stepPlane(world, autopilotInput(world, opts), DT);
    if (world.nextRing > before) return true;
  }
  return false;
}

/**
 * Place the plane a set distance before the next ring, on the ring's own axis, so the
 * ring frames the shot instead of filling it. Keeps the rest of the run state honest.
 */
function approachRing(world, distance) {
  const ring = world.rings[Math.min(world.nextRing, world.rings.length - 1)];
  const p = world.plane;
  p.x = ring.x - Math.cos(ring.heading) * distance;
  p.z = ring.z - Math.sin(ring.heading) * distance;
  p.heading = ring.heading;
  p.y = ring.y + 1.5;
  p.roll = 0.06;
  p.pitch = 0.02;
  p.vspeed = 0.2;
  p.speed = 48;
  p.throttle = 0.6;
  return ring;
}

/** Line the plane up on a short final, low and slowing, for the approach shot. */
function setupApproach(world) {
  const rw = world.runway;
  const p = world.plane;
  const dist = rw.halfLength + 260;
  p.x = rw.x - rw.dirX * dist;
  p.z = rw.z - rw.dirZ * dist;
  p.y = rw.elevation + 30;
  p.heading = rw.heading;
  p.speed = 38;
  p.pitch = 0.02;
  p.roll = 0;
  p.vspeed = -2.4;
  p.throttle = 0.34;
  p.fuel = 61;
  world.nextRing = world.rings.length;
  world.phase = 'fly';
}

/**
 * Build the world for a named shot and return { world, view }.
 * cover:    the opening view, first ring ahead, chain and runway beyond.
 * rings:    mid-course, the next ring filling the middle of the frame.
 * approach: short final, strip ahead, low and slow.
 * cockpit:  the pilot's seat, next ring through the windscreen.
 */
export function stageShot(shot, seed) {
  const world = createWorld(seed);

  if (shot === 'cover') {
    // Fly just far enough that the first ring is a comfortable distance ahead.
    flyFor(world, 0.2, { cruise: 50 });
    approachRing(world, 165);
    world.plane.y += 10;
    world.plane.roll = -0.14;
    world.nextRing = 0;
    world.score = 0;
    world.time = 14;
    world.timeLeft = COURSE.startTimeLeft;
    return { world, view: 'chase' };
  }

  if (shot === 'rings') {
    // Two rings down, then sit 58 m out from the third: big in frame, not on the lens.
    flyUntilNextRing(world, { cruise: 50 }, 60);
    flyUntilNextRing(world, { cruise: 50 }, 60);
    approachRing(world, 58);
    world.plane.roll = 0.18;
    world.time = 31;
    world.timeLeft = COURSE.startTimeLeft - 17;
    return { world, view: 'chase' };
  }

  if (shot === 'approach') {
    // Fly three rings so the score reads honestly, then set up a short final.
    for (let i = 0; i < 3; i += 1) flyUntilNextRing(world, { cruise: 50 }, 60);
    world.score = 1180;
    world.time = 76;
    world.timeLeft = COURSE.startTimeLeft - 46;
    setupApproach(world);
    return { world, view: 'chase' };
  }

  if (shot === 'cockpit') {
    flyUntilNextRing(world, { cruise: 50 }, 60);
    approachRing(world, 150);
    world.plane.roll = 0.1;
    world.time = 44;
    world.timeLeft = COURSE.startTimeLeft - 28;
    return { world, view: 'cockpit' };
  }

  // Unknown shot name: a plain mid-flight frame.
  flyFor(world, 4, { cruise: 50 });
  return { world, view: 'chase' };
}

export { LANDING, approachGeometry };
