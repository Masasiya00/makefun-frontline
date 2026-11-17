// FRONTLINE map: the battlefield is built once from the seed — trenches,
// containers as cover, tall grass, sand, the river, the command tent, the
// helipad, the watchtower and the enemy HQ bunker. Collision lives here.
import { makeRng, clamp } from './random.js';

export function buildMap(g) {
  const rng = makeRng(g.seed * 7919 + 13);
  const containers = [
    { x: 420, y: 880, w: 120, h: 46, angle: 0 },
    { x: 1180, y: 900, w: 120, h: 46, angle: 0 },
    { x: 300, y: 640, w: 46, h: 110, angle: 0 },
    { x: 1330, y: 660, w: 46, h: 110, angle: 0 },
    { x: 560, y: 480, w: 120, h: 46, angle: 0 },
    { x: 1060, y: 500, w: 120, h: 46, angle: 0 },
    { x: 700, y: 300, w: 46, h: 110, angle: 0 },
    { x: 920, y: 280, w: 120, h: 46, angle: 0 },
    { x: 480, y: 1120, w: 120, h: 46, angle: 0 },
    { x: 1240, y: 1080, w: 46, h: 110, angle: 0 },
  ];
  const grass = [];
  for (let i = 0; i < 16; i += 1) {
    grass.push({ x: 120 + rng() * 1360, y: 140 + rng() * 980, r: 55 + rng() * 70 });
  }
  const sand = [];
  for (let i = 0; i < 9; i += 1) {
    sand.push({ x: 150 + rng() * 1300, y: 150 + rng() * 950, r: 70 + rng() * 80 });
  }
  const trees = [];
  for (let i = 0; i < 14; i += 1) {
    trees.push({ x: 110 + rng() * 1380, y: 130 + rng() * 1000, r: 14 + rng() * 10 });
  }
  const rocks = [];
  for (let i = 0; i < 10; i += 1) {
    rocks.push({ x: 110 + rng() * 1380, y: 130 + rng() * 1000, r: 10 + rng() * 12 });
  }
  const craters = [];
  for (let i = 0; i < 12; i += 1) {
    craters.push({ x: 120 + rng() * 1360, y: 140 + rng() * 980, r: 22 + rng() * 26 });
  }
  return {
    containers, grass, sand, trees, rocks, craters,
    river: { x0: 0, x1: 78 },
    bridge: { y0: 560, y1: 660 },
    tent: { x: 800, y: 1130, r: 46 },
    helipad: { x: 1060, y: 1120, r: 52 },
    tower: { x: 300, y: 1060, r: 18 },
    hq: { x: 800, y: 92, w: 200, h: 70 },
  };
}

// True when a circle at (x, y, r) is blocked by solid map geometry.
export function isBlocked(map, x, y, r) {
  // River along the west edge, except on the bridge.
  if (x - r < map.river.x1 && !(y > map.bridge.y0 && y < map.bridge.y1)) return true;
  if (x - r < 8 || x + r > 1592 || y - r < 8 || y + r > 1192) return true;
  for (const c of map.containers) {
    if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(y - c.y) < c.h / 2 + r) return true;
  }
  // HQ bunker is solid.
  if (Math.abs(x - map.hq.x) < map.hq.w / 2 + r && Math.abs(y - map.hq.y) < map.hq.h / 2 + r) return true;
  if (Math.hypot(x - map.tent.x, y - map.tent.y) < map.tent.r + r - 6) return true;
  return false;
}

// Resolve a circle against solid geometry by axis: returns the corrected
// position. Containers thunk when hit hard (handled by the caller).
export function collideCircle(map, x, y, r, vx, vy) {
  let nx = x + vx;
  let ny = y + vy;
  if (isBlocked(map, nx, y, r)) nx = x;
  if (isBlocked(map, nx, ny, r)) ny = y;
  if (isBlocked(map, nx, ny, r)) { nx = x; ny = y; }
  return { x: clamp(nx, 12, 1588), y: clamp(ny, 12, 1188) };
}

export function inGrass(map, x, y) {
  for (const gr of map.grass) {
    if ((x - gr.x) ** 2 + (y - gr.y) ** 2 < gr.r * gr.r) return true;
  }
  return false;
}

export function inSand(map, x, y) {
  for (const s of map.sand) {
    if ((x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r) return true;
  }
  return false;
}

// Does the segment (x1,y1)-(x2,y2) cross a container? Bullets stop there.
export function segmentHitsContainer(map, x1, y1, x2, y2) {
  for (const c of map.containers) {
    if (segmentRect(x1, y1, x2, y2, c.x - c.w / 2, c.y - c.h / 2, c.w, c.h)) return c;
  }
  if (segmentRect(x1, y1, x2, y2, map.hq.x - map.hq.w / 2, map.hq.y - map.hq.h / 2, map.hq.w, map.hq.h)) return map.hq;
  return null;
}

function segmentRect(x1, y1, x2, y2, rx, ry, rw, rh) {
  // Liang-Barsky clip of the segment against the rect.
  let t0 = 0; let t1 = 1;
  const dx = x2 - x1; const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
