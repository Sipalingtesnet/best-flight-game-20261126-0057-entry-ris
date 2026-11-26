// The bush plane: a high-wing taildragger with a real skin, built from a handful of
// cross-sections swept into quads and shaded by how each panel faces the sun. The
// shape is geometry, not a picture: nothing here is loaded from a file.

import { PALETTE } from './config.js';

const TAU = Math.PI * 2;

/** The plane's own axes in world space: forward, up, right. */
function basis(plane) {
  const ch = Math.cos(plane.heading);
  const sh = Math.sin(plane.heading);
  const cp = Math.cos(plane.pitch);
  const sp = Math.sin(plane.pitch);
  const cr = Math.cos(plane.roll);
  const sr = Math.sin(plane.roll);

  const fwd = [ch * cp, sp, sh * cp];
  const up0 = [-ch * sp, cp, -sh * sp];
  const right0 = [-sh, 0, ch];
  return {
    fwd,
    up: [
      up0[0] * cr - right0[0] * sr,
      up0[1] * cr - right0[1] * sr,
      up0[2] * cr - right0[2] * sr,
    ],
    right: [
      right0[0] * cr + up0[0] * sr,
      right0[1] * cr + up0[1] * sr,
      right0[2] * cr + up0[2] * sr,
    ],
  };
}

/** Local (forward, up, right) metres to world space. */
function toWorld(plane, b, p) {
  return [
    plane.x + b.fwd[0] * p[0] + b.up[0] * p[1] + b.right[0] * p[2],
    plane.y + b.fwd[1] * p[0] + b.up[1] * p[1] + b.right[1] * p[2],
    plane.z + b.fwd[2] * p[0] + b.up[2] * p[1] + b.right[2] * p[2],
  ];
}

// A fuselage as a stack of stations: forward, centre height, half width, half height.
// The nose is blunt (it carries a radial engine) and the tail tapers to a post.
const STATIONS = [
  [-3.55, 0.52, 0.16, 0.30],
  [-2.60, 0.55, 0.42, 0.52],
  [-1.10, 0.56, 0.58, 0.66],
  [0.60, 0.58, 0.60, 0.70],
  [1.90, 0.56, 0.56, 0.66],
  [2.45, 0.55, 0.50, 0.58],
];

/** Ring of eight points around one station, so each panel is a real quad. */
function ring(st) {
  const [f, cy, hw, hh] = st;
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * TAU;
    pts.push([f, cy + Math.cos(a) * hh, Math.sin(a) * hw]);
  }
  return pts;
}

/** A quad from four local points, projected, with a shade from its facing. */
function quad(camera, plane, b, pts, base, stroke, alpha = 1) {
  const world = pts.map((p) => toWorld(plane, b, p));
  const proj = world.map((w) => camera.project(w[0], w[1], w[2]));
  if (proj.some((p) => !p.visible)) return null;
  // Facing: normal from two edges, lit from up-and-forward.
  const ax = world[1][0] - world[0][0], ay = world[1][1] - world[0][1], az = world[1][2] - world[0][2];
  const bx = world[3][0] - world[0][0], by = world[3][1] - world[0][1], bz = world[3][2] - world[0][2];
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl; ny /= nl; nz /= nl;
  const light = 0.42 + 0.58 * Math.max(0, ny * 0.72 + nx * 0.3 + nz * 0.22);
  const depth = proj.reduce((s, p) => s + p.depth, 0) / proj.length;
  return { proj, base, light, stroke, alpha, depth };
}

/** Filled panel: the base colour scaled by its facing. */
function shade(hex, light) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * light)},${Math.round(g * light)},${Math.round(b * light)})`;
}

/** The whole airframe as shaded panels, unsorted. */
function airframe(camera, plane) {
  const b = basis(plane);
  const out = [];
  const push = (q) => { if (q) out.push(q); };
  const body = PALETTE.planeBody;
  const dark = PALETTE.planeDark;

  // Fuselage skin between neighbouring stations.
  const rings = STATIONS.map(ring);
  for (let s = 0; s < rings.length - 1; s += 1) {
    const a = rings[s];
    const c = rings[s + 1];
    for (let i = 0; i < 8; i += 1) {
      const j = (i + 1) % 8;
      push(quad(camera, plane, b, [a[i], a[j], c[j], c[i]], body, 'rgba(40,55,65,0.35)'));
    }
  }
  // Nose cap and tail post close the skin.
  const nose = rings[rings.length - 1];
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    push(quad(camera, plane, b, [nose[i], nose[j], [2.62, 0.55, 0], nose[i]], '#e8e2d2', null));
  }
  const tail = rings[0];
  for (let i = 0; i < 8; i += 1) {
    const j = (i + 1) % 8;
    push(quad(camera, plane, b, [tail[i], tail[j], [-3.62, 0.52, 0], tail[i]], body, null));
  }

  // Red cheat line: a thin band on each flank.
  for (const side of [-1, 1]) {
    const w = 0.615 * side;
    push(quad(camera, plane, b, [
      [-2.4, 0.30, w], [1.85, 0.32, w], [1.85, 0.46, w], [-2.4, 0.44, w],
    ], PALETTE.planeStripe, null));
  }

  // High wing: a real slab with thickness, dihedral and a little taper.
  const panels = [
    { root: -0.6, tip: -6.9, chordRoot: 1.9, chordTip: 1.25, side: -1 },
    { root: -0.6, tip: 6.9, chordRoot: 1.9, chordTip: 1.25, side: 1 },
  ];
  for (const w of panels) {
    const y0 = 1.18;
    const y1 = 1.34;
    const th = 0.16;
    const rF = w.root + w.chordRoot * 0.5;
    const tF = w.tip + w.chordTip * 0.5;
    // Top and bottom skins.
    push(quad(camera, plane, b, [
      [rF - w.chordRoot / 2, y0 + th, w.root], [rF + w.chordRoot / 2, y0 + th, w.root],
      [tF + w.chordTip / 2, y1 + th, w.tip], [tF - w.chordTip / 2, y1 + th, w.tip],
    ], '#fdfbf2', 'rgba(60,80,95,0.45)'));
    push(quad(camera, plane, b, [
      [rF - w.chordRoot / 2, y0, w.root], [rF + w.chordRoot / 2, y0, w.root],
      [tF + w.chordTip / 2, y1, w.tip], [tF - w.chordTip / 2, y1, w.tip],
    ], '#d8d2c0', null));
    // Leading edge and tip cap.
    push(quad(camera, plane, b, [
      [rF + w.chordRoot / 2, y0, w.root], [rF + w.chordRoot / 2, y0 + th, w.root],
      [tF + w.chordTip / 2, y1 + th, w.tip], [tF + w.chordTip / 2, y1, w.tip],
    ], '#f1ece0', null));
    push(quad(camera, plane, b, [
      [tF - w.chordTip / 2, y1, w.tip], [tF + w.chordTip / 2, y1, w.tip],
      [tF + w.chordTip / 2, y1 + th, w.tip], [tF - w.chordTip / 2, y1 + th, w.tip],
    ], PALETTE.planeStripe, null));
    // Wing stripe on the top skin.
    push(quad(camera, plane, b, [
      [rF + 0.30, y0 + th + 0.01, w.root], [rF + 0.62, y0 + th + 0.01, w.root],
      [tF + 0.44, y1 + th + 0.01, w.tip], [tF + 0.12, y1 + th + 0.01, w.tip],
    ], PALETTE.planeStripe, null));
    // Strut from the lower fuselage to mid-span.
    const sx = 0.55;
    const sz = w.tip * 0.45;
    push(quad(camera, plane, b, [
      [sx, -0.05, sz], [sx + 0.12, -0.02, sz], [sx + 0.02, 1.14, sz], [sx - 0.10, 1.11, sz],
    ], dark, null));
  }

  // Tailplane: a thin slab with a fin on top.
  const tailY = 0.72;
  push(quad(camera, plane, b, [
    [-3.55, tailY, -1.35], [-2.75, tailY, -1.35], [-2.75, tailY, 1.35], [-3.55, tailY, 1.35],
  ], '#f7f3e6', 'rgba(60,80,95,0.45)'));
  push(quad(camera, plane, b, [
    [-3.55, tailY - 0.07, -1.35], [-2.75, tailY - 0.07, -1.35],
    [-2.75, tailY - 0.07, 1.35], [-3.55, tailY - 0.07, 1.35],
  ], '#cfc9b6', null));
  push(quad(camera, plane, b, [
    [-3.60, tailY, 0], [-2.60, tailY, 0], [-2.95, tailY + 1.45, 0], [-3.40, tailY + 1.35, 0],
  ], '#fdfbf2', 'rgba(60,80,95,0.45)'));
  push(quad(camera, plane, b, [
    [-3.55, tailY, -0.06], [-2.65, tailY, -0.06], [-2.98, tailY + 1.42, -0.06], [-3.42, tailY + 1.32, -0.06],
  ], PALETTE.planeStripe, null));

  // Canopy greenhouse behind the wing.
  const glass = PALETTE.planeGlass;
  push(quad(camera, plane, b, [
    [0.62, 1.20, -0.46], [1.62, 1.16, -0.40], [1.52, 1.52, 0], [0.66, 1.56, 0],
  ], glass, 'rgba(40,70,85,0.6)', 0.9));
  push(quad(camera, plane, b, [
    [0.62, 1.20, 0.46], [1.62, 1.16, 0.40], [1.52, 1.52, 0], [0.66, 1.56, 0],
  ], glass, 'rgba(40,70,85,0.6)', 0.9));
  push(quad(camera, plane, b, [
    [1.60, 1.17, -0.40], [1.60, 1.17, 0.40], [1.52, 1.52, 0], [1.52, 1.52, 0],
  ], 'rgba(150,200,220,0.7)', null, 0.85));

  // Bush tyres: fat discs on stubby legs.
  for (const side of [-1, 1]) {
    const wz = side * 1.05;
    push(quad(camera, plane, b, [
      [0.72, -0.55, wz - 0.14], [1.16, -0.55, wz - 0.14], [1.16, -1.35, wz - 0.14], [0.72, -1.35, wz - 0.14],
    ], '#232a30', 'rgba(0,0,0,0.4)'));
    push(quad(camera, plane, b, [
      [0.72, -0.55, wz + 0.14], [1.16, -0.55, wz + 0.14], [1.16, -1.35, wz + 0.14], [0.72, -1.35, wz + 0.14],
    ], '#2b333a', 'rgba(0,0,0,0.4)'));
    push(quad(camera, plane, b, [
      [0.86, -0.10, wz], [1.02, -0.10, wz], [1.02, -0.72, wz], [0.86, -0.72, wz],
    ], '#7b8790', null));
  }
  // Tail wheel.
  push(quad(camera, plane, b, [
    [-3.52, -0.25, -0.09], [-3.30, -0.25, -0.09], [-3.30, -0.62, -0.09], [-3.52, -0.62, -0.09],
  ], '#232a30', null));

  return out;
}

/** Draw the plane, with a spinning propeller disc when the engine is working. */
export function drawPlane(ctx, camera, plane) {
  const panels = airframe(camera, plane);
  panels.sort((a, b) => b.depth - a.depth);
  ctx.save();
  for (const f of panels) {
    ctx.beginPath();
    ctx.moveTo(f.proj[0].x, f.proj[0].y);
    for (let i = 1; i < f.proj.length; i += 1) ctx.lineTo(f.proj[i].x, f.proj[i].y);
    ctx.closePath();
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = shade(f.base, f.light);
    ctx.fill();
    if (f.stroke) {
      ctx.strokeStyle = f.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Propeller: a translucent disc plus two bright blades, at the nose.
  const b = basis(plane);
  const hub = camera.project(...toWorld(plane, b, [2.68, 0.55, 0]));
  if (hub.visible && plane.throttle > 0.02) {
    const r = Math.max(4, hub.scale * 1.05);
    ctx.save();
    ctx.globalAlpha = 0.14 + plane.throttle * 0.12;
    ctx.fillStyle = '#e6eef4';
    ctx.beginPath();
    ctx.ellipse(hub.x, hub.y, r * 0.24, r, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#f4f9fc';
    ctx.lineWidth = Math.max(1, r * 0.11);
    const spin = (plane.spin ?? 0) * 26;
    for (let k = 0; k < 2; k += 1) {
      const a = spin + k * Math.PI;
      ctx.beginPath();
      ctx.moveTo(hub.x + Math.cos(a) * r * 0.22, hub.y + Math.sin(a) * r);
      ctx.lineTo(hub.x - Math.cos(a) * r * 0.22, hub.y - Math.sin(a) * r);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/**
 * The cockpit's own airframe: the wing's leading edge and a strut across the top of
 * the windscreen, the cowl at the bottom, so the view reads as from inside the plane.
 */
export function drawCockpitAirframe(ctx, width, height, plane) {
  ctx.save();
  ctx.translate(width / 2, height * 0.46);
  ctx.rotate(plane.roll * 0.3);
  ctx.translate(-width / 2, -height * 0.46);

  // Wing leading edge.
  const top = height * 0.055;
  ctx.fillStyle = 'rgba(240,235,220,0.97)';
  ctx.beginPath();
  ctx.moveTo(-10, top - 34);
  ctx.lineTo(width + 10, top - 34);
  ctx.lineTo(width + 10, top + 18);
  ctx.quadraticCurveTo(width * 0.5, top + 40, -10, top + 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,90,100,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(226,88,47,0.92)';
  ctx.fillRect(0, top + 4, width, 6);

  // Wing strut, raked across the right of the screen.
  ctx.strokeStyle = 'rgba(47,59,69,0.95)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(width * 0.80, top + 10);
  ctx.lineTo(width * 0.95, height * 0.62);
  ctx.stroke();

  // Nose cowl and dashboard rising from the bottom.
  const cowl = ctx.createLinearGradient(0, height * 0.7, 0, height);
  cowl.addColorStop(0, '#33434f');
  cowl.addColorStop(1, '#101920');
  ctx.fillStyle = cowl;
  ctx.beginPath();
  ctx.moveTo(-10, height + 10);
  ctx.lineTo(width + 10, height + 10);
  ctx.lineTo(width + 10, height * 0.90);
  ctx.quadraticCurveTo(width * 0.62, height * 0.79, width * 0.5, height * 0.80);
  ctx.quadraticCurveTo(width * 0.38, height * 0.79, -10, height * 0.90);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
