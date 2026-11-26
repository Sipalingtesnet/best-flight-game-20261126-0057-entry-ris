# Evaluation log — Archipelago Run

Real verification only: every line below is a command that ran and what it printed.

## Round 1 — build and first render

Built the game as ES modules under `game/src/`, plus `index.html`, `main.ts`, `serve.ts`,
`shots.json` and this log.

### Checks run

- **Serves and renders.** `python3 -m http.server 8123 --directory game`, then
  `chromium --headless=new --dump-dom "http://127.0.0.1:8123/?shot=<name>&seed=1"`:
  `data-ready="true"` on all four shots (cover, rings, approach, cockpit).
- **No JavaScript exceptions.** A CDP session with `Runtime.enable` and
  `Runtime.exceptionThrown` watched while the page loaded and while keys were pressed:
  0 exceptions.
- **Live controls move the sim.** Enter to start, `S` held for 1.6 s, canvas pixel hash
  before and after: the frame changed (426217 → 496293).
- **Determinism.** `env MAKEFUN_OUTPUT_DIR=out1 node main.ts` twice, `diff -r out1 out2`
  printed nothing; both `dossier.json` are the same byte count.
- **Limits.** `game/` is 18 files; `game/index.html` is 1968 bytes; each screenshot is
  1280×720 and at most 127846 bytes.
- **No network.** `grep -rn "http://\|https://\|fetch(\|XMLHttpRequest" game/` → no matches.

### Defects found and fixed during the build

1. **Turn direction inverted.** `flight.js` turned the nose the wrong way for a banked
   wing (`-sin(roll)`); three seeds ended with 1–2 rings of 8 after 400 s. Fixed to
   `+sin(roll)`; the same seeds then flew all 8.
2. **Rings inside island peaks.** Rings sat at 44–68 m while peaks reached 62 m, so the
   autopilot flew into a hill after one ring. Peaks lowered to 20–44 m, ring band lifted
   to 66 m + 5 m per ring.
3. **The run clock could run backwards.** A ring subtracted 7 s from elapsed time. Split
   into `time` (always increasing) and `timeLeft` (the run clock, which rings add to).
4. **The autopilot oscillated.** Roll gain too high, no rate damping; the plane rolled
   ±70° and circled. Rewrote with a rate-damping term and a vertical-speed target.
5. **The approach controller could not descend.** Its damping term cancelled the descent
   error. Rewrote it to invert the model's climb relation
   (`asin(wantVs / (speed·0.62))`).
6. **The final ring left a 20–28% dive to the strip.** Ring 8 now sits on the extended
   centre line 430 m before the threshold at 52 m.
7. **The airframe was flat.** Rebuilt from eight-point fuselage stations swept into
   shaded quads, with a wing slab, tailplane, fin, canopy and bush tyres.
8. **The chase camera hid the plane.** The airframe projected to y≈589 px, behind the
   instrument panel (starts at 588). Pulled the camera to 40 m / 9 m and aimed below the
   plane; the airframe now spans about 340×110 px around y≈453.
9. **`main.js` sampled input twice a frame,** so `C` and `R` fired twice. Samples once
   and clears the one-shot buttons after the first fixed step.
10. **A wrong import broke the page.** `main.js` imported `autopilotInput` from
    `shots.js` after the pilot moved to `autopilot.js`; every shot failed to render.
    Fixed the import.

## Round 2 — evaluation

### 1. Headless logic simulation

`node logic-sim.mjs` imports only the DOM-free modules (`config`, `random`, `terrain`,
`course`, `world`, `flight`, `autopilot`) and flies 200 runs with the shared autopilot,
plus a 10-run reckless batch that proves the lose path exists.

Final run:

```
flights:            200
landed:             200
crashed:            0
rings not reached:  0
exceptions:         0
mean score:         2965
best score:         2988
mean rings:         8.00 / 8
min terrain clear:  0.00 m
reckless pilot:     10/10 ended in a crash
     9  Ditched in the sea
     1  Came down on the beach, short of the strip

PASS — 200 flights, 0 assertion failures
```

Asserted every step of every flight: score never negative and never decreasing, ring
counter never decreasing and never jumping, exactly one ring event per counted ring,
`ringsHit` free of duplicates, altitude never below terrain while the phase is still
`fly`, finite position, and every flight reaching `landed` or `crashed`.

### 2. Defects found in round 2 and fixed

11. **Fuel went NaN on the first ring pass.** `flight.js` read `FLIGHT.ringFuelBonus`,
    but the constant is `fuelRingBonus`, so `min(100, NaN)` poisoned the tank and the
    HUD. Fixed the name, restored the constant, and guarded both the burn and the bonus
    with `Number.isFinite` so no bad value can spread.
12. **The crash reason was wrong.** A ditching in open water was reported as "Flew into
    an island" because the test compared clearance instead of ground height. Now the
    wheels' surface is classified: strip, open water (< 0.6 m), beach (< 3.2 m) or
    hillside, with its own message for each.
13. **Engine-out glide could not fly.** A dry tank set the target airspeed to
    `idleSpeed * 0.7` = 21.7 m/s, below the 25 m/s stall speed, so an out-of-fuel plane
    stalled forever and could never arrive. It now glides at `idleSpeed`, which still
    flies, and is landable.
14. **The tank ran dry before the strip.** At the first burn rate a full-throttle run
    emptied the tank at ~139 s, before a normal run reaches the runway, so every flight
    died "Stalled onto the strip". Burn retuned so a disciplined run finishes with about
    half a tank and a throttle-jammed run genuinely runs dry (verified: `throttle-jam
    crashed Out of time t 300 minFuel 0%`).
15. **The autopilot's ring-leg throttle saturated.** It nudged the lever by the speed
    error, which pinned it at full power and drained the tank. It now sets the lever from
    the cruise speed with a small trim.
16. **The approach arrived below the landing speed.** A steep descent at idle bled
    airspeed to the 21.7 m/s floor, under the 27 m/s touchdown minimum, so every landing
    was "Stalled onto the strip". The final leg now holds 37–48 m/s with a floored
    throttle, and the flare caps the sink at 55% of the gear's limit.
17. **My own sim assertion was wrong.** It re-read the cumulative `ringsHit` list every
    step, so every flight reported "a ring was counted twice". Changed to watch the
    one-shot `ring` events and cross-check the count against the counter.

### 3. Re-verification after the fixes

- **Sim:** `node logic-sim.mjs` → `PASS — 200 flights, 0 assertion failures`.
- **Screenshots re-shot** after every visual change: all four are 1280×720 JPEGs, at
  most 127846 bytes.
- **The ring really is drawn:** sampling the computed circumference in each shot found
  amber ring pixels at 64/72 (cover), 71/72 (rings) and 72/72 (cockpit) sample points.
- **End screens render:** a staged page driving a full autopilot run to `landed` called
  `renderEnd` and left 17205 lit pixels on the canvas, with `phase=landed score=2967`.
- **Live play:** Enter, throttle, bank, `C` to the cockpit and back, `R` to retry — the
  frame hash changed at each step (animating, cockpit differs, retry reset), 0 exceptions.
- **Determinism:** `out1` and `out2` are byte-identical; `dossier.json` is 727911 bytes.
- **No network, no symlinks:** both greps print nothing.

Round 2 acceptance met: 200 flights, 0 assert failures, every defect listed above fixed
and re-verified, screenshots re-shot fresh.

## Round 3 — final read-through

Read every file once. Three more defects, all fixed and re-verified:

18. **`M` mute was advertised but not wired up.** The HUD hint and README both promise a
    mute key, and `input.js` had no `KeyM`. Added the action, consumed it as a one-shot
    in `main.js` and toggled `audio.setMuted`. Verified with a CDP session pressing `M`
    twice: 0 exceptions, page still ready.
19. **Dead code: `Space: 'brake'`.** No brake exists in the flight model and nothing read
    the action; the key is gone, along with its `preventDefault`.
20. **Stale screenshots after the input change.** Game files changed, so all four shots
    were re-shot rather than reused.

### Final verification (after the round-3 fixes)

- `env MAKEFUN_OUTPUT_DIR=g1 node main.ts` twice → `diff -r g1 g2` empty,
  `dossier.json` 729900 bytes in both.
- `data-ready="true"` on all four shots.
- `grep -rn "http://\|https://\|fetch(\|XMLHttpRequest" game/` → NONE.
- `game/index.html` 1968 bytes; `game/` 18 files, 104285 bytes.
- Screenshots: 1-cover 106065, 2-rings 128886, 3-approach 109527, 4-cockpit 121055 bytes,
  all JPEG 1280×720.
- `node logic-sim.mjs` → `PASS — 200 flights, 0 assertion failures`, reckless batch
  10/10 crashes.
- Secrets scan (`sk-`, api key, password, secret, token, bearer) over the repo excluding
  `vendor/`: NONE.
- `vendor/makefun-game.ts` is byte-identical to the kit's copy (`cmp`).
- README carries all three badges and the bounty link.
- The directory is not a git repository in this environment, so `git status` cannot run;
  the file inventory is the tracked set and holds only the intended files.
