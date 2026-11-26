// The flight model: throttle, pitch, bank, yaw and the sink that comes with them,
// plus the ring passes and the touchdown test. One step per fixed frame keeps the
// handling the same on every machine and lets the simulator replay a whole flight.

import { FLIGHT, COURSE, LANDING, SCORE, TIME } from './config.js';
import { groundHeight, runwayFrame, wrapAngle, clamp } from './terrain.js';
import { ringOffset } from './course.js';
import { emit, finalScore } from './world.js';

/** One fixed flight step. input = { throttleDelta, throttleSet, pitch, roll }. */
export function stepPlane(world, input, dt) {
  if (world.phase !== 'fly') return;
  const p = world.plane;
  world.time += dt;
  world.timeLeft -= dt;

  // Throttle lever: held keys move it, the mouse wheel sets it directly.
  if (input.throttleSet !== undefined) {
    p.throttle = clamp(input.throttleSet, 0, 1);
  } else {
    p.throttle = clamp(p.throttle + (input.throttleDelta || 0) * dt * 0.62, 0, 1);
  }

  // Fuel: the tank sets the sortie's length, and a dry tank makes the plane glide.
  const burn = FLIGHT.fuelBurnIdle + (FLIGHT.fuelBurnFull - FLIGHT.fuelBurnIdle) * p.throttle;
  // Clamp and guard: a bad value here would spread NaN through the whole state.
  const fuelAfterBurn = Number.isFinite(p.fuel) ? p.fuel - burn * dt : 0;
  p.fuel = Math.max(0, fuelAfterBurn);
  const dry = p.fuel <= 0;

  // Airspeed chases the throttle; pitch trades height for speed.
  const wanted = dry
    ? FLIGHT.idleSpeed + Math.sin(p.pitch) * 6
    : FLIGHT.idleSpeed + (FLIGHT.maxSpeed - FLIGHT.idleSpeed) * p.throttle - Math.sin(p.pitch) * 18;
  p.speed += (wanted - p.speed) * Math.min(1, FLIGHT.speedResponse * dt);

  // Stall softens the controls instead of freezing them: recovery is always possible.
  p.stall = p.speed < FLIGHT.stallSpeed;
  const authority = p.stall ? FLIGHT.authorityFloor + (1 - FLIGHT.authorityFloor) * clamp(p.speed / FLIGHT.stallSpeed, 0, 1) : 1;

  // Attitude.
  p.pitch = clamp(p.pitch + clamp(input.pitch || 0, -1, 1) * FLIGHT.pitchRate * authority * dt, -FLIGHT.pitchLimit, FLIGHT.pitchLimit);
  const rollIn = clamp(input.roll || 0, -1, 1);
  if (Math.abs(rollIn) > 0.02) {
    p.roll = clamp(p.roll + rollIn * FLIGHT.rollRate * authority * dt, -FLIGHT.rollLimit, FLIGHT.rollLimit);
  } else {
    p.roll -= p.roll * Math.min(1, FLIGHT.autoLevel * dt);
  }

  // Gentle yaw follows the bank: a right bank (positive roll) turns the nose right.
  const turn = Math.sin(p.roll) * FLIGHT.turnRate * clamp(p.speed / FLIGHT.cruiseSpeed, 0.4, 1.5);
  p.heading = wrapAngle(p.heading + turn * dt);

  // Vertical speed: pitch climbs, bank and stall sink.
  let vs = Math.sin(p.pitch) * p.speed * 0.62 - Math.abs(Math.sin(p.roll)) * FLIGHT.bankSink;
  if (p.stall) vs -= (FLIGHT.stallSpeed - p.speed) * FLIGHT.stallSink;
  if (dry) vs -= FLIGHT.fuelOutSink;
  p.vspeed = clamp(vs, -FLIGHT.maxVerticalSpeed, FLIGHT.maxVerticalSpeed);

  const step = p.speed * dt;
  p.x += Math.cos(p.heading) * step;
  p.z += Math.sin(p.heading) * step;
  p.y += p.vspeed * dt;
  world.distanceFlown += step;
  world.maxAltitude = Math.max(world.maxAltitude, p.y);

  checkRings(world);
  checkContact(world);

  if (world.phase === 'fly' && world.timeLeft <= 0) {
    fail(world, 'Out of time');
  }
}

/** Rings must be taken in order; each counts exactly once, on the plane's crossing. */
export function checkRings(world) {
  if (world.nextRing >= world.rings.length) return;
  const p = world.plane;
  const ring = world.rings[world.nextRing];
  const off = ringOffset(ring, p.x, p.y, p.z);
  const inside = Math.hypot(off.lateral, off.vertical) < ring.radius * COURSE.ringLateralFrac;
  if (inside && Math.abs(off.along) < COURSE.ringBand) {
    const points = COURSE.ringPoints + world.nextRing * COURSE.ringPointStep;
    world.score += points;
    world.ringsHit.push(world.nextRing);
    world.nextRing += 1;
    world.timeLeft += COURSE.ringTimeBonus;
    const bonus = Number.isFinite(FLIGHT.fuelRingBonus) ? FLIGHT.fuelRingBonus : 0;
    p.fuel = Math.min(FLIGHT.fuelStart, (Number.isFinite(p.fuel) ? p.fuel : 0) + bonus);
    emit(world, 'ring', { index: world.nextRing - 1, points });
  }
}

/** Sea, island or strip: decide between a crash, a bounce and a landing. */
export function checkContact(world) {
  const p = world.plane;
  const clearance = p.y - groundHeight(world, p.x, p.z);
  if (clearance > LANDING.touchdownBand) return;

  const rw = world.runway;
  const f = runwayFrame(rw, p.x, p.z);
  const onStrip = Math.abs(f.along) <= rw.halfLength && Math.abs(f.across) <= rw.halfWidth;

  if (!onStrip || world.nextRing < world.rings.length) {
    // Name the crash by what the wheels actually met: the strip, open water, a beach
    // or a hillside. Classifying by the ground height (not the clearance) keeps a
    // low pass over the atoll's sand from being called a ditching.
    const ground = groundHeight(world, p.x, p.z);
    let reason;
    if (onStrip) reason = 'Touched down before the course was flown';
    else if (ground < 0.6) reason = 'Ditched in the sea';
    else if (ground < 3.2) reason = 'Came down on the beach, short of the strip';
    else reason = 'Flew into an island';
    fail(world, reason);
    return;
  }
  touchdown(world);
}

function fail(world, reason) {
  if (world.phase !== 'fly') return;
  world.phase = 'crashed';
  world.crashReason = reason;
  world.plane.y = groundHeight(world, world.plane.x, world.plane.z);
  world.plane.speed *= 0.15;
  emit(world, 'crash', { reason });
}

/**
 * The wheels meet the strip. A fast or hard contact bounces (up to twice), a very
 * bad one crashes, and a clean one rolls out and scores the run.
 */
function touchdown(world) {
  const p = world.plane;
  const rw = world.runway;
  const f = runwayFrame(rw, p.x, p.z);
  const centreLine = 1 - clamp(Math.abs(f.across) / rw.halfWidth, 0, 1);
  const sink = Math.abs(p.vspeed);
  world.touchdownSink = sink;

  const tooFast = p.speed > LANDING.maxTouchdownSpeed;
  const tooSlow = p.speed < LANDING.minTouchdownSpeed;
  const tooHard = sink > LANDING.maxSinkRate;

  if ((tooFast || tooHard) && world.bounces < LANDING.maxBounces) {
    world.bounces += 1;
    p.y = rw.elevation + 3.4;
    p.vspeed = Math.max(1.6, sink * 0.3);
    p.speed = Math.min(p.speed, LANDING.maxTouchdownSpeed - 3);
    p.pitch = Math.min(p.pitch, LANDING.flarePitch);
    emit(world, 'bounce', { count: world.bounces });
    return;
  }
  if (tooFast || tooSlow || tooHard) {
    fail(world, tooFast ? 'Touched down too fast' : tooSlow ? 'Stalled onto the strip' : 'Hard landing');
    return;
  }

  p.y = rw.elevation;
  p.vspeed = 0;
  p.speed = Math.max(0, p.speed - 30);
  const softness = 1 - clamp(sink / LANDING.maxSinkRate, 0, 1);
  const aligned = Math.abs(Math.cos(wrapAngle(p.heading - rw.heading)));
  world.landQuality = clamp(0.55 * softness + 0.3 * centreLine + 0.15 * aligned, 0, 1);
  world.score += SCORE.landingBase
    + Math.round(SCORE.softLandingBonus * softness)
    + Math.round(SCORE.centreLineBonus * centreLine)
    + Math.round(SCORE.timeBonusPerSecond * Math.max(0, world.timeLeft) * 0.1);
  world.score = finalScore(world);
  world.phase = 'landed';
  emit(world, 'landed', { quality: world.landQuality });
}
