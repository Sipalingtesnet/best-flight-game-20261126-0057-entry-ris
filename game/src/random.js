// Seeded randomness: mulberry32, so the same ?seed= always builds the same
// archipelago, the same ring course and the same screenshot.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small helper bundle around one seeded stream. */
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length) % list.length];
    },
    signed(scale) {
      return (next() * 2 - 1) * scale;
    },
  };
}

/** Read ?seed= from a query string, falling back to a stable default. */
export function seedFromQuery(search) {
  const params = new URLSearchParams(search || '');
  const raw = params.get('seed');
  const value = raw === null ? 1 : Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return 1;
  return Math.abs(value) % 1000000;
}
