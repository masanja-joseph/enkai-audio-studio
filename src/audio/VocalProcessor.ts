import { VocalEffectsRack } from '../types/daw';

export interface VocalProcessorNodes {
  input: GainNode;
  output: GainNode;
  highPass: BiquadFilterNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  makeupGain: GainNode;
  reverbSend: GainNode;
  reverbNode: ConvolverNode;
  reverbReturn: GainNode;
  delaySend: GainNode;
  delayNode: DelayNode;
  delayFeedback: GainNode;
  delayReturn: GainNode;
  dryGain: GainNode;
  getReduction: () => number;
  updateSettings: (settings: VocalEffectsRack) => void;
  destroy: () => void;
}

/**
 * Builds an authentic real-time vocal processing DSP rack
 */
export function createVocalProcessor(
  ctx: AudioContext,
  initialSettings: VocalEffectsRack
): VocalProcessorNodes {
  const input = ctx.createGain();
  const output = ctx.createGain();

  // 1. Equalizer Nodes
  const highPass = ctx.createBiquadFilter();
  highPass.type = 'highpass';

  const eqLow = ctx.createBiquadFilter();
  eqLow.type = 'lowshelf';

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = 'peaking';

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = 'highshelf';

  // 2. Dynamics Compressor Node
  const compressor = ctx.createDynamicsCompressor();
  const makeupGain = ctx.createGain();

  // 3. Dry signal path
  const dryGain = ctx.createGain();

  // 4. Algorithmic Reverb
  const reverbSend = ctx.createGain();
  const reverbNode = ctx.createConvolver();
  const reverbReturn = ctx.createGain();

  // 5. Delay
  const delaySend = ctx.createGain();
  const delayNode = ctx.createDelay(2.0);
  const delayFeedback = ctx.createGain();
  const delayReturn = ctx.createGain();

  // Build impulse response for initial reverb
  reverbNode.buffer = createReverbImpulse(ctx, initialSettings.reverb.decay, initialSettings.reverb.roomSize);

  // Wire processing chain:
  // input -> highPass -> eqLow -> eqMid -> eqHigh -> compressor -> makeupGain -> dryGain -> output
  input.connect(highPass);
  highPass.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);
  eqHigh.connect(compressor);
  compressor.connect(makeupGain);
  
  makeupGain.connect(dryGain);
  dryGain.connect(output);

  // Send to Reverb
  makeupGain.connect(reverbSend);
  reverbSend.connect(reverbNode);
  reverbNode.connect(reverbReturn);
  reverbReturn.connect(output);

  // Send to Delay (feedback loop)
  makeupGain.connect(delaySend);
  delaySend.connect(delayNode);
  delayNode.connect(delayFeedback);
  delayFeedback.connect(delayNode);
  delayNode.connect(delayReturn);
  delayReturn.connect(output);

  // Apply initial settings
  applySettings(initialSettings);

  function applySettings(settings: VocalEffectsRack) {
    const now = ctx.currentTime;

    // EQ
    if (settings.equalizer.enabled) {
      highPass.frequency.setTargetAtTime(settings.equalizer.highPassFreq, now, 0.02);
      highPass.Q.setTargetAtTime(0.707, now, 0.02);

      eqLow.frequency.setTargetAtTime(settings.equalizer.lowFreq, now, 0.02);
      eqLow.gain.setTargetAtTime(settings.equalizer.lowGain, now, 0.02);

      eqMid.frequency.setTargetAtTime(settings.equalizer.midFreq, now, 0.02);
      eqMid.gain.setTargetAtTime(settings.equalizer.midGain, now, 0.02);
      eqMid.Q.setTargetAtTime(settings.equalizer.midQ, now, 0.02);

      eqHigh.frequency.setTargetAtTime(settings.equalizer.highFreq, now, 0.02);
      eqHigh.gain.setTargetAtTime(settings.equalizer.highGain, now, 0.02);
    } else {
      // Bypass EQ
      highPass.frequency.setTargetAtTime(10, now, 0.02);
      eqLow.gain.setTargetAtTime(0, now, 0.02);
      eqMid.gain.setTargetAtTime(0, now, 0.02);
      eqHigh.gain.setTargetAtTime(0, now, 0.02);
    }

    // Compressor
    if (settings.compressor.enabled) {
      compressor.threshold.setTargetAtTime(settings.compressor.threshold, now, 0.02);
      compressor.ratio.setTargetAtTime(settings.compressor.ratio, now, 0.02);
      compressor.attack.setTargetAtTime(settings.compressor.attack, now, 0.02);
      compressor.release.setTargetAtTime(settings.compressor.release, now, 0.02);

      const linearMakeup = Math.pow(10, settings.compressor.makeupGain / 20);
      makeupGain.gain.setTargetAtTime(linearMakeup, now, 0.02);
    } else {
      // Bypass compressor
      compressor.threshold.setTargetAtTime(0, now, 0.02);
      compressor.ratio.setTargetAtTime(1, now, 0.02);
      makeupGain.gain.setTargetAtTime(1.0, now, 0.02);
    }

    // Reverb
    if (settings.reverb.enabled) {
      reverbSend.gain.setTargetAtTime(settings.reverb.wetGain, now, 0.02);
      reverbReturn.gain.setTargetAtTime(1.0, now, 0.02);
      dryGain.gain.setTargetAtTime(settings.reverb.dryGain, now, 0.02);
    } else {
      reverbSend.gain.setTargetAtTime(0, now, 0.02);
      dryGain.gain.setTargetAtTime(1.0, now, 0.02);
    }

    // Delay
    if (settings.delay.enabled) {
      delaySend.gain.setTargetAtTime(1.0, now, 0.02);
      delayNode.delayTime.setTargetAtTime(settings.delay.time, now, 0.02);
      delayFeedback.gain.setTargetAtTime(settings.delay.feedback, now, 0.02);
      delayReturn.gain.setTargetAtTime(settings.delay.wetGain, now, 0.02);
    } else {
      delaySend.gain.setTargetAtTime(0, now, 0.02);
      delayReturn.gain.setTargetAtTime(0, now, 0.02);
    }
  }

  function getReduction(): number {
    return compressor.reduction; // Real-time gain reduction in dB
  }

  function destroy() {
    try {
      input.disconnect();
      highPass.disconnect();
      eqLow.disconnect();
      eqMid.disconnect();
      eqHigh.disconnect();
      compressor.disconnect();
      makeupGain.disconnect();
      dryGain.disconnect();
      output.disconnect();
      reverbSend.disconnect();
      reverbNode.disconnect();
      reverbReturn.disconnect();
      delaySend.disconnect();
      delayNode.disconnect();
      delayFeedback.disconnect();
      delayReturn.disconnect();
    } catch {
      // ignore
    }
  }

  return {
    input,
    output,
    highPass,
    eqLow,
    eqMid,
    eqHigh,
    compressor,
    makeupGain,
    reverbSend,
    reverbNode,
    reverbReturn,
    delaySend,
    delayNode,
    delayFeedback,
    delayReturn,
    dryGain,
    getReduction,
    updateSettings: applySettings,
    destroy,
  };
}

/**
 * Procedural impulse response generator for convolution reverb
 */
export function createReverbImpulse(
  ctx: AudioContext,
  decaySeconds: number,
  roomSize: 'small_booth' | 'dubbing_stage' | 'cinematic_hall' | 'cathedral'
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(0.5, decaySeconds) * sampleRate;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  let decayRate = 3.0;
  if (roomSize === 'small_booth') decayRate = 6.0;
  if (roomSize === 'dubbing_stage') decayRate = 4.0;
  if (roomSize === 'cinematic_hall') decayRate = 2.5;
  if (roomSize === 'cathedral') decayRate = 1.8;

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * decayRate);
    // Gaussian-like noise with subtle early reflection delays
    const nl = (Math.random() * 2 - 1) * env;
    const nr = (Math.random() * 2 - 1) * env;
    left[i] = nl;
    right[i] = nr;
  }

  return buffer;
}
