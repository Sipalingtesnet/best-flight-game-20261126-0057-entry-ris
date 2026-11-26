# Archipelago Run

A bush-plane island-hopping flight game that runs in a desktop browser from its own
files, with no build step and no network request.

[![make.fun bounty](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Sipalingtesnet/best-flight-game-20261126-0057-entry-ris/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Sipalingtesnet/best-flight-game-20261126-0057-entry-ris/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

## What it is

You fly a small high-wing bush plane along a seeded chain of tropical islands. Eight
glowing target rings float along the course, and the last atoll carries a runway strip.
Fly all eight rings in order, then line up and land: a smooth touchdown ends the run
with a score, a hard or fast one bounces or breaks the plane, and the sea is never
forgiving. A chase camera follows the plane by default and **C** puts you in the
cockpit with the instrument panel filling the lower half of the screen.

The archipelago, the ring course and the runway all come from a mulberry32 seed in the
URL (`?seed=7`), so a course is reproducible and a screenshot is exactly what the game
drew.

## How to play

1. Press **Enter** (or click) to leave the title card.
2. Follow the amber arrow and the distance readout to the next ring. Rings must be taken
   in order; each one scores points, a time bonus and a splash of fuel.
3. Keep the airspeed above the stall and watch the fuel bar: the tank lasts about five
   minutes at cruise, and a dry tank turns the plane into a glider.
4. After ring eight the arrow turns green and points at the runway. Fly a low, slow
   final, ease the nose up over the threshold, and let the wheels settle.
5. **R** flies the course again.

## Controls

| Input | Action |
| --- | --- |
| `W` / `S` or `↑` / `↓` on the throttle keys | raise and lower the throttle |
| `Arrow Up` / `Arrow Down` | pitch: nose up, nose down |
| `Arrow Left` / `Arrow Right`, `A` / `D` | bank left and right |
| Mouse drag | steer pitch and bank |
| Mouse wheel | set the throttle directly |
| `C` | chase view ↔ cockpit view |
| `R` | retry the course |
| `M` | mute |

## Scoring

Each ring gives a base score that grows along the course, and a few seconds come off the
clock. The landing adds a base score, a bonus for a soft touchdown, a bonus for the
centre line and a bonus for the time left. The final score is never negative.

## Running it

```
node serve.ts            # serves game/ at http://localhost:8080
```

Open `http://localhost:8080/?seed=1` to fly. The game is plain static files under
`game/`: an `index.html` and ES modules in `game/src/`, with every picture, dial and
sound made in code.

## Handing it in

```
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes
`dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## Layout

- `game/index.html` — the canvas page, inline style only.
- `game/src/config.js` — flight constants, course shape, scoring and the palette.
- `game/src/random.js` — mulberry32 and the seed from the URL.
- `game/src/course.js` — island chain, runway and ring generation.
- `game/src/terrain.js` — terrain and runway surface queries.
- `game/src/world.js` — the run's state and its queries.
- `game/src/flight.js` — the flight model, ring passes, touchdown and crash.
- `game/src/input.js` — keyboard and mouse merged into one control frame.
- `game/src/camera.js` — chase and cockpit projection.
- `game/src/scenery.js` — sky, sea, islands, runway, rings and clouds.
- `game/src/plane.js` — the aircraft's geometry and the cockpit airframe.
- `game/src/instruments.js` — the dials and levers.
- `game/src/hud.js` — the head-up readouts and the target arrow.
- `game/src/render.js` — frame composition and the end screens.
- `game/src/audio.js` — synthesised engine, wind and cues.
- `game/src/shots.js` — deterministic staged scenes for the screenshots.
- `game/src/main.js` — bootstrap, loop and the state machine.

## Licence

MIT — see `LICENSE`.
