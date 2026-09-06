"use client";
let ctx: AudioContext | null = null;

function tone(freq: number, dur = 0.18, type: OscillatorType = "sine", when = 0) {
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime + when;
    o.start(t);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.stop(t + dur);
  } catch {}
}

export const cueSuccess = () => { tone(880, 0.15); tone(1320, 0.2, "sine", 0.12); };
export const cueError = () => { tone(220, 0.3, "sawtooth"); tone(180, 0.3, "sawtooth", 0.15); };
export const cueScrapAlert = () => { tone(1200, 0.12, "square"); tone(1200, 0.12, "square", 0.18); tone(1200, 0.25, "square", 0.36); };
export const cueScan = () => tone(660, 0.1);
