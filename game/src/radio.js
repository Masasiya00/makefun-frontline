// FRONTLINE radio: Q supply drop, E jet airstrike, T mortar barrage,
// F smoke screen — plus the artillery barrage zone that sweeps the map and
// forces everyone to keep moving. Every call-in shows a radio order.
import { CALLINS, CONFIG } from './config.js';
import { setRadio } from './state.js';
import { startSupplyHeli } from './heli.js';
import { spawnSmokePuff, spawnExplosion } from './particles.js';

export function tryCallIn(g, kind, tx, ty, audio) {
  const c = CALLINS[kind];
  if (!c) return false;
  const p = g.player;
  if (!p.alive) return false;
  if (g.callinCd[kind] > 0) return false;
  const cost = c.cost;
  if (g.momentum < cost) {
    setRadio(g, `COMMAND: Not enough momentum — need ${cost} (have ${Math.floor(g.momentum)})`);
    audio.radioBeep();
    return false;
  }
  g.momentum -= cost;
  const cdMul = g.doctrines.includes('radio') ? 0.7 : 1;
  g.callinCd[kind] = c.cooldown * cdMul;
  setRadio(g, `COMMAND: ${c.order}`);
  audio.radioStatic();
  audio.radioBeep();

  if (kind === 'supply') {
    startSupplyHeli(g, audio);
  } else if (kind === 'strike') {
    // Jet flies over the target and the zone explodes in sequence.
    g.jet = {
      x: tx - 700, y: ty - 320, tx, ty,
      angle: Math.atan2(ty - (ty - 320), tx - (tx - 700)),
      state: 'in', t: 0, flame: 8 + g.rng() * 10,
    };
    audio.jetRoar();
  } else if (kind === 'mortar') {
    // Six shells whistle down on the target area.
    for (let i = 0; i < 6; i += 1) {
      g.mortars.push({
        x: tx + (g.rng() - 0.5) * 190,
        y: ty + (g.rng() - 0.5) * 150,
        t: 0.7 + i * 0.28, dmg: 85, from: 'player',
      });
    }
    audio.mortarWhistle();
  } else if (kind === 'smoke') {
    // A drifting smoke cloud that blocks enemy sight and fire.
    g.smokes.push({
      x: tx, y: ty, radius: 40, maxRadius: 130,
      life: 7, maxLife: 7, driftX: 14, driftY: -6, fromBlast: false,
    });
    for (let i = 0; i < 6; i += 1) spawnSmokePuff(g, tx, ty);
    audio.smokeHiss();
  }
  return true;
}

export function stepJet(g, dt, audio) {
  const j = g.jet;
  if (!j) return;
  j.t += dt;
  const speed = 640;
  if (j.state === 'in') {
    const dx = j.tx - j.x; const dy = j.ty - j.y;
    const d = Math.hypot(dx, dy);
    j.angle = Math.atan2(dy, dx);
    if (d < 60) {
      j.state = 'strike';
      // Five blasts across the target zone.
      for (let i = 0; i < 5; i += 1) {
        g.strikes.push({
          x: j.tx + (g.rng() - 0.5) * 220,
          y: j.ty + (g.rng() - 0.5) * 160,
          t: 0.15 + i * 0.22, dmg: 130,
        });
      }
      spawnExplosion(g, j.tx, j.ty, true);
      audio.explosion(true);
    } else {
      j.x += (dx / d) * speed * dt;
      j.y += (dy / d) * speed * dt;
    }
  } else {
    j.x += Math.cos(j.angle) * speed * dt;
    j.y += Math.sin(j.angle) * speed * dt;
    if (j.x < -100 || j.x > 1700 || j.y < -100 || j.y > 1300) g.jet = null;
  }
}

// The artillery barrage: a marked band sweeps the map on a timer.
export function stepBarrage(g, dt, audio) {
  const b = g.barrage;
  if (b.activeT > 0) {
    b.activeT -= dt;
    b.tickT += dt;
    if (b.tickT > 0.22) {
      b.tickT = 0;
      // Explosions walk across the band.
      const x = 60 + g.rng() * 1480;
      const y = b.y + (g.rng() - 0.5) * b.h;
      spawnExplosion(g, x, y, false);
      if (g.rng() < 0.4) audio.explosion(false);
    }
    if (b.activeT <= 0) b.nextT = CONFIG.barrageGap * (0.8 + g.rng() * 0.4);
    return;
  }
  if (b.warnT > 0) {
    b.warnT -= dt;
    if (b.warnT <= 0) {
      b.activeT = CONFIG.barrageActive;
      b.tickT = 0;
      audio.explosion(true);
    }
    return;
  }
  b.nextT -= dt;
  if (b.nextT <= 0) {
    b.y = 160 + g.rng() * 880;
    b.warnT = CONFIG.barrageWarn;
    setRadio(g, 'COMMAND: Incoming artillery — clear the marked band!');
    audio.mortarWhistle();
    audio.radioBeep();
  }
}
