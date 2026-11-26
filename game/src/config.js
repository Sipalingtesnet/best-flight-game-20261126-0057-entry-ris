// Archipelago Run — tunable numbers in one place.
// Every constant that shapes the flight model, the island chain, the ring course,
// the landing test, the scoring and the palette lives here, so the physics and the
// drawing code stay readable and the headless simulator can import the same numbers.

export const VIEW = {
  width: 1280,
  height: 720,
  fovX: 1.15,          // horizontal field of view, radians
  chaseDistance: 40,   // metres behind the plane
  chaseHeight: 9.0,    // metres above the plane
  cockpitHeight: 0.85,
};

// The flight model: a light high-wing bush plane. Speeds are metres per second,
// rates are per second, angles are radians unless the name says degrees.
export const FLIGHT = {
  idleSpeed: 31,
  cruiseSpeed: 54,
  maxSpeed: 86,
  stallSpeed: 25,
  speedResponse: 1.05,     // how quickly airspeed chases the throttle setting
  diveGain: 1.55,          // how strongly pitch trades height for speed
  pitchRate: 0.95,
  rollRate: 2.05,
  pitchLimit: 0.55,
  rollLimit: 1.25,
  turnRate: 1.05,          // yaw rate at full bank at cruise speed
  bankSink: 2.4,           // metres per second lost to a banked wing
  stallSink: 1.15,         // extra sink per m/s below the stall speed
  authorityFloor: 0.28,    // control authority left at the stall
  autoLevel: 0.42,         // gentle wing-levelling with no roll input
  maxVerticalSpeed: 22,
  mpsToKt: 1.94384,
  mToFt: 3.28084,
  fuelStart: 100,
  fuelBurnIdle: 0.45,      // percent per second
  fuelBurnFull: 1.45,
  fuelRingBonus: 2.5,      // percent of tank a ring pass puts back
  fuelOutSink: 1.6,
  fuelWarn: 22,
};

export const COURSE = {
  ringCount: 8,
  ringRadius: 20,
  ringBand: 8,             // how near the ring plane a pass counts
  ringBaseHeight: 66,
  ringHeightStep: 5,
  ringPoints: 120,
  ringPointStep: 40,
  ringTimeBonus: 7,
  ringFuelBonus: 5,
  ringLateralFrac: 0.92,   // must be inside this fraction of the radius
  finalRingDistance: 430,  // the last ring sits this far before the threshold
  finalRingHeight: 52,     // ...at this height above the deck
  startAltitude: 84,
};

export const ISLANDS = {
  count: 6,
  spacingMin: 720,
  spacingMax: 980,
  bearingDrift: 0.24,      // radians the chain may wander between islands
  baseBearing: 1.02,
  radiusMin: 120,
  radiusMax: 190,
  lastRadius: 250,
  lastHeight: 9.5,         // the final atoll is low and flat for the strip
  heightMin: 20,
  heightMax: 44,
  palmsPerIsland: 16,
};

export const RUNWAY = {
  halfLength: 150,
  halfWidth: 13,
  elevation: 9.8,
  offsetFrac: 0.34,        // how far the strip centre sits from the atoll centre
};

export const LANDING = {
  maxTouchdownSpeed: 50,   // m/s (~97 kt)
  maxSinkRate: 6.0,        // m/s at the moment of touchdown
  minTouchdownSpeed: 27,
  bounceSink: 3.6,
  bounceSpeed: 38,
  maxBounces: 2,
  flarePitch: 0.02,
  touchdownBand: 2.4,      // metres above the strip that count as contact
};

export const SCORE = {
  ringBase: 100,
  ringStep: 25,
  timeBonusPerSecond: 2,
  landingBase: 400,
  softLandingBonus: 350,
  centreLineBonus: 200,
  crashPenalty: 0,
};

export const TIME = {
  maxRunSeconds: 600,
  startTimeLeft: 300,
};

export const PALETTE = {
  skyTop: '#1d5fae',
  skyMid: '#5fb0e0',
  skyLow: '#bfe6f2',
  sun: '#fff6d0',
  sunGlow: 'rgba(255,244,196,0.55)',
  seaDeep: '#0b3f6b',
  seaMid: '#16628f',
  seaShallow: '#37a7bd',
  foam: '#eafaff',
  sand: '#f2dfae',
  sandDark: '#d9bd85',
  grass: '#3f9a52',
  grassDark: '#2b7440',
  cliff: '#7b6a4e',
  palmTrunk: '#7a5636',
  palmLeaf: '#2f8a45',
  runway: '#4a4f55',
  runwayEdge: '#f4f1e6',
  ring: '#7ef9d4',
  ringHot: '#ffffff',
  ringNext: '#ffd166',
  hudInk: '#eaf6ff',
  hudDim: '#8fb6cf',
  panel: '#111a22',
  panelRim: '#2c3f4f',
  panelFace: '#0d151b',
  needle: '#ff8f4d',
  dialFace: '#08111a',
  warning: '#ff5a4d',
  fuel: '#ffd166',
  planeBody: '#f4f0e4',
  planeStripe: '#e2582f',
  planeDark: '#2f3b45',
  planeGlass: '#9fd8e8',
};
