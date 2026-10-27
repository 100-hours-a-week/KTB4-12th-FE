export function createRouletteSound() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = true;

  function updateGain() {
    if (master && context)
      master.gain.setValueAtTime(enabled && !document.hidden ? 1 : 0, context.currentTime);
  }
  function unlock() {
    try {
      const Context =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return false;
      if (!context) {
        context = new Context();
        master = context.createGain();
        master.connect(context.destination);
      }
      updateGain();
      if (context.state === 'suspended') void context.resume().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
  function tone(frequency: number, duration: number, delay = 0, volume = 0.045) {
    if (!enabled || document.hidden || context?.state !== 'running' || !master) return;
    try {
      const at = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.01);
    } catch {
      // Audio support must not prevent completing the visual draw.
    }
  }
  return {
    unlock,
    updateGain,
    setEnabled(value: boolean) {
      enabled = value;
      updateGain();
    },
    tick() {
      tone(1400, 0.028);
    },
    win() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, i) =>
        tone(frequency, 0.18, i * 0.11, 0.055),
      );
    },
    dispose() {
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      context = null;
      master = null;
    },
  };
}
