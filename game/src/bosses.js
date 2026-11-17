// FRONTLINE bosses: WARHOUND (APC, rams the line), NIGHTHAWK (gunship,
// strafes from the air) and JUGGERNAUT (heavy tank, cannon shells). One
// boss per boss sector; it must fall before the sector can be taken.
import { BOSSES } from './config.js';
import { angleTo } from './random.js';
import { collideCircle } from './map.js';
import { hurtPlayer } from './bullets.js';
import { setBanner, setRadio } from './state.js';
import { spawnExplosion } from './particles.js';

export function spawnBoss(g, kind) {
  const base = BOSSES[kind];
  const d = g.diff;
  const y = kind === 'nighthawk' ? 260 : 220;
  const b = {
    kind, name: base.name,
    x: 800 + (g.rng() - 0.5) * 300, y,
    hp: base.hp * d.enemyHp, maxHp: base.hp * d.enemyHp,
    speed: base.speed * d.enemySpeed,
    damage: base.damage * d.enemyDmg,
    radius: base.radius, angle: Math.PI / 2,
    alive: true, attackCd: 2, phase: 1,
    strafeT: 0, strafeDir: 1, ramT: 0, shellT: 0,
  };
  g.boss = b;
  g.bossName = base.name;
  setBanner(g, `${base.name} INBOUND`, base.intel);
  setRadio(g, `COMMAND: ${base.name} on the field — take it down`);
  return b;
}

export function stepBoss(g, dt, audio) {
  const b = g.boss;
  if (!b || !b.alive) return;
  const p = g.player;
  b.attackCd -= dt;
  // Phase 2 below half health: faster, angrier.
  const newPhase = b.hp < b.maxHp * 0.5 ? 2 : 1;
  if (newPhase !== b.phase) {
    b.phase = newPhase;
    b.speed *= 1.25;
    setBanner(g, `${b.name} — PHASE ${b.phase}`, 'It is fighting harder now');
    audio.bossRoar();
  }

  if (b.kind === 'warhound') {
    // Charges the player or the line, rams for heavy damage.
    b.ramT -= dt;
    const target = p.alive ? p : { x: 800, y: g.lineY };
    b.angle = angleTo(b.x, b.y, target.x, target.y);
    const sp = b.ramT > 0 ? b.speed * 2.1 : b.speed;
    const pos = collideCircle(g.map, b.x, b.y, b.radius, Math.cos(b.angle) * sp * dt, Math.sin(b.angle) * sp * dt);
    b.x = pos.x; b.y = pos.y;
    if (b.ramT <= 0 && Math.hypot(p.x - b.x, p.y - b.y) < 500) {
      b.ramT = 4; // wind up, then charge
      audio.bossRoar();
    }
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < b.radius + 16 && b.attackCd <= 0) {
      b.attackCd = 1.2;
      hurtPlayer(g, b.damage, audio);
      g.shake = Math.max(g.shake, 9);
      spawnExplosion(g, p.x, p.y, false);
    }
  } else if (b.kind === 'nighthawk') {
    // Flies strafing runs across the line; ignores ground collision.
    b.strafeT -= dt;
    if (b.strafeT <= 0) {
      b.strafeT = 3.2;
      b.strafeDir *= -1;
      b.y = 180 + g.rng() * 260;
    }
    b.x += b.strafeDir * b.speed * dt;
    if (b.x < 140) { b.x = 140; b.strafeDir = 1; }
    if (b.x > 1460) { b.x = 1460; b.strafeDir = -1; }
    b.angle = b.strafeDir > 0 ? 0 : Math.PI;
    if (b.attackCd <= 0) {
      b.attackCd = 1.6;
      // Burst of 3 shots at the player.
      for (let i = 0; i < 3; i += 1) {
        const ang = angleTo(b.x, b.y, p.x, p.y) + (g.rng() - 0.5) * 0.2;
        g.bullets.push({
          x: b.x, y: b.y + 10, vx: Math.cos(ang) * 780, vy: Math.sin(ang) * 780,
          life: 0.9, dmg: b.damage, from: 'enemy', friendly: false,
          tracer: '#ff9a5a', range: 700, traveled: 0,
        });
      }
      audio.shot('smg');
    }
  } else {
    // JUGGERNAUT: slow advance, cannon shells at range, crush at close range.
    const target = p.alive ? p : { x: 800, y: g.lineY };
    b.angle = angleTo(b.x, b.y, target.x, target.y);
    const d = Math.hypot(target.x - b.x, target.y - b.y);
    if (d > 300) {
      const pos = collideCircle(g.map, b.x, b.y, b.radius, Math.cos(b.angle) * b.speed * dt, Math.sin(b.angle) * b.speed * dt);
      b.x = pos.x; b.y = pos.y;
    }
    b.shellT -= dt;
    if (b.shellT <= 0 && d < 560) {
      b.shellT = b.phase === 2 ? 2.2 : 3.2;
      g.grenades.push({
        x0: b.x, y0: b.y, x: b.x, y: b.y,
        tx: target.x + (g.rng() - 0.5) * 90, ty: target.y + (g.rng() - 0.5) * 90,
        t: 0, life: 1.3, dmg: b.damage, from: 'enemy',
      });
      audio.mortarWhistle();
    }
    if (d < b.radius + 18 && b.attackCd <= 0) {
      b.attackCd = 1.4;
      hurtPlayer(g, b.damage, audio);
      g.shake = Math.max(g.shake, 10);
      spawnExplosion(g, p.x, p.y, false);
    }
  }
}
