// Sound, all synthesised at run time with the WebAudio API: no files, no network.
// An engine hum tracks the throttle, wind noise grows with airspeed, and the ring,
// touchdown, stall and crash cues are short shaped tones. The context is created on
// the first user gesture, as browsers require, and every method is safe before then.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);

    // Engine: two detuned saws through a lowpass, pitch set by the throttle.
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 70;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 35;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    engine.connect(filter);
    sub.connect(subGain).connect(filter);
    filter.connect(engineGain).connect(master);
    engine.start();
    sub.start();

    // Wind: filtered noise from a short generated buffer, looped.
    const len = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last * 2.2;
    }
    wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    wind.connect(windFilter).connect(windGain).connect(master);
    wind.start();
    return ctx;
  }

  /** Called once from a real user gesture so the context may start. */
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  /** Continuous engine and wind, updated from the flight state each frame. */
  function update(state) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const throttle = state.throttle ?? 0;
    const speed = state.speed ?? 0;
    const freq = 58 + throttle * 96 + (state.stall ? Math.sin(t * 24) * 9 : 0);
    engine.frequency.setTargetAtTime(freq, t, 0.08);
    engineGain.gain.setTargetAtTime(0.055 + throttle * 0.085, t, 0.15);
    const windLevel = Math.min(0.11, Math.max(0, (speed - 26) / 70) * 0.11);
    windGain.gain.setTargetAtTime(windLevel, t, 0.2);
  }

  /** A short shaped tone; the building block of every cue. */
  function tone({ freq, endFreq, dur, type = 'sine', level = 0.2, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + Math.min(0.03, dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** A filtered noise burst, for the thud and the splash. */
  function noise({ dur = 0.3, level = 0.25, cutoff = 700 }) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(filter).connect(gain).connect(master);
    src.start();
  }

  const cues = {
    ring() {
      tone({ freq: 880, endFreq: 1320, dur: 0.16, type: 'triangle', level: 0.18 });
      tone({ freq: 1320, endFreq: 1760, dur: 0.2, type: 'sine', level: 0.12, delay: 0.1 });
    },
    bounce() {
      noise({ dur: 0.18, level: 0.2, cutoff: 500 });
      tone({ freq: 140, endFreq: 80, dur: 0.16, type: 'square', level: 0.09 });
    },
    landed() {
      noise({ dur: 0.45, level: 0.3, cutoff: 420 });
      tone({ freq: 300, endFreq: 180, dur: 0.4, type: 'sine', level: 0.14 });
      tone({ freq: 660, endFreq: 990, dur: 0.5, type: 'triangle', level: 0.1, delay: 0.22 });
    },
    crash() {
      noise({ dur: 0.7, level: 0.4, cutoff: 900 });
      tone({ freq: 180, endFreq: 40, dur: 0.7, type: 'sawtooth', level: 0.16 });
    },
    stall() {
      tone({ freq: 720, endFreq: 720, dur: 0.12, type: 'square', level: 0.08 });
    },
    fuel() {
      tone({ freq: 520, endFreq: 520, dur: 0.1, type: 'square', level: 0.07 });
    },
  };

  function play(kind) {
    const cue = cues[kind];
    if (cue) cue();
  }

  function setMuted(value) {
    muted = value;
    if (master) master.gain.value = muted ? 0 : 0.55;
  }

  return { unlock, update, play, setMuted, get muted() { return muted; }, get ready() { return ctx !== null; } };
}
