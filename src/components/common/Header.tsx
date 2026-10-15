import React from 'react';
import { 
  Sliders, 
  Layers, 
  Sparkles, 
  Video, 
  Smartphone, 
  Download, 
  FolderOpen
} from 'lucide-react';

export type WorkspaceTab = 'timeline' | 'mixer' | 'effects' | 'dubbing' | 'android';

interface HeaderProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  projectName: string;
  onOpenDashboard: () => void;
  onOpenExport: () => void;
  sampleRate: number;
  bitDepth: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  projectName,
  onOpenDashboard,
  onOpenExport,
  sampleRate,
}) => {
  return (
    <header className="h-11 sm:h-12 md:h-13 bg-[#13161c] border-b border-[#20252e] px-2 sm:px-4 flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-20 select-none">
      {/* Zone 1: Brand Wordmark & Project Selector */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold text-[10px] tracking-wider shrink-0">
            EA
          </div>
          <span className="font-semibold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap hidden min-[420px]:inline">
            <span className="hidden md:inline">Enkai Audio Studio</span>
            <span className="md:hidden">Enkai</span>
          </span>
        </div>

        <button
          onClick={onOpenDashboard}
          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded bg-[#1b2029] hover:bg-[#232935] border border-[#293240] text-xs text-[#c6cdd8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Open Project Dashboard"
        >
          <FolderOpen className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-medium max-w-[80px] sm:max-w-[140px] truncate text-white text-[11px] sm:text-xs">
            {projectName}
          </span>
          <span className="text-[10px] text-[#717c8d] font-mono hidden lg:inline">
            {sampleRate / 1000}k
          </span>
        </button>
      </div>

      {/* Zone 2: Workspace Navigation (Horizontally scrollable on mobile without clipping) */}
      <nav className="flex items-center gap-0.5 sm:gap-1 bg-[#0b0d11] p-0.5 sm:p-1 rounded-lg border border-[#1b2028] overflow-x-auto no-scrollbar shrink mx-1">
        <button
          onClick={() => onTabChange('timeline')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-[#1f2532] text-white shadow-xs border border-[#2d3545]'
              : 'text-[#828c9b] hover:text-[#dce2ec]'
          }`}
          title="Multitrack Timeline Editor"
        >
          <Layers className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">Timeline</span>
        </button>

        <button
          onClick={() => onTabChange('mixer')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'mixer'
              ? 'bg-[#1f2532] text-white shadow-xs border border-[#2d3545]'
              : 'text-[#828c9b] hover:text-[#dce2ec]'
          }`}
          title="Multichannel Console Mixer"
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">Mixer</span>
        </button>

        <button
          onClick={() => onTabChange('effects')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'effects'
              ? 'bg-[#1f2532] text-white shadow-xs border border-[#2d3545]'
              : 'text-[#828c9b] hover:text-[#dce2ec]'
          }`}
          title="Vocal DSP Processing Rack"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">Vocal DSP</span>
        </button>

        <button
          onClick={() => onTabChange('dubbing')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'dubbing'
              ? 'bg-[#1f2532] text-white shadow-xs border border-[#2d3545]'
              : 'text-[#828c9b] hover:text-[#dce2ec]'
          }`}
          title="Video Dubbing & Cue Sync"
        >
          <Video className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">Dubbing</span>
        </button>

        <button
          onClick={() => onTabChange('android')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'android'
              ? 'bg-[#1f2532] text-white shadow-xs border border-[#2d3545]'
              : 'text-[#828c9b] hover:text-[#dce2ec]'
          }`}
          title="Native Android Studio Project Source"
        >
          <Smartphone className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span className="text-[11px] sm:text-xs">Android</span>
        </button>
      </nav>

      {/* Zone 3: Primary Action: Export Master WAV */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onOpenExport}
          className="flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] sm:text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Export Master WAV Mix"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Export WAV</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>
    </header>
  );
};
