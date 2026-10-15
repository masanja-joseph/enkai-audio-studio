import React, { useState, useEffect, useRef } from 'react';
import { AudioProject, RecordingTake, AudioClip } from '../../types/daw';
import { AudioEngine, LevelMeterData } from '../../audio/AudioEngine';
import { drawWaveform } from '../../audio/WaveformGenerator';
import { 
  NoiseCleanupParams, 
  DEFAULT_NOISE_CLEANUP_PARAMS, 
  CleanupResultMetrics 
} from '../../audio/NoiseReductionDSP';
import { 
  Mic, 
  Square, 
  Check, 
  X, 
  RotateCcw, 
  AlertTriangle, 
  Play, 
  Pause, 
  Sparkles,
  Volume2,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AudioProject;
  engine: AudioEngine;
  playheadTime: number;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  onClose,
  project,
  engine,
  playheadTime,
  onUpdateProject,
}) => {
  // Capture states
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [inputMode, setInputMode] = useState<'voice_optimized' | 'raw_studio'>('voice_optimized');
  const [inputGainDb, setInputGainDb] = useState<number>(0);
  const [inputLevel, setInputLevel] = useState<{ peak: number; isClipping: boolean }>({
    peak: 0,
    isClipping: false,
  });
  const [targetTrackId, setTargetTrackId] = useState(
    project.tracks.find((t) => t.armedForRecord)?.id ||
      project.tracks.find((t) => t.type === 'dub_vocal')?.id ||
      project.tracks[0]?.id
  );
  const [micError, setMicError] = useState<string | null>(null);

  // Captured take states
  const [hasCapturedTake, setHasCapturedTake] = useState(false);
  const [rawCapturedData, setRawCapturedData] = useState<{
    blob: Blob;
    audioBuffer: AudioBuffer;
    duration: number;
    timelineStart: number;
    peaks: number[];
  } | null>(null);

  // Offline Noise Reduction DSP settings
  const [cleanupParams, setCleanupParams] = useState<NoiseCleanupParams>({
    ...DEFAULT_NOISE_CLEANUP_PARAMS,
  });
  const [cleanedBuffer, setCleanedBuffer] = useState<AudioBuffer | null>(null);
  const [cleanupMetrics, setCleanupMetrics] = useState<CleanupResultMetrics | null>(null);
  const [isBypassed, setIsBypassed] = useState(false);
  const [showAdvancedDenoise, setShowAdvancedDenoise] = useState(false);

  // Audition playback state
  const [isAuditioning, setIsAuditioning] = useState(false);
  const [auditionSource, setAuditionSource] = useState<'cleaned' | 'raw'>('cleaned');

  const timerRef = useRef<number | null>(null);
  const stopAuditionRef = useRef<(() => void) | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-listen to microphone when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const gainLinear = Math.pow(10, inputGainDb / 20);

    engine
      .startMicrophone(inputMode, gainLinear)
      .then(() => {
        if (isMounted) setMicError(null);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : 'Microphone permission denied or device not found';
          setMicError(`${errMsg}. Please ensure microphone access is granted in browser permissions.`);
        }
      });

    const unsub = engine.onMeterUpdate((meters: LevelMeterData) => {
      if (isMounted) {
        setInputLevel({
          peak: meters.inputLevel.peak,
          isClipping: meters.inputLevel.isClipping,
        });
      }
    });

    return () => {
      isMounted = false;
      unsub();
      if (stopAuditionRef.current) {
        stopAuditionRef.current();
        stopAuditionRef.current = null;
      }
    };
  }, [isOpen, engine, inputMode, inputGainDb]);

  // Re-run offline DSP vocal cleanup whenever parameters change on captured raw audio
  useEffect(() => {
    if (!rawCapturedData || !rawCapturedData.audioBuffer) return;

    try {
      if (isBypassed) {
        setCleanedBuffer(rawCapturedData.audioBuffer);
        setCleanupMetrics(null);
      } else {
        const { cleanedBuffer: cleaned, metrics } = engine.cleanBuffer(
          rawCapturedData.audioBuffer,
          cleanupParams
        );
        setCleanedBuffer(cleaned);
        setCleanupMetrics(metrics);
      }
    } catch (err) {
      console.error('Error running vocal cleanup DSP:', err);
    }
  }, [rawCapturedData, cleanupParams, isBypassed, engine]);

  // Draw waveform whenever active buffer changes
  useEffect(() => {
    if (hasCapturedTake && waveformCanvasRef.current) {
      const activeBuffer = isBypassed || auditionSource === 'raw' 
        ? rawCapturedData?.audioBuffer 
        : cleanedBuffer || rawCapturedData?.audioBuffer;

      if (activeBuffer) {
        const canvas = waveformCanvasRef.current;
        const color = isBypassed || auditionSource === 'raw' ? '#f59e0b' : '#10b981';
        const peaks = rawCapturedData?.peaks || [];
        drawWaveform(canvas, peaks, color, '#0b1320');
      }
    }
  }, [hasCapturedTake, rawCapturedData, cleanedBuffer, isBypassed, auditionSource]);

  // Safe teardown
  const handleClose = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopAuditionRef.current) {
      stopAuditionRef.current();
      stopAuditionRef.current = null;
    }
    if (isRecording) {
      engine.stopRecording().catch(() => {});
      setIsRecording(false);
    }
    engine.stopMicrophone();
    onClose();
  };

  if (!isOpen) return null;

  const handleStartRecord = async () => {
    try {
      setMicError(null);
      if (stopAuditionRef.current) {
        stopAuditionRef.current();
        stopAuditionRef.current = null;
        setIsAuditioning(false);
      }
      await engine.startRecording(targetTrackId);
      setIsRecording(true);
      setRecordDuration(0);
      setHasCapturedTake(false);
      setRawCapturedData(null);
      setCleanedBuffer(null);
      setCleanupMetrics(null);

      const start = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordDuration((Date.now() - start) / 1000);
      }, 50);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Microphone unavailable';
      setMicError(`Microphone error: ${errMsg}. Please verify permissions.`);
      setIsRecording(false);
    }
  };

  const handleStopRecord = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);

    try {
      const result = await engine.stopRecording();
      setRawCapturedData(result);
      setHasCapturedTake(true);
      setAuditionSource('cleaned');
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to finalize audio capture';
      setMicError(errMsg);
    }
  };

  const handleToggleAudition = (sourceToPlay: 'cleaned' | 'raw') => {
    if (!rawCapturedData) return;

    if (stopAuditionRef.current) {
      stopAuditionRef.current();
      stopAuditionRef.current = null;
    }

    if (isAuditioning && auditionSource === sourceToPlay) {
      setIsAuditioning(false);
      return;
    }

    setAuditionSource(sourceToPlay);
    setIsAuditioning(true);

    const bufferToPlay = sourceToPlay === 'cleaned' && cleanedBuffer && !isBypassed
      ? cleanedBuffer
      : rawCapturedData.audioBuffer;

    stopAuditionRef.current = engine.playBufferPreview(bufferToPlay, () => {
      setIsAuditioning(false);
      stopAuditionRef.current = null;
    });
  };

  const handleApproveTake = (applyCleanup: boolean = true) => {
    if (!rawCapturedData) return;

    if (stopAuditionRef.current) {
      stopAuditionRef.current();
      stopAuditionRef.current = null;
      setIsAuditioning(false);
    }

    const takeNumber = project.takes.length + 1;
    const rawAssetId = 'asset_raw_take_' + Date.now();
    const finalAssetId = applyCleanup && cleanedBuffer && !isBypassed 
      ? 'asset_clean_take_' + Date.now() 
      : rawAssetId;
    const clipId = 'clip_take_' + Date.now();

    const rawAsset = {
      id: rawAssetId,
      name: `Dub_Take_${takeNumber}_RAW.wav`,
      duration: rawCapturedData.duration,
      sampleRate: rawCapturedData.audioBuffer.sampleRate,
      channels: rawCapturedData.audioBuffer.numberOfChannels,
      waveformPeaks: rawCapturedData.peaks,
      audioBuffer: rawCapturedData.audioBuffer,
    };

    const assetsToAdd: Record<string, any> = {
      [rawAssetId]: rawAsset,
    };

    if (applyCleanup && cleanedBuffer && !isBypassed) {
      assetsToAdd[finalAssetId] = {
        id: finalAssetId,
        name: `Dub_Take_${takeNumber}_CLEANED.wav`,
        duration: cleanedBuffer.duration,
        sampleRate: cleanedBuffer.sampleRate,
        channels: cleanedBuffer.numberOfChannels,
        waveformPeaks: rawCapturedData.peaks,
        audioBuffer: cleanedBuffer,
      };
    }

    const newClip: AudioClip = {
      id: clipId,
      assetId: finalAssetId,
      name: `Take ${takeNumber}${applyCleanup && !isBypassed ? ' (Cleaned)' : ''}`,
      startTime: rawCapturedData.timelineStart,
      duration: rawCapturedData.duration,
      offset: 0,
      volume: 1.0,
      pan: 0,
      fadeIn: 0.04,
      fadeOut: 0.04,
      muted: false,
    };

    const newTake: RecordingTake = {
      id: 'take_' + Date.now(),
      trackId: targetTrackId,
      assetId: finalAssetId,
      originalAssetId: rawAssetId,
      name: `Dubbing Take ${takeNumber}`,
      timestamp: Date.now(),
      duration: rawCapturedData.duration,
      timelinePosition: rawCapturedData.timelineStart,
      status: 'accepted',
      isCleaned: applyCleanup && !isBypassed,
    };

    onUpdateProject((prev) => {
      console.log('Recording: Updating project with new take', { targetTrackId, newClip });
      const validTrackId = prev.tracks.some(t => t.id === targetTrackId)
        ? targetTrackId
        : prev.tracks[0]?.id;

      let updatedTracks = prev.tracks;
      let assignedTrackId = validTrackId;

      if (validTrackId) {
        updatedTracks = prev.tracks.map((t) =>
          t.id === validTrackId ? { ...t, clips: [...t.clips, newClip] } : t
        );
      } else {
        const fallbackTrackId = 'trk_vocal_' + Date.now();
        assignedTrackId = fallbackTrackId;
        const newTrack = {
          id: fallbackTrackId,
          name: 'Dub Vocal 1',
          type: 'dub_vocal' as const,
          color: '#10b981',
          volume: 1.0,
          pan: 0,
          muted: false,
          solo: false,
          armedForRecord: true,
          effects: prev.tracks[0]?.effects || {
            equalizer: { enabled: true, highPassFreq: 80, lowGain: 0, lowFreq: 120, midGain: 1.5, midFreq: 2400, midQ: 1.2, highGain: 2.0, highFreq: 8000 },
            compressor: { enabled: true, threshold: -18, ratio: 3.5, attack: 0.015, release: 0.15, makeupGain: 3.0 },
            pitch: { enabled: false, pitchSemitones: 0, fineTuneCents: 0, formantShift: 0 }
          },
          clips: [newClip]
        };
        updatedTracks = [...prev.tracks, newTrack];
      }

      return {
        ...prev,
        assets: {
          ...prev.assets,
          ...assetsToAdd,
        },
        tracks: updatedTracks,
        takes: [...prev.takes, { ...newTake, trackId: assignedTrackId || 'trk_vocal_fallback' }],
        duration: Math.max(prev.duration, newClip.startTime + newClip.duration + 2),
      };
    });

    handleClose();
  };

  const handleRetake = () => {
    if (stopAuditionRef.current) {
      stopAuditionRef.current();
      stopAuditionRef.current = null;
      setIsAuditioning(false);
    }
    setRawCapturedData(null);
    setCleanedBuffer(null);
    setCleanupMetrics(null);
    setHasCapturedTake(false);
    setRecordDuration(0);
    setMicError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 select-none">
      <div className="bg-[#121620] border border-[#232d3f] rounded-2xl w-full max-w-lg p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2230]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Vocal Recording Booth</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Studio HD
                </span>
              </h3>
              <p className="text-[11px] text-[#717e92]">
                Target: <span className="font-mono text-emerald-400">{playheadTime.toFixed(2)}s</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-[#1f293a] text-[#717e92] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {micError && (
          <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 text-xs text-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{micError}</span>
          </div>
        )}

        {/* --- PRE-RECORDING CONTROLS --- */}
        {!hasCapturedTake && (
          <div className="flex flex-col gap-3">
            {/* Target Track Selection */}
            <div className="bg-[#0b0e14] p-3 rounded-xl border border-[#1b222f] flex flex-col gap-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-[#7d8b9e] block mb-1">
                    Dub Vocal Track:
                  </label>
                  <select
                    value={targetTrackId}
                    disabled={isRecording}
                    onChange={(e) => setTargetTrackId(e.target.value)}
                    className="w-full bg-[#141a24] text-xs font-semibold text-white px-2.5 py-2 rounded-lg border border-[#232c3d] focus:outline-hidden cursor-pointer"
                  >
                    {project.tracks.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#141a24] text-white">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-[#7d8b9e] block mb-1">
                    Microphone Preset:
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setInputMode('voice_optimized')}
                      disabled={isRecording}
                      className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        inputMode === 'voice_optimized'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-[#141a24] text-[#717e92] hover:text-white'
                      }`}
                    >
                      Dialogue Filtered
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('raw_studio')}
                      disabled={isRecording}
                      className={`flex-1 py-2 px-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        inputMode === 'raw_studio'
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-[#141a24] text-[#717e92] hover:text-white'
                      }`}
                    >
                      Raw Studio
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Gain & Level Meter */}
              <div className="flex flex-col gap-1 pt-2 border-t border-[#171e2a]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#8694a7] flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5 text-[#526074]" />
                    Mic Input Gain:
                  </span>
                  <span className="font-mono text-white font-semibold">
                    {inputGainDb >= 0 ? `+${inputGainDb}` : inputGainDb} dB
                  </span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={inputGainDb}
                  disabled={isRecording}
                  onChange={(e) => setInputGainDb(Number(e.target.value))}
                  className="w-full accent-blue-500 h-1.5 bg-[#1b2230] rounded-lg cursor-pointer"
                />

                {/* Meter Bar */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-mono text-[#667487] w-12 shrink-0">LEVEL:</span>
                  <div className="flex-1 h-2.5 bg-[#131924] rounded overflow-hidden border border-[#1f2838] relative">
                    <div
                      className={`h-full transition-all duration-75 ${
                        inputLevel.isClipping
                          ? 'bg-red-500'
                          : inputLevel.peak > 0.8
                          ? 'bg-yellow-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, inputLevel.peak * 100)}%` }}
                    />
                  </div>
                  {inputLevel.isClipping ? (
                    <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/40 animate-pulse">
                      CLIP
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-[#7d8c9f] w-10 text-right">
                      {(inputLevel.peak * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Big Record Action Center */}
            <div className="flex flex-col items-center justify-center py-5 bg-[#0b0e14] rounded-xl border border-[#1b222f] gap-3">
              <div className="font-mono text-3xl font-bold tracking-widest text-white">
                {recordDuration.toFixed(2)}s
              </div>

              {!isRecording ? (
                <button
                  onClick={handleStartRecord}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-transform active:scale-95 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Recording Take</span>
                </button>
              ) : (
                <button
                  onClick={handleStopRecord}
                  className="flex items-center gap-2.5 px-7 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/50 animate-pulse transition-transform active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>Stop & Review Take</span>
                </button>
              )}
              <p className="text-[11px] text-[#637286] text-center px-4">
                {isRecording 
                  ? 'Recording in progress with synchronous guide playback.'
                  : 'Click Start to record your dialogue line over the scene.'}
              </p>
            </div>
          </div>
        )}

        {/* --- POST-RECORDING AUDITION & PLAYBACK STUDIO --- */}
        {hasCapturedTake && rawCapturedData && (
          <div className="flex flex-col gap-3">
            {/* Prominent Playback Audition Player Bar */}
            <div className="bg-[#0b0e14] border border-[#1b222f] rounded-xl p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Captured Take Ready</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      ({rawCapturedData.duration.toFixed(2)}s)
                    </span>
                  </h4>
                  <p className="text-[11px] text-[#717e92]">
                    Listen to your recorded dialogue before saving to the timeline.
                  </p>
                </div>

                {/* Primary Play/Pause Audition Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleAudition('cleaned')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
                      isAuditioning && auditionSource === 'cleaned'
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                        : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'
                    }`}
                  >
                    {isAuditioning && auditionSource === 'cleaned' ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{isAuditioning && auditionSource === 'cleaned' ? 'Pause' : 'Play Cleaned'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleAudition('raw')}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isAuditioning && auditionSource === 'raw'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#18202c] text-amber-400 hover:bg-[#202a3a] border border-amber-500/20'
                    }`}
                  >
                    {isAuditioning && auditionSource === 'raw' ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>Raw</span>
                  </button>
                </div>
              </div>

              {/* Waveform Viewport */}
              <canvas
                ref={waveformCanvasRef}
                width={520}
                height={64}
                className="w-full h-16 rounded-lg bg-[#06080d] border border-[#161d28]"
              />
            </div>

            {/* Clean, Collapsible Vocal Cleanup & Denoise DSP */}
            <div className="bg-[#0b0e14] border border-[#1b222f] rounded-xl overflow-hidden">
              <div 
                onClick={() => setShowAdvancedDenoise(!showAdvancedDenoise)}
                className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-[#141b26] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Studio Noise Reduction & Cleanup DSP
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBypassed(!isBypassed);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      isBypassed
                        ? 'bg-amber-900/40 text-amber-400 border border-amber-600/40'
                        : 'bg-purple-900/30 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    {isBypassed ? 'Bypassed' : 'Active'}
                  </button>
                  {showAdvancedDenoise ? (
                    <ChevronUp className="w-4 h-4 text-[#717e92]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#717e92]" />
                  )}
                </div>
              </div>

              {showAdvancedDenoise && (
                <div className="p-3.5 pt-1 border-t border-[#171e2b] flex flex-col gap-3 font-mono text-[11px]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* 1. High-Pass */}
                    <div className="bg-[#141a24] p-2.5 rounded-lg border border-[#1f2838] flex flex-col gap-1">
                      <label className="flex items-center justify-between font-sans text-white text-xs font-semibold cursor-pointer">
                        <span>High-Pass Filter:</span>
                        <input
                          type="checkbox"
                          checked={cleanupParams.highPassEnabled}
                          onChange={(e) =>
                            setCleanupParams((prev) => ({ ...prev, highPassEnabled: e.target.checked }))
                          }
                          className="accent-purple-500 cursor-pointer"
                        />
                      </label>
                      <select
                        value={cleanupParams.highPassFreq}
                        disabled={!cleanupParams.highPassEnabled}
                        onChange={(e) =>
                          setCleanupParams((prev) => ({ ...prev, highPassFreq: Number(e.target.value) }))
                        }
                        className="bg-[#0b0e14] text-white px-2 py-1 rounded border border-[#232d3f] text-xs focus:outline-hidden cursor-pointer mt-1"
                      >
                        <option value={60}>60 Hz</option>
                        <option value={80}>80 Hz (Male)</option>
                        <option value={100}>100 Hz</option>
                        <option value={120}>120 Hz (Female)</option>
                      </select>
                    </div>

                    {/* 2. Expander / Gate */}
                    <div className="bg-[#141a24] p-2.5 rounded-lg border border-[#1f2838] flex flex-col gap-1">
                      <label className="flex items-center justify-between font-sans text-white text-xs font-semibold cursor-pointer">
                        <span>Noise Gate:</span>
                        <input
                          type="checkbox"
                          checked={cleanupParams.noiseGateEnabled}
                          onChange={(e) =>
                            setCleanupParams((prev) => ({ ...prev, noiseGateEnabled: e.target.checked }))
                          }
                          className="accent-purple-500 cursor-pointer"
                        />
                      </label>
                      <div className="flex items-center justify-between text-[#8594a8] mt-1">
                        <span>Gate:</span>
                        <span className="text-white font-bold">{cleanupParams.gateThresholdDb} dB</span>
                      </div>
                      <input
                        type="range"
                        min="-60"
                        max="-24"
                        step="2"
                        disabled={!cleanupParams.noiseGateEnabled}
                        value={cleanupParams.gateThresholdDb}
                        onChange={(e) =>
                          setCleanupParams((prev) => ({ ...prev, gateThresholdDb: Number(e.target.value) }))
                        }
                        className="accent-purple-500 h-1 bg-[#0b0e14] rounded cursor-pointer mt-1"
                      />
                    </div>

                    {/* 3. Spectral Denoise */}
                    <div className="bg-[#141a24] p-2.5 rounded-lg border border-[#1f2838] flex flex-col gap-1">
                      <label className="flex items-center justify-between font-sans text-white text-xs font-semibold cursor-pointer">
                        <span>Spectral Denoise:</span>
                        <input
                          type="checkbox"
                          checked={cleanupParams.spectralDenoiseEnabled}
                          onChange={(e) =>
                            setCleanupParams((prev) => ({ ...prev, spectralDenoiseEnabled: e.target.checked }))
                          }
                          className="accent-purple-500 cursor-pointer"
                        />
                      </label>
                      <div className="flex items-center justify-between text-[#8594a8] mt-1">
                        <span>Reduction:</span>
                        <span className="text-white font-bold">{cleanupParams.reductionAmountDb} dB</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="18"
                        step="1"
                        disabled={!cleanupParams.spectralDenoiseEnabled}
                        value={cleanupParams.reductionAmountDb}
                        onChange={(e) =>
                          setCleanupParams((prev) => ({ ...prev, reductionAmountDb: Number(e.target.value) }))
                        }
                        className="accent-purple-500 h-1 bg-[#0b0e14] rounded cursor-pointer mt-1"
                      />
                    </div>
                  </div>

                  {cleanupMetrics && !isBypassed && (
                    <div className="flex items-center justify-between bg-[#121722] px-3 py-1.5 rounded border border-[#1e2736] text-[10px] font-mono">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Noise Attenuation: -{cleanupMetrics.noiseReducedDb} dB
                      </span>
                      <span className="text-[#8594a8]">Clean RMS: <strong className="text-white">{cleanupMetrics.cleanedRmsDb} dBFS</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Approval & Action Buttons */}
            <div className="flex items-center justify-between pt-1 border-t border-[#1b222f]">
              <button
                onClick={handleRetake}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#18202c] hover:bg-[#202a3a] text-xs font-semibold text-[#8b99ac] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard & Retake</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveTake(false)}
                  className="px-3 py-2 rounded-lg bg-[#172130] hover:bg-[#212e42] text-xs font-semibold text-amber-300 border border-amber-500/20 transition-colors cursor-pointer"
                >
                  Save Raw
                </button>

                <button
                  onClick={() => handleApproveTake(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Cleaned Take to Timeline</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
