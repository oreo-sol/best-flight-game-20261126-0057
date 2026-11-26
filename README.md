# Golden Hour Island Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/oreo-sol/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/oreo-sol/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A small prop plane over a recognisable island coast at golden hour. Chase
camera behind the aircraft, five golden rings to thread, then a landing on
the strip — with fuel that burns and a plane that bends when you land hard.

## How to play

- **↑ / W** climb · **↓ / S** descend · **← → / A D** bank · **Q / E** rudder
- **SHIFT** throttle up · **CTRL** throttle down · drag the mouse to look around
- **P** pause · **M** mute · **R** fly again

Fly through all five rings, then line up on the runway heading south and
grease the landing: a perfect touchdown is worth 500 points. Fuel runs out,
and a fast, steep, or off-strip touchdown ends the sortie.

## Build

Static files only — no build step, no network. Serve `game/` with any static
server (`node serve.ts` → http://localhost:8080) and open `index.html` in
desktop Chrome. Sounds are synthesized with WebAudio; everything is drawn
on Canvas 2D.

## Layout

- `game/index.html` — page shell
- `game/src/config.js` — world layout, mission course, tuning, palette
- `game/src/terrain.js` — island heightfield and colours
- `game/src/physics.js` — flight model, rings, landings, crashes
- `game/src/render.js` — chase-view pseudo-3D world, runway, rings, aircraft
- `game/src/hud.js` — instruments, compass, artificial horizon, overlays
- `game/src/input.js` — keyboard + mouse look
- `game/src/audio.js` — synthesized engine, wind, chimes
- `game/src/shots.js` — `?shot=` screenshot presets
- `game/src/main.js` — game loop and states
- `main.ts` — entry program (copies `game/` + `screenshots/`, writes the dossier)
