import React, { useEffect, useState } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Circle, 
  Repeat, 
  Volume2, 
  VolumeX,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { AudioEngine, LevelMeterData } from '../../audio/AudioEngine';

interface TransportBarProps {
  engine: AudioEngine;
  isPlaying: boolean;
  isRecording: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRecord: () => void;
  onSeek: (time: number) => void;
  playheadTime: number;
  duration: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  engine,
  isPlaying,
  isRecording,
  onPlay,
  onPause,
  onStop,
  onRecord,
  playheadTime,
  duration,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [masterVol, setMasterVol] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [masterPeak, setMasterPeak] = useState({ peak: 0, isClipping: false });

  useEffect(() => {
    const unsub = engine.onMeterUpdate((meters: LevelMeterData) => {
      setMasterPeak({
        peak: meters.masterLevel.peak,
        isClipping: meters.masterLevel.isClipping,
      });
    });
    return unsub;
  }, [engine]);

  // Format time into SMPTE: 00:00:00:00 (Hours:Minutes:Seconds:Frames at 24fps)
  const formatSMPTE = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const frames = Math.floor((totalSec % 1) * 24);

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVol(val);
    if (!isMuted) {
      engine.setMasterVolume(val);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      engine.setMasterVolume(masterVol);
    } else {
      setIsMuted(true);
      engine.setMasterVolume(0);
    }
  };

  const toggleLoop = () => {
    const next = !loopEnabled;
    setLoopEnabled(next);
    engine.setLoop(next, 0, duration);
  };

  return (
    <div className="bg-[#101217] border-b border-[#1d222b] px-2 sm:px-4 py-1.5 sm:py-0 sm:h-12 flex flex-col sm:flex-row items-center justify-between gap-1.5 sm:gap-3 shrink-0 select-none">
      {/* Upper/Left Row: Undo/Redo & Timecode Display */}
      <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 sm:p-1.5 rounded hover:bg-[#1d222b] text-[#828c9b] hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 sm:p-1.5 rounded hover:bg-[#1d222b] text-[#828c9b] hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center/Timecode Display */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 bg-[#08090c] px-2 sm:px-3 py-1 rounded border border-[#1d222a] font-mono shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-[#556070] uppercase font-semibold hidden md:inline">
              SMPTE
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wider text-emerald-400 tabular-nums">
              {formatSMPTE(playheadTime)}
            </span>
          </div>

          <div className="h-3.5 w-px bg-[#1e232c]" />

          <div className="flex items-center gap-1">
            <span className="text-xs sm:text-sm font-semibold text-blue-400 tabular-nums">
              {playheadTime.toFixed(1)}s
            </span>
            <span className="text-[10px] text-[#556070]">
              /{duration.toFixed(0)}s
            </span>
          </div>
        </div>

        {/* Compact Master Indicator for mobile (shown only on small screens) */}
        <div className="flex sm:hidden items-center gap-1 bg-[#090b0e] px-1.5 py-0.5 rounded border border-[#1a1f27]">
          <button
            onClick={toggleMute}
            className="text-[#828c9b] hover:text-white"
            title={isMuted ? 'Unmute Master' : 'Mute Master'}
          >
            {isMuted ? <VolumeX className="w-3 h-3 text-red-400" /> : <Volume2 className="w-3 h-3" />}
          </button>
          <div className="w-1.5 h-3.5 bg-[#141820] rounded-xs overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full ${
                masterPeak.isClipping ? 'bg-red-500' : masterPeak.peak > 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, masterPeak.peak * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Primary Transport Control Buttons (Always visible and centered on mobile & desktop) */}
      <div className="w-full sm:w-auto flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
        <button
          onClick={onStop}
          className="p-1.5 sm:p-2 rounded bg-[#181c24] hover:bg-[#222834] text-[#b0b9c7] hover:text-white transition-colors cursor-pointer"
          title="Stop & Reset Playhead (Return to 0)"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        <button
          onClick={isPlaying ? onPause : onPlay}
          className={`flex-1 sm:flex-initial px-4 py-1.5 sm:py-2 rounded flex items-center justify-center gap-1.5 font-semibold text-xs shadow-xs transition-colors cursor-pointer min-w-[90px] ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
          title="Play / Pause (Spacebar)"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              <span>PLAY</span>
            </>
          )}
        </button>

        <button
          onClick={onRecord}
          className={`flex-1 sm:flex-initial px-3.5 py-1.5 sm:py-2 rounded flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer min-w-[90px] ${
            isRecording
              ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400/50'
              : 'bg-[#181c24] hover:bg-[#222834] text-red-400 hover:text-red-300'
          }`}
          title="Record Dialogue / Vocal Take (R)"
        >
          <Circle className={`w-3 h-3 fill-current ${isRecording ? 'animate-pulse text-white' : ''}`} />
          <span>{isRecording ? 'REC' : 'RECORD'}</span>
        </button>

        <button
          onClick={toggleLoop}
          className={`p-1.5 sm:p-2 rounded transition-colors cursor-pointer ${
            loopEnabled
              ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
              : 'bg-[#181c24] hover:bg-[#222834] text-[#828c9b]'
          }`}
          title="Toggle Timeline Loop"
        >
          <Repeat className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right Desktop: Master Fader & Stereo Peak Meters (Hidden on mobile portrait, shown on sm+) */}
      <div className="hidden sm:flex items-center gap-2 md:gap-3 shrink-0">
        <button
          onClick={toggleMute}
          className="text-[#828c9b] hover:text-white transition-colors cursor-pointer"
          title={isMuted ? 'Unmute Master' : 'Mute Master'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Master Fader */}
        <div className="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.01"
            value={isMuted ? 0 : masterVol}
            onChange={handleVolumeChange}
            className="w-16 md:w-20 h-1.5 bg-[#1f2532] rounded-lg appearance-none cursor-pointer accent-blue-500"
            title={`Master Volume: ${(masterVol * 100).toFixed(0)}%`}
          />
          <span className="text-[10px] font-mono text-[#717c8d] w-8 text-right tabular-nums hidden md:inline">
            {isMuted ? 'MUTE' : `${(20 * Math.log10(Math.max(0.001, masterVol))).toFixed(0)}dB`}
          </span>
        </div>

        {/* Master Stereo Peak LED Meter */}
        <div className="flex items-center gap-1 bg-[#080a0d] p-1 rounded border border-[#181d25]">
          <div className="w-2 h-5 bg-[#141820] rounded-xs overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                masterPeak.isClipping
                  ? 'bg-red-500'
                  : masterPeak.peak > 0.8
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, masterPeak.peak * 100)}%` }}
            />
          </div>
          <div className="w-2 h-5 bg-[#141820] rounded-xs overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                masterPeak.isClipping
                  ? 'bg-red-500'
                  : masterPeak.peak > 0.8
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.min(100, masterPeak.peak * 95)}%` }}
            />
          </div>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              masterPeak.isClipping ? 'bg-red-500' : 'bg-red-950'
            }`}
            title="Digital Clip Indicator"
          />
        </div>
      </div>
    </div>
  );
};
