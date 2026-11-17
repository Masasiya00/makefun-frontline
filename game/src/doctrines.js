// FRONTLINE doctrines: the seven relics, picked one at a time between
// sectors. Each one changes the numbers the player fights with.
import { DOCTRINES, WEAPONS } from './config.js';

export function doctrineById(id) {
  return DOCTRINES.find((d) => d.id === id);
}

export function applyDoctrine(g, id) {
  const p = g.player;
  if (g.doctrines.includes(id)) return false;
  g.doctrines.push(id);
  if (id === 'mags') {
    p.magMul = 1.5;
    for (const w of p.weapons) {
      const base = WEAPONS[w.id];
      w.mag = Math.min(Math.round(base.mag * 1.5), w.mag + Math.round(base.mag * 0.5));
    }
  } else if (id === 'rapid') {
    p.fireMul = 1.15;
  } else if (id === 'flak') {
    p.maxArmor += 50;
    p.armor = p.maxArmor;
  } else if (id === 'radio') {
    p.commandBonus = 1;
  } else if (id === 'medic') {
    p.regen = 1.5;
  } else if (id === 'barrel') {
    p.rangeMul = 1.25;
  } else if (id === 'lucky') {
    p.critBonus = 0.12;
  }
  return true;
}
