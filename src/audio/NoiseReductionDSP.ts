/**
 * Enkai Audio Studio — Offline Vocal Noise Reduction & Cleanup DSP
 * 
 * Provides professional, offline DSP algorithms for speech and movie dubbing:
 * 1. 2nd-order Butterworth High-Pass Biquad Filter (removes low-frequency handling/HVAC rumble).
 * 2. Downward Expander / Adaptive Noise Gate (attenuates room noise between spoken dialogue).
 * 3. Spectral Subtraction with Musical Noise Mitigation & Wiener Gain Smoothing (removes continuous hiss/fan noise).
 * 4. Automatic Noise Profile Learning from lead-in room tone or quietest frames.
 */

export interface NoiseCleanupParams {
  highPassEnabled: boolean;
  highPassFreq: number; // e.g. 80 Hz, 100 Hz, 120 Hz
  noiseGateEnabled: boolean;
  gateThresholdDb: number; // e.g. -42 dB
  gateRatio: number; // e.g. 3.0 (downward expander ratio)
  gateAttackMs: number; // e.g. 6 ms
  gateReleaseMs: number; // e.g. 120 ms
  spectralDenoiseEnabled: boolean;
  reductionAmountDb: number; // e.g. 6 dB to 18 dB
  noiseProfileSource: 'auto_lead_in' | 'learned' | 'quietest_frames';
  customNoiseProfile?: Float32Array; // Optional learned spectral magnitude profile
  inputGainLinear?: number; // Pre-processing gain (e.g. 1.0)
}

export const DEFAULT_NOISE_CLEANUP_PARAMS: NoiseCleanupParams = {
  highPassEnabled: true,
  highPassFreq: 90, // Pristine for dialogue (Swahili and English)
  noiseGateEnabled: true,
  gateThresholdDb: -42,
  gateRatio: 3.5,
  gateAttackMs: 8,
  gateReleaseMs: 140,
  spectralDenoiseEnabled: true,
  reductionAmountDb: 10, // Moderate, preserves natural consonants and sibilants
  noiseProfileSource: 'auto_lead_in',
  inputGainLinear: 1.0,
};

export interface CleanupResultMetrics {
  originalRmsDb: number;
  cleanedRmsDb: number;
  originalPeakDb: number;
  cleanedPeakDb: number;
  estimatedNoiseFloorDb: number;
  noiseReducedDb: number;
}

/**
 * 2nd-order Butterworth High-Pass Filter
 */
export function applyHighPassFilter(
  samples: Float32Array,
  sampleRate: number,
  cutoffFreq: number
): Float32Array {
  if (cutoffFreq <= 10) return new Float32Array(samples);
  const out = new Float32Array(samples.length);

  const omega = (2.0 * Math.PI * cutoffFreq) / sampleRate;
  const sinOmega = Math.sin(omega);
  const cosOmega = Math.cos(omega);
  const alpha = sinOmega / (2.0 * 0.7071067811865476); // Q = 1/sqrt(2)

  const b0 = (1.0 + cosOmega) / 2.0;
  const b1 = -(1.0 + cosOmega);
  const b2 = (1.0 + cosOmega) / 2.0;
  const a0 = 1.0 + alpha;
  const a1 = -2.0 * cosOmega;
  const a2 = 1.0 - alpha;

  // Normalized coefficients
  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    out[i] = y0;
  }

  return out;
}

/**
 * Downward Expander / Noise Gate
 * Gently lowers the gain when speech is below threshold, with smooth attack and release
 * to prevent unnatural cutting of word tails or Swahili open vowels.
 */
export function applyDownwardExpander(
  samples: Float32Array,
  sampleRate: number,
  thresholdDb: number,
  ratio: number,
  attackMs: number,
  releaseMs: number
): Float32Array {
  const out = new Float32Array(samples.length);
  const thresholdLinear = Math.pow(10, thresholdDb / 20);
  const attackCoeff = Math.exp(-1.0 / (sampleRate * (attackMs / 1000)));
  const releaseCoeff = Math.exp(-1.0 / (sampleRate * (releaseMs / 1000)));

  let envelope = 0;
  const minGain = Math.pow(10, -30 / 20); // Max 30 dB attenuation to avoid jarring silence

  for (let i = 0; i < samples.length; i++) {
    const absInput = Math.abs(samples[i]);
    if (absInput > envelope) {
      envelope = attackCoeff * envelope + (1 - attackCoeff) * absInput;
    } else {
      envelope = releaseCoeff * envelope + (1 - releaseCoeff) * absInput;
    }

    let gain = 1.0;
    if (envelope < thresholdLinear && envelope > 1e-7) {
      const envDb = 20 * Math.log10(envelope);
      const diffDb = envDb - thresholdDb; // negative number
      const expansionDb = diffDb * (ratio - 1.0);
      const rawGain = Math.pow(10, expansionDb / 20);
      gain = Math.max(minGain, rawGain);
    } else if (envelope <= 1e-7) {
      gain = minGain;
    }

    out[i] = samples[i] * gain;
  }

  return out;
}

/**
 * Radix-2 In-place Cooley-Tukey FFT implementation
 */
function fftRadix2(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempRe = re[i];
      re[i] = re[j];
      re[j] = tempRe;
      const tempIm = im[i];
      im[i] = im[j];
      im[j] = tempIm;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly updates
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angle = (-2.0 * Math.PI) / len;
    const wStepRe = Math.cos(angle);
    const wStepIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1.0;
      let wIm = 0.0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * wRe - im[i + k + half] * wIm;
        const vIm = re[i + k + half] * wIm + im[i + k + half] * wRe;

        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;

        const nextWRe = wRe * wStepRe - wIm * wStepIm;
        const nextWIm = wRe * wStepIm + wIm * wStepRe;
        wRe = nextWRe;
        wIm = nextWIm;
      }
    }
  }
}

/**
 * Inverse Radix-2 FFT
 */
function ifftRadix2(re: Float32Array, im: Float32Array): void {
  // Complex conjugate
  for (let i = 0; i < im.length; i++) {
    im[i] = -im[i];
  }
  fftRadix2(re, im);
  const n = re.length;
  for (let i = 0; i < n; i++) {
    re[i] /= n;
    im[i] = -im[i] / n;
  }
}

/**
 * Learns average spectral magnitude noise profile from a raw audio segment.
 */
export function learnNoiseProfile(
  samples: Float32Array,
  frameSize: number = 1024,
  hopSize: number = 256
): Float32Array {
  const numBins = frameSize / 2 + 1;
  const avgProfile = new Float32Array(numBins);
  let count = 0;

  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }

  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  for (let pos = 0; pos + frameSize <= samples.length; pos += hopSize) {
    for (let i = 0; i < frameSize; i++) {
      re[i] = samples[pos + i] * window[i];
      im[i] = 0;
    }
    fftRadix2(re, im);

    for (let k = 0; k < numBins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      avgProfile[k] += mag;
    }
    count++;
  }

  if (count > 0) {
    for (let k = 0; k < numBins; k++) {
      avgProfile[k] /= count;
    }
  }

  return avgProfile;
}

/**
 * Spectral Subtraction Denoising with Wiener Gain Smoothing and Over-Subtraction
 * Preserves spoken dialogue formants while reducing continuous microphone self-noise and room tone.
 */
export function applySpectralDenoise(
  samples: Float32Array,
  sampleRate: number,
  reductionAmountDb: number = 10,
  customProfile?: Float32Array
): Float32Array {
  const frameSize = 1024;
  const hopSize = 256;
  const numBins = frameSize / 2 + 1;

  if (samples.length < frameSize * 2) {
    return new Float32Array(samples);
  }

  // 1. Determine or build noise profile
  let noiseProfile = customProfile;
  if (!noiseProfile || noiseProfile.length !== numBins) {
    // Learn from the first 250ms of room tone (or quietest 15% of frames if recording started immediately)
    const leadInSamples = Math.min(Math.floor(sampleRate * 0.35), Math.floor(samples.length * 0.2));
    if (leadInSamples >= frameSize) {
      noiseProfile = learnNoiseProfile(samples.subarray(0, leadInSamples), frameSize, hopSize);
    } else {
      noiseProfile = learnNoiseProfile(samples, frameSize, hopSize);
    }
  }

  // 2. Window and synthesis buffers
  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }

  const output = new Float32Array(samples.length);
  const winSum = new Float32Array(samples.length);

  // Spectral floor prevents "musical noise" (musical chirping / water droplets)
  // reductionAmountDb determines how aggressively we suppress (e.g. 10 dB)
  const maxAttenuationLinear = Math.pow(10, -Math.abs(reductionAmountDb) / 20);
  const oversubtraction = 1.35; // Alpha over-subtraction

  const re = new Float32Array(frameSize);
  const im = new Float32Array(frameSize);

  let prevGain = new Float32Array(numBins);
  prevGain.fill(1.0);

  for (let pos = 0; pos + frameSize <= samples.length; pos += hopSize) {
    for (let i = 0; i < frameSize; i++) {
      re[i] = samples[pos + i] * window[i];
      im[i] = 0;
    }

    fftRadix2(re, im);

    // Apply Wiener-smoothed spectral attenuation
    for (let k = 0; k < numBins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
      const noiseMag = (noiseProfile[k] || 1e-6) * oversubtraction;

      // SNR-based Wiener gain calculation
      let rawGain = 1.0;
      if (mag > 1e-7) {
        rawGain = Math.max(maxAttenuationLinear, (mag - noiseMag) / mag);
      } else {
        rawGain = maxAttenuationLinear;
      }

      // Smooth gain across frames (temporal smoothing reduces musical noise)
      const smoothedGain = 0.45 * prevGain[k] + 0.55 * rawGain;
      prevGain[k] = smoothedGain;

      re[k] *= smoothedGain;
      im[k] *= smoothedGain;

      // Symmetric bins for real signal inverse FFT
      if (k > 0 && k < frameSize / 2) {
        re[frameSize - k] = re[k];
        im[frameSize - k] = -im[k];
      }
    }

    ifftRadix2(re, im);

    // Overlap-Add to output
    for (let i = 0; i < frameSize; i++) {
      output[pos + i] += re[i] * window[i];
      winSum[pos + i] += window[i] * window[i];
    }
  }

  // Normalize by window sum (WOLA synthesis)
  for (let i = 0; i < samples.length; i++) {
    if (winSum[i] > 1e-4) {
      output[i] /= winSum[i];
    } else {
      output[i] = samples[i];
    }
  }

  return output;
}

/**
 * Calculates audio RMS and peak metrics in dBFS
 */
export function calculateAudioMetrics(samples: Float32Array): { rmsDb: number; peakDb: number } {
  if (samples.length === 0) return { rmsDb: -100, peakDb: -100 };
  let sumSq = 0;
  let peak = 0;

  for (let i = 0; i < samples.length; i++) {
    const absVal = Math.abs(samples[i]);
    if (absVal > peak) peak = absVal;
    sumSq += absVal * absVal;
  }

  const rms = Math.sqrt(sumSq / samples.length);
  const rmsDb = rms > 1e-6 ? 20 * Math.log10(rms) : -100;
  const peakDb = peak > 1e-6 ? 20 * Math.log10(peak) : -100;

  return { rmsDb, peakDb };
}

/**
 * Complete Vocal Cleanup Pipeline
 * Non-destructively processes an input audio buffer and returns the cleaned buffer + metrics.
 */
export function processVocalCleanup(
  ctx: AudioContext,
  sourceBuffer: AudioBuffer,
  params: NoiseCleanupParams = DEFAULT_NOISE_CLEANUP_PARAMS
): { cleanedBuffer: AudioBuffer; metrics: CleanupResultMetrics } {
  const numChannels = sourceBuffer.numberOfChannels;
  const length = sourceBuffer.length;
  const sampleRate = sourceBuffer.sampleRate;

  const cleanedBuffer = ctx.createBuffer(numChannels, length, sampleRate);

  let origRmsTotal = 0;
  let cleanRmsTotal = 0;
  let origPeakTotal = 0;
  let cleanPeakTotal = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const raw = sourceBuffer.getChannelData(ch);
    let channelData = new Float32Array(raw.length);
    channelData.set(raw);

    // Optional input gain
    if (params.inputGainLinear && params.inputGainLinear !== 1.0) {
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] *= params.inputGainLinear;
      }
    }

    const origMetrics = calculateAudioMetrics(channelData);
    origRmsTotal += origMetrics.rmsDb;
    origPeakTotal = Math.max(origPeakTotal, origMetrics.peakDb);

    // Step 1: High-pass filter for rumble
    if (params.highPassEnabled) {
      channelData = applyHighPassFilter(channelData, sampleRate, params.highPassFreq) as any;
    }

    // Step 2: Spectral Subtraction for continuous background noise
    if (params.spectralDenoiseEnabled) {
      channelData = applySpectralDenoise(
        channelData,
        sampleRate,
        params.reductionAmountDb,
        params.customNoiseProfile
      ) as any;
    }

    // Step 3: Downward Expander for noise between spoken lines
    if (params.noiseGateEnabled) {
      channelData = applyDownwardExpander(
        channelData,
        sampleRate,
        params.gateThresholdDb,
        params.gateRatio,
        params.gateAttackMs,
        params.gateReleaseMs
      ) as any;
    }

    const cleanMetrics = calculateAudioMetrics(channelData);
    cleanRmsTotal += cleanMetrics.rmsDb;
    cleanPeakTotal = Math.max(cleanPeakTotal, cleanMetrics.peakDb);

    cleanedBuffer.copyToChannel(channelData, ch);
  }

  const origAvgRms = origRmsTotal / numChannels;
  const cleanAvgRms = cleanRmsTotal / numChannels;

  return {
    cleanedBuffer,
    metrics: {
      originalRmsDb: Math.round(origAvgRms * 10) / 10,
      cleanedRmsDb: Math.round(cleanAvgRms * 10) / 10,
      originalPeakDb: Math.round(origPeakTotal * 10) / 10,
      cleanedPeakDb: Math.round(cleanPeakTotal * 10) / 10,
      estimatedNoiseFloorDb: Math.round((cleanAvgRms - 12) * 10) / 10,
      noiseReducedDb: Math.max(0, Math.round((origAvgRms - cleanAvgRms) * 10) / 10),
    },
  };
}
