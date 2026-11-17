// FRONTLINE — a make.fun best-game-01 entry (Node 22, standard library
// only). The game is this directory's game/ folder: plain static files a
// desktop browser loads offline (game/index.html and its ES modules under
// game/src/, no library, no network request), and this program hands it in.
//
// What the game is: a 2D canvas top-down war campaign. You are a squad
// leader on a living battlefield, and the frontline itself is the mechanic —
// a visible sandbag / wire / flag line that MOVES. Capture a sector's
// trench to push it toward the enemy HQ; lose a sector to a counter-attack
// and it falls back. Seven sectors, three bosses (WARHOUND, NIGHTHAWK,
// JUGGERNAUT), five weapons, seven doctrines, radio call-ins, drivable
// vehicles, artillery barrages, and an endless hold after the HQ falls.
//
// This program copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library — exactly the contract the kit's
// scorer expects. It also sanity-checks its own inputs first (the game
// folder, the screenshots, the claim file) and prints a short manifest so
// a failed build is loud instead of silent.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// --- FRONTLINE pre-flight: refuse to hand in a half-built entry. --------
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('FRONTLINE: game/index.html is missing — the game was not built');
}
const shotFiles = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => !f.startsWith('.'))
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`FRONTLINE: expected 3 or 4 screenshots, found ${shotFiles.length}`);
}
for (const f of shotFiles) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > 262144) throw new Error(`FRONTLINE: screenshot ${f} is ${size} bytes (cap 256 KiB)`);
}
if (!existsSync(join(here, '.makefun', 'owner.json'))) {
  throw new Error('FRONTLINE: .makefun/owner.json is missing — the claim file is required');
}

// --- Copy the entry into /output, then write the dossier. ---------------
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes: game/
// counts beside /output's own 1000-entry cap, its screenshots/ and
// dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// --- Manifest: what just went out, for the build log. --------------------
const srcFiles = readdirSync(join(gameDir, 'src')).filter((f) => f.endsWith('.js'));
console.log(`FRONTLINE handed in: ${srcFiles.length} source modules, ${shotFiles.length} screenshots -> ${out}`);
console.log(`  modules: ${srcFiles.join(', ')}`);
console.log(`  shots: ${shotFiles.join(', ')}`);
