import { AudioProject, AudioTrack, AudioClip, ExportSettings } from '../types/daw';
import { createVocalProcessor, VocalProcessorNodes } from './VocalProcessor';
import { encodeWAV } from './WavEncoder';
import { extractPeaks } from './WaveformGenerator';
import { pitchShiftAudioBuffer } from './PitchShifter';
import { 
  processVocalCleanup, 
  NoiseCleanupParams, 
  DEFAULT_NOISE_CLEANUP_PARAMS, 
  CleanupResultMetrics 
} from './NoiseReductionDSP';

export interface LevelMeterData {
  trackLevels: Record<string, { peak: number; rms: number; isClipping: boolean }>;
  masterLevel: { peak: number; rms: number; isClipping: boolean };
  inputLevel: { peak: number; rms: number; isClipping: boolean };
}

export class AudioEngine {
  private static instance: AudioEngine;
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private playheadTime: number = 0;
  private playStartTime: number = 0;
  private playStartOffset: number = 0;
  private loopEnabled: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 10;

  // Track channels
  private trackProcessors: Map<string, {
    input: GainNode;
    volumeNode: GainNode;
    panNode: StereoPannerNode;
    analyser: AnalyserNode;
    vocalRack: VocalProcessorNodes;
  }> = new Map();

  // Active audio source nodes currently playing
  private activeSources: {
    source: AudioBufferSourceNode;
    gain: GainNode;
    clipId: string;
  }[] = [];

  // Master bus
  private masterGain: GainNode | null = null;
  private masterLimiter: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // Microphone recording
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private recordStartTime: number = 0;

  // Playhead and meter update listeners
  private playheadListeners: Set<(time: number) => void> = new Set();
  private meterListeners: Set<(meters: LevelMeterData) => void> = new Set();
  private animFrameId: number | null = null;

  // Current project reference
  private currentProject: AudioProject | null = null;

  private constructor() {}

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async initAudioContext(sampleRate: number = 48000): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate });
      this.setupMasterBus();
      this.startMeterLoop();
    }
    if (this.ctx.state === 'suspended') {
      console.log('AudioEngine: Attempting to resume AudioContext...');
      await this.ctx.resume();
      console.log('AudioEngine: AudioContext resumed. Current state:', this.ctx.state);
    }
    console.log('AudioEngine: initAudioContext returning, state:', this.ctx.state);
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  public isContextSuspended(): boolean {
    return this.ctx ? this.ctx.state === 'suspended' : false;
  }

  private setupMasterBus() {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // Peak brickwall limiter to protect hearing and prevent digital harsh clipping
    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.value = -0.3; // -0.3 dBFS ceiling
    this.masterLimiter.knee.value = 0.0;
    this.masterLimiter.ratio.value = 20.0;
    this.masterLimiter.attack.value = 0.001;
    this.masterLimiter.release.value = 0.05;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 512;
    this.masterAnalyser.smoothingTimeConstant = 0.6;

    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);
  }

  public syncProject(project: AudioProject) {
    this.currentProject = project;
    if (!this.ctx) return;

    // Check solo logic
    const anySolo = project.tracks.some(t => t.solo);

    // Update track audio processing chains
    for (const track of project.tracks) {
      let channel = this.trackProcessors.get(track.id);
      if (!channel) {
        // Create new channel strip
        const input = this.ctx.createGain();
        const volumeNode = this.ctx.createGain();
        const panNode = this.ctx.createStereoPanner();
        const analyser = this.ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;

        const vocalRack = createVocalProcessor(this.ctx, track.effects);

        // Chain: input -> vocalRack.input -> vocalRack.output -> volumeNode -> panNode -> analyser -> masterGain
        input.connect(vocalRack.input);
        vocalRack.output.connect(volumeNode);
        volumeNode.connect(panNode);
        panNode.connect(analyser);
        if (this.masterGain) {
          analyser.connect(this.masterGain);
        }

        channel = { input, volumeNode, panNode, analyser, vocalRack };
        this.trackProcessors.set(track.id, channel);
      }

      // Update parameters smoothly
      const now = this.ctx.currentTime;
      let effectiveGain = track.volume;
      if (track.muted || (anySolo && !track.solo)) {
        effectiveGain = 0;
      }
      channel.volumeNode.gain.setTargetAtTime(effectiveGain, now, 0.02);
      channel.panNode.pan.setTargetAtTime(track.pan, now, 0.02);
      channel.vocalRack.updateSettings(track.effects);
    }

    // Clean up removed tracks
    const currentTrackIds = new Set(project.tracks.map(t => t.id));
    for (const [id, channel] of this.trackProcessors.entries()) {
      if (!currentTrackIds.has(id)) {
        channel.vocalRack.destroy();
        channel.volumeNode.disconnect();
        channel.panNode.disconnect();
        channel.analyser.disconnect();
        channel.input.disconnect();
        this.trackProcessors.delete(id);
      }
    }
  }

  public setMasterVolume(gain: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, gain), this.ctx.currentTime, 0.02);
    }
  }

  public async play(fromTime?: number) {
    await this.initAudioContext();
    if (!this.ctx || !this.currentProject) return;

    if (fromTime !== undefined) {
      this.playheadTime = Math.max(0, fromTime);
    }

    this.stopActiveSources();
    this.playStartTime = this.ctx.currentTime;
    this.playStartOffset = this.playheadTime;
    this.isPlaying = true;

    // Schedule clips across all tracks
    for (const track of this.currentProject.tracks) {
      const channel = this.trackProcessors.get(track.id);
      if (!channel) continue;

      for (const clip of track.clips) {
        if (clip.muted) continue;

        const asset = this.currentProject.assets[clip.assetId];
        if (!asset || !asset.audioBuffer) continue;

        const clipStartOnTimeline = clip.startTime;
        const clipEndOnTimeline = clip.startTime + clip.duration;

        // If clip hasn't finished yet
        if (clipEndOnTimeline > this.playheadTime) {
          const source = this.ctx.createBufferSource();
          let buf = asset.audioBuffer;
          if (track.effects.pitch.enabled && (track.effects.pitch.pitchSemitones !== 0 || track.effects.pitch.fineTuneCents !== 0)) {
            buf = pitchShiftAudioBuffer(this.ctx, buf, track.effects.pitch.pitchSemitones, track.effects.pitch.fineTuneCents);
          }
          source.buffer = buf;

          // Clip volume & fade envelope
          const clipGain = this.ctx.createGain();
          clipGain.gain.value = clip.volume;

          source.connect(clipGain);
          clipGain.connect(channel.input);

          if (this.playheadTime < clipStartOnTimeline) {
            // Clip will start in the future
            const when = this.playStartTime + (clipStartOnTimeline - this.playheadTime);
            source.start(when, clip.offset, clip.duration);

            // Apply fade-in and fade-out ramps
            if (clip.fadeIn > 0) {
              clipGain.gain.setValueAtTime(0, when);
              clipGain.gain.linearRampToValueAtTime(clip.volume, when + clip.fadeIn);
            }
            if (clip.fadeOut > 0) {
              const fadeStart = when + clip.duration - clip.fadeOut;
              clipGain.gain.setValueAtTime(clip.volume, Math.max(when, fadeStart));
              clipGain.gain.linearRampToValueAtTime(0, when + clip.duration);
            }
          } else {
            // Playhead is currently inside this clip
            const offsetIntoClip = this.playheadTime - clipStartOnTimeline;
            const remainingDuration = clip.duration - offsetIntoClip;
            source.start(this.playStartTime, clip.offset + offsetIntoClip, remainingDuration);

            // Apply fade-out if approaching end of clip
            if (clip.fadeOut > 0 && remainingDuration <= clip.fadeOut) {
              clipGain.gain.setValueAtTime(clip.volume, this.playStartTime);
              clipGain.gain.linearRampToValueAtTime(0, this.playStartTime + remainingDuration);
            }
          }

          this.activeSources.push({ source, gain: clipGain, clipId: clip.id });
        }
      }
    }
  }

  public pause() {
    if (!this.isPlaying) return;
    this.updateCurrentPlayhead();
    this.stopActiveSources();
    this.isPlaying = false;
  }

  public stop() {
    this.stopActiveSources();
    this.isPlaying = false;
    this.playheadTime = 0;
    this.notifyPlayhead(0);
  }

  public seek(targetTime: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.playheadTime = Math.max(0, targetTime);
    this.notifyPlayhead(this.playheadTime);
    if (wasPlaying) {
      this.play(this.playheadTime);
    }
  }

  public getPlayheadTime(): number {
    if (this.isPlaying && this.ctx) {
      return this.playStartOffset + (this.ctx.currentTime - this.playStartTime);
    }
    return this.playheadTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setLoop(enabled: boolean, start: number, end: number) {
    this.loopEnabled = enabled;
    this.loopStart = Math.max(0, start);
    this.loopEnd = Math.max(this.loopStart + 0.1, end);
  }

  private stopActiveSources() {
    for (const item of this.activeSources) {
      try {
        item.source.stop();
        item.source.disconnect();
        item.gain.disconnect();
      } catch {
        // ignore already stopped
      }
    }
    this.activeSources = [];
  }

  private updateCurrentPlayhead() {
    if (this.isPlaying && this.ctx) {
      this.playheadTime = this.playStartOffset + (this.ctx.currentTime - this.playStartTime);
    }
  }

  // --- Real-time Meter & Animation Loop ---

  private startMeterLoop() {
    if (this.animFrameId) return;

    const tick = () => {
      if (this.isPlaying && this.ctx) {
        const currentTime = this.playStartOffset + (this.ctx.currentTime - this.playStartTime);

        // Check loop boundary
        if (this.loopEnabled && currentTime >= this.loopEnd) {
          this.seek(this.loopStart);
          this.play(this.loopStart);
        } else {
          this.notifyPlayhead(currentTime);
        }
      }

      // Compute metering values
      const meterData: LevelMeterData = {
        trackLevels: {},
        masterLevel: this.calculateLevel(this.masterAnalyser),
        inputLevel: this.calculateLevel(this.micAnalyser),
      };

      for (const [trackId, channel] of this.trackProcessors.entries()) {
        meterData.trackLevels[trackId] = this.calculateLevel(channel.analyser);
      }

      for (const listener of this.meterListeners) {
        listener(meterData);
      }

      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);
  }

  private calculateLevel(analyser: AnalyserNode | null): { peak: number; rms: number; isClipping: boolean } {
    if (!analyser) return { peak: 0, rms: 0, isClipping: false };

    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);

    let peak = 0;
    let sumSquares = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const val = Math.abs(dataArray[i]);
      if (val > peak) peak = val;
      sumSquares += val * val;
    }

    const rms = Math.sqrt(sumSquares / dataArray.length);
    const isClipping = peak >= 0.99;

    return { peak, rms, isClipping };
  }

  // --- Listeners ---

  public onPlayheadUpdate(fn: (time: number) => void): () => void {
    this.playheadListeners.add(fn);
    return () => this.playheadListeners.delete(fn);
  }

  public onMeterUpdate(fn: (meters: LevelMeterData) => void): () => void {
    this.meterListeners.add(fn);
    return () => this.meterListeners.delete(fn);
  }

  private notifyPlayhead(time: number) {
    for (const fn of this.playheadListeners) {
      fn(time);
    }
  }

  // --- Microphone Recording Engine ---

  private micGainNode: GainNode | null = null;
  private currentMicMode: 'voice_optimized' | 'raw_studio' = 'voice_optimized';

  public async startMicrophone(
    mode: 'voice_optimized' | 'raw_studio' = 'voice_optimized',
    gainLinear: number = 1.0
  ): Promise<MediaStream> {
    await this.initAudioContext();
    const isStreamActive =
      this.micStream &&
      this.micStream.active &&
      this.micStream.getAudioTracks().some((t) => t.readyState === 'live') &&
      this.currentMicMode === mode;

    if (!isStreamActive) {
      if (this.micStream) {
        this.stopMicrophone();
      }

      this.currentMicMode = mode;
      try {
        const audioConstraints: MediaTrackConstraints = 
          mode === 'voice_optimized'
            ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false,
              }
            : {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              };

        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });

        if (this.ctx) {
          if (this.micSource) {
            try {
              this.micSource.disconnect();
            } catch {
              // ignore
            }
          }
          this.micSource = this.ctx.createMediaStreamSource(this.micStream);
          this.micGainNode = this.ctx.createGain();
          this.micGainNode.gain.value = gainLinear;

          this.micAnalyser = this.ctx.createAnalyser();
          this.micAnalyser.fftSize = 256;
          
          this.micSource.connect(this.micGainNode);
          this.micGainNode.connect(this.micAnalyser);
        }
      } catch (err) {
        console.error('Failed to access microphone hardware:', err);
        throw err;
      }
    } else if (this.micGainNode) {
      this.micGainNode.gain.value = gainLinear;
    }

    if (!this.micStream) {
      throw new Error('Failed to initialize microphone stream.');
    }
    return this.micStream;
  }

  public setMicrophoneGain(gainLinear: number): void {
    if (this.micGainNode) {
      this.micGainNode.gain.value = gainLinear;
    }
  }

  /**
   * Offline Vocal Noise Cleanup & Spectral Denoising
   * Processes the captured AudioBuffer non-destructively
   */
  public cleanBuffer(
    sourceBuffer: AudioBuffer,
    params: NoiseCleanupParams = DEFAULT_NOISE_CLEANUP_PARAMS
  ): { cleanedBuffer: AudioBuffer; metrics: CleanupResultMetrics } {
    if (!this.ctx) {
      throw new Error('AudioContext not initialized');
    }
    return processVocalCleanup(this.ctx, sourceBuffer, params);
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // ignore
      }
      this.micSource = null;
    }
  }

  public async startRecording(trackId: string): Promise<void> {
    const stream = await this.startMicrophone();
    this.recordedChunks = [];
    this.isRecording = true;
    this.recordStartTime = this.getPlayheadTime();

    let mimeType = 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus';
    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4';
    }

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.start(100);
    // Start timeline playback in synchronization so user hears backing vocal layers
    this.play();
  }

  public async stopRecording(): Promise<{
    blob: Blob;
    audioBuffer: AudioBuffer;
    duration: number;
    timelineStart: number;
    peaks: number[];
  }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording in progress.'));
        return;
      }

      this.pause();
      this.isRecording = false;
      const timelineStart = this.recordStartTime;

      this.mediaRecorder.onstop = async () => {
        try {
          if (!this.recordedChunks || this.recordedChunks.length === 0) {
            throw new Error('Recording ended with zero audio chunks captured. Please check microphone input.');
          }

          const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });

          if (blob.size === 0) {
            throw new Error('Recorded audio file is empty.');
          }

          const arrayBuf = await blob.arrayBuffer();
          const ctx = this.ctx || (await this.initAudioContext());
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          const audioBuffer = await ctx.decodeAudioData(arrayBuf);
          const peaks = extractPeaks(audioBuffer, 300);

          resolve({
            blob,
            audioBuffer,
            duration: audioBuffer.duration,
            timelineStart,
            peaks,
          });
        } catch (err) {
          reject(err);
        }
      };

      try {
        if (this.mediaRecorder.state !== 'inactive') {
          try {
            this.mediaRecorder.requestData();
          } catch {
            // ignore if not supported
          }
          this.mediaRecorder.stop();
        }
      } catch (err) {
        reject(err);
      }
    });
  }

  public playBufferPreview(audioBuffer: AudioBuffer, onEnded?: () => void): () => void {
    if (!this.ctx) return () => {};
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 1.0;
    source.connect(gain);
    if (this.masterGain) {
      gain.connect(this.masterGain);
    } else {
      gain.connect(this.ctx.destination);
    }
    source.start();
    source.onended = () => {
      if (onEnded) onEnded();
    };
    return () => {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  // --- Real Audio File Decoding (Import Audio) ---

  public async decodeAudioFile(file: File): Promise<{
    audioBuffer: AudioBuffer;
    duration: number;
    sampleRate: number;
    channels: number;
    peaks: number[];
  }> {
    await this.initAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    const peaks = extractPeaks(audioBuffer, 400);

    return {
      audioBuffer,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.numberOfChannels,
      peaks,
    };
  }

  // --- Offline Multitrack Master Export to WAV ---

  public async renderMasterWav(
    project: AudioProject,
    settings: ExportSettings,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const duration = Math.max(1, project.duration);
    const sampleRate = settings.sampleRate;
    const numChannels = settings.channels === 'mono' ? 1 : 2;
    const totalSamples = Math.floor(sampleRate * duration);

    // Create OfflineAudioContext for deterministic, non-realtime master bounce
    const offlineCtx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);

    // Master bus in offline context
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.0;

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.value = -0.3;
    limiter.ratio.value = 20.0;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    masterGain.connect(limiter);
    limiter.connect(offlineCtx.destination);

    const anySolo = project.tracks.some(t => t.solo);

    for (const track of project.tracks) {
      if (track.muted || (anySolo && !track.solo)) continue;

      // Track channel strip
      const trackInput = offlineCtx.createGain();
      const trackVolume = offlineCtx.createGain();
      trackVolume.gain.value = track.volume;

      const trackPan = offlineCtx.createStereoPanner();
      trackPan.pan.value = track.pan;

      // Track EQ
      const hp = offlineCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = track.effects.equalizer.enabled ? track.effects.equalizer.highPassFreq : 10;

      const eqLow = offlineCtx.createBiquadFilter();
      eqLow.type = 'lowshelf';
      eqLow.frequency.value = track.effects.equalizer.lowFreq;
      eqLow.gain.value = track.effects.equalizer.enabled ? track.effects.equalizer.lowGain : 0;

      const eqMid = offlineCtx.createBiquadFilter();
      eqMid.type = 'peaking';
      eqMid.frequency.value = track.effects.equalizer.midFreq;
      eqMid.gain.value = track.effects.equalizer.enabled ? track.effects.equalizer.midGain : 0;
      eqMid.Q.value = track.effects.equalizer.midQ;

      const eqHigh = offlineCtx.createBiquadFilter();
      eqHigh.type = 'highshelf';
      eqHigh.frequency.value = track.effects.equalizer.highFreq;
      eqHigh.gain.value = track.effects.equalizer.enabled ? track.effects.equalizer.highGain : 0;

      // Track Compressor
      const comp = offlineCtx.createDynamicsCompressor();
      if (track.effects.compressor.enabled) {
        comp.threshold.value = track.effects.compressor.threshold;
        comp.ratio.value = track.effects.compressor.ratio;
        comp.attack.value = track.effects.compressor.attack;
        comp.release.value = track.effects.compressor.release;
      } else {
        comp.threshold.value = 0;
        comp.ratio.value = 1;
      }

      const makeup = offlineCtx.createGain();
      makeup.gain.value = track.effects.compressor.enabled 
        ? Math.pow(10, track.effects.compressor.makeupGain / 20) 
        : 1.0;

      // Chain
      trackInput.connect(hp);
      hp.connect(eqLow);
      eqLow.connect(eqMid);
      eqMid.connect(eqHigh);
      eqHigh.connect(comp);
      comp.connect(makeup);
      makeup.connect(trackVolume);
      trackVolume.connect(trackPan);
      trackPan.connect(masterGain);

      // Schedule clips
      for (const clip of track.clips) {
        if (clip.muted) continue;
        const asset = project.assets[clip.assetId];
        if (!asset || !asset.audioBuffer) continue;

        const source = offlineCtx.createBufferSource();
        let buf = asset.audioBuffer;
        if (track.effects.pitch.enabled && (track.effects.pitch.pitchSemitones !== 0 || track.effects.pitch.fineTuneCents !== 0)) {
          buf = pitchShiftAudioBuffer(offlineCtx, buf, track.effects.pitch.pitchSemitones, track.effects.pitch.fineTuneCents);
        }
        source.buffer = buf;

        const clipGain = offlineCtx.createGain();
        clipGain.gain.value = clip.volume;

        // Apply fades
        if (clip.fadeIn > 0) {
          clipGain.gain.setValueAtTime(0, clip.startTime);
          clipGain.gain.linearRampToValueAtTime(clip.volume, clip.startTime + clip.fadeIn);
        }
        if (clip.fadeOut > 0) {
          const fadeStart = clip.startTime + clip.duration - clip.fadeOut;
          clipGain.gain.setValueAtTime(clip.volume, fadeStart);
          clipGain.gain.linearRampToValueAtTime(0, clip.startTime + clip.duration);
        }

        source.connect(clipGain);
        clipGain.connect(trackInput);

        source.start(clip.startTime, clip.offset, clip.duration);
      }
    }

    if (onProgress) onProgress(0.4);

    // Render offline buffer
    const renderedBuffer = await offlineCtx.startRendering();

    if (onProgress) onProgress(0.85);

    // Normalize if enabled
    if (settings.normalize) {
      normalizeBuffer(renderedBuffer);
    }

    // Encode to real WAV
    const wavBlob = encodeWAV(renderedBuffer, settings.bitDepth, settings.channels === 'mono');

    if (onProgress) onProgress(1.0);

    return wavBlob;
  }
}

function normalizeBuffer(buffer: AudioBuffer) {
  let maxPeak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > maxPeak) maxPeak = abs;
    }
  }

  if (maxPeak > 0 && maxPeak < 0.99) {
    const multiplier = 0.99 / maxPeak;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        data[i] *= multiplier;
      }
    }
  }
}
