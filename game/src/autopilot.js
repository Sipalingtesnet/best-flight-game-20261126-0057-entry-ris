// A small pilot that can fly the whole sortie by itself: bank toward the next ring,
// then turn onto final, descend on a computed glide path and flare onto the strip. It
// is not the player: it stages the screenshots, keeps the title scene alive, and the
// headless simulation flies 200 runs with it to prove the course is reachable and every
// run ends. It is deliberately simple, and it is deterministic.

import { clamp, wrapAngle } from './terrain.js';
import { FLIGHT, LANDING } from './config.js';

/** Where the plane sits relative to the strip: along the centre line, across it, and
 *  how far it still has to fly to reach the touchdown point. */
export function approachGeometry(world) {
  const rw = world.runway;
  const p = world.plane;
  const dx = p.x - rw.x;
  const dz = p.z - rw.z;
  const along = dx * rw.dirX + dz * rw.dirZ;
  const across = -dx * rw.dirZ + dz * rw.dirX;
  const toThreshold = -(along + rw.halfLength);
  return { along, across, toThreshold };
}

/** Pitch for a wanted vertical speed, inverting the model's climb relation. */
function pitchForClimb(world, wantVs) {
  const p = world.plane;
  const perRad = Math.max(9, p.speed * 0.62);
  const raw = Math.asin(clamp(wantVs / perRad, -0.92, 0.92));
  const trim = clamp((wantVs - p.vspeed) * 0.06, -0.22, 0.22);
  return clamp((raw + trim) / 0.95, -1, 1);
}

/** Controls for one step: rings first, then the strip. */
export function autopilotInput(world, opts = {}) {
  if (world.nextRing < world.rings.length) return towardRing(world, opts);
  return ontoRunway(world, opts);
}

function towardRing(world, opts) {
  const plane = world.plane;
  const target = world.rings[world.nextRing];
  const cruise = opts.cruise ?? 50;
  const holdAlt = opts.holdAlt ?? target.y + 4;

  const rel = wrapAngle(Math.atan2(target.z - plane.z, target.x - plane.x) - plane.heading);
  const turnRate = Math.sin(plane.roll) * 1.05;
  const roll = clamp(rel * 1.5 - turnRate * 0.85, -1, 1);

  const wantVs = clamp((holdAlt - plane.y) * 0.35, -4.5, 4.5);
  const pitch = pitchForClimb(world, wantVs);
  // Set the lever rather than nudging it: the cruise speed picks a throttle directly,
  // with a small trim for the error, so the tank lasts the sortie.
  const base = (cruise - FLIGHT.idleSpeed) / (FLIGHT.maxSpeed - FLIGHT.idleSpeed);
  const throttleSet = clamp(base + (cruise - plane.speed) * 0.035, 0.2, 0.95);
  return { roll, pitch, throttleSet };
}

/**
 * Final approach. The controller picks a touchdown point a little past the threshold,
 * works out the sink that would arrive there, and flies it — steeply if the plane is
 * high and far out, gently once it is low and close. A flare in the last stretch keeps
 * the touchdown sink under the gear's limit.
 */
function ontoRunway(world, opts) {
  const plane = world.plane;
  const rw = world.runway;
  const g = approachGeometry(world);

  // Steer for the centre line, aiming further ahead the wider the plane sits.
  const lead = clamp(60 + Math.abs(g.across) * 4 + Math.max(0, g.toThreshold) * 0.35, 60, 460);
  const aimX = rw.x - rw.dirX * rw.halfLength + rw.dirX * lead;
  const aimZ = rw.z - rw.dirZ * rw.halfLength + rw.dirZ * lead;
  const rel = wrapAngle(Math.atan2(aimZ - plane.z, aimX - plane.x) - plane.heading);
  const turnRate = Math.sin(plane.roll) * 1.05;
  const roll = clamp(rel * 1.9 - turnRate * 0.9, -1, 1);

  // Touchdown point: 40 m past the threshold, on the deck.
  const touchdownAlong = -rw.halfLength + 40;
  const distToGo = Math.max(8, touchdownAlong - g.along);
  const heightToGo = plane.y - rw.elevation;
  const timeToGo = distToGo / Math.max(12, plane.speed);

  // Sink rate: the computed glide path, but the last stretch is a flare — below 9 m the
  // plane levels off and sinks at no more than the gear will take.
  let wantVs;
  if (heightToGo < 9) {
    wantVs = clamp(-heightToGo / Math.max(0.9, timeToGo), -LANDING.maxSinkRate * 0.55, 0.4);
  } else {
    wantVs = clamp(-heightToGo / Math.max(0.6, timeToGo), -LANDING.maxSinkRate * 0.85, 3);
  }

  const pitch = pitchForClimb(world, wantVs);

  // Hold an approach speed with the throttle. A descent steepens the glide and bleeds
  // airspeed, so the lever is set from the wanted speed, not left at idle: below about
  // 36 m/s the wing stops holding and the touchdown gate refuses the landing.
  const wantSpeed = heightToGo > 25 ? 48 : g.toThreshold > 140 ? 42 : 37;
  const wantThrottle = clamp((wantSpeed - FLIGHT.idleSpeed) / (FLIGHT.maxSpeed - FLIGHT.idleSpeed), 0.18, 0.85);
  const throttleSet = clamp(wantThrottle + (wantSpeed - plane.speed) * 0.03, 0.1, 0.9);
  return { roll, pitch, throttleSet };
}
