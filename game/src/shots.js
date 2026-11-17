// FRONTLINE screenshot scenes: deterministic captures for
// ?shot=briefing|play|boss|victory&seed=1. Each scene builds a real game
// state and runs the real fixed-step sim with scripted input, so the
// screenshots are the game itself, not a mock. The parent playtest reads
// window.__shotReady and window.__frontline.snapshot().
import { SECTORS } from './config.js';
import { startSector } from './main.js';
import { spawnEnemy, buildSpawnQueue } from './enemies.js';
import { tryCallIn } from './radio.js';
import { startSupplyHeli } from './heli.js';
import { setRadio, computeGrade } from './state.js';
import { unlockWeapon } from './weapons.js';

export function stageShot(g, name, step, input, audio) {
  if (name === 'briefing') stageBriefing(g);
  else if (name === 'play') stagePlay(g, step, input);
  else if (name === 'boss') stageBoss(g, step, input, audio);
  else if (name === 'victory') stageVictory(g);
  else stageBriefing(g);
}

function stageBriefing(g) {
  g.screen = 'briefing';
  g.selectedDiff = 'veteran';
  g.time = 4.2;
  // Backdrop: enemies milling outside the wire.
  const spots = [[300, 200], [1400, 300], [200, 900], [1500, 1000], [500, 1100], [1200, 150]];
  for (const [x, y] of spots) spawnEnemy(g, 'grunt', x, y);
  spawnEnemy(g, 'grenadier', 1350, 700);
  spawnEnemy(g, 'shield', 260, 560);
  g.camera.x = 800; g.camera.y = 600;
}

function nearestEnemyScreen(g, input) {
  let best = null; let bestD = Infinity;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d = (e.x - g.player.x) ** 2 + (e.y - g.player.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (g.boss && g.boss.alive) {
    const bd = (g.boss.x - g.player.x) ** 2 + (g.boss.y - g.player.y) ** 2;
    const range = { pistol: 540, smg: 430, rifle: 660, shotgun: 350, sniper: 920 }[g.player.weapons[g.player.cur].id] || 500;
    if (bd < range * range && bd < bestD) { bestD = bd; best = g.boss; }
  }
  if (!best) return false;
  input.mouseX = best.x - g.camera.x + 640;
  input.mouseY = best.y - g.camera.y + 400;
  return true;
}

function stagePlay(g, step, input) {
  g.screen = 'play';
  g.diff = { label: 'VETERAN', enemyHp: 1, enemyDmg: 1, enemySpeed: 1, spawnGap: 1 };
  g.player.x = 800; g.player.y = 940;
  g.player.hp = 82; g.player.armor = 34;
  g.momentum = 42;
  g.score = 3650;
  g.kills = 31;
  g.combo = 6; g.comboTimer = 2.5;
  g.doctrines = ['mags', 'medic'];
  g.player.regen = 1.5;
  unlockWeapon(g, 'rifle');
  g.player.cur = 2; // rifle in hand
  g.player.weapons[2].mag = 24;
  g.elapsed = 214;
  startSector(g);
  // Pre-place a visible fight: enemies closing from three sides, a smoke
  // cloud drifting, a crate by the helipad.
  const pack = [
    ['grunt', 620, 780], ['grunt', 660, 820], ['rusher', 980, 760],
    ['rusher', 1020, 830], ['grenadier', 560, 980], ['sniper', 1150, 1020],
    ['shield', 700, 1060], ['grunt', 900, 1080], ['grunt', 760, 720],
  ];
  for (const [kind, x, y] of pack) spawnEnemy(g, kind, x, y);
  g.spawnQueue = buildSpawnQueue(g, SECTORS[0]);
  g.smokes.push({ x: 900, y: 860, radius: 90, maxRadius: 130, life: 6, maxLife: 8, driftX: 12, driftY: -4, fromBlast: false });
  g.crates.push({ x: 1010, y: 1080, kind: 'medkit', t: 0, bob: 0, taken: false });
  // Run the real sim with scripted fire so tracers, casings and muzzle
  // flash are genuinely in flight when the shutter falls.
  input.mouseDown = true;
  for (let i = 0; i < 70; i += 1) {
    nearestEnemyScreen(g, input);
    step(g, input);
  }
  input.mouseDown = false;
  setRadio(g, 'COMMAND: Mortar section, fire for effect grid 5-3');
}

function stageBoss(g, step, input, audio) {
  g.screen = 'play';
  g.diff = { label: 'VETERAN', enemyHp: 1, enemyDmg: 1, enemySpeed: 1, spawnGap: 1 };
  // Sectors 1-2 taken: the line sits at sector 3, CROSSROADS.
  g.sectors[0].taken = true; g.sectors[0].capture = 100;
  g.sectors[1].taken = true; g.sectors[1].capture = 100;
  g.sector = 2;
  g.lineY = 830; g.lineTargetY = 650;
  g.player.x = 760; g.player.y = 860;
  g.player.hp = 74; g.player.armor = 40;
  g.momentum = 45;
  g.score = 7400;
  g.kills = 58;
  g.combo = 9; g.comboTimer = 2.8;
  g.doctrines = ['mags', 'flak'];
  g.player.maxArmor = 100;
  unlockWeapon(g, 'rifle');
  unlockWeapon(g, 'shotgun');
  g.player.cur = 3; // shotgun in hand
  g.elapsed = 428;
  startSector(g); // spawns the WARHOUND boss for sector 3
  const pack = [
    ['grunt', 880, 640], ['grunt', 930, 680], ['rusher', 860, 700],
    ['grenadier', 980, 630], ['shield', 910, 720], ['grunt', 950, 760],
    ['rusher', 840, 660], ['sniper', 1180, 900],
  ];
  for (const [kind, x, y] of pack) spawnEnemy(g, kind, x, y);
  g.boss.x = 700; g.boss.y = 720; // close to the player: big in frame
  g.spawnQueue = buildSpawnQueue(g, SECTORS[2]);
  // Call the airstrike on the cluster and send the supply heli in, then run
  // the sim until the jet is over the target and the blasts are going off.
  tryCallIn(g, 'strike', 920, 680, audio);
  startSupplyHeli(g, audio);
  g.momentum = 18;
  input.mouseDown = true;
  for (let i = 0; i < 105; i += 1) {
    nearestEnemyScreen(g, input);
    input.mouseDown = (i % 14) !== 13; // semi-auto shotgun: re-trigger
    step(g, input);
    if (g.strikes.length === 0 && i > 95) break;
  }
  input.mouseDown = false;
  setRadio(g, 'COMMAND: Viper flight, strike grid 5-3');
  g.bannerT = 0; // hide the sector banner so the boss reads cleanly
  g.smokes.push({ x: 920, y: 680, radius: 70, maxRadius: 120, life: 3, maxLife: 3.2, driftX: 12, driftY: -6, fromBlast: true });
}

function stageVictory(g) {
  g.screen = 'victory';
  g.sector = 6;
  for (const s of g.sectors) { s.taken = true; s.capture = 100; }
  g.hq.alive = false; g.hq.hp = 0;
  g.lineY = 150; g.lineTargetY = 150;
  g.score = 18400;
  g.kills = 147;
  g.bestCombo = 14;
  g.elapsed = 742;
  g.stats.shotsFired = 812;
  g.stats.shotsHit = 552;
  g.doctrines = ['mags', 'rapid', 'flak', 'medic'];
  g.result = { win: true, grade: 'S', kills: 147, time: 742, accuracy: 68, sector: 7 };
  g.time = 6.0;
  g.camera.x = 800; g.camera.y = 600;
}

export function snapshot(g) {
  return {
    screen: g.screen,
    sector: g.sector + 1,
    sectorsTaken: g.sectors.filter((s) => s.taken).length,
    hp: Math.round(g.player.hp),
    armor: Math.round(g.player.armor),
    score: g.score,
    momentum: Math.floor(g.momentum),
    kills: g.kills,
    combo: g.combo,
    lineY: Math.round(g.lineY),
    lineIntegrity: Math.round(g.lineIntegrity),
    hqHp: g.hq ? Math.round(g.hq.hp) : 0,
    enemiesAlive: g.enemies.filter((e) => e.alive).length + (g.boss && g.boss.alive ? 1 : 0),
    spawnQueued: g.spawnQueue.length,
    boss: g.bossName,
    bossHp: g.boss ? Math.round(g.boss.hp) : 0,
    bossMaxHp: g.boss ? Math.round(g.boss.maxHp) : 0,
    weapons: g.player.weapons.filter((w) => w.unlocked).map((w) => w.id),
    currentWeapon: g.player.weapons[g.player.cur].id,
    doctrines: g.doctrines.slice(),
    grade: g.result ? g.result.grade : computeGrade(g),
    accuracy: g.stats.shotsFired ? Math.round((g.stats.shotsHit / g.stats.shotsFired) * 100) : 0,
    endless: g.endless,
  };
}
