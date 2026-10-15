import React, { useRef, useEffect, useState } from 'react';
import { AudioProject, VideoCueMarker } from '../../types/daw';
import { AudioEngine } from '../../audio/AudioEngine';
import { 
  Video, 
  Upload, 
  Play, 
  Pause, 
  Bookmark, 
  Plus, 
  Trash2, 
  Clock, 
  Volume2, 
  User, 
  FileText 
} from 'lucide-react';

interface VideoDubbingWorkspaceProps {
  project: AudioProject;
  engine: AudioEngine;
  playheadTime: number;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
  onOpenRecordModal: () => void;
}

export const VideoDubbingWorkspace: React.FC<VideoDubbingWorkspaceProps> = ({
  project,
  engine,
  playheadTime,
  isPlaying,
  onPlay,
  onPause,
  onSeek,
  onUpdateProject,
  onOpenRecordModal,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMarkerLabel, setNewMarkerLabel] = useState('');
  const [newMarkerSpeaker, setNewMarkerSpeaker] = useState('Cmdr. Vance');
  const [newMarkerNotes, setNewMarkerNotes] = useState('');

  // Keep video synchronized with audio timeline playhead
  useEffect(() => {
    if (videoRef.current) {
      const v = videoRef.current;
      if (Math.abs(v.currentTime - playheadTime) > 0.15) {
        v.currentTime = playheadTime;
      }
      if (isPlaying && v.paused) {
        v.play().catch(() => {});
      } else if (!isPlaying && !v.paused) {
        v.pause();
      }
    }
  }, [playheadTime, isPlaying]);

  // If no user video file is uploaded yet, draw a cinematic sci-fi film dubbing canvas
  useEffect(() => {
    if (project.videoUrl) return; // User has uploaded real video
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = (canvas.width = 640);
    const h = (canvas.height = 360);

    // Draw dark cinematic space / airlock scene with animated grid & timecode
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, w, h);

    // Starfield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137 + playheadTime * 5) % w);
      const sy = (i * 93) % h;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // Airlock viewport frame
    ctx.strokeStyle = '#1e2837';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);

    // Horizon planet glow
    const grad = ctx.createRadialGradient(w / 2, h + 50, 20, w / 2, h + 50, 300);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Center sci-fi HUD reticle
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Scene prompt & timecode overlay
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(`SCENE 04 // AIRLOCK DECOMPRESSION`, 25, 35);

    // Current dialogue line display
    const currentMarker = project.videoMarkers
      .filter((m) => m.time <= playheadTime)
      .slice(-1)[0];

    if (currentMarker) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(40, h - 70, w - 80, 48);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      ctx.strokeRect(40, h - 70, w - 80, 48);

      ctx.fillStyle = '#60a5fa';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${currentMarker.speaker}:`, 55, h - 50);

      ctx.fillStyle = '#ffffff';
      ctx.font = '13px sans-serif';
      ctx.fillText(`"${currentMarker.label}"`, 55, h - 32);
    }
  }, [playheadTime, project.videoUrl, project.videoMarkers]);

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onUpdateProject((prev) => ({
      ...prev,
      videoUrl: url,
      videoFileName: file.name,
    }));
  };

  const handleAddMarker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarkerLabel.trim()) return;

    const newMarker: VideoCueMarker = {
      id: 'vm_' + Date.now(),
      time: playheadTime,
      label: newMarkerLabel.trim(),
      speaker: newMarkerSpeaker.trim() || 'Speaker',
      notes: newMarkerNotes.trim(),
    };

    onUpdateProject((prev) => ({
      ...prev,
      videoMarkers: [...prev.videoMarkers, newMarker].sort((a, b) => a.time - b.time),
    }));

    setNewMarkerLabel('');
    setNewMarkerNotes('');
  };

  const handleDeleteMarker = (id: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      videoMarkers: prev.videoMarkers.filter((m) => m.id !== id),
    }));
  };

  return (
    <div className="flex-1 bg-[#0a0c0f] p-6 flex flex-col lg:flex-row gap-6 overflow-y-auto select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleVideoFileChange}
        accept="video/*"
        className="hidden"
      />

      {/* Left Column: Video Preview Player & Dubbing Teleprompter */}
      <div className="flex-1 flex flex-col gap-4 min-w-[340px]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c222b]">
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Video className="w-4 h-4 text-amber-400" />
              <span>Movie Dubbing & Synchronized Video Monitor</span>
            </h2>
            <p className="text-xs text-[#737e90] mt-0.5">
              Frame-accurate audio sync · Actor cue markers · Scene dialogue teleprompter
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1c222c] hover:bg-[#252e3b] text-xs font-semibold text-white border border-[#2b3547] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>{project.videoUrl ? 'Change Video' : 'Load Video File'}</span>
          </button>
        </div>

        {/* Video Canvas / Video Player Frame */}
        <div className="relative aspect-video bg-[#05070a] rounded-xl overflow-hidden border border-[#202836] shadow-xl flex items-center justify-center">
          {project.videoUrl ? (
            <video
              ref={videoRef}
              src={project.videoUrl}
              className="w-full h-full object-contain"
              muted
              playsInline
            />
          ) : (
            <canvas ref={canvasRef} className="w-full h-full object-contain" />
          )}

          {/* Top Overlays */}
          <div className="absolute top-3 left-3 bg-black/70 px-2.5 py-1 rounded border border-white/10 text-[11px] font-mono text-emerald-400 font-semibold tabular-nums">
            TC: {playheadTime.toFixed(2)}s
          </div>

          {project.videoFileName && (
            <div className="absolute top-3 right-3 bg-black/70 px-2.5 py-1 rounded border border-white/10 text-[11px] font-medium text-white max-w-[200px] truncate">
              {project.videoFileName}
            </div>
          )}

          {/* Floating Action: Quick Record Voice Take right at this scene position */}
          <div className="absolute bottom-3 right-3">
            <button
              onClick={onOpenRecordModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg transition-colors cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Record Voice Take Here</span>
            </button>
          </div>
        </div>

        {/* Active Scene Prompt / Actor Teleprompter Card */}
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-white uppercase tracking-wider mb-2">
            <div className="flex items-center gap-1.5 text-blue-400">
              <FileText className="w-4 h-4" />
              <span>Actor Cue Teleprompter</span>
            </div>
            <span className="text-[10px] font-mono text-[#616e82]">
              PLAYHEAD: {playheadTime.toFixed(2)}s
            </span>
          </div>

          <div className="bg-[#090b0e] p-3 rounded-lg border border-[#1a212d] min-h-[70px] flex flex-col justify-center">
            {(() => {
              const marker = project.videoMarkers
                .filter((m) => m.time <= playheadTime)
                .slice(-1)[0];

              if (!marker) {
                return (
                  <p className="text-xs text-[#5e6b7d] italic text-center">
                    No active cue at this timecode. Scrub to a marker or add a new script cue below.
                  </p>
                );
              }

              return (
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{marker.speaker} ({marker.time.toFixed(1)}s):</span>
                  </div>
                  <p className="text-sm text-white font-medium pl-5 leading-relaxed">
                    "{marker.label}"
                  </p>
                  {marker.notes && (
                    <p className="text-[11px] text-[#78869c] pl-5 mt-1 italic">
                      Note: {marker.notes}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Right Column: Scene Cue Markers Manager */}
      <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
        <div className="bg-[#12161e] rounded-xl border border-[#1f2735] p-4 flex flex-col h-full">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c232f] mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Dialogue Cue Markers ({project.videoMarkers.length})
              </span>
            </div>
          </div>

          {/* Add Marker Form */}
          <form onSubmit={handleAddMarker} className="flex flex-col gap-2 mb-4 bg-[#0e1218] p-3 rounded-lg border border-[#1b222d]">
            <span className="text-[11px] font-semibold text-[#8b97ab]">
              Add Scene Cue at {playheadTime.toFixed(2)}s:
            </span>

            <input
              type="text"
              placeholder="Speaker (e.g. Cmdr. Vance)"
              value={newMarkerSpeaker}
              onChange={(e) => setNewMarkerSpeaker(e.target.value)}
              className="bg-[#171d27] border border-[#273142] rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
            />

            <input
              type="text"
              placeholder="Script Dialogue line to dub..."
              value={newMarkerLabel}
              onChange={(e) => setNewMarkerLabel(e.target.value)}
              className="bg-[#171d27] border border-[#273142] rounded px-2.5 py-1.5 text-xs text-white focus:outline-hidden"
            />

            <button
              type="submit"
              className="mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Cue Marker</span>
            </button>
          </form>

          {/* Markers List */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[360px]">
            {project.videoMarkers.map((marker) => {
              const isPast = playheadTime >= marker.time;
              return (
                <div
                  key={marker.id}
                  onClick={() => onSeek(marker.time)}
                  className={`p-2.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    isPast
                      ? 'bg-[#181e28] border-blue-500/40 text-white'
                      : 'bg-[#0f131a] border-[#1d2532] text-[#8e9aa9] hover:bg-[#141923]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold tabular-nums">
                          {marker.time.toFixed(1)}s
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {marker.speaker}
                        </span>
                      </div>
                      <p className="text-xs text-[#a0adbf] truncate mt-0.5">
                        "{marker.label}"
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMarker(marker.id);
                    }}
                    className="p-1 rounded hover:bg-[#283244] text-[#6d798c] hover:text-red-400 transition-colors"
                    title="Delete Marker"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
