import type * as ToneNs from 'tone';

export class AmbientAudio {
  private started = false;

  private tone: typeof ToneNs | null = null;

  private synth: ToneNs.PolySynth | null = null;

  private filter: ToneNs.Filter | null = null;

  private gain: ToneNs.Gain | null = null;

  private currentNote = 'C4';

  async ensureStarted(): Promise<void> {
    if (this.started) return;
    try {
      const Tone = await import('tone');
      await Tone.start();

      this.tone = Tone;
      this.filter = new Tone.Filter(1800, 'lowpass').toDestination();
      this.gain = new Tone.Gain(0.08).connect(this.filter);
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.8, release: 1.8 },
      }).connect(this.gain);
      this.synth.triggerAttack(this.currentNote);
      this.started = true;
    } catch (error) {
      console.warn('Ambient audio init failed', error);
    }
  }

  update(overall: number, stress: number): void {
    if (!this.started || !this.tone || !this.synth || !this.filter || !this.gain) return;
    const notes = ['A3', 'B3', 'C4', 'D4', 'E4'];
    const index = Math.max(0, Math.min(notes.length - 1, Math.floor((overall / 100) * notes.length)));
    const nextNote = notes[index];
    if (nextNote !== this.currentNote) {
      this.synth.triggerRelease(this.currentNote);
      this.synth.triggerAttack(nextNote);
      this.currentNote = nextNote;
    }

    const cutoff = 800 + overall * 22;
    const gain = 0.03 + (100 - stress) * 0.0008;
    this.filter.frequency.rampTo(cutoff, 0.8);
    this.gain.gain.rampTo(gain, 0.8);
  }

  stop(): void {
    if (!this.started || !this.synth || !this.tone) return;
    this.synth.triggerRelease(this.currentNote);
    this.synth.dispose();
    this.filter?.dispose();
    this.gain?.dispose();
    this.started = false;
  }
}

export const ambientAudio = new AmbientAudio();
