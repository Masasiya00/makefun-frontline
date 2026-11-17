// FRONTLINE bullets: flight, container cover, hits on enemies / the boss /
// the HQ bunker, grenades and mortar shells. Damage falloff with range.
import { CONFIG, ENEMIES } from './config.js';
import { segmentHitsContainer, inGrass } from './map.js';
import { spawnBlood, spawnExplosion } from './particles.js';
import { addFloat, addFeed, computeGrade } from './state.js';
import { addMomentum } from './frontline.js';

function falloff(b) {
  const t = Math.min(1, b.traveled / b.range);
  return 1 - 0.45 * t; // up to 45% weaker at max range
}

export function updateBullets(g, dt, audio) {
  for (const b of g.bullets) {
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    const stepLen = Math.hypot(b.vx * dt, b.vy * dt);
    b.traveled += stepLen;
    b.life -= dt;
    // Containers and the HQ bunker stop bullets (metallic thunk).
    const hitCover = segmentHitsContainer(g.map, b.x, b.y, nx, ny);
    if (hitCover) {
      spawnExplosion(g, nx, ny, false);
      audio.thunk();
      b.life = 0;
      continue;
    }
    b.x = nx; b.y = ny;
    if (b.life <= 0) continue;
    if (b.x < 0 || b.x > 1600 || b.y < 0 || b.y > 1200) { b.life = 0; continue; }

    if (b.friendly) {
      // Enemy soldiers.
      for (const e of g.enemies) {
        if (!e.alive) continue;
        const rr = e.radius + 2;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
          damageEnemy(g, e, b.dmg * falloff(b), b.crit, audio);
          if (b.from === 'player') g.stats.shotsHit += 1;
          b.life = 0;
          break;
        }
      }
      if (b.life <= 0) continue;
      // Boss.
      if (g.boss && g.boss.alive) {
        const bb = g.boss;
        const rr = bb.radius + 2;
        if ((bb.x - b.x) ** 2 + (bb.y - b.y) ** 2 < rr * rr) {
          damageBoss(g, bb, b.dmg * falloff(b), b.crit, audio);
          if (b.from === 'player') g.stats.shotsHit += 1;
          b.life = 0;
        }
      }
      if (b.life <= 0) continue;
      // HQ bunker, only in the HQ phase.
      if (g.hqPhase && g.hq.alive) {
        const hq = g.map.hq;
        if (Math.abs(b.x - hq.x) < hq.w / 2 + 4 && Math.abs(b.y - hq.y) < hq.h / 2 + 4) {
          g.hq.hp -= b.dmg * falloff(b);
          addFloat(g, b.x, b.y - 10, String(Math.round(b.dmg * falloff(b))), '#ffd75e', 14);
          if (b.from === 'player') g.stats.shotsHit += 1;
          b.life = 0;
          if (g.hq.hp <= 0) {
            g.hq.hp = 0; g.hq.alive = false;
            spawnExplosion(g, hq.x, hq.y, true);
            spawnExplosion(g, hq.x - 60, hq.y + 10, true);
            audio.explosion(true);
          }
        }
      }
    } else {
      // Enemy bullets hit the player (or the vehicle they ride).
      const p = g.player;
      const target = p.inVehicle ? p.vehicle : p;
      const rr = (p.inVehicle ? 26 : 15) + 2;
      if ((target.x - b.x) ** 2 + (target.y - b.y) ** 2 < rr * rr) {
        hurtPlayer(g, b.dmg, audio);
        b.life = 0;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => b.life > 0);

  // Grenades arc to their target, then explode.
  for (const gr of g.grenades) {
    gr.t += dt;
    const k = Math.min(1, gr.t / gr.life);
    gr.x = gr.x0 + (gr.tx - gr.x0) * k;
    gr.y = gr.y0 + (gr.ty - gr.y0) * k - Math.sin(k * Math.PI) * 60;
    if (gr.t >= gr.life) {
      explodeAt(g, gr.x, gr.y, gr.dmg, gr.from, audio, 90);
      gr.done = true;
    }
  }
  g.grenades = g.grenades.filter((gr) => !gr.done);

  // Mortar shells fall from the sky after a whistle.
  for (const m of g.mortars) {
    m.t -= dt;
    if (m.t <= 0) {
      explodeAt(g, m.x, m.y, m.dmg, m.from, audio, 110);
      m.done = true;
    }
  }
  g.mortars = g.mortars.filter((m) => !m.done);

  // Airstrike blasts go off in sequence.
  for (const s of g.strikes) {
    s.t -= dt;
    if (s.t <= 0) {
      explodeAt(g, s.x, s.y, s.dmg, 'player', audio, 130);
      s.done = true;
    }
  }
  g.strikes = g.strikes.filter((s) => !s.done);
}

export function explodeAt(g, x, y, dmg, from, audio, radius) {
  spawnExplosion(g, x, y, radius > 100);
  audio.explosion(radius > 100);
  g.shake = Math.max(g.shake, 6);
  if (from === 'player') {
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius) damageEnemy(g, e, dmg * (1 - d / radius * 0.5), false, audio);
    }
    if (g.boss && g.boss.alive) {
      const d = Math.hypot(g.boss.x - x, g.boss.y - y);
      if (d < radius + 20) damageBoss(g, g.boss, dmg * 0.8, false, audio);
    }
    if (g.hqPhase && g.hq.alive) {
      const d = Math.hypot(g.map.hq.x - x, g.map.hq.y - y);
      if (d < radius + 60) {
        g.hq.hp -= dmg * 0.7;
        if (g.hq.hp <= 0) { g.hq.hp = 0; g.hq.alive = false; spawnExplosion(g, g.map.hq.x, g.map.hq.y, true); }
      }
    }
  } else {
    const p = g.player;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) hurtPlayer(g, dmg * (1 - d / radius * 0.5), audio);
    for (const a of g.allies) {
      if (!a.alive) continue;
      const da = Math.hypot(a.x - x, a.y - y);
      if (da < radius) { a.hp -= dmg * 0.7; if (a.hp <= 0) a.alive = false; }
    }
  }
}

export function damageEnemy(g, e, dmg, crit, audio) {
  e.hp -= dmg;
  spawnBlood(g, e.x, e.y);
  addFloat(g, e.x, e.y - 18, String(Math.round(dmg)), crit ? '#ff5a3a' : '#ffd75e', crit ? 19 : 14);
  audio.hitmarker();
  if (e.hp <= 0 && e.alive) {
    e.alive = false;
    g.kills += 1;
    g.score += ENEMIES[e.kind].score;
    const cmd = CONFIG.commandPerKill[e.kind] + (g.player.commandBonus || 0);
    addMomentum(g, CONFIG.momentumPerKill);
    g.combo += 1;
    g.comboTimer = CONFIG.comboWindow;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    addFeed(g, `${ENEMIES[e.kind].name} down +${ENEMIES[e.kind].score}`);
    g.hitstop = Math.max(g.hitstop, 0.045);
    spawnExplosion(g, e.x, e.y, false);
  }
}

export function damageBoss(g, b, dmg, crit, audio) {
  b.hp -= dmg;
  spawnBlood(g, b.x, b.y);
  addFloat(g, b.x, b.y - b.radius - 6, String(Math.round(dmg)), crit ? '#ff5a3a' : '#ffd75e', crit ? 20 : 15);
  audio.hitmarker();
  if (b.hp <= 0 && b.alive) {
    b.alive = false;
    g.kills += 1;
    g.score += CONFIG.scorePerKill.boss;
    addMomentum(g, CONFIG.momentumPerKill * 3);
    g.combo += 3;
    g.comboTimer = CONFIG.comboWindow;
    g.bestCombo = Math.max(g.bestCombo, g.combo);
    setBanner(g, `${b.name} DOWN!`, 'The sector is yours to take');
    addFeed(g, `${b.name} DESTROYED +1500`);
    spawnExplosion(g, b.x, b.y, true);
    spawnExplosion(g, b.x + 30, b.y - 20, true);
    audio.explosion(true);
    g.hitstop = Math.max(g.hitstop, 0.12);
    g.bossName = '';
  }
}

export function hurtPlayer(g, dmg, audio) {
  const p = g.player;
  if (!p.alive || p.invulnT > 0) return;
  // Riding a vehicle: the ride soaks most of the hit, and can be destroyed.
  if (p.inVehicle && p.vehicle && p.vehicle.alive) {
    const v = p.vehicle;
    v.hp -= dmg;
    if (v.hp <= 0) {
      v.hp = 0; v.alive = false;
      spawnExplosion(g, v.x, v.y, true);
      audio.explosion(true);
      g.shake = Math.max(g.shake, 8);
      p.inVehicle = null; v.occupied = false; p.vehicle = null;
      p.x = v.x + 50; p.y = v.y + 30;
    }
    dmg *= 0.4;
  }
  let left = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left * 0.6);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  p.invulnT = 0.25;
  g.shake = Math.max(g.shake, 4);
  spawnBlood(g, p.x, p.y);
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    g.result = {
      win: false, grade: computeGrade(g), kills: g.kills, time: g.elapsed,
      sector: g.sector + 1,
      accuracy: g.stats.shotsFired ? Math.round((g.stats.shotsHit / g.stats.shotsFired) * 100) : 0,
    };
    g.screen = 'defeat';
    audio.defeat();
  }
}
