// FRONTLINE vehicles: the drivable jeep and motorcycle. They are fast, they
// ram, and they can be destroyed — the rider is thrown clear when they go.
import { spawnExplosion } from './particles.js';
import { exitVehicle } from './player.js';

export function damageVehicle(g, v, dmg, audio) {
  if (!v.alive) return;
  v.hp -= dmg;
  if (v.hp <= 0) {
    v.hp = 0;
    v.alive = false;
    spawnExplosion(g, v.x, v.y, true);
    audio.explosion(true);
    g.shake = Math.max(g.shake, 8);
    if (v.occupied) {
      exitVehicle(g);
      g.player.x = v.x + 50;
      g.player.y = v.y + 30;
    }
  }
}

export function updateVehicles(g, dt) {
  for (const v of g.vehicles) {
    if (!v.alive) continue;
    // Enemy fire chews vehicles too: bullets aimed at the rider hit the ride.
    // (Handled in bullets.js via the rider target; this keeps them honest.)
    if (v.hp < v.maxHp) v.hp = Math.min(v.maxHp, v.hp + 1.5 * dt);
  }
}

// A destroyed vehicle leaves a wreck that still blocks movement.
export function vehicleWreckBlocks(g, x, y, r) {
  for (const v of g.vehicles) {
    if (v.alive) continue;
    if ((v.x - x) ** 2 + (v.y - y) ** 2 < (26 + r) * (26 + r)) return true;
  }
  return false;
}
