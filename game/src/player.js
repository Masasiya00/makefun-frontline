// FRONTLINE player: movement, sprint, aim, firing, reload, vehicle entry,
// pickups. The player is the squad leader; everything else reacts to them.
import { CONFIG, WEAPONS } from './config.js';
import { moveVector } from './input.js';
import { collideCircle, inGrass, inSand, isBlocked } from './map.js';
import { switchWeapon, startReload, tryFire, finishReload, weaponStats } from './weapons.js';
import { spawnDust } from './particles.js';
import { hurtPlayer } from './bullets.js';

export function stepPlayer(g, input, pressed, dt, audio) {
  const p = g.player;
  if (!p.alive) return;
  if (p.invulnT > 0) p.invulnT -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.comboTimer > 0) { /* combo handled in main */ }
  if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // Aim at the mouse.
  const wx = g.camera.x - 640 + input.mouseX;
  const wy = g.camera.y - 400 + input.mouseY;
  p.angle = Math.atan2(wy - p.y, wx - p.x);

  // Weapon switching 1-5.
  for (let i = 0; i < 5; i += 1) {
    if (pressed.keys[`Digit${i + 1}`] || pressed.keys[`Numpad${i + 1}`]) switchWeapon(g, i);
  }
  if (pressed.keys.KeyR) startReload(g, audio);
  if (pressed.keys.KeyM) { g.muted = audio.toggleMute(); }

  // Vehicle entry/exit with E when near one (E is the airstrike otherwise).
  // Riding: E always exits. On foot: E rides the nearest vehicle.
  if (pressed.keys.KeyE) {
    if (p.inVehicle) {
      toggleVehicle(g, p.vehicle, audio);
    } else {
      const near = nearestVehicle(g, 70);
      if (near) { toggleVehicle(g, near, audio); }
    }
    // else: the radio module handles the airstrike in main.js
  }

  const mv = moveVector(input);
  const sprinting = input.keys.ShiftLeft || input.keys.ShiftRight;
  let speed = p.speed * (sprinting ? 1.4 : 1);
  if (inSand(g.map, p.x, p.y)) speed *= 0.9; // sand slows the advance
  if (p.reloadT > 0) speed *= 0.7;

  if (p.inVehicle) {
    stepVehicleMove(g, mv, sprinting, dt, audio);
  } else if (mv.x !== 0 || mv.y !== 0) {
    const pos = collideCircle(g.map, p.x, p.y, CONFIG.playerRadius, mv.x * speed * dt, mv.y * speed * dt);
    p.x = pos.x; p.y = pos.y;
    p.stepT += dt;
    if (p.stepT > 0.22) {
      p.stepT = 0;
      if (inSand(g.map, p.x, p.y)) spawnDust(g, p.x, p.y + 10);
    }
  }

  // Reload timer.
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { p.reloadT = 0; finishReload(g); }
  }

  // Firing: hold for auto weapons, click per shot for semi-auto.
  const w = p.weapons[p.cur];
  const st = weaponStats(g, w);
  if (st.auto) {
    if (input.mouseDown) tryFire(g, audio);
  } else if (pressed.clicked || (input.mouseDown && p.fireCd <= 0 && !p._semiHeld)) {
    if (tryFire(g, audio)) p._semiHeld = true;
  }
  if (!input.mouseDown) p._semiHeld = false;

  // Pickups: crates on the ground.
  for (const c of g.crates) {
    if (c.taken) continue;
    if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 34 * 34) {
      c.taken = true;
      applyCrate(g, c, audio);
    }
  }
  g.crates = g.crates.filter((c) => !c.taken);

  // Barrage zone damage.
  const b = g.barrage;
  if (b.activeT > 0) {
    if (Math.abs(p.y - b.y) < b.h / 2 && p.x > 40 && p.x < 1560) {
      b._tick = (b._tick || 0) + dt;
      if (b._tick > 0.4) {
        b._tick = 0;
        hurtPlayer(g, 22, audio);
      }
    }
  }
}

function stepVehicleMove(g, mv, sprinting, dt, audio) {
  const p = g.player;
  const v = p.vehicle;
  if (!v || !v.alive) { p.inVehicle = null; p.vehicle = null; return; }
  const speed = (v.kind === 'bike' ? 430 : 330) * (sprinting ? 1.15 : 1);
  // Vehicles steer with WASD relative to facing: W drives forward.
  let fx = 0; let fy = 0;
  if (mv.y < 0) { fx = Math.cos(v.angle); fy = Math.sin(v.angle); }
  if (mv.y > 0) { fx = -Math.cos(v.angle) * 0.6; fy = -Math.sin(v.angle) * 0.6; }
  if (mv.x !== 0) v.angle += mv.x * 2.4 * dt * (mv.y < 0 ? 1 : -1);
  const pos = collideCircle(g.map, v.x, v.y, 24, fx * speed * dt, fy * speed * dt);
  // Ramming enemies hurts them.
  for (const e of g.enemies) {
    if (!e.alive) continue;
    if ((e.x - v.x) ** 2 + (e.y - v.y) ** 2 < 40 * 40) {
      e.hp -= 60 * dt * 10;
      if (e.hp <= 0 && e.alive) {
        e.alive = false;
        g.kills += 1; g.score += 100;
        g.combo += 1; g.comboTimer = CONFIG.comboWindow;
      }
    }
  }
  v.x = pos.x; v.y = pos.y;
  p.x = v.x; p.y = v.y;
  if (Math.abs(fx) + Math.abs(fy) > 0 && g.rng() < dt * 8) spawnDust(g, v.x, v.y + 14);
}

export function nearestVehicle(g, maxD) {
  let best = null; let bd = maxD * maxD;
  for (const v of g.vehicles) {
    if (!v.alive || v.occupied) continue;
    const d2 = (v.x - g.player.x) ** 2 + (v.y - g.player.y) ** 2;
    if (d2 < bd) { bd = d2; best = v; }
  }
  return best;
}

function toggleVehicle(g, v) {
  const p = g.player;
  if (p.inVehicle) {
    // Exit: step out beside the vehicle.
    p.inVehicle = null;
    p.vehicle.occupied = false;
    p.vehicle = null;
    p.x += 40; p.y += 20;
    if (isBlocked(g.map, p.x, p.y, CONFIG.playerRadius)) { p.x -= 80; p.y -= 40; }
  } else {
    p.inVehicle = v;
    p.vehicle = v;
    v.occupied = true;
    v.angle = p.angle;
    p.x = v.x; p.y = v.y;
  }
}

export function exitVehicle(g) {
  const p = g.player;
  if (!p.inVehicle) return;
  const v = p.vehicle;
  p.inVehicle = null;
  if (v) v.occupied = false;
  p.vehicle = null;
}

function applyCrate(g, c, audio) {
  const p = g.player;
  if (c.kind === 'medkit') {
    p.hp = Math.min(p.maxHp, p.hp + 40);
    p.armor = Math.min(p.maxArmor, p.armor + 25);
  } else if (c.kind === 'ammo') {
    for (const w of p.weapons) {
      if (!w.unlocked || w.id === 'pistol') continue;
      w.reserve += Math.round(WEAPONS[w.id].startAmmo * 0.6);
    }
  } else if (c.kind === 'weapon') {
    const locked = p.weapons.filter((w) => !w.unlocked);
    if (locked.length > 0) {
      const w = locked[Math.floor(g.rng() * locked.length)];
      w.unlocked = true;
      w.mag = Math.round(WEAPONS[w.id].mag * p.magMul);
      w.reserve = WEAPONS[w.id].startAmmo;
      p.cur = p.weapons.indexOf(w);
    } else {
      for (const w of p.weapons) if (w.id !== 'pistol') w.reserve += 60;
    }
  }
  audio.captureTick();
}
