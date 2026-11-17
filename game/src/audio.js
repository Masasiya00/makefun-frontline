// FRONTLINE audio: every sound is synthesized with WebAudio — no audio
// files, no network. Each weapon has its own voice; the radio, rotor, jet,
// mortar whistle and explosions are all procedural. Everything is guarded:
// if the AudioContext is missing or suspended, sounds are silently skipped.
export function makeAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    windNode: null,
  };

  function ensure() {
    if (audio.ctx) return audio.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch {
      audio.ctx = null;
    }
    return audio.ctx;
  }

  function noiseBuffer(ctx, seconds) {
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function burst(dur, filterFreq, filterType, gain, decay) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, dur + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = filterType || 'lowpass';
      filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
      src.connect(filter); filter.connect(g); g.connect(audio.master);
      src.start(t); src.stop(t + dur + 0.05);
    } catch { /* audio is best-effort */ }
  }

  function tone(freq, dur, type, gain, slideTo) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(audio.master);
      osc.start(t); osc.stop(t + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  return {
    get muted() { return audio.muted; },
    unlock() { ensure(); if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); },
    toggleMute() { audio.muted = !audio.muted; return audio.muted; },

    // One distinct voice per weapon.
    shot(kind) {
      if (kind === 'pistol') { burst(0.09, 2400, 'bandpass', 0.5, 0.08); tone(320, 0.06, 'square', 0.18, 90); }
      else if (kind === 'smg') { burst(0.06, 3200, 'bandpass', 0.32, 0.05); tone(420, 0.04, 'square', 0.1, 140); }
      else if (kind === 'rifle') { burst(0.1, 1800, 'bandpass', 0.55, 0.09); tone(240, 0.07, 'sawtooth', 0.2, 70); }
      else if (kind === 'shotgun') { burst(0.22, 900, 'lowpass', 0.8, 0.2); tone(140, 0.16, 'sawtooth', 0.3, 45); }
      else if (kind === 'sniper') { burst(0.3, 3600, 'highpass', 0.5, 0.28); tone(900, 0.22, 'sine', 0.22, 120); }
    },
    reload() { tone(1200, 0.05, 'square', 0.12); setTimeout(() => tone(900, 0.05, 'square', 0.12), 90); },
    dryFire() { tone(1800, 0.03, 'square', 0.08); },
    hitmarker() { tone(2400, 0.04, 'sine', 0.14); },
    casing() { tone(3200, 0.02, 'square', 0.05); },
    explosion(big) {
      burst(big ? 0.9 : 0.5, 420, 'lowpass', big ? 1.0 : 0.7, big ? 0.85 : 0.45);
      tone(70, big ? 0.7 : 0.4, 'sine', 0.5, 28);
    },
    mortarWhistle() { tone(1400, 0.7, 'sine', 0.1, 300); },
    jetRoar() { burst(1.6, 700, 'bandpass', 0.6, 1.5); tone(180, 1.4, 'sawtooth', 0.12, 420); },
    rotor() { burst(1.4, 300, 'lowpass', 0.5, 1.3); tone(55, 1.3, 'square', 0.16, 48); },
    radioBeep() { tone(1050, 0.07, 'sine', 0.16); setTimeout(() => tone(1050, 0.07, 'sine', 0.16), 110); },
    radioStatic() { burst(0.35, 2600, 'bandpass', 0.22, 0.3); },
    smokeHiss() { burst(1.1, 5200, 'highpass', 0.3, 1.0); },
    thunk() { tone(180, 0.1, 'sine', 0.3, 70); burst(0.08, 900, 'lowpass', 0.25, 0.07); },
    captureTick() { tone(1500, 0.05, 'sine', 0.12); },
    sectorTaken() {
      tone(523, 0.14, 'square', 0.18); setTimeout(() => tone(659, 0.14, 'square', 0.18), 130);
      setTimeout(() => tone(784, 0.28, 'square', 0.2), 260);
    },
    sectorLost() { tone(392, 0.2, 'sawtooth', 0.2, 196); setTimeout(() => tone(262, 0.35, 'sawtooth', 0.2, 131), 200); },
    victory() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'square', 0.2), i * 170));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.35, 'sawtooth', 0.18), i * 200));
    },
    bossRoar() { burst(0.8, 500, 'lowpass', 0.7, 0.7); tone(90, 0.7, 'sawtooth', 0.25, 50); },
    engine() { tone(80, 0.3, 'sawtooth', 0.1, 110); },
    windStart() {
      const ctx = ensure();
      if (!ctx || audio.windNode) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx, 2);
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 400;
        const g = ctx.createGain(); g.gain.value = 0.05;
        src.connect(filter); filter.connect(g); g.connect(audio.master);
        src.start();
        audio.windNode = src;
      } catch { /* best effort */ }
    },
  };
}
