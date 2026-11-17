// FRONTLINE HUD: the top-10 layout — top bar (sector + boss + score +
// momentum), WIN/LOSE pills, INCOMING panel left, boss + doctrines +
// support panel right, bottom weapon/ammo/HP bar with call-in keys, combo
// and grade, minimap bottom-right. Plus the briefing, pause, doctrine,
// victory and defeat screens.
import { CONFIG, WEAPONS, WEAPON_ORDER, CALLINS, DOCTRINES, DIFFICULTY } from './config.js';
import { PALETTE, skyTint } from './palette.js';
import { fmtTime } from './random.js';
import { doctrineById } from './doctrines.js';
import { currentSector } from './frontline.js';

const FONT = 'monospace';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function bar(ctx, x, y, w, h, pct, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, pct)), h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHUD(ctx, g) {
  const W = CONFIG.viewW; const H = CONFIG.viewH;
  const p = g.player;
  ctx.textBaseline = 'alphabetic';

  // ---- Top bar: sector, boss, score, momentum, time.
  panel(ctx, 0, 0, W, 46);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'left';
  const s = currentSector(g);
  ctx.fillText(g.hqPhase ? 'SECTOR 7/7 — HQ ASSAULT' : `SECTOR ${s.n}/7 — ${s.name}`, 14, 30);
  ctx.textAlign = 'center';
  ctx.fillStyle = g.boss && g.boss.alive ? '#ff8a70' : PALETTE.amber;
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(g.boss && g.boss.alive ? `⚠ ${g.boss.name} — ${Math.ceil(g.boss.hp)}/${g.boss.maxHp} HP` : 'FRONTLINE', W / 2, 29);
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 19px ${FONT}`;
  ctx.fillText(`SCORE ${g.score.toLocaleString()}   ◆ ${Math.floor(g.momentum)} MOMENTUM   ${fmtTime(g.elapsed)}`, W - 14, 30);

  // ---- WIN / LOSE pills, directly below the top bar.
  const winText = g.hqPhase
    ? 'WIN: destroy the HQ bunker'
    : `WIN: take all 7 sectors & break the HQ (${g.sectors.filter((x) => x.taken).length}/7)`;
  const loseText = g.lineIntegrity <= 25
    ? 'LOSE: line collapsing — integrity critical'
    : 'LOSE: line collapses to HQ / squad leader falls';
  ctx.font = `bold 13px ${FONT}`;
  const winW = ctx.measureText(winText).width + 24;
  const loseW = ctx.measureText(loseText).width + 24;
  ctx.fillStyle = 'rgba(30, 90, 30, 0.85)';
  ctx.fillRect(14, 52, winW, 24);
  ctx.fillStyle = '#c8f0a8';
  ctx.textAlign = 'left';
  ctx.fillText(winText, 26, 69);
  ctx.fillStyle = 'rgba(140, 30, 25, 0.85)';
  ctx.fillRect(W - 14 - loseW, 52, loseW, 24);
  ctx.fillStyle = '#ffd0c8';
  ctx.fillText(loseText, W - 2 - loseW, 69);

  // ---- Left panel: INCOMING queue + next spawn.
  const incoming = {};
  for (const k of g.spawnQueue) incoming[k] = (incoming[k] || 0) + 1;
  const aliveCount = g.enemies.filter((e) => e.alive).length;
  panel(ctx, 14, 88, 210, 150);
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('INCOMING', 24, 108);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `13px ${FONT}`;
  let iy = 128;
  const kinds = Object.keys(incoming);
  if (kinds.length === 0 && aliveCount === 0) ctx.fillText('— sector clear —', 24, iy);
  for (const k of kinds.slice(0, 5)) {
    ctx.fillText(`${k.toUpperCase()} × ${incoming[k]}`, 24, iy);
    iy += 17;
  }
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText(`ON FIELD: ${aliveCount}`, 24, 214);
  ctx.fillText(g.spawnQueue.length > 0 ? `NEXT WAVE: ${Math.max(0, g.spawnT).toFixed(1)}s` : 'NO REINFORCEMENTS', 24, 232);

  // ---- Right panel: boss bar + doctrines + support.
  panel(ctx, W - 224, 88, 210, 248);
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(g.boss && g.boss.alive ? `${g.boss.name} — PHASE ${g.boss.phase}` : 'BOSS: NONE ON FIELD', W - 214, 108);
  if (g.boss && g.boss.alive) {
    bar(ctx, W - 214, 116, 190, 10, g.boss.hp / g.boss.maxHp, '#d84a35');
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`${Math.ceil(g.boss.hp)} / ${g.boss.maxHp} HP`, W - 214, 142);
  } else {
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `11px ${FONT}`;
    ctx.fillText('Next boss: sector 3 / 5 / 7', W - 214, 130);
  }
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('DOCTRINES', W - 214, 166);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `12px ${FONT}`;
  if (g.doctrines.length === 0) ctx.fillText('— none yet —', W - 214, 184);
  g.doctrines.slice(0, 3).forEach((id, i) => {
    ctx.fillText(`• ${doctrineById(id).name}`, W - 214, 184 + i * 16);
  });
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('SUPPORT', W - 214, 258);
  ctx.font = `11px ${FONT}`;
  const calls = [['supply', 'Q'], ['strike', 'E'], ['mortar', 'T'], ['smoke', 'F']];
  calls.forEach(([kind, key], i) => {
    const c = CALLINS[kind];
    const cd = g.callinCd[kind];
    const afford = g.momentum >= c.cost;
    ctx.fillStyle = cd > 0 ? PALETTE.hudDim : afford ? PALETTE.hudText : '#c07060';
    ctx.fillText(`[${key}] ${c.name} ${c.cost}◆${cd > 0 ? ` ${cd.toFixed(0)}s` : ''}`, W - 214, 276 + i * 15);
  });

  // ---- Kill feed (top-right, under the right panel).
  ctx.textAlign = 'left';
  ctx.font = `12px ${FONT}`;
  g.feed.forEach((f, i) => {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 6);
    ctx.fillStyle = '#e8e2c8';
    ctx.fillText(f.text, W - 224, 352 + i * 17);
  });
  ctx.globalAlpha = 1;

  // ---- Bottom bar: weapons, HP, armor, call-ins, combo, grade.
  panel(ctx, 0, H - 64, W, 64);
  let wx = 14;
  const SHORT = { pistol: ['M9', 'PISTOL'], smg: ['MP5', 'SMG'], rifle: ['M4', 'RIFLE'], shotgun: ['M870', 'SHOTGUN'], sniper: ['M24', 'SNIPER'] };
  WEAPON_ORDER.forEach((id, i) => {
    const w = p.weapons[i];
    const unlocked = w.unlocked;
    const cur = p.cur === i;
    const bw = 104;
    ctx.fillStyle = cur ? 'rgba(255, 179, 71, 0.25)' : 'rgba(0,0,0,0.4)';
    ctx.fillRect(wx, H - 54, bw, 44);
    ctx.strokeStyle = cur ? PALETTE.amber : '#555';
    ctx.strokeRect(wx + 0.5, H - 53.5, bw - 1, 43);
    ctx.fillStyle = unlocked ? (cur ? PALETTE.gold : PALETTE.hudText) : '#666';
    ctx.textAlign = 'left';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(`[${i + 1}] ${SHORT[id][0]}`, wx + 6, H - 36);
    ctx.font = `10px ${FONT}`;
    if (unlocked) {
      const st = w;
      const magTxt = id === 'pistol' ? `${st.mag} / ∞` : `${st.mag} / ${st.reserve === Infinity ? '∞' : st.reserve}`;
      ctx.fillStyle = st.mag === 0 ? '#ff6a5a' : PALETTE.hudDim;
      ctx.fillText(p.reloadT > 0 && cur ? 'RELOADING…' : `${SHORT[id][1]} ${magTxt}`, wx + 6, H - 20);
    } else {
      ctx.fillStyle = '#666';
      ctx.fillText('— LOCKED —', wx + 6, H - 20);
    }
    wx += bw + 6;
  });
  // HP + armor.
  const hx = wx + 6;
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, hx, H - 38);
  bar(ctx, hx, H - 32, 120, 10, p.hp / p.maxHp, '#7fce5a');
  ctx.fillText(`ARMOR ${Math.ceil(p.armor)}`, hx, H - 14);
  bar(ctx, hx + 72, H - 20, 56, 8, p.armor / p.maxArmor, '#7ab8ff');
  // Combo + grade.
  ctx.textAlign = 'right';
  ctx.fillStyle = g.combo >= 5 ? PALETTE.gold : PALETTE.hudText;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(g.combo > 1 ? `COMBO ×${g.combo}` : 'COMBO ×1', W - 200, H - 32);
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`GRADE ${g.grade}`, W - 200, H - 14);

  // ---- Radio order line.
  if (g.radioT > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(16,20,12,0.85)';
    const tw = ctx.measureText(g.radioText).width + 30;
    ctx.fillRect(W / 2 - tw / 2, H - 96, tw, 24);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`📻 ${g.radioText}`, W / 2, H - 79);
  }

  // ---- Center banner.
  if (g.bannerT > 0) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, g.bannerT);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(g.banner, W / 2, 300);
    if (g.bannerSub) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `16px ${FONT}`;
      ctx.fillText(g.bannerSub, W / 2, 328);
    }
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, g);
}

function drawMinimap(ctx, g) {
  const mw = 190; const mh = 142;
  const x0 = CONFIG.viewW - mw - 14; const y0 = CONFIG.viewH - 64 - mh - 10;
  const sx = mw / CONFIG.mapW; const sy = mh / CONFIG.mapH;
  panel(ctx, x0 - 4, y0 - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#2c3624';
  ctx.fillRect(x0, y0, mw, mh);
  // Sectors.
  for (const s of g.sectors) {
    ctx.fillStyle = s.taken ? PALETTE.friendly : '#c0453a';
    ctx.beginPath(); ctx.arc(x0 + s.x * sx, y0 + s.y * sy, s.taken ? 5 : 4, 0, Math.PI * 2); ctx.fill();
  }
  // HQ.
  ctx.fillStyle = '#e05244';
  ctx.fillRect(x0 + 800 * sx - 5, y0 + 92 * sy - 4, 10, 8);
  // Frontline.
  ctx.strokeStyle = '#ffd75e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y0 + g.lineY * sy); ctx.lineTo(x0 + mw, y0 + g.lineY * sy); ctx.stroke();
  // Enemies (red dots), allies (green), player (white), boss (big red).
  ctx.fillStyle = '#ff6a5a';
  for (const e of g.enemies) {
    if (!e.alive) continue;
    ctx.fillRect(x0 + e.x * sx - 1, y0 + e.y * sy - 1, 3, 3);
  }
  ctx.fillStyle = '#7fce5a';
  for (const a of g.allies) {
    if (!a.alive) continue;
    ctx.fillRect(x0 + a.x * sx - 1, y0 + a.y * sy - 1, 3, 3);
  }
  if (g.boss && g.boss.alive) {
    ctx.fillStyle = '#ff2a1a';
    ctx.beginPath(); ctx.arc(x0 + g.boss.x * sx, y0 + g.boss.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x0 + g.player.x * sx, y0 + g.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('MAP — FRONTLINE', x0, y0 - 10);
}

// ---------- Screens ----------

function dim(ctx) {
  ctx.fillStyle = 'rgba(10, 14, 8, 0.72)';
  ctx.fillRect(0, 0, CONFIG.viewW, CONFIG.viewH);
}

function title(ctx, text, y, size, color) {
  ctx.textAlign = 'center';
  ctx.fillStyle = color || PALETTE.gold;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.fillText(text, CONFIG.viewW / 2, y);
}

export function drawBriefing(ctx, g) {
  dim(ctx);
  title(ctx, 'FRONTLINE', 130, 64);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PUSH THE LINE THROUGH SEVEN SECTORS AND BREAK THE ENEMY HQ', CONFIG.viewW / 2, 168);
  ctx.fillStyle = PALETTE.amber;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText('— OPERATION BRIEFING —', CONFIG.viewW / 2, 200);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `14px ${FONT}`;
  const lines = [
    'You are a squad leader on a living battlefield. The frontline is a real line —',
    'sandbags, wire and flags — and it MOVES. Capture a sector trench to push it',
    'forward. Lose a sector to a counter-attack and it falls back.',
    '',
    'Kills earn MOMENTUM: it speeds every capture and buys radio call-ins.',
    'Allied squads fight beside you. Bosses guard sectors 3, 5 and 7.',
    'Artillery sweeps the map on a timer — clear the marked band or die.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, CONFIG.viewW / 2, 228 + i * 20));
  // Difficulty select.
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillStyle = PALETTE.amber;
  ctx.fillText('SELECT DIFFICULTY  ( ← → )', CONFIG.viewW / 2, 400);
  const keys = ['recruit', 'veteran', 'legend'];
  keys.forEach((k, i) => {
    const d = DIFFICULTY[k];
    const x = CONFIG.viewW / 2 + (i - 1) * 260;
    const sel = g.selectedDiff === k;
    ctx.fillStyle = sel ? 'rgba(255,179,71,0.22)' : 'rgba(0,0,0,0.4)';
    ctx.fillRect(x - 115, 420, 230, 64);
    ctx.strokeStyle = sel ? PALETTE.amber : '#555';
    ctx.strokeRect(x - 115, 420, 230, 64);
    ctx.fillStyle = sel ? PALETTE.gold : PALETTE.hudText;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(d.label, x, 446);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `11px ${FONT}`;
    ctx.fillText(d.desc, x, 468);
  });
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `14px ${FONT}`;
  ctx.fillText('WASD move · Mouse aim · Hold click fire · 1-5 weapons · R reload · Shift sprint', CONFIG.viewW / 2, 522);
  ctx.fillText('Q supply drop · E airstrike (E near a vehicle = ride it) · T mortar · F smoke', CONFIG.viewW / 2, 546);
  ctx.fillText('P pause · M mute · Capture the trench zone to advance the line', CONFIG.viewW / 2, 570);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText(g.time % 1 < 0.6 ? '▶ PRESS ENTER TO DEPLOY ◀' : 'PRESS ENTER TO DEPLOY', CONFIG.viewW / 2, 640);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = `12px ${FONT}`;
  ctx.fillText('7 sectors · 3 bosses · 5 weapons · 7 doctrines · endless after the HQ falls', CONFIG.viewW / 2, 676);
}

export function drawPause(ctx, g) {
  dim(ctx);
  title(ctx, 'PAUSED', 300, 48);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`SECTOR ${g.sector + 1}/7 · SCORE ${g.score.toLocaleString()} · KILLS ${g.kills}`, CONFIG.viewW / 2, 350);
  ctx.fillText('P / ESC — resume · R — restart the campaign', CONFIG.viewW / 2, 386);
}

export function drawDoctrine(ctx, g) {
  dim(ctx);
  title(ctx, `SECTOR ${g.sector} TAKEN`, 150, 40, PALETTE.green);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Command authorises a new doctrine. Pick one — the line waits for no one.', CONFIG.viewW / 2, 190);
  const offer = g.doctrineOffer || [];
  offer.forEach((id, i) => {
    const d = doctrineById(id);
    const x = CONFIG.viewW / 2 + (i - 1) * 300;
    const sel = g.doctrinePick === i;
    ctx.fillStyle = sel ? 'rgba(255,179,71,0.25)' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(x - 135, 230, 270, 130);
    ctx.strokeStyle = sel ? PALETTE.amber : '#555';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 135, 230, 270, 130);
    ctx.fillStyle = sel ? PALETTE.gold : PALETTE.hudText;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(d.name, x, 272);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `13px ${FONT}`;
    const words = d.desc.split(' ');
    let line = '';
    let ly = 300;
    for (const w of words) {
      if ((line + ' ' + w).length > 26) { ctx.fillText(line, x, ly); ly += 18; line = w; }
      else line = line ? line + ' ' + w : w;
    }
    ctx.fillText(line, x, ly);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`[${i + 1}]`, x, 340);
  });
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillText('← → choose · ENTER confirm · or press 1 / 2 / 3', CONFIG.viewW / 2, 420);
}

export function drawVictory(ctx, g) {
  dim(ctx);
  title(ctx, 'LINE BROKEN THROUGH', 170, 52, PALETTE.green);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('All seven sectors taken. The enemy HQ is rubble. The frontline is yours.', CONFIG.viewW / 2, 216);
  const r = g.result || { kills: 0, time: 0, accuracy: 0, grade: 'S' };
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`GRADE ${r.grade}`, CONFIG.viewW / 2, 280);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `17px ${FONT}`;
  const rows = [
    `KILLS  ${r.kills}`,
    `TIME  ${fmtTime(r.time)}`,
    `ACCURACY  ${r.accuracy}%`,
    `SCORE  ${g.score.toLocaleString()}`,
    `BEST COMBO  ×${g.bestCombo}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, CONFIG.viewW / 2, 326 + i * 30));
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 19px ${FONT}`;
  ctx.fillText(g.time % 1 < 0.6 ? '▶ R — PLAY AGAIN · E — ENDLESS MODE ◀' : 'R — PLAY AGAIN · E — ENDLESS MODE', CONFIG.viewW / 2, 520);
}

export function drawDefeat(ctx, g) {
  dim(ctx);
  title(ctx, 'LINE COLLAPSED', 170, 52, PALETTE.red);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('The frontline fell back to your HQ. The sector is lost — for now.', CONFIG.viewW / 2, 216);
  const r = g.result || { kills: 0, time: 0, accuracy: 0, grade: 'C', sector: 1 };
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.fillText(`GRADE ${r.grade}`, CONFIG.viewW / 2, 280);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `17px ${FONT}`;
  const rows = [
    `SECTOR REACHED  ${r.sector}/7`,
    `KILLS  ${r.kills}`,
    `TIME  ${fmtTime(r.time)}`,
    `ACCURACY  ${r.accuracy}%`,
    `SCORE  ${g.score.toLocaleString()}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, CONFIG.viewW / 2, 326 + i * 30));
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `bold 19px ${FONT}`;
  ctx.fillText(g.time % 1 < 0.6 ? '▶ R — TRY AGAIN ◀' : 'R — TRY AGAIN', CONFIG.viewW / 2, 520);
}
