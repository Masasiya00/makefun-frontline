// FRONTLINE sprites: every figure is drawn from canvas primitives —
// soldiers, bosses, vehicles, flags, sandbags, crates, helicopters. No
// image files, no network.
import { PALETTE, ENEMY_COLORS } from './palette.js';

// A soldier: body circle, helmet arc, gun line toward angle, team ring.
export function drawSoldier(ctx, x, y, angle, color, opts) {
  const o = opts || {};
  const r = o.radius || 13;
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  // Gun.
  ctx.strokeStyle = '#1c1c16';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * (r + 12), Math.sin(angle) * (r + 12)); ctx.stroke();
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Helmet.
  ctx.fillStyle = o.helmet || 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3, r * 0.62, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  ctx.fillStyle = '#f2ecd8';
  ctx.beginPath(); ctx.arc(Math.cos(angle) * (r - 3), Math.sin(angle) * (r - 3), 2.5, 0, Math.PI * 2); ctx.fill();
  if (o.shield) {
    ctx.strokeStyle = '#c8c8c8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, angle - 0.9, angle + 0.9);
    ctx.stroke();
  }
  if (o.hidden) {
    ctx.fillStyle = 'rgba(74, 107, 47, 0.35)';
    ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawBoss(ctx, b) {
  const color = ENEMY_COLORS.boss;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(3, 5, b.radius + 4, (b.radius + 4) * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(b.angle);
  if (b.kind === 'nighthawk') {
    // Gunship: fuselage + rotor blur + tail.
    ctx.fillStyle = '#3a3f45';
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242a';
    ctx.fillRect(-44, -4, 18, 8);
    ctx.strokeStyle = 'rgba(220,220,220,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(52, 0); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(14, 0, 7, 0, Math.PI * 2); ctx.fill();
  } else if (b.kind === 'juggernaut') {
    // Heavy tank: hull + turret + long cannon.
    ctx.fillStyle = '#4a4038';
    ctx.beginPath(); ctx.roundRect(-40, -26, 80, 52, 8); ctx.fill();
    ctx.fillStyle = '#2e2a24';
    ctx.fillRect(-42, -30, 84, 8); ctx.fillRect(-42, 22, 84, 8);
    ctx.fillStyle = '#5c5148';
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1c16'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(58, 0); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-6, 0, 6, 0, Math.PI * 2); ctx.fill();
  } else {
    // WARHOUND APC: boxy hull + ram bar + wheels.
    ctx.fillStyle = '#54503e';
    ctx.beginPath(); ctx.roundRect(-36, -22, 72, 44, 6); ctx.fill();
    ctx.fillStyle = '#3a382c';
    ctx.fillRect(-38, -26, 10, 52);
    ctx.fillStyle = '#2e2a24';
    for (const wy of [-24, 24]) {
      ctx.beginPath(); ctx.arc(-18, wy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(16, wy, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(8, 0, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Boss health bar above.
  const w = 90;
  const pct = Math.max(0, b.hp / b.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(b.x - w / 2 - 1, b.y - b.radius - 18, w + 2, 9);
  ctx.fillStyle = '#d84a35';
  ctx.fillRect(b.x - w / 2, b.y - b.radius - 17, w * pct, 7);
  ctx.fillStyle = '#f2ecd8';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(b.name, b.x, b.y - b.radius - 22);
}

export function drawVehicle(ctx, v) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, 34, 20, 0, 0, Math.PI * 2); ctx.fill();
  if (v.kind === 'jeep') {
    ctx.fillStyle = '#5c6b3a';
    ctx.beginPath(); ctx.roundRect(-30, -16, 60, 32, 6); ctx.fill();
    ctx.fillStyle = '#3a4630';
    ctx.beginPath(); ctx.roundRect(-8, -13, 22, 26, 4); ctx.fill();
    ctx.fillStyle = '#1c1c16';
    for (const [wx, wy] of [[-20, -18], [16, -18], [-20, 18], [16, 18]]) {
      ctx.beginPath(); ctx.arc(wx, wy, 6, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#7a5a2e';
    ctx.beginPath(); ctx.roundRect(-22, -6, 44, 12, 6); ctx.fill();
    ctx.fillStyle = '#1c1c16';
    ctx.beginPath(); ctx.arc(-18, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, 0, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  if (v.hp < v.maxHp) {
    const w = 56;
    const pct = Math.max(0, v.hp / v.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(v.x - w / 2, v.y - 34, w, 6);
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(v.x - w / 2, v.y - 33, w * pct, 4);
  }
  if (!v.occupied) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[E] RIDE', v.x, v.y - 40);
  }
}

export function drawFlag(ctx, x, y, friendly, wave) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#3a2e1c';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -44); ctx.stroke();
  const wob = Math.sin(wave * 3 + x * 0.05) * 3;
  ctx.fillStyle = friendly ? PALETTE.friendly : PALETTE.enemy;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.lineTo(30, -38 + wob);
  ctx.lineTo(0, -30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawSandbag(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#8a7a4d';
  ctx.beginPath(); ctx.roundRect(-16, -7, 32, 14, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawCrate(ctx, c, t) {
  const bob = Math.sin(t * 3 + c.x) * 2;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  ctx.fillStyle = '#6b5a34';
  ctx.fillRect(-15, -15, 30, 30);
  ctx.strokeStyle = '#3a2e1c';
  ctx.lineWidth = 2;
  ctx.strokeRect(-15, -15, 30, 30);
  ctx.beginPath(); ctx.moveTo(-15, -15); ctx.lineTo(15, 15); ctx.moveTo(15, -15); ctx.lineTo(-15, 15); ctx.stroke();
  ctx.fillStyle = c.kind === 'medkit' ? '#e05244' : c.kind === 'weapon' ? '#ffd75e' : '#7fce5a';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(c.kind === 'medkit' ? '+' : c.kind === 'weapon' ? 'W' : 'A', 0, 4);
  ctx.restore();
}

export function drawHeli(ctx, h) {
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(3, 5, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(h.angle);
  ctx.fillStyle = '#4a5a3a';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2e3826';
  ctx.fillRect(-46, -3, 16, 6);
  ctx.strokeStyle = 'rgba(220,220,220,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(58, 0); ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath(); ctx.arc(16, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawJet(ctx, j) {
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.rotate(j.angle);
  ctx.fillStyle = '#8a8f96';
  ctx.beginPath(); ctx.moveTo(26, 0); ctx.lineTo(-18, -12); ctx.lineTo(-12, 0); ctx.lineTo(-18, 12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-30 - j.flame, 0); ctx.lineTo(-14, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
