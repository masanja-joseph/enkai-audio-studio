/**
 * Enkai Audio Studio — Professional Multitrack Audio Workstation
 * Native Android Architecture & Web Audio Production Studio
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AudioProject } from './types/daw';
import { AudioEngine } from './audio/AudioEngine';
import { 
  createInitialDemoProject, 
  saveProject, 
  listSavedProjects, 
  loadProject 
} from './storage/projectStorage';
import { Header, WorkspaceTab } from './components/common/Header';
import { TransportBar } from './components/common/TransportBar';
import { MultitrackTimeline } from './components/timeline/MultitrackTimeline';
import { ConsoleMixer } from './components/mixer/ConsoleMixer';
import { VocalEffectsRack } from './components/effects/VocalEffectsRack';
import { VideoDubbingWorkspace } from './components/dubbing/VideoDubbingWorkspace';
import { AndroidProjectViewer } from './components/android/AndroidProjectViewer';
import { RecordingModal } from './components/recording/RecordingModal';
import { ExportModal } from './components/export/ExportModal';
import { ProjectDashboard } from './components/dashboard/ProjectDashboard';

export default function App() {
  const engineRef = useRef<AudioEngine>(AudioEngine.getInstance());
  const engine = engineRef.current;

  const [project, setProject] = useState<AudioProject | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('timeline');
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [selectedTrackForFX, setSelectedTrackForFX] = useState<string>('');

  // Modals
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

  // Undo / Redo history
  const [history, setHistory] = useState<AudioProject[]>([]);
  const [future, setFuture] = useState<AudioProject[]>([]);

  const [audioContextState, setAudioContextState] = useState<'initializing' | 'suspended' | 'ready'>('initializing');

  // Initialize or load project on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        setAudioContextState('initializing');
        const ctx = await engine.initAudioContext();
        
        if (ctx.state === 'suspended') {
            if (isMounted) setAudioContextState('suspended');
            return;
        }
        
        const savedList = await listSavedProjects();
        let currentProj: AudioProject | null = null;

        if (savedList.length > 0) {
          currentProj = await loadProject(savedList[0].id, engine.getContext()!);
        }

        if (!currentProj) {
          currentProj = await createInitialDemoProject(engine.getContext()!);
          await saveProject(currentProj);
        }

        if (isMounted) {
          setAudioContextState('ready');
          setProject(currentProj);
          setSelectedTrackForFX(currentProj.tracks[0]?.id || '');
          engine.syncProject(currentProj);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }

    init();

    // Subscribe to engine playhead updates
    const unsubPlayhead = engine.onPlayheadUpdate((time) => {
      setPlayheadTime(time);
    });

    return () => {
      isMounted = false;
      unsubPlayhead();
    };
  }, [engine]);

  // Sync project changes to AudioEngine & auto-save to IndexedDB
  const handleUpdateProject = useCallback(
    (updater: (prev: AudioProject) => AudioProject) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next = updater(prev);

        // Push to undo stack
        setHistory((h) => [...h.slice(-20), prev]);
        setFuture([]);

        // Sync to audio engine
        engine.syncProject(next);

        // Auto-save to IndexedDB (debounced / asynchronous)
        saveProject(next).catch((err) => console.error('Auto-save error:', err));

        return next;
      });
    },
    [engine]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0 || !project) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [project, ...f]);
    setProject(previous);
    engine.syncProject(previous);
  }, [history, project, engine]);

  const handleRedo = useCallback(() => {
    if (future.length === 0 || !project) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, project]);
    setProject(next);
    engine.syncProject(next);
  }, [future, project, engine]);

  // Transport controls
  const handlePlay = useCallback(async () => {
    await engine.play(playheadTime);
    setIsPlaying(true);
  }, [engine, playheadTime]);

  const handlePause = useCallback(() => {
    engine.pause();
    setIsPlaying(false);
  }, [engine]);

  const handleStop = useCallback(() => {
    engine.stop();
    setIsPlaying(false);
    setPlayheadTime(0);
  }, [engine]);

  const handleSeek = useCallback(
    (time: number) => {
      engine.seek(time);
      setPlayheadTime(time);
    },
    [engine]
  );

  // Keyboard shortcuts (Space = Play/Pause, Ctrl+Z = Undo, Ctrl+Y = Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (engine.getIsPlaying()) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsRecordModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [engine, handlePlay, handlePause, handleUndo, handleRedo]);

  if (!project || audioContextState !== 'ready') {
    return (
      <div className="h-screen w-screen bg-[#0e1013] flex flex-col items-center justify-center gap-3 text-white select-none">
        <div className="w-8 h-8 rounded bg-blue-600 animate-pulse flex items-center justify-center font-bold text-xs">
          EA
        </div>
        {audioContextState === 'suspended' ? (
          <button
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold uppercase tracking-wider text-sm transition-all"
            onClick={async () => {
              const ctx = await engine.initAudioContext();
              if (ctx.state !== 'suspended') {
                setAudioContextState('ready');
                // Reload projects after resuming
                const savedList = await listSavedProjects();
                let currentProj: AudioProject | null = null;
                if (savedList.length > 0) {
                  currentProj = await loadProject(savedList[0].id, ctx);
                }
                if (!currentProj) {
                  currentProj = await createInitialDemoProject(ctx);
                  await saveProject(currentProj);
                }
                setProject(currentProj);
                setSelectedTrackForFX(currentProj.tracks[0]?.id || '');
                engine.syncProject(currentProj);
              }
            }}
          >
            Start Audio Engine
          </button>
        ) : (
          <span className="text-xs font-mono text-[#8b95a5] tracking-wider uppercase">
            {audioContextState === 'initializing' ? 'Initializing Enkai Audio Engine...' : 'Audio Engine Suspended...'}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0e1013] text-[#e2e5ea] overflow-hidden select-none">
      {/* 1. Universal Top Bar */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        projectName={project.name}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        sampleRate={project.sampleRate}
        bitDepth={project.bitDepth}
      />

      {/* 2. Main Transport Bar */}
      <TransportBar
        engine={engine}
        isPlaying={isPlaying}
        isRecording={isRecording}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onRecord={() => setIsRecordModalOpen(true)}
        onSeek={handleSeek}
        playheadTime={playheadTime}
        duration={project.duration}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
      />

      {/* 3. Main Workspace Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {activeTab === 'timeline' && (
          <MultitrackTimeline
            project={project}
            engine={engine}
            playheadTime={playheadTime}
            onSeek={handleSeek}
            onUpdateProject={handleUpdateProject}
            onSelectTrackForFX={(trackId) => {
              setSelectedTrackForFX(trackId);
              setActiveTab('effects');
            }}
            onOpenRecordModal={(trackId) => {
              handleUpdateProject((prev) => ({
                ...prev,
                tracks: prev.tracks.map((t) => ({
                  ...t,
                  armedForRecord: t.id === trackId,
                })),
              }));
              setIsRecordModalOpen(true);
            }}
          />
        )}

        {activeTab === 'mixer' && (
          <ConsoleMixer
            project={project}
            engine={engine}
            onUpdateProject={handleUpdateProject}
            onSelectTrackForFX={(trackId) => {
              setSelectedTrackForFX(trackId);
              setActiveTab('effects');
            }}
          />
        )}

        {activeTab === 'effects' && (
          <VocalEffectsRack
            project={project}
            selectedTrackId={selectedTrackForFX || project.tracks[0]?.id}
            onSelectTrack={setSelectedTrackForFX}
            onUpdateProject={handleUpdateProject}
          />
        )}

        {activeTab === 'dubbing' && (
          <VideoDubbingWorkspace
            project={project}
            engine={engine}
            playheadTime={playheadTime}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onUpdateProject={handleUpdateProject}
            onOpenRecordModal={() => setIsRecordModalOpen(true)}
          />
        )}

        {activeTab === 'android' && <AndroidProjectViewer />}
      </main>

      {/* 4. Modals */}
      <RecordingModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        project={project}
        engine={engine}
        playheadTime={playheadTime}
        onUpdateProject={handleUpdateProject}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
        engine={engine}
      />

      <ProjectDashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        currentProject={project}
        engine={engine}
        onSelectProject={(newProj) => {
          setProject(newProj);
          setSelectedTrackForFX(newProj.tracks[0]?.id || '');
          engine.syncProject(newProj);
        }}
        onUpdateProject={handleUpdateProject}
      />
    </div>
  );
}
