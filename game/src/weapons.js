// FRONTLINE weapons: firing, reload, switching, ammo. Each weapon reads
// its stats from config.js; the player module owns movement.
import { WEAPONS, WEAPON_ORDER } from './config.js';
import { spawnMuzzleDust, spawnDust } from './particles.js';

export function weaponStats(g, w) {
  const base = WEAPONS[w.id];
  const p = g.player;
  return {
    damage: base.damage,
    rate: base.rate / p.fireMul,
    mag: Math.round(base.mag * p.magMul),
    reload: base.reload,
    spread: base.spread,
    speed: base.speed,
    range: base.range * p.rangeMul,
    pellets: base.pellets,
    auto: base.auto,
    sound: base.sound,
    kick: base.kick,
    tracer: base.tracer,
  };
}

export function unlockWeapon(g, id) {
  const w = g.player.weapons.find((x) => x.id === id);
  if (!w) return;
  if (!w.unlocked) {
    w.unlocked = true;
    const base = WEAPONS[id];
    w.mag = Math.round(base.mag * g.player.magMul);
    w.reserve = base.startAmmo;
  } else {
    w.reserve += Math.round(WEAPONS[id].startAmmo * 0.5);
  }
}

export function switchWeapon(g, idx) {
  const w = g.player.weapons[idx];
  if (!w || !w.unlocked) return false;
  if (g.player.cur === idx) return false;
  g.player.cur = idx;
  g.player.reloadT = 0;
  g.player.fireCd = 0.15;
  return true;
}

export function startReload(g, audio) {
  const p = g.player;
  const w = p.weapons[p.cur];
  const st = weaponStats(g, w);
  if (p.reloadT > 0) return;
  if (w.mag >= st.mag) return;
  if (w.id !== 'pistol' && w.reserve <= 0) return;
  p.reloadT = st.reload;
  audio.reload();
}

export function finishReload(g) {
  const p = g.player;
  const w = p.weapons[p.cur];
  const st = weaponStats(g, w);
  if (w.id === 'pistol') {
    w.mag = st.mag;
    return;
  }
  const need = st.mag - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take;
  w.reserve -= take;
}

// Fire one trigger pull (called by the player step while the trigger is
// held, respecting auto vs semi-auto). Returns true if a shot left the gun.
export function tryFire(g, audio) {
  const p = g.player;
  const w = p.weapons[p.cur];
  const st = weaponStats(g, w);
  if (p.reloadT > 0 || p.fireCd > 0) return false;
  if (w.mag <= 0) {
    audio.dryFire();
    startReload(g, audio);
    p.fireCd = 0.3;
    return false;
  }
  w.mag -= 1;
  p.fireCd = st.rate;
  g.stats.shotsFired += st.pellets;
  const spreadBase = p.angle;
  for (let i = 0; i < st.pellets; i += 1) {
    const spread = (g.rng() - 0.5) * 2 * st.spread;
    const a = spreadBase + spread;
    const crit = g.rng() < (0.05 + p.critBonus);
    g.bullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed,
      life: st.range / st.speed, dmg: st.damage * (crit ? 2 : 1),
      from: 'player', friendly: true, crit,
      tracer: st.tracer, range: st.range, traveled: 0,
    });
  }
  // Tracer line, muzzle flash, casing, recoil kick.
  const mx = p.x + Math.cos(p.angle) * 26;
  const my = p.y + Math.sin(p.angle) * 26;
  g.tracers.push({
    x1: mx, y1: my,
    x2: mx + Math.cos(p.angle) * 46, y2: my + Math.sin(p.angle) * 46,
    life: 0.07, color: st.tracer,
  });
  spawnMuzzleDust(g, mx, my, p.angle);
  const ca = p.angle + Math.PI / 2 + (g.rng() - 0.5) * 0.8;
  g.casings.push({
    x: p.x, y: p.y, vx: Math.cos(ca) * 90, vy: Math.sin(ca) * 90,
    life: 0.7, angle: g.rng() * Math.PI * 2,
  });
  if (p.inVehicle) {
    p.vehicle.x -= Math.cos(p.angle) * st.kick * 0.4;
    p.vehicle.y -= Math.sin(p.angle) * st.kick * 0.4;
  } else {
    p.x -= Math.cos(p.angle) * st.kick * 0.35;
    p.y -= Math.sin(p.angle) * st.kick * 0.35;
  }
  audio.shot(st.sound);
  if (Math.random() < 0.3) audio.casing();
  return true;
}
