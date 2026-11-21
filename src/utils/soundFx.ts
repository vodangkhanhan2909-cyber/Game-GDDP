let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playTone(freq: number, durationSec: number, type: OscillatorType = 'sine', gainLevel = 0.08): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSec + 0.02);
}

export function playTickFx(): void {
  playTone(740, 0.07, 'triangle', 0.05);
}

export function playRevealFx(): void {
  playTone(523.25, 0.14, 'sine', 0.08);
  setTimeout(() => playTone(659.25, 0.22, 'sine', 0.08), 90);
}

export function playVictoryFx(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, idx) => {
    setTimeout(() => playTone(n, 0.35, 'triangle', 0.09), idx * 110);
  });
}
