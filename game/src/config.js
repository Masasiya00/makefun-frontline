// FRONTLINE tuning: every number the campaign balances on lives here, so a
// difficulty tweak is one edit, never a hunt through the sim.
export const CONFIG = {
  viewW: 1280,
  viewH: 800,
  mapW: 1600,
  mapH: 1200,
  step: 1 / 60,
  playerRadius: 15,
  playerSpeed: 238,
  playerSprint: 335,
  playerHp: 100,
  playerArmor: 50,
  maxArmor: 100,
  hqHp: 900,
  captureRate: 11, // % per second while the squad leader holds the zone
  captureAllyRate: 1.5, // % per second per allied soldier in the zone
  captureEnemyStall: 7, // % per second lost while enemies hold the zone alone
  retakeHold: 8, // seconds enemies must hold a taken sector to flip it back
  momentumPerKill: 4,
  momentumCap: 60,
  momentumDecay: 0.6, // per second
  comboWindow: 3.5,
  critBase: 0.05,
  critMult: 2,
  barrageGap: 28, // seconds between artillery barrages
  barrageWarn: 2.5,
  barrageActive: 1.6,
  barrageHeight: 130,
  commandPerKill: { grunt: 2, rusher: 2, grenadier: 4, sniper: 4, shield: 5, boss: 30 },
  scorePerKill: { grunt: 100, rusher: 120, grenadier: 200, sniper: 220, shield: 250, boss: 1500 },
};

export const DIFFICULTY = {
  recruit: { label: 'RECRUIT', enemyHp: 0.8, enemyDmg: 0.8, enemySpeed: 0.9, spawnGap: 1.2, desc: 'Steady pace. Learn the frontline.' },
  veteran: { label: 'VETERAN', enemyHp: 1.0, enemyDmg: 1.0, enemySpeed: 1.0, spawnGap: 1.0, desc: 'The intended fight. Push the line.' },
  legend: { label: 'LEGEND', enemyHp: 1.35, enemyDmg: 1.3, enemySpeed: 1.1, spawnGap: 0.8, desc: 'No mercy. For commanders only.' },
};

// Five weapons, each with its own sound, stats and feel. The pistol has an
// infinite reserve; the rest eat reserve ammo. Rifle, shotgun and sniper
// arrive in supply crates and drops.
export const WEAPONS = {
  pistol: {
    name: 'M9 PISTOL', key: '1', damage: 24, rate: 0.26, mag: 12, reload: 0.95,
    spread: 0.025, speed: 950, range: 540, pellets: 1, auto: false,
    reserve: Infinity, startAmmo: Infinity, sound: 'pistol', kick: 2.5, tracer: '#ffd75e',
  },
  smg: {
    name: 'MP5 SMG', key: '2', damage: 12, rate: 0.075, mag: 32, reload: 1.25,
    spread: 0.085, speed: 880, range: 430, pellets: 1, auto: true,
    reserve: 192, startAmmo: 192, sound: 'smg', kick: 1.2, tracer: '#ffe9a8',
  },
  rifle: {
    name: 'M4 RIFLE', key: '3', damage: 19, rate: 0.11, mag: 30, reload: 1.45,
    spread: 0.04, speed: 1080, range: 660, pellets: 1, auto: true,
    reserve: 180, startAmmo: 120, sound: 'rifle', kick: 2.0, tracer: '#ffd75e',
  },
  shotgun: {
    name: 'M870 SHOTGUN', key: '4', damage: 10, rate: 0.8, mag: 6, reload: 2.1,
    spread: 0.21, speed: 780, range: 350, pellets: 6, auto: false,
    reserve: 48, startAmmo: 36, sound: 'shotgun', kick: 6.0, tracer: '#ffb347',
  },
  sniper: {
    name: 'M24 SNIPER', key: '5', damage: 105, rate: 1.35, mag: 5, reload: 2.3,
    spread: 0.0, speed: 1700, range: 920, pellets: 1, auto: false,
    reserve: 30, startAmmo: 20, sound: 'sniper', kick: 7.0, tracer: '#fff3c4',
  },
};

export const WEAPON_ORDER = ['pistol', 'smg', 'rifle', 'shotgun', 'sniper'];

// Enemy kinds: speed, hp, damage, radius, colour key, behaviour.
export const ENEMIES = {
  grunt: { name: 'Grunt', hp: 46, speed: 62, damage: 9, radius: 14, color: 'grunt', range: 26, attackRate: 0.9, score: 100 },
  rusher: { name: 'Rusher', hp: 28, speed: 118, damage: 7, radius: 12, color: 'rusher', range: 24, attackRate: 0.7, score: 120 },
  grenadier: { name: 'Grenadier', hp: 60, speed: 52, damage: 26, radius: 15, color: 'grenadier', range: 300, attackRate: 2.6, score: 200 },
  sniper: { name: 'Sniper', hp: 40, speed: 46, damage: 18, radius: 13, color: 'sniper', range: 430, attackRate: 2.2, score: 220 },
  shield: { name: 'Shield-bearer', hp: 150, speed: 38, damage: 12, radius: 18, color: 'shield', range: 30, attackRate: 1.1, score: 250 },
};

// Sector battle compositions. Sector n fields its mix; the boss (if any)
// must fall before the capture meter can pass 99%.
export const SECTORS = [
  { n: 1, name: 'GREENLINE', x: 800, y: 1020, mix: { grunt: 10, rusher: 4 }, boss: null, sky: 'day', intel: 'Light infantry probing the wire. Take the trench.' },
  { n: 2, name: 'WHEATFIELD', x: 620, y: 880, mix: { grunt: 12, rusher: 6, grenadier: 2 }, boss: null, sky: 'day', intel: 'Grenadiers in the tall grass. Watch for arcs.' },
  { n: 3, name: 'CROSSROADS', x: 980, y: 740, mix: { grunt: 12, rusher: 8, grenadier: 4, sniper: 2 }, boss: 'warhound', sky: 'dusk', intel: 'WARHOUND — an armored APC is ramming the line.' },
  { n: 4, name: 'RIDGE', x: 800, y: 600, mix: { grunt: 12, rusher: 10, grenadier: 6, sniper: 4, shield: 4 }, boss: null, sky: 'dusk', intel: 'Shield-bearers lead the push. Flank them.' },
  { n: 5, name: 'AIRFIELD', x: 620, y: 460, mix: { grunt: 14, rusher: 10, grenadier: 6, sniper: 6, shield: 4 }, boss: 'nighthawk', sky: 'dusk', intel: 'NIGHTHAWK — attack gunship strafing the frontline.' },
  { n: 6, name: 'DEADWOOD', x: 980, y: 320, mix: { grunt: 16, rusher: 12, grenadier: 8, sniper: 6, shield: 8 }, boss: null, sky: 'night', intel: 'Night fighting. Flares up — trust your tracers.' },
  { n: 7, name: 'IRON GATE', x: 800, y: 180, mix: { grunt: 18, rusher: 14, grenadier: 10, sniper: 8, shield: 10 }, boss: 'juggernaut', sky: 'night', intel: 'JUGGERNAUT — heavy battle tank guards the HQ.' },
];

export const BOSSES = {
  warhound: {
    name: 'WARHOUND', kind: 'warhound', hp: 950, speed: 78, damage: 30, radius: 34,
    color: 'boss', range: 46, attackRate: 1.2, intel: 'Armored APC. It rams the line — stop it in the open.',
  },
  nighthawk: {
    name: 'NIGHTHAWK', kind: 'nighthawk', hp: 1250, speed: 155, damage: 16, radius: 30,
    color: 'boss', range: 420, attackRate: 1.6, intel: 'Attack gunship. It strafes in bursts — keep moving.',
  },
  juggernaut: {
    name: 'JUGGERNAUT', kind: 'juggernaut', hp: 2200, speed: 34, damage: 55, radius: 42,
    color: 'boss', range: 460, attackRate: 3.4, intel: 'Heavy battle tank. Cannon shells, thick armor. Aim for the turret ring.',
  },
};

// Radio call-ins: cost in momentum, cooldown, and the radio order text.
export const CALLINS = {
  supply: { key: 'Q', name: 'SUPPLY DROP', cost: 15, cooldown: 25, order: 'Eagle-1, supply drop inbound' },
  strike: { key: 'E', name: 'AIRSTRIKE', cost: 25, cooldown: 35, order: 'Viper flight, strike' },
  mortar: { key: 'T', name: 'MORTAR BARRAGE', cost: 20, cooldown: 20, order: 'Mortar section, fire for effect' },
  smoke: { key: 'F', name: 'SMOKE SCREEN', cost: 10, cooldown: 12, order: 'Smoke out, cover the line' },
};

// Doctrines (relics): pick one between sectors. id, name, blurb.
export const DOCTRINES = [
  { id: 'mags', name: 'EXTENDED MAGS', desc: '+50% magazine size, all weapons' },
  { id: 'rapid', name: 'RAPID FIRE', desc: '+15% fire rate, all weapons' },
  { id: 'flak', name: 'FLAK PLATING', desc: '+50 max armor, repair armor to full' },
  { id: 'radio', name: 'FIELD RADIO', desc: 'Call-in cooldowns -30%, +1 momentum per kill' },
  { id: 'medic', name: 'COMBAT MEDIC', desc: 'Regenerate 1.5 HP per second' },
  { id: 'barrel', name: 'LONG BARREL', desc: '+25% weapon range' },
  { id: 'lucky', name: 'LUCKY CASING', desc: '+12% critical hit chance' },
];
