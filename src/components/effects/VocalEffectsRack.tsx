import React, { useState } from 'react';
import { AudioProject, VocalEffectsRack as EffectsRackType } from '../../types/daw';
import { Sparkles, Sliders, Activity, Disc, Waves, Power, RotateCcw } from 'lucide-react';

interface VocalEffectsRackProps {
  project: AudioProject;
  selectedTrackId: string;
  onSelectTrack: (trackId: string) => void;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
}

export const VocalEffectsRack: React.FC<VocalEffectsRackProps> = ({
  project,
  selectedTrackId,
  onSelectTrack,
  onUpdateProject,
}) => {
  const currentTrack = project.tracks.find((t) => t.id === selectedTrackId) || project.tracks[0];
  const fx = currentTrack?.effects;

  const updateEffects = (updater: (prev: EffectsRackType) => EffectsRackType) => {
    if (!currentTrack) return;
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === currentTrack.id ? { ...t, effects: updater(t.effects) } : t
      ),
    }));
  };

  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'mature_authoritative':
        updateEffects((prev) => ({
          ...prev,
          equalizer: {
            enabled: true,
            highPassFreq: 75,
            lowGain: 3.5,
            lowFreq: 120,
            midGain: 1.5,
            midFreq: 2200,
            midQ: 1.2,
            highGain: 2.0,
            highFreq: 7500,
          },
          compressor: {
            enabled: true,
            threshold: -22,
            ratio: 5.0,
            attack: 0.01,
            release: 0.15,
            makeupGain: 4.0,
          },
          pitch: {
            enabled: true,
            pitchSemitones: -2,
            fineTuneCents: 0,
            formantShift: -3,
            preserveTiming: true,
          },
          reverb: {
            enabled: true,
            decay: 2.0,
            preDelay: 0.02,
            wetGain: 0.15,
            dryGain: 1.0,
            roomSize: 'dubbing_stage',
          },
          delay: { enabled: false, time: 0.3, feedback: 0.2, wetGain: 0.1 },
          gate: { enabled: true, threshold: -48, attack: 0.005, release: 0.1 },
        }));
        break;

      case 'rough_dramatic':
        updateEffects((prev) => ({
          ...prev,
          equalizer: {
            enabled: true,
            highPassFreq: 85,
            lowGain: 2.0,
            lowFreq: 140,
            midGain: 3.5,
            midFreq: 2600,
            midQ: 1.5,
            highGain: 2.5,
            highFreq: 8000,
          },
          compressor: {
            enabled: true,
            threshold: -20,
            ratio: 6.0,
            attack: 0.006,
            release: 0.12,
            makeupGain: 4.5,
          },
          pitch: {
            enabled: true,
            pitchSemitones: -1,
            fineTuneCents: 0,
            formantShift: -2,
            preserveTiming: true,
          },
          reverb: {
            enabled: true,
            decay: 2.2,
            preDelay: 0.025,
            wetGain: 0.18,
            dryGain: 1.0,
            roomSize: 'cinematic_hall',
          },
          delay: { enabled: false, time: 0.25, feedback: 0.25, wetGain: 0.12 },
          gate: { enabled: true, threshold: -50, attack: 0.005, release: 0.1 },
        }));
        break;

      case 'smooth_lead':
        updateEffects((prev) => ({
          ...prev,
          equalizer: {
            enabled: true,
            highPassFreq: 80,
            lowGain: 1.0,
            lowFreq: 130,
            midGain: 2.0,
            midFreq: 3000,
            midQ: 1.2,
            highGain: 3.0,
            highFreq: 9000,
          },
          compressor: {
            enabled: true,
            threshold: -18,
            ratio: 3.5,
            attack: 0.015,
            release: 0.15,
            makeupGain: 3.0,
          },
          pitch: {
            enabled: false,
            pitchSemitones: 0,
            fineTuneCents: 0,
            formantShift: 0,
            preserveTiming: true,
          },
          reverb: {
            enabled: true,
            decay: 1.4,
            preDelay: 0.015,
            wetGain: 0.1,
            dryGain: 1.0,
            roomSize: 'small_booth',
          },
          delay: { enabled: false, time: 0.2, feedback: 0.2, wetGain: 0.1 },
          gate: { enabled: true, threshold: -55, attack: 0.005, release: 0.08 },
        }));
        break;

      case 'natural_dialogue':
        updateEffects((prev) => ({
          ...prev,
          equalizer: {
            enabled: true,
            highPassFreq: 80,
            lowGain: 0,
            lowFreq: 120,
            midGain: 1.0,
            midFreq: 2400,
            midQ: 1.0,
            highGain: 1.5,
            highFreq: 8000,
          },
          compressor: {
            enabled: true,
            threshold: -16,
            ratio: 2.5,
            attack: 0.02,
            release: 0.18,
            makeupGain: 2.0,
          },
          pitch: {
            enabled: false,
            pitchSemitones: 0,
            fineTuneCents: 0,
            formantShift: 0,
            preserveTiming: true,
          },
          reverb: {
            enabled: true,
            decay: 1.0,
            preDelay: 0.01,
            wetGain: 0.06,
            dryGain: 1.0,
            roomSize: 'small_booth',
          },
          delay: { enabled: false, time: 0.2, feedback: 0.2, wetGain: 0.1 },
          gate: { enabled: true, threshold: -58, attack: 0.005, release: 0.08 },
        }));
        break;
    }
  };

  if (!currentTrack || !fx) {
    return (
      <div className="flex-1 bg-[#0a0c0f] flex items-center justify-center text-xs text-[#717b8c]">
        Select a track to configure vocal effects.
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#0a0c0f] p-6 flex flex-col overflow-y-auto select-none">
      {/* Top Header & Track Selector */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1c222b] shrink-0 mb-6">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Professional Vocal Processing DSP Rack</span>
          </h2>
          <p className="text-xs text-[#737e90] mt-0.5">
            Parametric EQ · Dynamic Compressor · Formant Shifter · Studio Reverb & Delay
          </p>
        </div>

        {/* Track Selector & Presets */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#12161d] px-2.5 py-1.5 rounded border border-[#202735]">
            <span className="text-[11px] text-[#717d91] font-medium">Selected Track:</span>
            <select
              value={currentTrack.id}
              onChange={(e) => onSelectTrack(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-white focus:outline-hidden cursor-pointer"
            >
              {project.tracks.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#12161d] text-white">
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 bg-[#12161d] p-1 rounded border border-[#202735]">
            <button
              onClick={() => applyPreset('mature_authoritative')}
              className="px-2 py-1 rounded hover:bg-[#1f2633] text-[11px] font-medium text-amber-400 transition-colors cursor-pointer"
            >
              Mature Authoritative
            </button>
            <button
              onClick={() => applyPreset('rough_dramatic')}
              className="px-2 py-1 rounded hover:bg-[#1f2633] text-[11px] font-medium text-red-400 transition-colors cursor-pointer"
            >
              Rough Dramatic
            </button>
            <button
              onClick={() => applyPreset('smooth_lead')}
              className="px-2 py-1 rounded hover:bg-[#1f2633] text-[11px] font-medium text-blue-400 transition-colors cursor-pointer"
            >
              Smooth Lead
            </button>
            <button
              onClick={() => applyPreset('natural_dialogue')}
              className="px-2 py-1 rounded hover:bg-[#1f2633] text-[11px] font-medium text-emerald-400 transition-colors cursor-pointer"
            >
              Natural Dialogue
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Modular Effects Units */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Unit 1: 4-Band Parametric Equalizer */}
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c232f]">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Parametric Equalizer (4-Band)
              </span>
            </div>

            <button
              onClick={() =>
                updateEffects((prev) => ({
                  ...prev,
                  equalizer: { ...prev.equalizer, enabled: !prev.equalizer.enabled },
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                fx.equalizer.enabled
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                  : 'bg-[#1b202a] text-[#6d798c]'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{fx.equalizer.enabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          </div>

          {/* SVG Visual EQ Curve Display */}
          <div className="h-32 bg-[#090b0e] rounded-lg border border-[#1a202c] my-3 relative overflow-hidden flex items-center justify-center p-2">
            <svg className="w-full h-full" viewBox="0 0 400 120" preserveAspectRatio="none">
              {/* Grid Lines */}
              <line x1="0" y1="60" x2="400" y2="60" stroke="#1d2532" strokeWidth="1" strokeDasharray="3,3" />
              <line x1="100" y1="0" x2="100" y2="120" stroke="#161d28" strokeWidth="1" />
              <line x1="200" y1="0" x2="200" y2="120" stroke="#161d28" strokeWidth="1" />
              <line x1="300" y1="0" x2="300" y2="120" stroke="#161d28" strokeWidth="1" />

              {/* Dynamic Composite EQ Spline Path */}
              <path
                d={`M 0,${60 + (fx.equalizer.enabled ? 50 : 0)} 
                   Q ${Math.min(60, fx.equalizer.highPassFreq / 3)},${60} 80,${60 - fx.equalizer.lowGain * 2} 
                   Q 200,${60 - fx.equalizer.midGain * 3} 320,${60 - fx.equalizer.highGain * 2} 
                   L 400,${60 - fx.equalizer.highGain * 2}`}
                fill="none"
                stroke={fx.equalizer.enabled ? '#3b82f6' : '#4b5563'}
                strokeWidth="2.5"
                className="transition-all duration-150"
              />

              {/* EQ Control Nodes */}
              {fx.equalizer.enabled && (
                <>
                  <circle cx="80" cy={60 - fx.equalizer.lowGain * 2} r="4" fill="#60a5fa" />
                  <circle cx="200" cy={60 - fx.equalizer.midGain * 3} r="4" fill="#a78bfa" />
                  <circle cx="320" cy={60 - fx.equalizer.highGain * 2} r="4" fill="#34d399" />
                </>
              )}
            </svg>
            <div className="absolute bottom-1 right-2 text-[9px] font-mono text-[#525f73]">
              20Hz — 20kHz
            </div>
          </div>

          {/* EQ Knobs / Sliders Controls */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center font-mono">
            {/* High Pass */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">HP Filter</span>
              <span className="text-xs font-bold text-white block my-1">
                {fx.equalizer.highPassFreq} Hz
              </span>
              <input
                type="range"
                min="20"
                max="300"
                step="5"
                value={fx.equalizer.highPassFreq}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    equalizer: { ...prev.equalizer, highPassFreq: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Low Gain */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Low Gain</span>
              <span className="text-xs font-bold text-blue-400 block my-1">
                {fx.equalizer.lowGain > 0 ? '+' : ''}{fx.equalizer.lowGain} dB
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={fx.equalizer.lowGain}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    equalizer: { ...prev.equalizer, lowGain: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Mid Gain & Mid Freq */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Mid Gain</span>
              <span className="text-xs font-bold text-purple-400 block my-1">
                {fx.equalizer.midGain > 0 ? '+' : ''}{fx.equalizer.midGain} dB
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={fx.equalizer.midGain}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    equalizer: { ...prev.equalizer, midGain: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-purple-500"
              />
              <span className="text-[9px] text-[#556174] block mt-1">{fx.equalizer.midFreq} Hz</span>
            </div>

            {/* High Gain */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">High Air</span>
              <span className="text-xs font-bold text-emerald-400 block my-1">
                {fx.equalizer.highGain > 0 ? '+' : ''}{fx.equalizer.highGain} dB
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="0.5"
                value={fx.equalizer.highGain}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    equalizer: { ...prev.equalizer, highGain: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Unit 2: Studio Dynamics Compressor */}
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c232f]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Studio Dynamics Compressor
              </span>
            </div>

            <button
              onClick={() =>
                updateEffects((prev) => ({
                  ...prev,
                  compressor: { ...prev.compressor, enabled: !prev.compressor.enabled },
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                fx.compressor.enabled
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#1b202a] text-[#6d798c]'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{fx.compressor.enabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          </div>

          {/* Gain Reduction Meter Display */}
          <div className="h-20 bg-[#090b0e] rounded-lg border border-[#1a202c] my-3 p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#6e7b8f]">
              <span>GAIN REDUCTION (GR)</span>
              <span className="text-amber-400 font-bold">
                {fx.compressor.enabled ? '-4.2 dB' : '0.0 dB'}
              </span>
            </div>

            {/* Multi-tier Reduction Bar */}
            <div className="h-3.5 bg-[#141922] rounded-xs border border-[#1f2735] overflow-hidden flex flex-row-reverse">
              <div
                className={`h-full transition-all duration-100 ${
                  fx.compressor.enabled ? 'bg-amber-400 shadow-xs' : 'bg-transparent'
                }`}
                style={{ width: fx.compressor.enabled ? '35%' : '0%' }}
              />
            </div>

            <div className="flex justify-between text-[9px] font-mono text-[#4e5a6c]">
              <span>-20dB</span>
              <span>-15dB</span>
              <span>-10dB</span>
              <span>-6dB</span>
              <span>-3dB</span>
              <span>0dB</span>
            </div>
          </div>

          {/* Compressor Controls */}
          <div className="grid grid-cols-5 gap-2 pt-1 text-center font-mono">
            {/* Threshold */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Threshold</span>
              <span className="text-xs font-bold text-white block my-1">
                {fx.compressor.threshold} dB
              </span>
              <input
                type="range"
                min="-48"
                max="0"
                step="1"
                value={fx.compressor.threshold}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, threshold: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Ratio */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Ratio</span>
              <span className="text-xs font-bold text-white block my-1">
                {fx.compressor.ratio.toFixed(1)}:1
              </span>
              <input
                type="range"
                min="1"
                max="12"
                step="0.5"
                value={fx.compressor.ratio}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, ratio: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Attack */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Attack</span>
              <span className="text-xs font-bold text-white block my-1">
                {Math.round(fx.compressor.attack * 1000)} ms
              </span>
              <input
                type="range"
                min="0.001"
                max="0.08"
                step="0.002"
                value={fx.compressor.attack}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, attack: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Release */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Release</span>
              <span className="text-xs font-bold text-white block my-1">
                {Math.round(fx.compressor.release * 1000)} ms
              </span>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.01"
                value={fx.compressor.release}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, release: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Makeup Gain */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Makeup</span>
              <span className="text-xs font-bold text-amber-400 block my-1">
                +{fx.compressor.makeupGain} dB
              </span>
              <input
                type="range"
                min="0"
                max="18"
                step="0.5"
                value={fx.compressor.makeupGain}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    compressor: { ...prev.compressor, makeupGain: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Unit 3: Pitch & Formant Shifter (Voice Character) */}
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c232f]">
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Pitch & Formant Shifter (Voice Character)
              </span>
            </div>

            <button
              onClick={() =>
                updateEffects((prev) => ({
                  ...prev,
                  pitch: { ...prev.pitch, enabled: !prev.pitch.enabled },
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                fx.pitch.enabled
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                  : 'bg-[#1b202a] text-[#6d798c]'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{fx.pitch.enabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          </div>

          <p className="text-xs text-[#717e92] my-3">
            Independent pitch & vocal tract formant shifting. Transform actor voices into deep dramatic movie trailer narration or lighter character dialogue without changing timeline speed.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center font-mono">
            {/* Pitch Semitones */}
            <div className="bg-[#0e1218] p-3 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Pitch Semitones</span>
              <span className="text-sm font-bold text-white block my-1">
                {fx.pitch.pitchSemitones > 0 ? '+' : ''}{fx.pitch.pitchSemitones} st
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={fx.pitch.pitchSemitones}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    pitch: { ...prev.pitch, pitchSemitones: parseInt(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            {/* Formant Shift (Vocal Cavity) */}
            <div className="bg-[#0e1218] p-3 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Formant Shift</span>
              <span className="text-sm font-bold text-amber-400 block my-1">
                {fx.pitch.formantShift > 0 ? 'Thin / Bright' : fx.pitch.formantShift < 0 ? 'Deep / Chest' : 'Neutral'}
              </span>
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                value={fx.pitch.formantShift}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    pitch: { ...prev.pitch, formantShift: parseInt(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Timing Preservation */}
            <div className="bg-[#0e1218] p-3 rounded border border-[#1b222d] flex flex-col justify-between">
              <span className="text-[10px] text-[#637084] block font-sans">Timing Lock</span>
              <span className="text-xs font-semibold text-emerald-400 block">
                Preserve Sync
              </span>
              <span className="text-[9px] text-[#556377]">Locked to 24 FPS</span>
            </div>
          </div>
        </div>

        {/* Unit 4: Dubbing Stage Reverb & Spatial Delay */}
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c232f]">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Dubbing Stage Reverb & Delay
              </span>
            </div>

            <button
              onClick={() =>
                updateEffects((prev) => ({
                  ...prev,
                  reverb: { ...prev.reverb, enabled: !prev.reverb.enabled },
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                fx.reverb.enabled
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                  : 'bg-[#1b202a] text-[#6d798c]'
              }`}
            >
              <Power className="w-3 h-3" />
              <span>{fx.reverb.enabled ? 'ACTIVE' : 'BYPASS'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 my-3 text-center font-mono">
            {/* Room Model */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Acoustic Room</span>
              <select
                value={fx.reverb.roomSize}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    reverb: {
                      ...prev.reverb,
                      roomSize: e.target.value as EffectsRackType['reverb']['roomSize'],
                    },
                  }))
                }
                className="w-full mt-2 bg-[#171d27] text-white text-[11px] rounded p-1 border border-[#2b3547] focus:outline-hidden"
              >
                <option value="small_booth">Dry Booth</option>
                <option value="dubbing_stage">Dubbing Stage</option>
                <option value="cinematic_hall">Cinematic Hall</option>
                <option value="cathedral">Cathedral</option>
              </select>
            </div>

            {/* Decay Time */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Decay</span>
              <span className="text-xs font-bold text-cyan-400 block my-1">
                {fx.reverb.decay.toFixed(1)}s
              </span>
              <input
                type="range"
                min="0.5"
                max="4.5"
                step="0.1"
                value={fx.reverb.decay}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    reverb: { ...prev.reverb, decay: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Wet Mix */}
            <div className="bg-[#0e1218] p-2 rounded border border-[#1b222d]">
              <span className="text-[10px] text-[#637084] block font-sans">Wet Mix</span>
              <span className="text-xs font-bold text-cyan-400 block my-1">
                {Math.round(fx.reverb.wetGain * 100)}%
              </span>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.02"
                value={fx.reverb.wetGain}
                onChange={(e) =>
                  updateEffects((prev) => ({
                    ...prev,
                    reverb: { ...prev.reverb, wetGain: parseFloat(e.target.value) },
                  }))
                }
                className="w-full h-1 bg-[#202735] rounded appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#707c8e] pt-1 border-t border-[#1a212d]">
            <span>Noise Gate: {fx.gate.enabled ? `${fx.gate.threshold} dB Threshold` : 'Off'}</span>
            <button
              onClick={() =>
                updateEffects((prev) => ({
                  ...prev,
                  gate: { ...prev.gate, enabled: !prev.gate.enabled },
                }))
              }
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                fx.gate.enabled ? 'bg-emerald-950 text-emerald-400' : 'bg-[#1b202a] text-[#6b778a]'
              }`}
            >
              GATE {fx.gate.enabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
