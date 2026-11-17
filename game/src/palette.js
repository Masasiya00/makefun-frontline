// FRONTLINE palette: military olive / khaki / amber on a stencil-mono HUD.
// One place owns every colour so the art direction stays coherent.
export const PALETTE = {
  bg: '#232a1e',
  ground: '#3d4a2f',
  groundDark: '#33402a',
  sand: '#8a7a4d',
  sandDark: '#6f6239',
  grass: '#4a6b2f',
  grassDark: '#3a5525',
  river: '#2e4a5e',
  riverLight: '#3d637f',
  friendly: '#7fae4e',
  friendlyDark: '#4e7a2e',
  enemy: '#c0453a',
  enemyDark: '#8c2f28',
  khaki: '#cbb98a',
  amber: '#ffb347',
  gold: '#ffd75e',
  olive: '#6b7c4a',
  smoke: '#9aa08e',
  hudBg: 'rgba(16, 20, 12, 0.82)',
  hudLine: '#8a9a6a',
  hudText: '#e8e2c8',
  hudDim: '#a8a888',
  red: '#e05244',
  green: '#7fce5a',
  white: '#f2ecd8',
  black: '#10140c',
  tracer: '#ffd75e',
  boss: '#d84a35',
};

export const ENEMY_COLORS = {
  grunt: '#c0453a',
  rusher: '#e07a2e',
  grenadier: '#a04ac0',
  sniper: '#3a7ac0',
  shield: '#7a7a8a',
  boss: '#d84a35',
};

// Sky tint per sector phase: day -> dusk -> night, with flares at night.
export function skyTint(sky) {
  if (sky === 'dusk') return { overlay: 'rgba(64, 32, 48, 0.18)', dark: 0.12 };
  if (sky === 'night') return { overlay: 'rgba(8, 12, 32, 0.34)', dark: 0.3 };
  return { overlay: 'rgba(0,0,0,0)', dark: 0 };
}
