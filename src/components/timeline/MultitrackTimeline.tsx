import React, { useRef, useState, useEffect } from 'react';
import { 
  AudioProject, 
  AudioTrack, 
  AudioClip, 
  TrackType 
} from '../../types/daw';
import { drawWaveform } from '../../audio/WaveformGenerator';
import { AudioEngine, LevelMeterData } from '../../audio/AudioEngine';
import { 
  Mic, 
  Film, 
  Plus, 
  Trash2, 
  Copy, 
  Scissors, 
  ZoomIn, 
  ZoomOut, 
  Upload, 
  SlidersHorizontal,
  Smartphone,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Sliders
} from 'lucide-react';

interface MultitrackTimelineProps {
  project: AudioProject;
  engine: AudioEngine;
  playheadTime: number;
  onSeek: (time: number) => void;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
  onSelectTrackForFX?: (trackId: string) => void;
  onOpenRecordModal?: (trackId: string) => void;
}

export const MultitrackTimeline: React.FC<MultitrackTimelineProps> = ({
  project,
  engine,
  playheadTime,
  onSeek,
  onUpdateProject,
  onSelectTrackForFX,
  onOpenRecordModal,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80); // Zoom level
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(project.tracks[0]?.id || '');
  const [trackMeters, setTrackMeters] = useState<Record<string, { peak: number; isClipping: boolean }>>({});
  const [isCompactHeader, setIsCompactHeader] = useState(false);
  const [showRotationTip, setShowRotationTip] = useState(true);
  const [openTrackSettingsId, setOpenTrackSettingsId] = useState<string | null>(null);
  
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetTrackForUpload, setTargetTrackForUpload] = useState<string | null>(null);

  // Auto detect small portrait screen on mount
  useEffect(() => {
    if (window.innerWidth < 640) {
      setIsCompactHeader(true);
    }
  }, []);

  // Meter listener
  useEffect(() => {
    const unsub = engine.onMeterUpdate((meters: LevelMeterData) => {
      const map: Record<string, { peak: number; isClipping: boolean }> = {};
      for (const [id, data] of Object.entries(meters.trackLevels)) {
        map[id] = { peak: data.peak, isClipping: data.isClipping };
      }
      setTrackMeters(map);
    });
    return unsub;
  }, [engine]);

  const totalWidth = Math.max(1200, project.duration * pixelsPerSecond + 200);

  // Ruler drag to seek playhead
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateTime = (clientX: number) => {
      const clickX = clientX - rect.left;
      const targetTime = Math.max(0, Math.min(project.duration, clickX / pixelsPerSecond));
      onSeek(targetTime);
    };
    updateTime(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateTime(moveEvent.clientX);
    };
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleRulerTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const updateTime = (clientX: number) => {
      const clickX = clientX - rect.left;
      const targetTime = Math.max(0, Math.min(project.duration, clickX / pixelsPerSecond));
      onSeek(targetTime);
    };
    updateTime(touch.clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (moveTouch) {
        updateTime(moveTouch.clientX);
      }
    };
    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Track manipulation
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

  const toggleTrackArm = (trackId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, armedForRecord: !t.armedForRecord } : t
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

  const handleTrackNameChange = (trackId: string, name: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, name } : t
      ),
    }));
  };

  const handleDeleteTrack = (trackId: string) => {
    if (project.tracks.length <= 1) return;
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== trackId),
    }));
  };

  // Primary user-creatable track type: Dub Vocal layers only
  const handleAddVocalLayer = () => {
    const vocalLayers = project.tracks.filter(
      (t) => t.type === 'dub_vocal' || t.name.startsWith('Dub Vocal')
    );
    const nextNumber = vocalLayers.length + 1;
    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4', '#eab308'];
    const color = colors[(nextNumber - 1) % colors.length];

    const newTrack: AudioTrack = {
      id: 'trk_vocal_' + Date.now(),
      name: `Dub Vocal ${nextNumber}`,
      type: 'dub_vocal',
      color,
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
      armedForRecord: true,
      effects: project.tracks[0]?.effects || {
        equalizer: {
          enabled: true,
          highPassFreq: 80,
          lowGain: 0,
          lowFreq: 120,
          midGain: 1.5,
          midFreq: 2400,
          midQ: 1.2,
          highGain: 2.0,
          highFreq: 8000,
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
          enabled: false,
          decay: 1.8,
          preDelay: 0.02,
          wetGain: 0.15,
          dryGain: 1.0,
          roomSize: 'dubbing_stage',
        },
        delay: {
          enabled: false,
          time: 0.25,
          feedback: 0.3,
          wetGain: 0.2,
        },
        gate: {
          enabled: false,
          threshold: -50,
          attack: 0.005,
          release: 0.1,
        },
      },
      clips: [],
    };

    onUpdateProject((prev) => ({
      ...prev,
      tracks: [...prev.tracks, newTrack],
    }));
  };

  // Clip actions
  const handleDeleteClip = (trackId: string, clipId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t
      ),
    }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const handleDuplicateClip = (trackId: string, clip: AudioClip) => {
    const newClip: AudioClip = {
      ...clip,
      id: 'clip_' + Date.now(),
      startTime: clip.startTime + clip.duration + 0.5,
      name: clip.name + ' (Copy)',
    };

    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, newClip] } : t
      ),
      duration: Math.max(prev.duration, newClip.startTime + newClip.duration + 2),
    }));
  };

  // Split clip at playhead
  const handleSplitClipAtPlayhead = (trackId: string, clip: AudioClip) => {
    if (playheadTime <= clip.startTime || playheadTime >= clip.startTime + clip.duration) {
      return;
    }

    const firstDuration = playheadTime - clip.startTime;
    const secondDuration = clip.duration - firstDuration;

    const clip1: AudioClip = {
      ...clip,
      id: 'clip_' + Date.now() + '_a',
      duration: firstDuration,
      name: clip.name + ' (Pt 1)',
    };

    const clip2: AudioClip = {
      ...clip,
      id: 'clip_' + Date.now() + '_b',
      startTime: playheadTime,
      duration: secondDuration,
      offset: clip.offset + firstDuration,
      name: clip.name + ' (Pt 2)',
    };

    onUpdateProject((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) => (c.id === clip.id ? clip1 : c)).concat(clip2),
            }
          : t
      ),
    }));
  };

  // Split all clips intersecting current playhead position
  const handleSplitAtPlayhead = () => {
    onUpdateProject((prev) => {
      let modified = false;
      const updatedTracks = prev.tracks.map((track) => {
        const newClips: AudioClip[] = [];
        for (const clip of track.clips) {
          if (playheadTime > clip.startTime + 0.05 && playheadTime < clip.startTime + clip.duration - 0.05) {
            modified = true;
            const firstDuration = playheadTime - clip.startTime;
            const secondDuration = clip.duration - firstDuration;

            const clip1: AudioClip = {
              ...clip,
              id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_a',
              duration: firstDuration,
              name: clip.name + ' (Pt 1)',
            };

            const clip2: AudioClip = {
              ...clip,
              id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4) + '_b',
              startTime: playheadTime,
              duration: secondDuration,
              offset: clip.offset + firstDuration,
              name: clip.name + ' (Pt 2)',
            };
            newClips.push(clip1, clip2);
          } else {
            newClips.push(clip);
          }
        }
        return { ...track, clips: newClips };
      });

      if (!modified && selectedClipId) {
        return {
          ...prev,
          tracks: prev.tracks.map((track) => ({
            ...track,
            clips: track.clips.flatMap((clip) => {
              if (clip.id === selectedClipId && playheadTime > clip.startTime && playheadTime < clip.startTime + clip.duration) {
                const firstDuration = playheadTime - clip.startTime;
                const secondDuration = clip.duration - firstDuration;
                const clip1: AudioClip = {
                  ...clip,
                  id: 'clip_' + Date.now() + '_a',
                  duration: firstDuration,
                  name: clip.name + ' (Pt 1)',
                };
                const clip2: AudioClip = {
                  ...clip,
                  id: 'clip_' + Date.now() + '_b',
                  startTime: playheadTime,
                  duration: secondDuration,
                  offset: clip.offset + firstDuration,
                  name: clip.name + ' (Pt 2)',
                };
                return [clip1, clip2];
              }
              return [clip];
            }),
          })),
        };
      }

      return { ...prev, tracks: updatedTracks };
    });
  };

  // Real Audio Import handler
  const handleUploadAudioClick = (trackId: string) => {
    setTargetTrackForUpload(trackId);
    fileInputRef.current?.click();
  };

  const handleAudioFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetTrackForUpload) return;

    try {
      const decoded = await engine.decodeAudioFile(file);
      const assetId = 'asset_' + Date.now();

      const newAsset = {
        id: assetId,
        name: file.name,
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        waveformPeaks: decoded.peaks,
        audioBuffer: decoded.audioBuffer,
      };

      const newClip: AudioClip = {
        id: 'clip_' + Date.now(),
        assetId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        startTime: playheadTime,
        duration: decoded.duration,
        offset: 0,
        volume: 1.0,
        pan: 0,
        fadeIn: 0.05,
        fadeOut: 0.05,
        muted: false,
      };

      onUpdateProject((prev) => ({
        ...prev,
        assets: {
          ...prev.assets,
          [assetId]: newAsset,
        },
        tracks: prev.tracks.map((t) =>
          t.id === targetTrackForUpload
            ? { ...t, clips: [...t.clips, newClip] }
            : t
        ),
        duration: Math.max(prev.duration, newClip.startTime + newClip.duration + 2),
      }));
    } catch (err) {
      console.error('Failed to decode audio file:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getTrackIcon = (type: TrackType) => {
    if (type === 'guide_reference' || type === 'film_audio') {
      return <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    return <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  };

  const nextVocalNumber = project.tracks.filter(
    (t) => t.type === 'dub_vocal' || t.name.startsWith('Dub Vocal')
  ).length + 1;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#090b0e] select-none">
      {/* Hidden file input for audio upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleAudioFileSelected}
        accept="audio/*,video/*"
        className="hidden"
      />

      {/* Rotation Advisory Banner for Mobile Portrait View */}
      {showRotationTip && (
        <div className="sm:hidden bg-[#161d2a] border-b border-[#28354a] px-3 py-1 flex items-center justify-between text-[11px] text-[#93a1b8] shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Rotate device to Landscape for wide studio timeline</span>
          </div>
          <button
            onClick={() => setShowRotationTip(false)}
            className="p-0.5 text-[#738299] hover:text-white shrink-0 ml-2 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Sub-toolbar: Add Vocal Layer, Header Width Toggle, Zoom */}
      <div className="h-9 sm:h-10 bg-[#11141a] border-b border-[#1b2028] px-2 sm:px-4 flex items-center justify-between text-xs text-[#828c9b] shrink-0 gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Trim / Split at Playhead Button (Scissor) */}
          <button
            onClick={handleSplitAtPlayhead}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#212938] hover:bg-[#2b3547] text-blue-300 font-semibold text-[11px] sm:text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            title="Trim / Split Audio at Playhead Position"
          >
            <Scissors className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden min-[480px]:inline">Trim (Playhead)</span>
          </button>

          {/* Add Dub Vocal Layer Action Button */}
          <button
            onClick={handleAddVocalLayer}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] sm:text-xs transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            title="Add Dub Vocal Layer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dub Vocal {nextVocalNumber}</span>
          </button>

          {/* Toggle Compact vs Wide Track Headers */}
          <button
            onClick={() => setIsCompactHeader(!isCompactHeader)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#181d26] hover:bg-[#222936] text-[11px] text-[#a4afbf] transition-colors cursor-pointer whitespace-nowrap"
            title={isCompactHeader ? 'Expand Track Headers' : 'Compact Track Headers'}
          >
            {isCompactHeader ? (
              <>
                <PanelLeftOpen className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden min-[480px]:inline">Wide Header</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden min-[480px]:inline">Compact</span>
              </>
            )}
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setPixelsPerSecond((p) => Math.max(30, p - 20))}
            className="p-1 rounded hover:bg-[#1c222c] text-[#828c9b] hover:text-white transition-colors cursor-pointer"
            title="Zoom Out Timeline"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[10px] sm:text-[11px] text-[#717c8d] w-12 text-center tabular-nums">
            {pixelsPerSecond}px/s
          </span>
          <button
            onClick={() => setPixelsPerSecond((p) => Math.min(240, p + 20))}
            className="p-1 rounded hover:bg-[#1c222c] text-[#828c9b] hover:text-white transition-colors cursor-pointer"
            title="Zoom In Timeline"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Multitrack Canvas Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers Column */}
        <div 
          className={`bg-[#11141a] border-r border-[#1d222b] flex flex-col shrink-0 z-10 transition-all duration-150 ${
            isCompactHeader ? 'w-24 sm:w-32' : 'w-44 sm:w-56 md:w-64'
          }`}
        >
          {/* Header spacer aligned with ruler */}
          <div className="h-8 bg-[#151921] border-b border-[#202632] px-2 flex items-center justify-between text-[10px] font-semibold text-[#6d7788] uppercase tracking-wider shrink-0">
            <span className="truncate">Vocals ({project.tracks.length})</span>
            {!isCompactHeader && <span className="hidden sm:inline">M / S / R</span>}
          </div>

          {/* Track Headers List */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {project.tracks.map((track) => {
              const isSelected = selectedTrackId === track.id;
              const meter = trackMeters[track.id] || { peak: 0, isClipping: false };
              const isSettingsOpen = openTrackSettingsId === track.id;

              return (
                <div
                  key={track.id}
                  onClick={() => setSelectedTrackId(track.id)}
                  className={`h-28 border-b border-[#1a1f28] p-2 flex flex-col justify-between transition-colors relative cursor-pointer ${
                    isSelected ? 'bg-[#171b23]' : 'bg-[#101318] hover:bg-[#141820]'
                  }`}
                >
                  {/* Left accent strip matching track color */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: track.color }}
                  />

                  {/* Top row: Track Type Icon, Name & Actions */}
                  <div className="flex items-center justify-between gap-1 pl-1">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {getTrackIcon(track.type)}
                      <input
                        type="text"
                        value={track.name}
                        onChange={(e) => handleTrackNameChange(track.id, e.target.value)}
                        className="bg-transparent border-none text-[11px] sm:text-xs font-semibold text-white focus:outline-hidden focus:bg-[#202734] rounded px-0.5 w-full truncate"
                      />
                    </div>

                    {!isCompactHeader ? (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {/* Open Vocal FX Rack */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectTrackForFX) onSelectTrackForFX(track.id);
                          }}
                          className="p-1 rounded hover:bg-[#202633] text-[#717c8d] hover:text-purple-400 transition-colors"
                          title="Open Vocal FX Rack"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                        </button>

                        {/* Import audio file */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadAudioClick(track.id);
                          }}
                          className="p-1 rounded hover:bg-[#202633] text-[#717c8d] hover:text-blue-400 transition-colors"
                          title="Import Audio into Track"
                        >
                          <Upload className="w-3 h-3" />
                        </button>

                        {/* Delete Track */}
                        {project.tracks.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTrack(track.id);
                            }}
                            className="p-1 rounded hover:bg-[#202633] text-[#717c8d] hover:text-red-400 transition-colors"
                            title="Delete Track"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenTrackSettingsId(isSettingsOpen ? null : track.id);
                        }}
                        className="p-1 rounded hover:bg-[#202633] text-[#717c8d] hover:text-blue-400"
                        title="Track Quick Settings"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Middle row: Mute, Solo, Record Arm */}
                  <div className="flex items-center gap-1 pl-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackMute(track.id);
                      }}
                      className={`w-5 h-5 rounded text-[9px] font-bold transition-colors cursor-pointer shrink-0 ${
                        track.muted
                          ? 'bg-amber-600 text-white font-extrabold'
                          : 'bg-[#1b2029] hover:bg-[#242b37] text-[#788394]'
                      }`}
                      title="Mute Track"
                    >
                      M
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackSolo(track.id);
                      }}
                      className={`w-5 h-5 rounded text-[9px] font-bold transition-colors cursor-pointer shrink-0 ${
                        track.solo
                          ? 'bg-yellow-400 text-slate-950 font-extrabold'
                          : 'bg-[#1b2029] hover:bg-[#242b37] text-[#788394]'
                      }`}
                      title="Solo Track"
                    >
                      S
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTrackArm(track.id);
                        if (onOpenRecordModal && !track.armedForRecord) {
                          onOpenRecordModal(track.id);
                        }
                      }}
                      className={`w-5 h-5 rounded text-[9px] font-bold transition-colors cursor-pointer shrink-0 ${
                        track.armedForRecord
                          ? 'bg-red-600 text-white ring-1 ring-red-400'
                          : 'bg-[#1b2029] hover:bg-[#242b37] text-[#788394]'
                      }`}
                      title="Arm Track for Recording"
                    >
                      R
                    </button>

                    {/* Level meter bar */}
                    <div className="flex-1 h-2 bg-[#080a0d] rounded-xs overflow-hidden ml-0.5 border border-[#1c222c]">
                      <div
                        className={`h-full transition-all duration-75 ${
                          meter.isClipping
                            ? 'bg-red-500'
                            : meter.peak > 0.8
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, meter.peak * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom row: Volume / Pan Controls */}
                  {!isCompactHeader ? (
                    <div className="flex items-center gap-1.5 pl-1 text-[10px] font-mono text-[#6d7788]">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="text-[9px] text-[#556070] shrink-0">VOL</span>
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.01"
                          value={track.volume}
                          onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#1f2532] rounded appearance-none cursor-pointer accent-blue-500"
                        />
                        <span className="w-6 text-right text-[9px] tabular-nums hidden sm:inline shrink-0">
                          {(track.volume * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="hidden md:flex items-center gap-1 w-14 shrink-0">
                        <span className="text-[9px] text-[#556070]">PAN</span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={track.pan}
                          onChange={(e) => handleTrackPan(track.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#1f2532] rounded appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-[9px] font-mono text-[#717c8d] pl-1 truncate">
                      Vol: {(track.volume * 100).toFixed(0)}%
                    </div>
                  )}

                  {/* Quick Settings Popover for Compact Mode */}
                  {isSettingsOpen && (
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="absolute left-full top-0 ml-1 z-40 bg-[#161a22] border border-[#2b3547] rounded-lg p-2.5 shadow-xl flex flex-col gap-2 w-48 text-xs select-none"
                    >
                      <div className="flex items-center justify-between pb-1 border-b border-[#222a38]">
                        <span className="font-bold text-white text-[11px] truncate">{track.name}</span>
                        <button
                          onClick={() => setOpenTrackSettingsId(null)}
                          className="text-[#717c8d] hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-[#717c8d] mb-0.5">
                          <span>Volume</span>
                          <span>{(track.volume * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.01"
                          value={track.volume}
                          onChange={(e) => handleTrackVolume(track.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#202735] rounded accent-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] text-[#717c8d] mb-0.5">
                          <span>Pan</span>
                          <span>{track.pan.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.05"
                          value={track.pan}
                          onChange={(e) => handleTrackPan(track.id, parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#202735] rounded accent-purple-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 pt-1 border-t border-[#222a38]">
                        <button
                          onClick={() => {
                            setOpenTrackSettingsId(null);
                            if (onSelectTrackForFX) onSelectTrackForFX(track.id);
                          }}
                          className="flex-1 py-1 rounded bg-[#202837] hover:bg-[#2b364a] text-purple-300 text-[10px] font-semibold text-center"
                        >
                          FX Rack
                        </button>
                        <button
                          onClick={() => {
                            setOpenTrackSettingsId(null);
                            handleUploadAudioClick(track.id);
                          }}
                          className="flex-1 py-1 rounded bg-[#202837] hover:bg-[#2b364a] text-blue-300 text-[10px] font-semibold text-center"
                        >
                          Import
                        </button>
                        {project.tracks.length > 1 && (
                          <button
                            onClick={() => {
                              setOpenTrackSettingsId(null);
                              handleDeleteTrack(track.id);
                            }}
                            className="p-1 rounded bg-[#202837] hover:bg-red-950 text-red-400"
                            title="Delete Track"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scrollable Timeline Viewport */}
        <div 
          ref={timelineScrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#08090c]"
        >
          <div style={{ width: `${totalWidth}px` }} className="relative">
            {/* Time Ruler (Height: 32px) */}
            <div
              onMouseDown={handleRulerMouseDown}
              onTouchStart={handleRulerTouchStart}
              className="h-8 bg-[#12151d] border-b border-[#1f2530] sticky top-0 z-20 cursor-ew-resize select-none relative"
            >
              {Array.from({ length: Math.ceil(project.duration + 10) }).map((_, sec) => {
                const x = sec * pixelsPerSecond;
                const isMajor = sec % 5 === 0;

                return (
                  <div
                    key={sec}
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: `${x}px` }}
                  >
                    <div
                      className={`w-px ${
                        isMajor ? 'h-3 bg-[#3e4859]' : 'h-1.5 bg-[#222833]'
                      }`}
                    />
                    {isMajor && (
                      <span className="absolute top-3.5 left-1 text-[10px] font-mono text-[#677282] tabular-nums">
                        {sec}s
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Red Playhead Line */}
            <div
              className="absolute top-0 bottom-0 z-30 cursor-ew-resize group"
              style={{ left: `${playheadTime * pixelsPerSecond}px` }}
              onMouseDown={(e) => {
                e.preventDefault();
                const handleMouseMove = (me: MouseEvent) => {
                  const rect = timelineScrollRef.current?.getBoundingClientRect();
                  if (rect) {
                    const time = Math.max(0, Math.min(project.duration, (me.clientX - rect.left + timelineScrollRef.current!.scrollLeft) / pixelsPerSecond));
                    onSeek(time);
                  }
                };
                const handleMouseUp = () => {
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('mouseup', handleMouseUp);
                };
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                const handleTouchMove = (te: TouchEvent) => {
                  const rect = timelineScrollRef.current?.getBoundingClientRect();
                  if (rect && te.touches[0]) {
                    const time = Math.max(0, Math.min(project.duration, (te.touches[0].clientX - rect.left + timelineScrollRef.current!.scrollLeft) / pixelsPerSecond));
                    onSeek(time);
                  }
                };
                const handleTouchEnd = () => {
                  window.removeEventListener('touchmove', handleTouchMove);
                  window.removeEventListener('touchend', handleTouchEnd);
                };
                window.addEventListener('touchmove', handleTouchMove);
                window.addEventListener('touchend', handleTouchEnd);
              }}
            >
              <div className="w-0 h-0 border-x-4 border-x-transparent border-t-6 border-t-red-500 -ml-1" />
              <div className="w-0.5 h-full bg-red-500/90 shadow-[0_0_8px_rgba(239,68,68,0.6)] group-hover:bg-red-400" />
            </div>

            {/* Track Lanes */}
            <div className="relative">
              {project.tracks.map((track) => (
                <div
                  key={track.id}
                  className={`h-28 border-b border-[#161a22] relative overflow-hidden transition-colors ${
                    track.muted ? 'opacity-40' : ''
                  }`}
                  style={{
                    backgroundImage: `linear-gradient(to right, #11151e 1px, transparent 1px)`,
                    backgroundSize: `${pixelsPerSecond}px 100%`,
                  }}
                >
                  {/* Track Clips */}
                  {track.clips.map((clip) => {
                    const asset = project.assets[clip.assetId];
                    const clipWidth = clip.duration * pixelsPerSecond;
                    const clipLeft = clip.startTime * pixelsPerSecond;
                    const isClipSelected = selectedClipId === clip.id;

                    return (
                      <TimelineClip
                        key={clip.id}
                        clip={clip}
                        assetPeaks={asset?.waveformPeaks || []}
                        left={clipLeft}
                        width={clipWidth}
                        color={track.color}
                        isSelected={isClipSelected}
                        pixelsPerSecond={pixelsPerSecond}
                        onSelect={() => setSelectedClipId(clip.id)}
                        onDelete={() => handleDeleteClip(track.id, clip.id)}
                        onDuplicate={() => handleDuplicateClip(track.id, clip)}
                        onSplit={() => handleSplitClipAtPlayhead(track.id, clip)}
                        onUpdateClip={(updatedClip) => {
                          onUpdateProject((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id
                                ? {
                                    ...t,
                                    clips: t.clips.map((c) =>
                                      c.id === clip.id ? updatedClip : c
                                    ),
                                  }
                                : t
                            ),
                          }));
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Timeline Audio Clip Component with Touch Support ---

interface TimelineClipProps {
  clip: AudioClip;
  assetPeaks: number[];
  left: number;
  width: number;
  color: string;
  isSelected: boolean;
  pixelsPerSecond: number;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
  onUpdateClip: (clip: AudioClip) => void;
}

const TimelineClip: React.FC<TimelineClipProps> = ({
  clip,
  assetPeaks,
  left,
  width,
  color,
  isSelected,
  pixelsPerSecond,
  onSelect,
  onDelete,
  onDuplicate,
  onSplit,
  onUpdateClip,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Render authentic waveform onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = Math.max(20, Math.floor(width));
    canvas.height = 70;

    drawWaveform(canvas, assetPeaks, color, '#080a0e');
  }, [assetPeaks, width, color]);

  // Handle left edge trimming (Mouse & Touch)
  const handleLeftTrimStart = (clientX: number) => {
    onSelect();
    const startX = clientX;
    const initialStartTime = clip.startTime;
    const initialDuration = clip.duration;
    const initialOffset = clip.offset;

    const handleMove = (currentX: number) => {
      const deltaX = currentX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStartTime = Math.max(0, initialStartTime + deltaTime);
      const actualDelta = newStartTime - initialStartTime;
      const newDuration = Math.max(0.1, initialDuration - actualDelta);
      const newOffset = Math.max(0, initialOffset + actualDelta);

      onUpdateClip({
        ...clip,
        startTime: newStartTime,
        duration: newDuration,
        offset: newOffset,
      });
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);
  };

  const handleLeftTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleLeftTrimStart(e.clientX);
  };

  const handleLeftTrimTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches[0]) {
      handleLeftTrimStart(e.touches[0].clientX);
    }
  };

  // Handle right edge trimming (Mouse & Touch)
  const handleRightTrimStart = (clientX: number) => {
    onSelect();
    const startX = clientX;
    const initialDuration = clip.duration;

    const handleMove = (currentX: number) => {
      const deltaX = currentX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newDuration = Math.max(0.1, initialDuration + deltaTime);

      onUpdateClip({
        ...clip,
        duration: newDuration,
      });
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handleMove(e.touches[0].clientX);
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);
  };

  const handleRightTrimMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleRightTrimStart(e.clientX);
  };

  const handleRightTrimTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches[0]) {
      handleRightTrimStart(e.touches[0].clientX);
    }
  };

  // Handle clip dragging along timeline (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    setIsDragging(true);
    const startX = e.clientX;
    const initialStartTime = clip.startTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStartTime = Math.max(0, initialStartTime + deltaTime);
      onUpdateClip({ ...clip, startTime: newStartTime });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Handle clip dragging along timeline (Touch for Android / mobile)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    onSelect();
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    const startX = touch.clientX;
    const initialStartTime = clip.startTime;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveTouch = moveEvent.touches[0];
      if (!moveTouch) return;
      const deltaX = moveTouch.clientX - startX;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStartTime = Math.max(0, initialStartTime + deltaTime);
      onUpdateClip({ ...clip, startTime: newStartTime });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={`absolute top-2.5 bottom-2.5 rounded-md overflow-hidden flex flex-col border transition-shadow cursor-grab active:cursor-grabbing select-none ${
        isSelected
          ? 'ring-2 ring-white border-white shadow-lg z-10'
          : 'border-[#293240] hover:border-[#3e4a5d]'
      }`}
      style={{
        left: `${left}px`,
        width: `${Math.max(24, width)}px`,
        backgroundColor: '#141820',
      }}
    >
      {/* Left Trim Handle */}
      <div
        onMouseDown={handleLeftTrimMouseDown}
        onTouchStart={handleLeftTrimTouchStart}
        className="absolute left-0 top-0 bottom-0 w-3 bg-white/15 hover:bg-white/40 cursor-ew-resize z-20 flex items-center justify-center transition-colors"
        title="Trim Start"
      >
        <div className="w-0.5 h-4 bg-white/70 rounded-full" />
      </div>

      {/* Right Trim Handle */}
      <div
        onMouseDown={handleRightTrimMouseDown}
        onTouchStart={handleRightTrimTouchStart}
        className="absolute right-0 top-0 bottom-0 w-3 bg-white/15 hover:bg-white/40 cursor-ew-resize z-20 flex items-center justify-center transition-colors"
        title="Trim End"
      >
        <div className="w-0.5 h-4 bg-white/70 rounded-full" />
      </div>
      {/* Clip Title Banner with quick actions */}
      <div 
        className="h-5 px-1.5 flex items-center justify-between text-[10px] font-semibold text-white truncate shrink-0"
        style={{ backgroundColor: color + 'dd' }}
      >
        <span className="truncate">{clip.name}</span>

        {isSelected && (
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSplit();
              }}
              className="p-0.5 rounded hover:bg-black/30 transition-colors cursor-pointer"
              title="Split at Playhead"
            >
              <Scissors className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
              className="p-0.5 rounded hover:bg-black/30 transition-colors cursor-pointer"
              title="Duplicate Clip"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-0.5 rounded hover:bg-black/30 text-red-200 transition-colors cursor-pointer"
              title="Delete Clip"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Waveform Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#0a0d13]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Clip Fade In / Fade Out Overlays */}
        {clip.fadeIn > 0 && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-linear-to-r from-black/60 to-transparent pointer-events-none"
            style={{ width: `${clip.fadeIn * pixelsPerSecond}px` }}
          />
        )}
        {clip.fadeOut > 0 && (
          <div
            className="absolute top-0 bottom-0 right-0 bg-linear-to-l from-black/60 to-transparent pointer-events-none"
            style={{ width: `${clip.fadeOut * pixelsPerSecond}px` }}
          />
        )}
      </div>
    </div>
  );
};
