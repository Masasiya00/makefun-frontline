// FRONTLINE enemies: five kinds plus allied AI squads. Enemies advance on
// the line, fight the allies and the player, and try to retake sectors.
// Allies hold the line with the player and help capture zones.
import { ENEMIES, CONFIG } from './config.js';
import { angleTo, clamp, dist2 } from './random.js';
import { collideCircle, inGrass } from './map.js';
import { hurtPlayer } from './bullets.js';
import { spawnBlood } from './particles.js';

export function spawnEnemy(g, kind, x, y) {
  const base = ENEMIES[kind];
  const d = g.diff;
  const e = {
    kind, x, y,
    hp: base.hp * d.enemyHp, maxHp: base.hp * d.enemyHp,
    speed: base.speed * d.enemySpeed * (0.9 + g.rng() * 0.2),
    damage: base.damage * d.enemyDmg,
    radius: base.radius,
    angle: Math.PI / 2,
    alive: true,
    attackCd: 0.5 + g.rng(),
    aimT: 0,
    strafeDir: g.rng() < 0.5 ? 1 : -1,
    hidden: false,
  };
  g.enemies.push(e);
  return e;
}

export function buildSpawnQueue(g, sector) {
  const q = [];
  for (const [kind, n] of Object.entries(sector.mix)) {
    for (let i = 0; i < n; i += 1) q.push(kind);
  }
  // Shuffle so the mix arrives mixed, not in blocks.
  for (let i = q.length - 1; i > 0; i -= 1) {
    const j = Math.floor(g.rng() * (i + 1));
    const t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

export function spawnTick(g, dt, audio) {
  if (g.spawnQueue.length === 0) return;
  g.spawnT -= dt;
  if (g.spawnT > 0) return;
  g.spawnT = g.diff.spawnGap * (0.7 + g.rng() * 0.6);
  const kind = g.spawnQueue.shift();
  // Enemies arrive from the enemy side, spread across the front.
  const x = 120 + g.rng() * 1360;
  const y = 60 + g.rng() * 140;
  spawnEnemy(g, kind, x, y);
}

// Allied squads: 3 squads of 3, they hold near the line and fight.
export function spawnAllies(g) {
  g.allies = [];
  for (let s = 0; s < 3; s += 1) {
    const bx = 420 + s * 380;
    for (let i = 0; i < 3; i += 1) {
      g.allies.push({
        x: bx + (g.rng() - 0.5) * 60,
        y: g.lineY + 90 + (g.rng() - 0.5) * 50,
        hp: 80, maxHp: 80, angle: -Math.PI / 2,
        alive: true, fireCd: 0.5 + g.rng(), squad: s,
      });
    }
  }
}

function nearestTarget(g, x, y, maxD) {
  let best = null; let bd = maxD * maxD;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < bd) { bd = d2; best = e; }
  }
  if (g.boss && g.boss.alive) {
    const d2 = dist2(x, y, g.boss.x, g.boss.y);
    if (d2 < bd) { bd = d2; best = g.boss; }
  }
  return best;
}

export function stepEnemies(g, dt, audio) {
  const p = g.player;
  for (const e of g.enemies) {
    if (!e.alive) continue;
    e.attackCd -= dt;
    e.hidden = inGrass(g.map, e.x, e.y);
    // Target: the player if close, else the nearest ally, else the line.
    let tx = p.x; let ty = p.y;
    let target = p.alive ? p : null;
    let bestD = dist2(e.x, e.y, p.x, p.y);
    for (const a of g.allies) {
      if (!a.alive) continue;
      const d2 = dist2(e.x, e.y, a.x, a.y);
      if (d2 < bestD) { bestD = d2; target = a; tx = a.x; ty = a.y; }
    }
    const d = Math.sqrt(bestD);
    const range = ENEMIES[e.kind].range;

    if (e.kind === 'grenadier') {
      // Hold at range, lob grenades.
      e.angle = angleTo(e.x, e.y, tx, ty);
      if (d > 300) {
        const pos = collideCircle(g.map, e.x, e.y, e.radius, Math.cos(e.angle) * e.speed * dt, Math.sin(e.angle) * e.speed * dt);
        e.x = pos.x; e.y = pos.y;
      } else if (e.attackCd <= 0) {
        e.attackCd = ENEMIES.grenadier.attackRate;
        g.grenades.push({ x0: e.x, y0: e.y, x: e.x, y: e.y, tx, ty, t: 0, life: 1.1, dmg: e.damage, from: 'enemy' });
        audio.mortarWhistle();
      }
    } else if (e.kind === 'sniper') {
      // Long range: stand off, telegraph with a laser, then fire.
      e.angle = angleTo(e.x, e.y, tx, ty);
      if (d > 420) {
        const pos = collideCircle(g.map, e.x, e.y, e.radius, Math.cos(e.angle) * e.speed * dt, Math.sin(e.angle) * e.speed * dt);
        e.x = pos.x; e.y = pos.y;
      } else if (e.attackCd <= 0) {
        e.attackCd = ENEMIES.sniper.attackRate;
        e.aimT = 0.5; // telegraph
        g.bullets.push({
          x: e.x + Math.cos(e.angle) * 18, y: e.y + Math.sin(e.angle) * 18,
          vx: Math.cos(e.angle) * 900, vy: Math.sin(e.angle) * 900,
          life: 0.7, dmg: e.damage, from: 'enemy', friendly: false,
          tracer: '#7ab8ff', range: 640, traveled: 0,
        });
        audio.shot('sniper');
      }
    } else if (e.kind === 'shield') {
      // Slow advance, armored front, melee at the line.
      e.angle = angleTo(e.x, e.y, tx, ty);
      if (d > range) {
        const pos = collideCircle(g.map, e.x, e.y, e.radius, Math.cos(e.angle) * e.speed * dt, Math.sin(e.angle) * e.speed * dt);
        e.x = pos.x; e.y = pos.y;
      } else if (e.attackCd <= 0) {
        e.attackCd = ENEMIES.shield.attackRate;
        if (target === p) hurtPlayer(g, e.damage, audio);
        else if (target) { target.hp -= e.damage; if (target.hp <= 0) target.alive = false; }
      }
    } else {
      // Grunt / rusher: close in and brawl.
      e.angle = angleTo(e.x, e.y, tx, ty);
      const strafe = Math.sin(g.time * 1.7 + e.strafeDir) * 0.35;
      const mx = Math.cos(e.angle + strafe) * e.speed * dt;
      const my = Math.sin(e.angle + strafe) * e.speed * dt;
      const pos = collideCircle(g.map, e.x, e.y, e.radius, mx, my);
      e.x = pos.x; e.y = pos.y;
      if (d < range && e.attackCd <= 0) {
        e.attackCd = ENEMIES[e.kind].attackRate;
        if (target === p) hurtPlayer(g, e.damage, audio);
        else if (target) { target.hp -= e.damage; if (target.hp <= 0) target.alive = false; }
      }
    }
    if (e.aimT > 0) e.aimT -= dt;
  }
  g.enemies = g.enemies.filter((e) => e.alive || e.hp > -50);
  // Prune the dead so the array does not grow forever.
  if (g.enemies.length > 220) g.enemies = g.enemies.filter((e) => e.alive);
}

export function stepAllies(g, dt, audio) {
  const p = g.player;
  for (const a of g.allies) {
    if (!a.alive) continue;
    a.fireCd -= dt;
    // Hold just past the current sector's trench, screening the advance.
    // (Deliberately NOT on the last taken sector: a taken sector left
    // undefended can be retaken, which is the frontline's tug-of-war.)
    const s = g.sectors[Math.min(g.sector, 6)];
    const anchorX = clamp(s.x + (a.squad - 1) * 220, 160, 1440);
    const anchorY = s.y - 40;
    const dx = anchorX - a.x; const dy = anchorY - a.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) {
      const pos = collideCircle(g.map, a.x, a.y, 13, (dx / d) * 95 * dt, (dy / d) * 95 * dt);
      a.x = pos.x; a.y = pos.y;
    }
    // Fire at the nearest enemy in range.
    const target = nearestTarget(g, a.x, a.y, 380);
    if (target) {
      a.angle = angleTo(a.x, a.y, target.x, target.y);
      if (a.fireCd <= 0) {
        a.fireCd = 0.55 + g.rng() * 0.3;
        const spread = (g.rng() - 0.5) * 0.12;
        const ang = a.angle + spread;
        g.bullets.push({
          x: a.x + Math.cos(ang) * 20, y: a.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * 850, vy: Math.sin(ang) * 850,
          life: 0.5, dmg: 9, from: 'ally', friendly: true,
          tracer: '#9fe870', range: 420, traveled: 0,
        });
        g.tracers.push({ x1: a.x, y1: a.y, x2: a.x + Math.cos(ang) * 30, y2: a.y + Math.sin(ang) * 30, life: 0.05, color: '#9fe870' });
      }
    }
  }
  // Reinforce: a fallen ally is replaced at base after a while.
  const alive = g.allies.filter((a) => a.alive).length;
  g._allyRespawn = (g._allyRespawn || 0) + dt;
  if (alive < 9 && g._allyRespawn > 6) {
    g._allyRespawn = 0;
    const dead = g.allies.find((a) => !a.alive);
    if (dead) {
      dead.alive = true; dead.hp = dead.maxHp;
      dead.x = clamp(p.x + (g.rng() - 0.5) * 200, 120, 1480);
      dead.y = clamp(p.y + 120 + g.rng() * 60, 200, 1140);
    }
  }
}
