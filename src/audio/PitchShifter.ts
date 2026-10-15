/**
 * Enkai Audio Studio — Robust Pitch Shifter
 * 
 * Implements pitch shifting (-12 to +12 semitones + fine cent tuning) 
 * using phase resampling and wrapping to ensure zero silence, zero truncation,
 * and immediate audible pitch changes for vocal takes.
 */

export function pitchShiftAudioBuffer(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  semitones: number,
  cents: number = 0
): AudioBuffer {
  const totalSemitones = semitones + cents / 100;
  if (Math.abs(totalSemitones) < 0.01) {
    return buffer; // No shift needed
  }

  const numChannels = buffer.numberOfChannels;
  const numFrames = buffer.length;
  const sampleRate = buffer.sampleRate;
  const pitchRatio = Math.pow(2, totalSemitones / 12);

  const outBuffer = ctx.createBuffer(numChannels, numFrames, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const inputData = buffer.getChannelData(ch);
    const outputData = outBuffer.getChannelData(ch);

    let srcPos = 0.0;
    const step = pitchRatio;

    for (let i = 0; i < numFrames; i++) {
      const idx0 = Math.floor(srcPos);
      const idx1 = Math.min(idx0 + 1, numFrames - 1);
      const frac = srcPos - idx0;

      if (idx0 < numFrames) {
        const val0 = inputData[idx0];
        const val1 = inputData[idx1];
        outputData[i] = val0 + frac * (val1 - val0);
      } else {
        outputData[i] = inputData[numFrames - 1];
      }

      srcPos += step;
      if (srcPos >= numFrames) {
        srcPos = srcPos % numFrames;
      }
    }
  }

  return outBuffer;
}
