// FRONTLINE main: the fixed-step loop, the world renderer, the screen
// state machine, and the playtest hooks (window.__frontline). The sim is
// pure state in state.js; this file wires the modules together and draws.
import { CONFIG, DIFFICULTY, ENEMIES } from './config.js';
import { clamp } from './random.js';
import { PALETTE, ENEMY_COLORS, skyTint } from './palette.js';
import { makeAudio } from './audio.js';
import { makeInput, consumePressed } from './input.js';
import { newGame, setRadio, setBanner, computeGrade, sectorSky } from './state.js';
import { buildMap } from './map.js';
import { updateFrontline, currentSector } from './frontline.js';
import { stepPlayer, nearestVehicle } from './player.js';
import { unlockWeapon } from './weapons.js';
import { spawnEnemy, buildSpawnQueue, spawnTick, spawnAllies, stepEnemies, stepAllies } from './enemies.js';
import { spawnBoss, stepBoss } from './bosses.js';
import { updateBullets } from './bullets.js';
import { updateVehicles } from './vehicles.js';
import { stepHeli, startSupplyHeli } from './heli.js';
import { tryCallIn, stepJet, stepBarrage } from './radio.js';
import { applyDoctrine } from './doctrines.js';
import { updateParticles } from './particles.js';
import { drawSoldier, drawBoss, drawVehicle, drawFlag, drawSandbag, drawCrate, drawHeli, drawJet } from './sprites.js';
import { drawHUD, drawBriefing, drawPause, drawDoctrine, drawVictory, drawDefeat } from './hud.js';
import { stageShot, snapshot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = CONFIG.viewW;
canvas.height = CONFIG.viewH;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1);
const shotName = params.get('shot') || '';

const audio = makeAudio();
const input = makeInput(canvas);

let g = newGame(seed, 'veteran');
g.map = buildMap(g);

export function startSector(gg) {
  const s = gg.sectors[Math.min(gg.sector, 6)];
  gg.spawnQueue = buildSpawnQueue(gg, s);
  gg.spawnTotal = gg.spawnQueue.length;
  gg.spawnT = 1.2;
  gg.trickleT = 0;
  if (s.boss) spawnBoss(gg, s.boss);
  setBanner(gg, `SECTOR ${s.n} — ${s.name}`, s.intel);
  if (gg.allies.length === 0) spawnAllies(gg);
  if (gg.supplyPending) {
    gg.supplyPending = false;
    startSupplyHeli(gg, audio);
  }
}

function deploy() {
  g.diff = DIFFICULTY[g.selectedDiff];
  g.screen = 'play';
  audio.unlock();
  audio.windStart();
  startSector(g);
}

function restart() {
  const keepSeed = g.seed;
  const keepDiff = g.selectedDiff;
  g = newGame(keepSeed, keepDiff);
  g.map = buildMap(g);
  g.screen = 'briefing';
}

function endlessContinue() {
  g.endless = true;
  g.endlessWave = 1;
  g.hqPhase = false;
  g.hq.alive = true;
  g.hq.hp = g.hq.maxHp;
  g.result = null;
  g.screen = 'play';
  g.player.hp = Math.max(60, g.player.hp);
  g.spawnQueue = endlessQueue(g, 1);
  setBanner(g, 'ENDLESS — HOLD THE HQ', 'Counter-attacks keep coming. How long can you hold?');
  setRadio(g, 'COMMAND: Endless defence authorised. Hold at all costs.');
}

function endlessQueue(gg, wave) {
  const q = [];
  const mix = {
    grunt: 10 + wave * 2, rusher: 6 + wave, grenadier: 3 + wave,
    sniper: 2 + Math.floor(wave / 2), shield: 2 + Math.floor(wave / 2),
  };
  for (const [kind, n] of Object.entries(mix)) {
    for (let i = 0; i < n; i += 1) q.push(kind);
  }
  for (let i = q.length - 1; i > 0; i -= 1) {
    const j = Math.floor(gg.rng() * (i + 1));
    const t = q[i]; q[i] = q[j]; q[j] = t;
  }
  return q;
}

function mouseWorld() {
  return { x: g.camera.x - 640 + input.mouseX, y: g.camera.y - 400 + input.mouseY };
}

function tick(gg, inp, dt) {
  const { keys: pressed, clicked } = consumePressed(inp);
  if (Object.keys(pressed).length > 0 || clicked) audio.unlock();

  if (gg.screen === 'briefing') {
    gg.time += dt;
    const order = ['recruit', 'veteran', 'legend'];
    let idx = order.indexOf(gg.selectedDiff);
    if (pressed.ArrowLeft) idx = Math.max(0, idx - 1);
    if (pressed.ArrowRight) idx = Math.min(2, idx + 1);
    gg.selectedDiff = order[idx];
    if (pressed.Enter) deploy();
    return;
  }

  if (gg.screen === 'pause') {
    if (pressed.KeyP || pressed.Escape) gg.screen = 'play';
    if (pressed.KeyR) restart();
    return;
  }

  if (gg.screen === 'doctrine') {
    const offer = gg.doctrineOffer || [];
    if (pressed.ArrowLeft) gg.doctrinePick = Math.max(0, gg.doctrinePick - 1);
    if (pressed.ArrowRight) gg.doctrinePick = Math.min(offer.length - 1, gg.doctrinePick + 1);
    let pick = -1;
    if (pressed.Enter) pick = gg.doctrinePick;
    if (pressed.Digit1) pick = 0;
    if (pressed.Digit2) pick = 1;
    if (pressed.Digit3) pick = 2;
    if (pick >= 0 && offer[pick]) {
      applyDoctrine(gg, offer[pick]);
      gg.doctrineOffer = null;
      gg.screen = 'play';
      startSector(gg);
    }
    return;
  }

  if (gg.screen === 'victory') {
    gg.time += dt;
    if (pressed.KeyR) restart();
    if (pressed.KeyE) endlessContinue();
    return;
  }

  if (gg.screen === 'defeat') {
    gg.time += dt;
    if (pressed.KeyR) restart();
    return;
  }

  // ---- play ----
  gg.time += dt;
  gg.elapsed += dt;
  if (gg.comboTimer > 0) { gg.comboTimer -= dt; if (gg.comboTimer <= 0) gg.combo = 0; }
  gg.momentum = Math.max(0, gg.momentum - CONFIG.momentumDecay * dt);
  for (const k of Object.keys(gg.callinCd)) gg.callinCd[k] = Math.max(0, gg.callinCd[k] - dt);
  if (gg.radioT > 0) gg.radioT -= dt;
  if (gg.bannerT > 0) gg.bannerT -= dt;
  if (gg.hitstop > 0) { gg.hitstop -= dt; return; }

  const mw = mouseWorld();
  // E rides/exits a vehicle when riding or near one; otherwise it is the
  // airstrike. (The player step handles the vehicle toggle itself.)
  const nearVeh = gg.player.inVehicle ? gg.player.vehicle : nearestVehicle(gg, 70);
  if (pressed.KeyQ) tryCallIn(gg, 'supply', gg.player.x, gg.player.y, audio);
  if (pressed.KeyE && !nearVeh) tryCallIn(gg, 'strike', mw.x, mw.y, audio);
  if (pressed.KeyT) tryCallIn(gg, 'mortar', mw.x, mw.y, audio);
  if (pressed.KeyF) tryCallIn(gg, 'smoke', mw.x, mw.y, audio);
  if (pressed.KeyP || pressed.Escape) { gg.screen = 'pause'; return; }

  stepPlayer(gg, inp, { keys: pressed, clicked }, dt, audio);
  stepEnemies(gg, dt, audio);
  stepAllies(gg, dt, audio);
  stepBoss(gg, dt, audio);
  updateBullets(gg, dt, audio);
  updateFrontline(gg, dt, audio);
  stepHeli(gg, dt, audio);
  stepJet(gg, dt, audio);
  stepBarrage(gg, dt, audio);
  updateVehicles(gg, dt);
  updateParticles(gg, dt);
  spawnTick(gg, dt, audio);

  // Trickle pressure: if the queue is dry and the field is thin, send more.
  if (!gg.hqPhase && gg.spawnQueue.length === 0 && !gg.endless) {
    const alive = gg.enemies.filter((e) => e.alive).length;
    const s = currentSector(gg);
    if (!s.taken && alive < 4) {
      gg.trickleT = (gg.trickleT || 0) + dt;
      if (gg.trickleT > 6) {
        gg.trickleT = 0;
        spawnEnemy(gg, gg.rng() < 0.5 ? 'grunt' : 'rusher', 200 + gg.rng() * 1200, 80 + gg.rng() * 120);
        spawnEnemy(gg, 'grunt', 200 + gg.rng() * 1200, 80 + gg.rng() * 120);
      }
    }
  }
  // Endless waves keep coming.
  if (gg.endless && gg.spawnQueue.length === 0 && gg.enemies.filter((e) => e.alive).length < 3) {
    gg.endlessWave += 1;
    gg.spawnQueue = endlessQueue(gg, gg.endlessWave);
    setBanner(gg, `COUNTER-ATTACK WAVE ${gg.endlessWave}`, 'They keep coming');
  }

  // Camera follows the player, clamped to the world.
  const p = gg.player;
  gg.camera.x = clamp(p.x, 640, 960);
  gg.camera.y = clamp(p.y, 400, 800);
  if (gg.shake > 0) gg.shake = Math.max(0, gg.shake - dt * 26);
  gg.grade = computeGrade(gg);
}

// ---------- Rendering ----------

function drawWorld(c, gg) {
  const map = gg.map;
  const camX = clamp(gg.camera.x + (Math.random() - 0.5) * gg.shake, 640, 960);
  const camY = clamp(gg.camera.y + (Math.random() - 0.5) * gg.shake, 400, 800);
  c.save();
  c.translate(-camX + 640, -camY + 400);

  // Ground.
  c.fillStyle = PALETTE.ground;
  c.fillRect(0, 0, 1600, 1200);
  c.fillStyle = PALETTE.groundDark;
  for (let i = 0; i < 40; i += 1) {
    const px = ((i * 373) % 1600); const py = ((i * 211) % 1200);
    c.fillRect(px, py, 60 + (i % 3) * 30, 40 + (i % 2) * 26);
  }
  // Friendly / enemy ground tint split by the frontline.
  c.fillStyle = 'rgba(127, 174, 78, 0.05)';
  c.fillRect(0, gg.lineY, 1600, 1200 - gg.lineY);
  c.fillStyle = 'rgba(192, 69, 58, 0.05)';
  c.fillRect(0, 0, 1600, gg.lineY);
  // Sand patches.
  for (const s of map.sand) {
    c.fillStyle = PALETTE.sand;
    c.beginPath(); c.ellipse(s.x, s.y, s.r, s.r * 0.7, 0, 0, Math.PI * 2); c.fill();
  }
  // Craters.
  for (const cr of map.craters) {
    c.fillStyle = '#2c2f22';
    c.beginPath(); c.ellipse(cr.x, cr.y, cr.r, cr.r * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.4)';
    c.stroke();
  }
  // River along the west edge + bridge.
  c.fillStyle = PALETTE.river;
  c.fillRect(0, 0, 78, 1200);
  c.fillStyle = PALETTE.riverLight;
  c.fillRect(62, 0, 6, 1200);
  c.fillStyle = '#6b5a34';
  c.fillRect(0, 560, 90, 100);
  c.strokeStyle = '#3a2e1c';
  c.lineWidth = 2;
  for (let y = 566; y < 660; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(90, y); c.stroke(); }
  // Tall grass (blade positions are a pure hash of position — the render
  // never consumes the seeded RNG, so a seed replays identically).
  for (const gr of map.grass) {
    c.fillStyle = 'rgba(74, 107, 47, 0.55)';
    c.beginPath(); c.ellipse(gr.x, gr.y, gr.r, gr.r * 0.7, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(58, 85, 37, 0.8)';
    c.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const h1 = Math.sin(gr.x * 12.9898 + i * 78.233) * 43758.5453;
      const h2 = Math.sin(gr.y * 26.651 + i * 11.135) * 12543.1234;
      const bx = gr.x + (h1 - Math.floor(h1) - 0.5) * gr.r * 1.6;
      const by = gr.y + (h2 - Math.floor(h2) - 0.5) * gr.r;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 3, by - 12); c.stroke();
    }
  }
  // Trees and rocks.
  for (const t of map.trees) {
    c.fillStyle = '#2e4a22';
    c.beginPath(); c.arc(t.x, t.y, t.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3a5c2a';
    c.beginPath(); c.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2); c.fill();
  }
  for (const r of map.rocks) {
    c.fillStyle = '#6a6a60';
    c.beginPath(); c.arc(r.x, r.y, r.r, 0, Math.PI * 2); c.fill();
  }
  // Command tent + helipad + watchtower (friendly ground).
  c.fillStyle = '#7a6a42';
  c.beginPath(); c.moveTo(map.tent.x - 46, map.tent.y + 30); c.lineTo(map.tent.x, map.tent.y - 40); c.lineTo(map.tent.x + 46, map.tent.y + 30); c.closePath(); c.fill();
  c.strokeStyle = '#3a2e1c'; c.stroke();
  c.fillStyle = '#5c5c50';
  c.beginPath(); c.arc(map.helipad.x, map.helipad.y, map.helipad.r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#ffd75e'; c.lineWidth = 3;
  c.beginPath(); c.arc(map.helipad.x, map.helipad.y, map.helipad.r - 8, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#ffd75e'; c.font = 'bold 30px monospace'; c.textAlign = 'center';
  c.fillText('H', map.helipad.x, map.helipad.y + 11);
  c.fillStyle = '#4a4038';
  c.fillRect(map.tower.x - 16, map.tower.y - 16, 32, 32);
  c.strokeStyle = '#2e2a24'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(map.tower.x - 12, map.tower.y + 16); c.lineTo(map.tower.x - 20, map.tower.y + 44); c.moveTo(map.tower.x + 12, map.tower.y + 16); c.lineTo(map.tower.x + 20, map.tower.y + 44); c.stroke();

  // Enemy HQ bunker.
  const hq = map.hq;
  c.fillStyle = '#3a3230';
  c.fillRect(hq.x - hq.w / 2, hq.y - hq.h / 2, hq.w, hq.h);
  c.strokeStyle = '#1c1c16'; c.lineWidth = 3;
  c.strokeRect(hq.x - hq.w / 2, hq.y - hq.h / 2, hq.w, hq.h);
  c.fillStyle = '#e05244';
  c.font = 'bold 16px monospace'; c.textAlign = 'center';
  c.fillText('ENEMY HQ', hq.x, hq.y + 6);
  if (gg.hqPhase && gg.hq.alive) {
    const w = 160;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(hq.x - w / 2, hq.y - hq.h / 2 - 18, w, 10);
    c.fillStyle = '#e05244';
    c.fillRect(hq.x - w / 2, hq.y - hq.h / 2 - 17, w * Math.max(0, gg.hq.hp / gg.hq.maxHp), 8);
  }
  drawFlag(c, hq.x + hq.w / 2 + 12, hq.y + hq.h / 2, false, gg.time);

  // Sector trenches + flags + capture rings.
  for (const s of gg.sectors) {
    const isCurrent = gg.sectors.indexOf(s) === gg.sector && !gg.hqPhase;
    c.fillStyle = '#2e2a20';
    c.beginPath(); c.roundRect(s.x - 110, s.y - 26, 220, 52, 10); c.fill();
    c.strokeStyle = s.taken ? PALETTE.friendly : '#8c2f28';
    c.lineWidth = 3;
    c.stroke();
    // Sandbags along the trench lip.
    for (let i = -4; i <= 4; i += 1) drawSandbag(c, s.x + i * 26, s.y - 30, 0);
    drawFlag(c, s.x + 118, s.y + 24, s.taken, gg.time);
    c.fillStyle = s.taken ? PALETTE.friendly : '#e8e2c8';
    c.font = 'bold 13px monospace'; c.textAlign = 'center';
    c.fillText(`SECTOR ${s.n} — ${s.name}`, s.x, s.y + 52);
    if (isCurrent) {
      // Capture ring.
      const pct = s.capture / 100;
      c.strokeStyle = 'rgba(255, 215, 94, 0.9)';
      c.lineWidth = 5;
      c.beginPath(); c.arc(s.x, s.y, 128, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); c.stroke();
      c.fillStyle = '#ffd75e';
      c.font = 'bold 15px monospace';
      c.fillText(`CAPTURE ${Math.floor(s.capture)}%`, s.x, s.y - 138);
      if (gg.boss && gg.boss.alive) {
        c.fillStyle = '#ff8a70';
        c.fillText('BOSS MUST FALL FIRST', s.x, s.y + 78);
      }
    }
    if (s.retake > 0) {
      c.fillStyle = '#ff6a5a';
      c.font = 'bold 14px monospace';
      c.fillText(`RETAKE ${Math.ceil(8 - s.retake)}s`, s.x, s.y - 138);
    }
  }

  // The frontline: sandbags + wire + flags across the whole map.
  c.strokeStyle = 'rgba(200, 180, 120, 0.9)';
  c.lineWidth = 2;
  c.beginPath();
  for (let x = 90; x <= 1590; x += 24) {
    const y = gg.lineY + ((x / 24) % 2 === 0 ? -5 : 5);
    if (x === 90) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  for (let x = 100; x <= 1580; x += 34) drawSandbag(c, x, gg.lineY + 8, (x % 68 === 0 ? 0.2 : -0.2));
  for (let x = 200; x <= 1500; x += 200) drawFlag(c, x, gg.lineY + 4, x % 400 === 0, gg.time);

  // Artillery barrage band.
  const b = gg.barrage;
  if (b.warnT > 0 || b.activeT > 0) {
    c.fillStyle = b.warnT > 0 ? 'rgba(224, 82, 68, 0.25)' : 'rgba(255, 122, 46, 0.35)';
    c.fillRect(80, b.y - b.h / 2, 1520, b.h);
    c.strokeStyle = '#ff2a1a';
    c.lineWidth = 3;
    c.setLineDash([14, 10]);
    c.strokeRect(80, b.y - b.h / 2, 1520, b.h);
    c.setLineDash([]);
    c.fillStyle = '#ffffff';
    c.font = 'bold 20px monospace'; c.textAlign = 'center';
    c.fillText(b.warnT > 0 ? '⚠ INCOMING ARTILLERY — CLEAR THE BAND ⚠' : 'ARTILLERY IMPACT', 800, b.y + 7);
  }

  // Smoke clouds.
  for (const s of gg.smokes) {
    c.fillStyle = 'rgba(200, 200, 188, 0.4)';
    c.beginPath(); c.arc(s.x, s.y, s.radius, 0, Math.PI * 2); c.fill();
  }
  // Crates.
  for (const cr of gg.crates) drawCrate(c, cr, gg.time);
  // Vehicles.
  for (const v of gg.vehicles) if (v.alive) drawVehicle(c, v);
  // Allies.
  for (const a of gg.allies) {
    if (!a.alive) continue;
    drawSoldier(c, a.x, a.y, a.angle, '#5a8a3a', { radius: 12, helmet: '#3a5c26' });
  }
  // Enemies.
  for (const e of gg.enemies) {
    if (!e.alive) continue;
    c.globalAlpha = e.hidden ? 0.55 : 1;
    drawSoldier(c, e.x, e.y, e.angle, ENEMY_COLORS[e.kind], { radius: e.radius, helmet: 'rgba(0,0,0,0.4)', shield: e.kind === 'shield' });
    c.globalAlpha = 1;
    if (e.hp < e.maxHp) {
      const w = 30;
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(e.x - w / 2, e.y - e.radius - 10, w, 5);
      c.fillStyle = '#e05244';
      c.fillRect(e.x - w / 2, e.y - e.radius - 9, w * Math.max(0, e.hp / e.maxHp), 3);
    }
    // Sniper telegraph.
    if (e.aimT > 0 && e.kind === 'sniper') {
      c.strokeStyle = 'rgba(255, 60, 40, 0.6)';
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(e.x, e.y); c.lineTo(gg.player.x, gg.player.y); c.stroke();
    }
  }
  // Boss.
  if (gg.boss && gg.boss.alive) drawBoss(c, gg.boss);
  // Heli + jet.
  if (gg.heli) drawHeli(c, gg.heli);
  if (gg.jet) drawJet(c, gg.jet);
  // Grenades.
  for (const gr of gg.grenades) {
    c.fillStyle = '#1c1c16';
    c.beginPath(); c.arc(gr.x, gr.y, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(gr.x, gr.y + 14, 8, 4, 0, 0, Math.PI * 2); c.fill();
  }
  // Mortar markers.
  for (const m of gg.mortars) {
    c.strokeStyle = 'rgba(255, 82, 68, 0.8)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(m.x, m.y, 16 + (1 - Math.max(0, m.t)) * 10, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(m.x - 8, m.y); c.lineTo(m.x + 8, m.y); c.moveTo(m.x, m.y - 8); c.lineTo(m.x, m.y + 8); c.stroke();
  }
  // Airstrike markers.
  for (const s of gg.strikes) {
    c.strokeStyle = 'rgba(255, 179, 71, 0.9)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(s.x, s.y, 20, 0, Math.PI * 2); c.stroke();
  }
  // Bullets.
  c.lineWidth = 2;
  for (const bl of gg.bullets) {
    c.strokeStyle = bl.tracer || '#ffd75e';
    c.beginPath();
    c.moveTo(bl.x - bl.vx * 0.02, bl.y - bl.vy * 0.02);
    c.lineTo(bl.x, bl.y);
    c.stroke();
  }
  // Tracers.
  for (const t of gg.tracers) {
    c.globalAlpha = Math.max(0, t.life / 0.07);
    c.strokeStyle = t.color;
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(t.x1, t.y1); c.lineTo(t.x2, t.y2); c.stroke();
  }
  c.globalAlpha = 1;
  // Particles.
  for (const pt of gg.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    c.globalAlpha = pt.kind === 'smoke' ? a * 0.5 : a;
    c.fillStyle = pt.color;
    c.beginPath(); c.arc(pt.x, pt.y, pt.size * (pt.kind === 'smoke' ? 1 : a), 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Casings.
  c.strokeStyle = '#d8b45a';
  c.lineWidth = 2;
  for (const cs of gg.casings) {
    c.save();
    c.translate(cs.x, cs.y);
    c.rotate(cs.angle);
    c.beginPath(); c.moveTo(-3, 0); c.lineTo(3, 0); c.stroke();
    c.restore();
  }
  // Floating damage numbers.
  c.textAlign = 'center';
  for (const f of gg.floats) {
    c.globalAlpha = Math.max(0, f.life / f.maxLife);
    c.fillStyle = f.color;
    c.font = `bold ${f.size}px monospace`;
    c.fillText(f.text, f.x, f.y);
  }
  c.globalAlpha = 1;
  // Player (on foot, or riding).
  const p = gg.player;
  if (p.alive) {
    if (p.inVehicle && p.vehicle) {
      drawSoldier(c, p.vehicle.x, p.vehicle.y - 4, p.angle, '#6b7c4a', { radius: 11, helmet: '#3a4a2a' });
    } else {
      drawSoldier(c, p.x, p.y, p.angle, '#7fae4e', { radius: 15, helmet: '#4e7a2e' });
      // Aim line, short and subtle.
      c.strokeStyle = 'rgba(255, 215, 94, 0.35)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(p.angle) * 60, p.y + Math.sin(p.angle) * 60); c.stroke();
    }
  }
  c.restore();

  // Sky tint (screen space).
  const tint = skyTint(sectorSky(gg));
  if (tint.overlay !== 'rgba(0,0,0,0)') {
    c.fillStyle = tint.overlay;
    c.fillRect(0, 0, CONFIG.viewW, CONFIG.viewH);
  }
  // Crosshair.
  if (gg.screen === 'play') {
    c.strokeStyle = '#ffd75e';
    c.lineWidth = 2;
    const mx = input.mouseX; const my = input.mouseY;
    c.beginPath();
    c.moveTo(mx - 9, my); c.lineTo(mx - 3, my);
    c.moveTo(mx + 3, my); c.lineTo(mx + 9, my);
    c.moveTo(mx, my - 9); c.lineTo(mx, my - 3);
    c.moveTo(mx, my + 3); c.lineTo(mx, my + 9);
    c.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, CONFIG.viewW, CONFIG.viewH);
  drawWorld(ctx, g);
  if (g.screen === 'play') drawHUD(ctx, g);
  else if (g.screen === 'briefing') drawBriefing(ctx, g);
  else if (g.screen === 'pause') { drawHUD(ctx, g); drawPause(ctx, g); }
  else if (g.screen === 'doctrine') { drawHUD(ctx, g); drawDoctrine(ctx, g); }
  else if (g.screen === 'victory') drawVictory(ctx, g);
  else if (g.screen === 'defeat') drawDefeat(ctx, g);
}

// ---------- Loop ----------

let last = performance.now();
let acc = 0;
let shotStaged = false;
let shotReady = false;

function frame(now) {
  const frameStart = performance.now();
  const dtReal = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dtReal;
  let n = 0;
  while (acc >= CONFIG.step && n < 5) {
    tick(g, input, CONFIG.step);
    acc -= CONFIG.step;
    n += 1;
  }
  if (n === 5) acc = 0;
  render();
  const ms = performance.now() - frameStart;
  g.frameTimes.push(ms);
  if (g.frameTimes.length > 240) g.frameTimes.shift();
  if (shotStaged && !shotReady) {
    shotReady = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function fpsStats() {
  const arr = g.frameTimes.slice(-120).sort((a, b) => a - b);
  if (arr.length === 0) return { avgMs: 0, p95Ms: 0, fps: 0, samples: 0 };
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const p95 = arr[Math.floor(arr.length * 0.95)] || arr[arr.length - 1];
  return { avgMs: +avg.toFixed(2), p95Ms: +p95.toFixed(2), fps: +(1000 / Math.max(avg, 0.01)).toFixed(1), samples: arr.length };
}

// Stage a deterministic screenshot scene, if the URL asks for one.
if (shotName) {
  stageShot(g, shotName, (gg, inp) => tick(gg, inp, CONFIG.step), input, audio);
  shotStaged = true;
  render();
  window.__shotReady = true;
}

window.__frontline = {
  get state() { return g; },
  snapshot: () => snapshot(g),
  advance(sec) {
    const n = Math.round(sec / CONFIG.step);
    for (let i = 0; i < n; i += 1) tick(g, input, CONFIG.step);
    render();
    return snapshot(g);
  },
  giveAllWeapons() {
    for (const id of ['rifle', 'shotgun', 'sniper']) unlockWeapon(g, id);
    g.player.weapons[2].reserve = 500;
    g.player.weapons[3].reserve = 200;
    g.player.weapons[4].reserve = 100;
    return snapshot(g);
  },
  fps: fpsStats,
  deploy,
  startSector: () => startSector(g),
  spawnBoss: (kind) => spawnBoss(g, kind),
  forceVictory() {
    g.result = { win: true, grade: computeGrade(g), kills: g.kills, time: g.elapsed, sector: 7, accuracy: 68 };
    g.screen = 'victory';
    return snapshot(g);
  },
  forceDefeat() {
    g.result = { win: false, grade: computeGrade(g), kills: g.kills, time: g.elapsed, sector: g.sector + 1, accuracy: 50 };
    g.screen = 'defeat';
    return snapshot(g);
  },
};

window.__shotReady = shotName ? true : false;
requestAnimationFrame(frame);
