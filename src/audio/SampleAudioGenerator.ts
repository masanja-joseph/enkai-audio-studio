/**
 * Procedural Audio Synthesizer for Demo & Film Dubbing Stems
 * Generates real, rich PCM AudioBuffers without external network requests.
 */

export function createCinematicDialogueBuffer(ctx: AudioContext, duration: number = 8.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, numSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Synthesize realistic speech formant rhythm (speech envelope + vowel resonances)
  // Dialogue: "Warning: primary thrusters offline... initiate manual backup."
  const words = [
    { start: 0.5, dur: 0.8, pitch: 140, vowelF1: 700, vowelF2: 1200 }, // "War-ning"
    { start: 1.6, dur: 0.7, pitch: 155, vowelF1: 400, vowelF2: 2000 }, // "pri-ma-ry"
    { start: 2.5, dur: 0.9, pitch: 130, vowelF1: 300, vowelF2: 900 },  // "thrus-ters"
    { start: 3.6, dur: 0.8, pitch: 120, vowelF1: 500, vowelF2: 1800 }, // "off-line"
    { start: 5.0, dur: 0.7, pitch: 145, vowelF1: 350, vowelF2: 2200 }, // "in-i-ti-ate"
    { start: 5.9, dur: 0.6, pitch: 135, vowelF1: 600, vowelF2: 1100 }, // "man-u-al"
    { start: 6.7, dur: 0.9, pitch: 115, vowelF1: 300, vowelF2: 800 },  // "back-up"
  ];

  for (const word of words) {
    const startSample = Math.floor(word.start * sampleRate);
    const wordSamples = Math.floor(word.dur * sampleRate);

    for (let i = 0; i < wordSamples; i++) {
      const idx = startSample + i;
      if (idx >= numSamples) break;

      const t = i / sampleRate;
      const progress = i / wordSamples;
      // Speech envelope (smooth attack & release per syllable)
      const env = Math.sin(progress * Math.PI) * Math.sin(progress * Math.PI * 3);
      const cleanEnv = Math.max(0, env);

      // Glottal pulse approximation with vibrato
      const f0 = word.pitch * (1 + 0.03 * Math.sin(2 * Math.PI * 5 * t));
      const phase = 2 * Math.PI * f0 * t;
      let pulse = Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase);

      // Formants (throat & mouth cavity resonance)
      const f1 = word.vowelF1;
      const f2 = word.vowelF2;
      const formant1 = Math.sin(2 * Math.PI * f1 * t) * 0.4;
      const formant2 = Math.sin(2 * Math.PI * f2 * t) * 0.3;

      // Soft breath noise
      const breath = (Math.random() * 2 - 1) * 0.04;

      data[idx] += (pulse * 0.5 + formant1 + formant2 + breath) * cleanEnv * 0.45;
    }
  }

  return buffer;
}

export function createCinematicScoreBuffer(ctx: AudioContext, duration: number = 10.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Minor cinematic chord progression: C minor -> Ab major -> Eb major -> Bb major
  // Frequencies (Hz)
  const chords = [
    { start: 0.0, dur: 2.5, freqs: [130.81, 155.56, 196.0, 261.63] }, // C3, Eb3, G3, C4
    { start: 2.5, dur: 2.5, freqs: [103.83, 130.81, 155.56, 207.65] }, // Ab2, C3, Eb3, Ab3
    { start: 5.0, dur: 2.5, freqs: [155.56, 196.0, 233.08, 311.13] }, // Eb3, G3, Bb3, Eb4
    { start: 7.5, dur: 2.5, freqs: [116.54, 146.83, 174.61, 233.08] }, // Bb2, D3, F3, Bb3
  ];

  for (const chord of chords) {
    const startSample = Math.floor(chord.start * sampleRate);
    const chordSamples = Math.floor(chord.dur * sampleRate);

    for (let i = 0; i < chordSamples; i++) {
      const idx = startSample + i;
      if (idx >= numSamples) break;

      const t = i / sampleRate;
      const progress = i / chordSamples;
      // Lush slow attack and smooth crossfade envelope
      const env = Math.sin(progress * Math.PI);

      let lVal = 0;
      let rVal = 0;

      for (let f = 0; f < chord.freqs.length; f++) {
        const freq = chord.freqs[f];
        // Detuned stereo saws and sines
        const s1 = Math.sin(2 * Math.PI * freq * t);
        const s2 = Math.sin(2 * Math.PI * (freq * 1.004) * t);
        const s3 = Math.sin(2 * Math.PI * (freq * 0.996) * t);

        lVal += (s1 * 0.5 + s2 * 0.3) * 0.08;
        rVal += (s1 * 0.5 + s3 * 0.3) * 0.08;
      }

      left[idx] += lVal * env;
      right[idx] += rVal * env;
    }
  }

  return buffer;
}

export function createFilmAmbienceBuffer(ctx: AudioContext, duration: number = 10.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Sub-bass rumble (spaceship engine interior / moody warehouse room tone)
  let lastL = 0;
  let lastR = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Low rumble oscillator (38 Hz + 55 Hz)
    const rumble = Math.sin(2 * Math.PI * 38 * t) * 0.12 + Math.sin(2 * Math.PI * 55 * t) * 0.08;

    // Pink-noise / low-pass filtered air noise
    const whiteL = (Math.random() * 2 - 1) * 0.05;
    const whiteR = (Math.random() * 2 - 1) * 0.05;
    lastL = lastL * 0.96 + whiteL * 0.04;
    lastR = lastR * 0.96 + whiteR * 0.04;

    left[i] = rumble + lastL;
    right[i] = rumble + lastR;
  }

  return buffer;
}

export function createSoundEffectsBuffer(ctx: AudioContext, duration: number = 3.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // High-impact cinematic boom / laser telemetry beep
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (t < 1.8) {
      // Sub-bass pitch drop (from 180Hz down to 35Hz)
      const freq = Math.max(35, 180 * Math.exp(-t * 3));
      const phase = 2 * Math.PI * freq * t;
      const boomEnv = Math.exp(-t * 2.5);
      const impact = Math.sin(phase) * boomEnv * 0.4;

      // Stereo sweep noise
      const sweepNoise = (Math.random() * 2 - 1) * Math.exp(-t * 8) * 0.2;

      left[i] = impact + sweepNoise;
      right[i] = impact - sweepNoise;
    }
  }

  return buffer;
}
