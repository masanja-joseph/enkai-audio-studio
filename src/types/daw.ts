export type TrackType = 
  | 'dub_vocal'
  | 'guide_reference'
  | 'dialogue' 
  | 'film_audio' 
  | 'bg_music' 
  | 'sound_effects' 
  | 'ambience' 
  | 'voiceover_takes';

export interface AudioClip {
  id: string;
  assetId: string;
  name: string;
  startTime: number; // in seconds on timeline
  duration: number; // in seconds
  offset: number; // start offset within source audio in seconds
  volume: number; // linear gain (0.0 to 2.0, 1.0 = 0dB)
  pan: number; // -1.0 to 1.0
  fadeIn: number; // fade in duration in seconds
  fadeOut: number; // fade out duration in seconds
  muted: boolean;
  color?: string;
}

export interface EqualizerSettings {
  enabled: boolean;
  highPassFreq: number; // Hz (20 - 500)
  lowGain: number; // dB (-15 to +15)
  lowFreq: number; // Hz (80 - 300)
  midGain: number; // dB (-15 to +15)
  midFreq: number; // Hz (400 - 4000)
  midQ: number; // 0.5 - 5.0
  highGain: number; // dB (-15 to +15)
  highFreq: number; // Hz (4000 - 16000)
}

export interface CompressorSettings {
  enabled: boolean;
  threshold: number; // dB (-60 to 0)
  ratio: number; // 1 to 20
  attack: number; // seconds (0.001 to 0.1)
  release: number; // seconds (0.05 to 1.0)
  makeupGain: number; // dB (0 to 24)
}

export interface PitchSettings {
  enabled: boolean;
  pitchSemitones: number; // -12 to +12
  fineTuneCents: number; // -50 to +50
  formantShift: number; // -12 to +12 (character transformation: deep to thin)
  preserveTiming: boolean;
}

export interface ReverbSettings {
  enabled: boolean;
  decay: number; // seconds (0.5 to 5.0)
  preDelay: number; // seconds (0.0 to 0.1)
  wetGain: number; // 0.0 to 1.0
  dryGain: number; // 0.0 to 1.0
  roomSize: 'small_booth' | 'dubbing_stage' | 'cinematic_hall' | 'cathedral';
}

export interface DelaySettings {
  enabled: boolean;
  time: number; // seconds (0.05 to 1.0)
  feedback: number; // 0.0 to 0.9
  wetGain: number; // 0.0 to 1.0
}

export interface NoiseGateSettings {
  enabled: boolean;
  threshold: number; // dB (-80 to -20)
  attack: number; // seconds (0.001 to 0.05)
  release: number; // seconds (0.05 to 0.5)
}

export interface VocalEffectsRack {
  equalizer: EqualizerSettings;
  compressor: CompressorSettings;
  pitch: PitchSettings;
  reverb: ReverbSettings;
  delay: DelaySettings;
  gate: NoiseGateSettings;
}

export interface AudioTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number; // linear gain (0.0 to 2.0, default 1.0)
  pan: number; // -1.0 to +1.0, default 0.0
  muted: boolean;
  solo: boolean;
  armedForRecord: boolean;
  effects: VocalEffectsRack;
  clips: AudioClip[];
}

export interface AudioAsset {
  id: string;
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  waveformPeaks: number[]; // precomputed min/max peaks for UI rendering
  dataUrl?: string; // base64 or blob URL
  audioBuffer?: AudioBuffer;
}

export interface RecordingTake {
  id: string;
  trackId: string;
  assetId: string;
  originalAssetId?: string; // Non-destructive reference to original raw take
  name: string;
  timestamp: number;
  duration: number;
  timelinePosition: number;
  status: 'pending' | 'accepted' | 'rejected';
  isCleaned?: boolean;
}

export interface VideoCueMarker {
  id: string;
  time: number;
  label: string;
  speaker: string;
  notes?: string;
}

export interface AudioProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sampleRate: 44100 | 48000;
  bitDepth: 16 | 24;
  duration: number; // in seconds
  tracks: AudioTrack[];
  assets: Record<string, AudioAsset>;
  takes: RecordingTake[];
  videoUrl?: string;
  videoFileName?: string;
  videoDuration?: number;
  videoMarkers: VideoCueMarker[];
}

export interface ExportSettings {
  format: 'wav';
  bitDepth: 16 | 24;
  sampleRate: 44100 | 48000;
  channels: 'stereo' | 'mono';
  normalize: boolean;
}
