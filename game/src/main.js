// Bootstrap and the game loop. States: title -> fly -> landed | crashed. A fixed
// simulation step keeps handling identical everywhere; rendering follows the frame
// rate. ?shot=<name>&seed=<n> stages a deterministic scene instead of a live run.

import { VIEW } from './config.js';
import { createWorld, drainEvents } from './world.js';
import { stepPlane } from './flight.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { renderFrame, renderEnd, drawTitle } from './render.js';
import { seedFromQuery } from './random.js';
import { stageShot } from './shots.js';
import { autopilotInput } from './autopilot.js';

const STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = seedFromQuery(window.location.search);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const input = createInput(canvas);
const audio = createAudio();

let state = 'title';       // title | fly | landed | crashed
let world = null;
let viewMode = 'chase';
let accumulator = 0;
let last = 0;
let clock = 0;
let staged = null;

// A staged shot is frozen after its one frame, so it never drifts between runs.
const FROZEN = Boolean(shotName);

function newRun() {
  world = createWorld(seed);
  viewMode = 'chase';
  state = 'fly';
  accumulator = 0;
}

if (staged === null && shotName) {
  staged = stageShot(shotName, seed);
  world = staged.world;
  viewMode = staged.view;
  state = 'fly';
} else {
  world = createWorld(seed);
  state = 'title';
}

// Browsers only start an audio context on a gesture; the same gesture leaves the title.
function onGesture() {
  audio.unlock();
  if (!FROZEN && state === 'title') state = 'fly';
}
window.addEventListener('pointerdown', onGesture);
window.addEventListener('keydown', onGesture);

function playCues(events) {
  for (const e of events) {
    if (e.kind === 'ring') audio.play('ring');
    else if (e.kind === 'bounce') audio.play('bounce');
    else if (e.kind === 'landed') audio.play('landed');
    else if (e.kind === 'crash') audio.play('crash');
  }
}

/** One fixed simulation step, driven by the controls sampled for that step. */
function simulate(frame, dt) {
  if (state === 'title') {
    // The title card flies the plane on rails so the scene behind it is alive.
    stepPlane(world, autopilotInput(world, { cruise: 46, holdAlt: world.plane.y }), dt);
    playCues(drainEvents(world));
    return;
  }
  if (state !== 'fly') return;
  if (frame.retry) {
    newRun();
    return;
  }
  if (frame.toggleView) viewMode = viewMode === 'chase' ? 'cockpit' : 'chase';
  if (frame.mute) audio.setMuted(!audio.muted);
  stepPlane(world, frame, dt);
  playCues(drainEvents(world));
  audio.update({
    throttle: world.plane.throttle,
    speed: world.plane.speed,
    stall: world.plane.stall,
  });
  if (world.phase !== 'fly') state = world.phase;
}

function frame(now) {
  const dt = last === 0 ? STEP : Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;

  if (!FROZEN) {
    // Sample once per frame; hold the same frame for each fixed step in this frame.
    const controls = input.sample();
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 6) {
      simulate(controls, STEP);
      accumulator -= STEP;
      guard += 1;
      // Only the first step of a frame consumes the one-shot buttons.
      controls.toggleView = false;
      controls.retry = false;
      controls.mute = false;
      controls.start = false;
    }
  }

  renderFrame(ctx, world, viewMode, clock);
  if (!FROZEN && state === 'title') drawTitle(ctx, VIEW.width, VIEW.height, seed);
  if (!FROZEN && (state === 'landed' || state === 'crashed')) renderEnd(ctx, world);

  if (!document.body.dataset.ready) document.body.dataset.ready = 'true';
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
