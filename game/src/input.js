// Input: keyboard and mouse, merged into one control frame per tick.
// Keys: W/S or Up/Down change throttle, arrows or A/D pitch and bank, C swaps the
// camera. The mouse drags pitch and bank and its wheel sets the throttle directly.

const KEY_MAP = {
  KeyW: 'throttleUp',
  ArrowUp: 'pitchUp',
  KeyS: 'throttleDown',
  ArrowDown: 'pitchDown',
  KeyA: 'rollLeft',
  ArrowLeft: 'rollLeft',
  KeyD: 'rollRight',
  ArrowRight: 'rollRight',
  KeyC: 'toggleView',
  KeyR: 'retry',
  KeyM: 'mute',
  Enter: 'start',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { dragging: false, x: 0, y: 0, dx: 0, dy: 0, wheel: 0 };
  let wheelThrottle = null;

  const onKeyDown = (e) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') e.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  };
  const onKeyUp = (e) => {
    const action = KEY_MAP[e.code];
    if (action) held.delete(action);
  };
  const onBlur = () => {
    held.clear();
    mouse.dragging = false;
  };
  const onDown = (e) => {
    mouse.dragging = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!mouse.dragging) return;
    mouse.dx += e.clientX - mouse.x;
    mouse.dy += e.clientY - mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  };
  const onUp = () => {
    mouse.dragging = false;
  };
  const onWheel = (e) => {
    e.preventDefault();
    mouse.wheel += e.deltaY;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  /** Consume one frame of controls; deltas are cleared so nothing repeats. */
  function sample() {
    const throttleDelta = (held.has('throttleUp') ? 1 : 0) - (held.has('throttleDown') ? 1 : 0);
    let pitch = (held.has('pitchUp') ? 1 : 0) - (held.has('pitchDown') ? 1 : 0);
    let roll = (held.has('rollRight') ? 1 : 0) - (held.has('rollLeft') ? 1 : 0);

    // Mouse drag: a pixel of travel is a slice of the control range, applied for
    // the frame and then decayed, so a flick turns and a hold keeps turning.
    if (mouse.dragging) {
      roll += Math.max(-1, Math.min(1, mouse.dx / 9));
      pitch += Math.max(-1, Math.min(1, -mouse.dy / 9));
    }

    if (mouse.wheel !== 0) {
      wheelThrottle = Math.max(0, Math.min(1, (wheelThrottle ?? 0.62) - mouse.wheel * 0.0009));
      mouse.wheel = 0;
    }

    const frame = {
      throttleDelta,
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      toggleView: pressed.has('toggleView'),
      retry: pressed.has('retry'),
      mute: pressed.has('mute'),
      start: pressed.has('start'),
    };
    if (wheelThrottle !== null && throttleDelta === 0) {
      frame.throttleSet = wheelThrottle;
    }
    if (throttleDelta !== 0) wheelThrottle = null;

    mouse.dx = 0;
    mouse.dy = 0;
    pressed.clear();
    return frame;
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('wheel', onWheel);
  }

  return { sample, dispose };
}
