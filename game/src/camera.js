// The camera: one perspective projection used by every drawn thing, in two modes.
// Chase sits behind and above the plane with a partial roll; cockpit sits at the
// pilot's eye with the full roll. Both hand back screen points and a depth, so the
// scenery can sort itself and the HUD can stay flat on top.

import { VIEW } from './config.js';

const DEG = Math.PI / 180;

function norm(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Build a camera for the current plane state. `mode` is 'chase' or 'cockpit'.
 * The result exposes project(x, y, z) -> {x, y, depth, visible} and the basis.
 */
export function createCamera(plane, mode, width, height) {
  const fwd = [Math.cos(plane.heading), 0, Math.sin(plane.heading)];
  const up = [0, 1, 0];
  let pos;
  let lookPitch;
  let roll;
  let look;
  if (mode === 'cockpit') {
    pos = [
      plane.x + fwd[0] * 0.5,
      plane.y + VIEW.cockpitHeight,
      plane.z + fwd[2] * 0.5,
    ];
    lookPitch = plane.pitch * 0.85;
    roll = plane.roll * 0.92;
    const cp = Math.cos(lookPitch);
    look = norm([fwd[0] * cp, Math.sin(lookPitch), fwd[2] * cp]);
  } else {
    // Chase: sit well behind and above (the plane is a small object at this scale, so
    // the camera pulls back with speed), then aim past the nose so the airframe sits
    // in the middle of the frame, clear of the instrument panel.
    const back = VIEW.chaseDistance + Math.min(10, plane.speed * 0.06);
    pos = [
      plane.x - fwd[0] * back,
      plane.y + VIEW.chaseHeight - plane.vspeed * 0.05,
      plane.z - fwd[2] * back,
    ];
    const aim = [
      plane.x + fwd[0] * (back + 52),
      plane.y - 3.0 + plane.pitch * 24,
      plane.z + fwd[2] * (back + 52),
    ];
    look = norm([aim[0] - pos[0], aim[1] - pos[1], aim[2] - pos[2]]);
    roll = plane.roll * 0.45;
  }
  let right = norm(cross(look, up));
  let camUp = cross(right, look);

  // Roll the basis around the look axis so the horizon tilts with the wing.
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const rolledRight = [
    right[0] * cr + camUp[0] * sr,
    right[1] * cr + camUp[1] * sr,
    right[2] * cr + camUp[2] * sr,
  ];
  camUp = [
    camUp[0] * cr - right[0] * sr,
    camUp[1] * cr - right[1] * sr,
    camUp[2] * cr - right[2] * sr,
  ];
  right = rolledRight;

  const focal = (width / 2) / Math.tan(VIEW.fovX / 2);
  const cx = width / 2;
  const cy = height * 0.46;

  function project(x, y, z) {
    const vx = x - pos[0];
    const vy = y - pos[1];
    const vz = z - pos[2];
    const depth = vx * look[0] + vy * look[1] + vz * look[2];
    if (depth <= 0.35) return { x: 0, y: 0, depth, visible: false, scale: 0 };
    const sx = (vx * right[0] + vy * right[1] + vz * right[2]) / depth * focal + cx;
    const sy = cy - (vx * camUp[0] + vy * camUp[1] + vz * camUp[2]) / depth * focal;
    return { x: sx, y: sy, depth, visible: true, scale: focal / depth };
  }

  return { mode, pos, look, right, up: camUp, focal, cx, cy, project };
}

/** Where the sea horizon runs on screen: sampled across the field of view. */
export function horizonPoints(camera, width, height, samples = 12) {
  const pts = [];
  const spread = Math.tan(VIEW.fovX * 0.62);
  for (let i = 0; i <= samples; i += 1) {
    const t = (i / samples) * 2 - 1;
    const dir = norm([
      camera.look[0] + camera.right[0] * spread * t,
      0,
      camera.look[2] + camera.right[2] * spread * t,
    ]);
    const far = 26000;
    const p = camera.project(camera.pos[0] + dir[0] * far, 0, camera.pos[2] + dir[2] * far);
    pts.push(p.visible ? p : { x: (i / samples) * width, y: height * 0.5, visible: false });
  }
  return pts;
}

/** A compass rose angle in degrees, 0 = north (-Z), clockwise. */
export function headingDegrees(heading) {
  const deg = (Math.atan2(Math.cos(heading), -Math.sin(heading)) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export { DEG };
