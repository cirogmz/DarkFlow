// Web Audio API Sound Synthesizer for Kitchen KDS & Dispatch Notifications

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }

  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignored: requires user gesture
    });
  }

  return sharedAudioCtx;
}

/**
 * Plays a bright dual-tone kitchen order chime (880Hz -> 1320Hz)
 * Designed to cut through ambient restaurant/kitchen background noise.
 */
export function playKitchenChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Tone 1: High harmonic ping (880 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(890, now + 0.15);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.35, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    // Tone 2: Ascending bell chime (1320 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(1335, now + 0.6);

    gain2.gain.setValueAtTime(0.001, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.9);
  } catch (e) {
    console.warn('Audio chime could not be played:', e);
  }
}

/**
 * Plays an upbeat 3-tone arpeggio (C5 -> E5 -> G5) for order dispatch / ready status
 */
export function playDispatchChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, index) => {
      const startTime = now + index * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch (e) {
    console.warn('Dispatch chime could not be played:', e);
  }
}
