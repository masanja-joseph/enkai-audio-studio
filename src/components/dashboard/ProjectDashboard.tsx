import React, { useEffect, useState } from 'react';
import { AudioProject } from '../../types/daw';
import { 
  listSavedProjects, 
  deleteProjectFromDB, 
  createInitialDemoProject, 
  loadProject, 
  saveProject 
} from '../../storage/projectStorage';
import { AudioEngine } from '../../audio/AudioEngine';
import { 
  FolderPlus, 
  Trash2, 
  Copy, 
  Clock, 
  FolderOpen, 
  Layers, 
  Check, 
  X, 
  Sparkles,
  Settings
} from 'lucide-react';

interface ProjectDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: AudioProject;
  engine: AudioEngine;
  onSelectProject: (project: AudioProject) => void;
  onUpdateProject: (updater: (prev: AudioProject) => AudioProject) => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  isOpen,
  onClose,
  currentProject,
  engine,
  onSelectProject,
  onUpdateProject,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectsList, setProjectsList] = useState<{
    id: string;
    name: string;
    updatedAt: number;
    trackCount: number;
    duration: number;
    sampleRate: number;
  }[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newSampleRate, setNewSampleRate] = useState<44100 | 48000>(48000);
  const [newBitDepth, setNewBitDepth] = useState<16 | 24>(24);
  const [isCreating, setIsCreating] = useState(false);

  const refreshList = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      console.log('ProjectDashboard: Calling listSavedProjects...');
      const list = await listSavedProjects();
      console.log('ProjectDashboard: Loaded projects', list);
      setProjectsList(list);
    } catch (err) {
      console.error('Failed to list projects:', err);
      setErrorMessage('Error: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim() || 'Untitled Dubbing Session';

    const ctx = await engine.initAudioContext(newSampleRate);
    const demo = await createInitialDemoProject(ctx);
    demo.name = name;
    demo.sampleRate = newSampleRate;
    demo.bitDepth = newBitDepth;

    await saveProject(demo);
    onSelectProject(demo);
    setIsCreating(false);
    setNewProjectName('');
    onClose();
  };

  const handleOpenProject = async (id: string) => {
    if (id === currentProject.id) {
      onClose();
      return;
    }
    const ctx = await engine.initAudioContext();
    const loaded = await loadProject(id, ctx);
    if (loaded) {
      onSelectProject(loaded);
      onClose();
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }

    try {
      await deleteProjectFromDB(id);
      setDeletingId(null);

      if (id === currentProject.id) {
        const remaining = await listSavedProjects();
        const ctx = await engine.initAudioContext();
        if (remaining.length > 0) {
          const nextProj = await loadProject(remaining[0].id, ctx);
          if (nextProj) {
            onSelectProject(nextProj);
          }
        } else {
          const newDemo = await createInitialDemoProject(ctx);
          await saveProject(newDemo);
          onSelectProject(newDemo);
        }
      }

      await refreshList();
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Could not delete project. Please try again.');
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ctx = await engine.initAudioContext();
    const original = await loadProject(id, ctx);
    if (original) {
      const duplicated: AudioProject = {
        ...original,
        id: 'proj_' + Date.now(),
        name: original.name + ' (Copy)',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveProject(duplicated);
      await refreshList();
    }
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#12161e] border border-[#232c3c] rounded-2xl w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-5 max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2432]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Project Dashboard & Session Manager
              </h3>
              <p className="text-[11px] text-[#717e92]">
                Local IndexedDB persistent offline storage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#202938] text-[#717e92] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar: Create New Session */}
        {!isCreating ? (
          <div className="flex items-center justify-between bg-[#0e1218] p-3 rounded-xl border border-[#1b222e]">
            <div>
              <span className="text-xs font-bold text-white block">Current Session: {currentProject.name}</span>
              <span className="text-[11px] text-[#727f92]">
                {currentProject.tracks.length} tracks · {currentProject.duration.toFixed(1)}s · {currentProject.sampleRate} Hz
              </span>
            </div>

            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Create New Project</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateNew} className="flex flex-col gap-3 bg-[#0e1218] p-4 rounded-xl border border-[#242e3f]">
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Create New Audio Session
            </span>

            <input
              type="text"
              placeholder="Session Name (e.g. Blade Runner 2049 VO Take 3)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              className="bg-[#171d27] border border-[#2b3547] rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[11px] text-[#768498] block mb-1">Sample Rate</label>
                <select
                  value={newSampleRate}
                  onChange={(e) => setNewSampleRate(Number(e.target.value) as 44100 | 48000)}
                  className="w-full bg-[#171d27] border border-[#2b3547] text-white rounded p-1.5 text-xs focus:outline-hidden"
                >
                  <option value={48000}>48.0 kHz (Film & TV Standard)</option>
                  <option value={44100}>44.1 kHz (CD Audio)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#768498] block mb-1">Bit Depth</label>
                <select
                  value={newBitDepth}
                  onChange={(e) => setNewBitDepth(Number(e.target.value) as 16 | 24)}
                  className="w-full bg-[#171d27] border border-[#2b3547] text-white rounded p-1.5 text-xs focus:outline-hidden"
                >
                  <option value={24}>24-bit PCM (Studio Master)</option>
                  <option value={16}>16-bit PCM (Standard)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded text-xs text-[#828f9f] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Initialize Project
              </button>
            </div>
          </form>
        )}

        {/* Saved Sessions List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <span className="text-xs font-semibold text-[#8b98aa] uppercase tracking-wider mb-2">
            Recent Projects
          </span>

          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-[#5e6b7d]">Loading projects...</div>
            ) : errorMessage ? (
              <div className="py-8 text-center text-xs text-red-500 bg-red-900/20 rounded-lg p-4">
                {errorMessage}
                <button onClick={refreshList} className="block mt-2 underline cursor-pointer">Retry</button>
              </div>
            ) : projectsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#5e6b7d]">
                No other saved projects found in local storage.
              </div>
            ) : (
              projectsList.map((p) => {
                const isCurrent = p.id === currentProject.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleOpenProject(p.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isCurrent
                        ? 'bg-[#18202d] border-blue-500/50 shadow-xs'
                        : 'bg-[#0e1218] border-[#1d2533] hover:bg-[#141922]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{p.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-mono font-bold bg-blue-900/60 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                            CURRENT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-[#6d798b] font-mono mt-1">
                        <span>{p.trackCount} tracks</span>
                        <span>·</span>
                        <span>{p.duration.toFixed(1)}s</span>
                        <span>·</span>
                        <span>{p.sampleRate / 1000} kHz</span>
                        <span>·</span>
                        <span>{formatDate(p.updatedAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => handleDuplicate(p.id, e)}
                        className="p-1.5 rounded hover:bg-[#202939] text-[#717e92] hover:text-white transition-colors"
                        title="Duplicate Project"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {deletingId === p.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDelete(p.id, e)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleDelete(p.id, e)}
                          className="p-1.5 rounded hover:bg-[#202939] text-[#717e92] hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete Project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
