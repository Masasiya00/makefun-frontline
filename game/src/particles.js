// FRONTLINE particles: explosions, blood, muzzle dust, drifting smoke and
// floating damage numbers. Pure visual state — the sim spawns them, the
// renderer draws them, nothing else reads them.
export function spawnExplosion(g, x, y, big) {
  const n = big ? 26 : 14;
  for (let i = 0; i < n; i += 1) {
    const a = g.rng() * Math.PI * 2;
    const sp = (big ? 260 : 170) * (0.3 + g.rng() * 0.7);
    g.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.5 + g.rng() * 0.5, maxLife: 1,
      size: 3 + g.rng() * (big ? 9 : 6),
      color: ['#ffb347', '#ff7a2e', '#ff4d2e', '#5a5a52'][Math.floor(g.rng() * 4)],
      kind: 'fire',
    });
  }
  for (let i = 0; i < (big ? 10 : 5); i += 1) {
    const a = g.rng() * Math.PI * 2;
    const sp = 30 + g.rng() * 60;
    g.particles.push({
      x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
      life: 1.2 + g.rng() * 1.2, maxLife: 2.4,
      size: 14 + g.rng() * 18,
      color: '#6a6a60', kind: 'smoke',
    });
  }
  g.shake = Math.max(g.shake, big ? 10 : 5);
}

export function spawnBlood(g, x, y) {
  for (let i = 0; i < 6; i += 1) {
    const a = g.rng() * Math.PI * 2;
    const sp = 60 + g.rng() * 120;
    g.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.3 + g.rng() * 0.3, maxLife: 0.6,
      size: 2 + g.rng() * 3, color: '#a02020', kind: 'blood',
    });
  }
}

export function spawnMuzzleDust(g, x, y, angle) {
  g.particles.push({
    x, y, vx: Math.cos(angle) * 40, vy: Math.sin(angle) * 40,
    life: 0.12, maxLife: 0.12, size: 9, color: '#ffe9a8', kind: 'flash',
  });
}

export function spawnDust(g, x, y) {
  g.particles.push({
    x, y, vx: (g.rng() - 0.5) * 30, vy: -12 - g.rng() * 20,
    life: 0.5 + g.rng() * 0.4, maxLife: 0.9,
    size: 5 + g.rng() * 7, color: '#9a8a62', kind: 'dust',
  });
}

export function spawnSmokePuff(g, x, y) {
  g.particles.push({
    x: x + (g.rng() - 0.5) * 30, y: y + (g.rng() - 0.5) * 30,
    vx: 8 + g.rng() * 10, vy: -4 - g.rng() * 8,
    life: 1.5 + g.rng(), maxLife: 2.5,
    size: 16 + g.rng() * 14, color: '#c8c8bc', kind: 'smoke',
  });
}

export function updateParticles(g, dt) {
  for (const p of g.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94; p.vy *= 0.94;
    if (p.kind === 'smoke') { p.vy -= 6 * dt; p.size += 6 * dt; }
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const c of g.casings) {
    c.life -= dt;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vx *= 0.9; c.vy *= 0.9;
    c.angle += 8 * dt;
  }
  g.casings = g.casings.filter((c) => c.life > 0);
  for (const f of g.floats) {
    f.life -= dt;
    f.y -= 42 * dt;
  }
  g.floats = g.floats.filter((f) => f.life > 0);
  for (const t of g.tracers) t.life -= dt;
  g.tracers = g.tracers.filter((t) => t.life > 0);
  for (const s of g.smokes) {
    s.life -= dt;
    s.x += s.driftX * dt; s.y += s.driftY * dt;
    s.radius = Math.min(s.maxRadius, s.radius + 26 * dt);
  }
  g.smokes = g.smokes.filter((s) => s.life > 0);
  for (const f of g.feed) f.t += dt;
  g.feed = g.feed.filter((f) => f.t < 6);
}
