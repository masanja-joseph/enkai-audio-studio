import React, { useEffect, useState } from 'react';
import { AudioProject, AudioTrack } from '../../types/daw';
import { AudioEngine, LevelMeterData } from '../../audio/AudioEngine';
import { SlidersHorizontal, Volume2, ShieldAlert } from 'lucide-react';

interface ConsoleMixerProps {
  project: AudioProject;
  engine: AudioEngine;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
  onSelectTrackForFX: (trackId: string) => void;
}

export const ConsoleMixer: React.FC<ConsoleMixerProps> = ({
  project,
  engine,
  onUpdateProject,
  onSelectTrackForFX,
}) => {
  const [trackMeters, setTrackMeters] = useState<Record<string, { peak: number; rms: number; isClipping: boolean }>>({});
  const [masterMeter, setMasterMeter] = useState<{ peak: number; rms: number; isClipping: boolean }>({
    peak: 0,
    rms: 0,
    isClipping: false,
  });
  const [masterVol, setMasterVol] = useState(1.0);

  useEffect(() => {
    const unsub = engine.onMeterUpdate((meters: LevelMeterData) => {
      setTrackMeters(meters.trackLevels);
      setMasterMeter(meters.masterLevel);
    });
    return unsub;
  }, [engine]);

  const toggleTrackMute = (trackId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, muted: !t.muted } : t
      ),
    }));
  };

  const toggleTrackSolo = (trackId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, solo: !t.solo } : t
      ),
    }));
  };

  const handleTrackVolume = (trackId: string, vol: number) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, volume: vol } : t
      ),
    }));
  };

  const handleTrackPan = (trackId: string, pan: number) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, pan } : t
      ),
    }));
  };

  const handleMasterVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVol(val);
    engine.setMasterVolume(val);
  };

  return (
    <div className="flex-1 bg-[#0a0c0f] p-6 flex flex-col overflow-x-auto select-none">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1c222b] shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase">
            Multitrack Console Strip Mixer
          </h2>
          <p className="text-xs text-[#737e90] mt-0.5">
            Synchronized 32-bit float internal summing bus · Peak limiter protection
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#8b95a5]">
          <span>TRACKS: {project.tracks.length}</span>
          <span className="text-[#3b4453]">|</span>
          <span>SAMPLE RATE: {project.sampleRate} Hz</span>
        </div>
      </div>

      {/* Mixer Channel Strips Flex Row */}
      <div className="flex-1 flex gap-2.5 sm:gap-3 overflow-y-auto pb-4">
        {project.tracks.map((track, idx) => {
          const meter = trackMeters[track.id] || { peak: 0, rms: 0, isClipping: false };
          const dbVal = 20 * Math.log10(Math.max(0.001, track.volume));

          return (
            <div
              key={track.id}
              className="w-28 sm:w-32 bg-[#12161d] rounded-lg border border-[#1e2530] flex flex-col justify-between p-2.5 sm:p-3 shrink-0 relative shadow-sm"
            >
              {/* Top Accent Strip */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 rounded-t-lg"
                style={{ backgroundColor: track.color }}
              />

              {/* Channel Strip Header */}
              <div className="pt-1.5 flex flex-col gap-1 text-center">
                <span className="text-[10px] font-mono text-[#5f6b7e] uppercase">
                  CH {idx + 1}
                </span>
                <span className="text-xs font-bold text-white truncate px-1" title={track.name}>
                  {track.name}
                </span>

                {/* Vocal FX Button */}
                <button
                  onClick={() => onSelectTrackForFX(track.id)}
                  className="mt-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-[#1c222c] hover:bg-[#252e3b] text-[10px] font-semibold text-purple-300 border border-[#2b3546] transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3 text-purple-400" />
                  <span>FX Rack</span>
                </button>
              </div>

              {/* Pan Pot Control */}
              <div className="flex flex-col items-center gap-1 my-3">
                <div className="flex items-center justify-between w-full px-1 text-[10px] font-mono text-[#6e7a8e]">
                  <span>L</span>
                  <span className="text-white font-semibold">
                    {track.pan === 0 ? 'C' : track.pan > 0 ? `R${Math.round(track.pan * 100)}` : `L${Math.round(Math.abs(track.pan) * 100)}`}
                  </span>
                  <span>R</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={track.pan}
                  onChange={(e) => handleTrackPan(track.id, parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#222834] rounded appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Mute and Solo Buttons */}
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                <button
                  onClick={() => toggleTrackMute(track.id)}
                  className={`py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    track.muted
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-[#1b202a] hover:bg-[#242b38] text-[#7a8698]'
                  }`}
                >
                  MUTE
                </button>
                <button
                  onClick={() => toggleTrackSolo(track.id)}
                  className={`py-1.5 rounded text-xs font-bold transition-colors cursor-pointer ${
                    track.solo
                      ? 'bg-yellow-400 text-slate-950 font-extrabold shadow-xs'
                      : 'bg-[#1b202a] hover:bg-[#242b38] text-[#7a8698]'
                  }`}
                >
                  SOLO
                </button>
              </div>

              {/* Vertical Fader & LED Meter Section */}
              <div className="flex-1 flex items-center justify-center gap-3 py-2">
                {/* dB Scale Legend */}
                <div className="flex flex-col justify-between text-[9px] font-mono text-[#546073] h-44 select-none">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-18</span>
                  <span>-36</span>
                  <span>-∞</span>
                </div>

                {/* Vertical Slider Fader */}
                <div className="h-44 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.01"
                    value={track.volume}
                    onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                    className="h-44 w-6 appearance-none bg-transparent cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
                  />
                </div>

                {/* Multi-segment LED Peak Meter */}
                <div className="h-44 w-3.5 bg-[#090b0e] rounded-xs border border-[#1d232e] p-0.5 flex flex-col-reverse overflow-hidden">
                  <div
                    className={`w-full transition-all duration-75 rounded-xs ${
                      meter.isClipping
                        ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                        : meter.peak > 0.85
                        ? 'bg-amber-400'
                        : meter.peak > 0.5
                        ? 'bg-lime-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ height: `${Math.min(100, meter.peak * 100)}%` }}
                  />
                </div>
              </div>

              {/* Fader Readout */}
              <div className="mt-2 text-center bg-[#090b0e] py-1 rounded border border-[#1b212c]">
                <span className="text-[11px] font-mono font-semibold text-white tabular-nums">
                  {dbVal <= -40 ? '-∞ dB' : `${dbVal > 0 ? '+' : ''}${dbVal.toFixed(1)} dB`}
                </span>
              </div>
            </div>
          );
        })}

        {/* Vertical Divider */}
        <div className="w-px bg-[#202734] mx-2 self-stretch" />

        {/* Master Output Bus Strip */}
        <div className="w-36 bg-[#161b24] rounded-lg border-2 border-[#2b3547] flex flex-col justify-between p-3 shrink-0 shadow-md">
          {/* Master Header */}
          <div className="pt-1 flex flex-col gap-1 text-center">
            <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-widest">
              MASTER BUS
            </span>
            <span className="text-xs font-extrabold text-white">
              MAIN OUT L/R
            </span>

            {/* Peak Limiter Indicator */}
            <div className="mt-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-[10px] text-emerald-400 font-mono">
              <ShieldAlert className="w-3 h-3 text-emerald-400" />
              <span>LIMITER ON</span>
            </div>
          </div>

          {/* Master Fader and Dual Stereo Meters */}
          <div className="flex-1 flex items-center justify-center gap-3 py-4">
            {/* dB Scale Legend */}
            <div className="flex flex-col justify-between text-[9px] font-mono text-[#616d80] h-48 select-none">
              <span>+6</span>
              <span>0</span>
              <span>-6</span>
              <span>-18</span>
              <span>-36</span>
              <span>-∞</span>
            </div>

            {/* Master Vertical Slider */}
            <div className="h-48 flex items-center">
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={masterVol}
                onChange={handleMasterVolume}
                className="h-48 w-7 appearance-none bg-transparent cursor-pointer [writing-mode:bt-lr] [-webkit-appearance:slider-vertical]"
              />
            </div>

            {/* Dual Stereo LED Meter */}
            <div className="h-48 flex gap-1 bg-[#090b0e] rounded-xs border border-[#1f2735] p-0.5">
              {/* Left Channel */}
              <div className="w-3 h-full flex flex-col-reverse overflow-hidden">
                <div
                  className={`w-full transition-all duration-75 rounded-xs ${
                    masterMeter.isClipping
                      ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                      : masterMeter.peak > 0.85
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ height: `${Math.min(100, masterMeter.peak * 100)}%` }}
                />
              </div>
              {/* Right Channel */}
              <div className="w-3 h-full flex flex-col-reverse overflow-hidden">
                <div
                  className={`w-full transition-all duration-75 rounded-xs ${
                    masterMeter.isClipping
                      ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]'
                      : masterMeter.peak > 0.85
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                  style={{ height: `${Math.min(100, masterMeter.peak * 96)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Master dB Readout & Clip LED */}
          <div className="mt-2 flex items-center justify-between px-2 bg-[#090b0e] py-1.5 rounded border border-[#212937]">
            <span className="text-xs font-mono font-bold text-white tabular-nums">
              {(20 * Math.log10(Math.max(0.001, masterVol))).toFixed(1)} dB
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono text-[#616d80]">CLIP</span>
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  masterMeter.isClipping ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,1)]' : 'bg-[#251012]'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
