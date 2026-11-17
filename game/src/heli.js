// FRONTLINE helicopters: the supply heli flies in from the south, drops a
// crate on the line, and leaves. Crates hold ammo, medkits or weapons.
import { angleTo } from './random.js';
import { spawnDust } from './particles.js';

export function startSupplyHeli(g, audio, crateKind) {
  if (g.heli) return false;
  const kind = crateKind || ['ammo', 'medkit', 'weapon'][Math.floor(g.rng() * 3)];
  g.heli = {
    x: g.player.x + (g.rng() - 0.5) * 200,
    y: 1300,
    tx: g.player.x, ty: Math.max(300, g.player.y - 120),
    state: 'in', t: 0, crateKind: kind, angle: -Math.PI / 2,
    rotorT: 0,
  };
  audio.rotor();
  return true;
}

export function stepHeli(g, dt, audio) {
  const h = g.heli;
  if (!h) return;
  h.t += dt;
  h.rotorT += dt;
  const speed = 260;
  if (h.state === 'in') {
    h.angle = angleTo(h.x, h.y, h.tx, h.ty);
    const dx = h.tx - h.x; const dy = h.ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) {
      h.state = 'drop';
      h.t = 0;
      // The crate falls at the drop point.
      g.crates.push({ x: h.x, y: h.y + 30, kind: h.crateKind, t: 0, bob: 0, taken: false });
    } else {
      h.x += (dx / d) * speed * dt;
      h.y += (dy / d) * speed * dt;
    }
    if (g.rng() < dt * 20) spawnDust(g, h.x + (g.rng() - 0.5) * 60, h.y + 40);
  } else if (h.state === 'drop') {
    if (h.t > 0.8) { h.state = 'out'; h.t = 0; }
  } else {
    // Fly back south and off the map.
    h.angle = Math.PI / 2;
    h.y += speed * dt;
    if (h.y > 1350) g.heli = null;
  }
}
