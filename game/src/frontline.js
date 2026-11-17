// FRONTLINE frontline: the moving line itself. Capture the current sector's
// trench zone to push the line forward; lose a sector to a counter-attack
// and the line falls back. Kills earn momentum, which speeds capture.
import { CONFIG } from './config.js';
import { setBanner, setRadio, addFeed, addFloat } from './state.js';
import { spawnExplosion } from './particles.js';

function zoneHas(g, x, y, r, list) {
  for (const e of list) {
    if (!e.alive) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 < r * r) return true;
  }
  return false;
}

function countInZone(g, x, y, r, list) {
  let n = 0;
  for (const e of list) {
    if (!e.alive) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 < r * r) n += 1;
  }
  return n;
}

export function currentSector(g) {
  return g.sectors[Math.min(g.sector, 6)];
}

export function frontlineTargetY(g) {
  if (g.hqPhase) return 150;
  return currentSector(g).y - 90;
}

export function updateFrontline(g, dt, audio) {
  // The visual line chases its target.
  g.lineTargetY = frontlineTargetY(g);
  g.lineY += (g.lineTargetY - g.lineY) * Math.min(1, dt * 1.2);
  if (g.hqPhase) { updateHqPhase(g, dt, audio); return; }

  const s = currentSector(g);
  const R = 120;
  const playerIn = (g.player.x - s.x) ** 2 + (g.player.y - s.y) ** 2 < R * R;
  const alliesIn = countInZone(g, s.x, s.y, R, g.allies);
  const enemiesIn = countInZone(g, s.x, s.y, R, g.enemies);
  const bossAlive = g.boss && g.boss.alive;

  // A taken sector needs no capturing (endless hold, or between sectors).
  if (!s.taken) {
    // Allies assist the capture — but only while the squad leader is
    // fighting for the sector too. Allies alone never take a sector on
    // their own; the player is the one who tips the balance.
    const playerNear = (g.player.x - s.x) ** 2 + (g.player.y - s.y) ** 2 < 260 * 260;
    if (playerIn || (alliesIn > 0 && playerNear)) {
    // Capture: the leader holds it fastest; allies help; momentum helps.
    const mult = 1 + Math.min(g.momentum, CONFIG.momentumCap) / 40;
    let rate = 0;
    if (playerIn) rate += CONFIG.captureRate * mult;
    rate += alliesIn * CONFIG.captureAllyRate;
    if (enemiesIn > 0) rate *= 0.35; // contested: slow grind
    // The boss gates the last point: it must fall first.
    const cap = bossAlive ? 99 : 100;
    const before = s.capture;
    s.capture = Math.min(cap, s.capture + rate * dt);
    if (Math.floor(s.capture / 10) !== Math.floor(before / 10)) audio.captureTick();
    if (bossAlive && s.capture >= 99 && before < 99) {
      setBanner(g, 'ELIMINATE THE BOSS', `${g.boss.name} must fall before the sector turns`);
      audio.radioBeep();
    }
  } else if (enemiesIn > 0) {
    // Unopposed enemies in the zone undo the capture.
    s.capture = Math.max(0, s.capture - CONFIG.captureEnemyStall * dt);
  }

  if (s.capture >= 100) takeSector(g, audio);
  }

  // Counter-attack: enemies holding the LAST TAKEN sector flip it back.
  // (Disabled in endless mode — there the fight is a pure hold.)
  if (g.sector > 0 && !g.endless) {
    const prev = g.sectors[g.sector - 1];
    const foes = countInZone(g, prev.x, prev.y, R, g.enemies);
    const friend = (g.player.x - prev.x) ** 2 + (g.player.y - prev.y) ** 2 < R * R
      || countInZone(g, prev.x, prev.y, R, g.allies) > 0;
    if (foes >= 3 && !friend) {
      prev.retake += dt;
      if (prev.retake >= CONFIG.retakeHold) loseSector(g, audio);
    } else {
      prev.retake = Math.max(0, prev.retake - dt * 2);
    }
  }
}

function takeSector(g, audio) {
  const s = currentSector(g);
  s.taken = true;
  s.capture = 100;
  s.retake = 0;
  g.lineIntegrity = Math.min(100, g.lineIntegrity + 4);
  g.score += 500 + g.sector * 250;
  setBanner(g, `SECTOR ${s.n} TAKEN — ${s.name}`, 'Line pushed forward. Resupply inbound.');
  addFeed(g, `SECTOR ${s.n} ${s.name} TAKEN`);
  audio.sectorTaken();
  spawnExplosion(g, s.x, s.y - 40, false);
  // The heli brings a resupply crate to the new line.
  g.supplyPending = true;
  if (g.sector >= 6) {
    // Last sector: the HQ assault begins.
    g.hqPhase = true;
    setBanner(g, 'THE HQ IS EXPOSED', 'Break the bunker — end this war');
    setRadio(g, 'COMMAND: All units, assault the HQ bunker');
    audio.radioStatic();
    return;
  }
  g.sector += 1;
  // Doctrine pick between sectors.
  offerDoctrine(g);
}

export function offerDoctrine(g) {
  const pool = ['mags', 'rapid', 'flak', 'radio', 'medic', 'barrel', 'lucky']
    .filter((id) => !g.doctrines.includes(id));
  const picks = [];
  const bag = pool.slice();
  while (picks.length < 3 && bag.length > 0) {
    picks.push(bag.splice(Math.floor(g.rng() * bag.length), 1)[0]);
  }
  g.doctrineOffer = picks;
  g.doctrinePick = 0;
  g.screen = 'doctrine';
}

function loseSector(g, audio) {
  const prev = g.sectors[g.sector - 1];
  prev.taken = false;
  prev.capture = 45;
  prev.retake = 0;
  g.sector -= 1;
  g.lineIntegrity = Math.max(0, g.lineIntegrity - 14);
  setBanner(g, `SECTOR ${prev.n} LOST — LINE FALLING BACK`, 'Counter-attack overran the trench');
  addFeed(g, `SECTOR ${prev.n} LOST — counter-attack`);
  audio.sectorLost();
  if (g.lineIntegrity <= 0) {
    // The line has collapsed all the way back: defeat.
    g.result = { win: false, grade: 'D', kills: g.kills, time: g.elapsed, sector: g.sector + 1 };
    g.screen = 'defeat';
    audio.defeat();
  }
}

function updateHqPhase(g, dt, audio) {
  // HQ bunker: bullets damage it (see bullets.js). Nothing else to tick
  // here except the barrage timer, which main.js runs.
  if (g.hq && !g.hq.alive) {
    g.result = {
      win: true, grade: 'S', kills: g.kills, time: g.elapsed, sector: 7,
      accuracy: g.stats.shotsFired ? Math.round((g.stats.shotsHit / g.stats.shotsFired) * 100) : 0,
    };
    g.screen = 'victory';
    audio.victory();
  }
}

export function addMomentum(g, n) {
  g.momentum = Math.min(CONFIG.momentumCap, g.momentum + n);
  g.player.commandBonus = 0;
}
