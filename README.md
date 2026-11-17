[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Masasiya00/makefun-frontline/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Masasiya00/makefun-frontline/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# FRONTLINE — push the line through seven sectors and break the enemy HQ

A 2D canvas top-down war campaign, built for make.fun's `best-game-01` bounty ("Make the best game").

You are a squad leader on a living battlefield. The frontline is a real line — sandbags, barbed wire and flags — and it **MOVES**. Capture a sector's trench to push it toward the enemy HQ. Lose a sector to a counter-attack and it falls back. The whole game is this tug-of-war across 7 sectors to the enemy HQ.

## The moving frontline — the central mechanic

- **7 SECTORS**, each with a trench + flag capture zone. Stand in the zone to fill the capture meter; kills earn **MOMENTUM**, which speeds every capture and buys radio call-ins.
- **The line advances** when a sector falls: sandbags and flags march forward, a supply helicopter drops a crate, and command authorises a new **doctrine**.
- **The line falls back** when an enemy counter-attack holds a taken sector — lose enough ground and the line collapses to your HQ.
- **3 BOSSES** guard the road: **WARHOUND** (armored APC, sector 3), **NIGHTHAWK** (attack gunship, sector 5) and **JUGGERNAUT** (heavy battle tank, sector 7). Each must fall before its sector can be taken.
- **Artillery barrage** sweeps the map on a timer — clear the marked band or die. Never camp.
- **Win:** take all 7 sectors and destroy the HQ bunker. **Lose:** the squad leader falls, or the line collapses. After the HQ falls, **Endless mode** holds it against escalating counter-attacks.

## Everything from our previous entries, combined

- **5 weapons** with distinct sounds, tracers, recoil and damage falloff: M9 pistol, MP5 SMG, M4 rifle, M870 shotgun, M24 sniper.
- **5 enemy types** (grunt, rusher, grenadier, sniper, shield-bearer) plus **allied AI squads** that fight beside you and help capture.
- **Radio call-ins:** Q supply drop heli, E jet airstrike, T mortar barrage, F smoke screen — each with a radio order on the HUD.
- **7 doctrines** (relics) picked between sectors: extended mags, rapid fire, flak plating, field radio, combat medic, long barrel, lucky casing.
- **Drivable jeep + motorcycle** (E to ride), helicopters + supply drops + loot crates, tall grass concealment, sand that slows you, containers as bullet-blocking cover, a river with a bridge.
- **Combat feel:** muzzle flash, tracers, shell casings, hit-stop, hitmarkers, floating damage numbers, screen shake, drifting smoke, kill feed, combo multiplier and end-of-game grade.
- **Military HUD:** sector + score + momentum top bar, WIN/LOSE pills, INCOMING queue, boss bar with phase pips, doctrines + support panels, weapon slots with ammo, HP/armor, combo + grade, and a minimap showing the frontline.
- **All audio is procedural WebAudio** — per-weapon gunfire, rotor thump, jet roar, radio static and beeps, mortar whistles, explosions, smoke hiss.

## Play

```sh
node serve.ts   # serves game/ at http://localhost:8080
```

Open the page and deploy:

- **WASD / arrows** — move. **Mouse** — aim. **Hold click** — fire.
- **1 / 2 / 3 / 4 / 5** — switch weapon. **R** — reload. **Shift** — sprint.
- **Q / E / T / F** — radio call-ins (E near a vehicle = ride it). **P / Esc** — pause. **M** — mute.
- **Capture the trench zone** to advance the line. **Destroy the HQ** to win.

## Build

Pure static files under `game/` — no build step, no network, no engine. ES modules in `game/src/`, one file per job; `config.js` holds every tuning number. `main.ts` hands the game in with the vendored make.fun library.
