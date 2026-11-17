// FRONTLINE state: one object owns everything the sim and the renderer
// read. newGame builds it; helpers keep the HUD text and the grade in one
// place.
import { CONFIG, DIFFICULTY, WEAPONS, WEAPON_ORDER, SECTORS } from './config.js';
import { makeRng } from './random.js';

export function makePlayerWeapons() {
  return WEAPON_ORDER.map((id) => {
    const w = WEAPONS[id];
    const unlocked = id === 'pistol' || id === 'smg';
    return {
      id, name: w.name, key: w.key,
      mag: unlocked ? w.mag : 0, // unlocked weapons start chambered
      reserve: w.startAmmo,
      unlocked,
    };
  });
}

export function newGame(seed, diffKey) {
  const rng = makeRng(seed || 1);
  const diff = DIFFICULTY[diffKey || 'veteran'];
  const sectors = SECTORS.map((s) => ({
    n: s.n, name: s.name, x: s.x, y: s.y, mix: s.mix, boss: s.boss,
    sky: s.sky, intel: s.intel, taken: false, capture: 0, retake: 0,
  }));
  return {
    seed: seed || 1,
    rng,
    screen: 'briefing',
    selectedDiff: diffKey || 'veteran',
    diff,
    time: 0,
    elapsed: 0,
    sector: 0, // index of the sector currently being fought over
    sectors,
    lineY: 1120, // visual frontline; lerps toward its target every step
    lineTargetY: sectors[0].y - 90,
    lineIntegrity: 100,
    hq: { x: 800, y: 92, hp: CONFIG.hqHp, maxHp: CONFIG.hqHp, alive: true },
    hqPhase: false,
    player: {
      x: 800, y: 1060, angle: -Math.PI / 2, hp: CONFIG.playerHp,
      maxHp: CONFIG.playerHp, armor: CONFIG.playerArmor, maxArmor: CONFIG.playerArmor,
      speed: CONFIG.playerSpeed, weapons: makePlayerWeapons(), cur: 0,
      fireCd: 0, reloadT: 0, sprint: false, inVehicle: null, vehicle: null,
      regen: 0, magMul: 1, fireMul: 1, rangeMul: 1, critBonus: 0,
      commandBonus: 0, alive: true, invulnT: 0, stepT: 0,
    },
    enemies: [],
    allies: [],
    boss: null,
    bossName: '',
    bullets: [],
    grenades: [],
    mortars: [],
    strikes: [],
    smokes: [],
    particles: [],
    casings: [],
    floats: [],
    tracers: [],
    crates: [],
    heli: null,
    jet: null,
    vehicles: [
      { kind: 'jeep', x: 520, y: 1000, angle: 0, hp: 320, maxHp: 320, occupied: false, alive: true },
      { kind: 'bike', x: 1080, y: 1060, angle: 0, hp: 180, maxHp: 180, occupied: false, alive: true },
    ],
    feed: [],
    combo: 0, comboTimer: 0, bestCombo: 0,
    kills: 0, score: 0,
    momentum: 0, // command points: kills speed capture, and buy call-ins
    spawnQueue: [],
    spawnT: 0,
    spawnTotal: 0,
    callinCd: { supply: 0, strike: 0, mortar: 0, smoke: 0 },
    doctrines: [],
    doctrineOffer: null,
    doctrinePick: 0,
    radioText: '',
    radioT: 0,
    banner: '',
    bannerT: 0,
    bannerSub: '',
    camera: { x: 800, y: 600 },
    shake: 0,
    hitstop: 0,
    stats: { shotsFired: 0, shotsHit: 0 },
    barrage: { nextT: 18, warnT: 0, activeT: 0, y: 0, h: CONFIG.barrageHeight, tickT: 0 },
    endless: false,
    endlessWave: 0,
    result: null,
    grade: 'C',
    frameTimes: [],
    fpsAvg: 0,
    fpsP95: 0,
    muted: false,
  };
}

export function setRadio(g, text) {
  g.radioText = text;
  g.radioT = 4.5;
}

export function setBanner(g, text, sub) {
  g.banner = text;
  g.bannerSub = sub || '';
  g.bannerT = 3.2;
}

export function addFeed(g, text) {
  g.feed.unshift({ text, t: 0 });
  if (g.feed.length > 6) g.feed.length = 6;
}

export function addFloat(g, x, y, text, color, size) {
  g.floats.push({ x, y, life: 0.9, maxLife: 0.9, text, color: color || '#ffd75e', size: size || 15 });
}

export function computeGrade(g) {
  const acc = g.stats.shotsFired ? g.stats.shotsHit / g.stats.shotsFired : 0;
  const integ = g.lineIntegrity / 100;
  const score = acc * 0.55 + integ * 0.45;
  if (score >= 0.72 && g.kills >= 60) return 'S';
  if (score >= 0.58) return 'A';
  if (score >= 0.42) return 'B';
  return 'C';
}

export function sectorSky(g) {
  return g.sectors[Math.min(g.sector, 6)].sky;
}
