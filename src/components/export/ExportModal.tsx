import React, { useState } from 'react';
import { AudioProject, ExportSettings } from '../../types/daw';
import { AudioEngine } from '../../audio/AudioEngine';
import { Download, X, Check, Disc } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: AudioProject;
  engine: AudioEngine;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  engine,
}) => {
  const [exportFileName, setExportFileName] = useState(`${project.name.replace(/\s+/g, '_')}_Master`);
  const [bitDepth, setBitDepth] = useState<16 | 24>(24);
  const [sampleRate, setSampleRate] = useState<44100 | 48000>(48000);
  const [channels, setChannels] = useState<'stereo' | 'mono'>('stereo');
  const [normalize, setNormalize] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setExportProgress(0.1);
    setDownloadUrl(null);

    const settings: ExportSettings = {
      format: 'wav',
      bitDepth,
      sampleRate,
      channels,
      normalize,
    };

    try {
      const wavBlob = await engine.renderMasterWav(project, settings, (p) => {
        setExportProgress(p);
      });

      const fileName = (exportFileName.trim() || `${project.name}_Master`) + '.wav';
      let savedViaPicker = false;

      // Try File System Access API if available to let user pick export location
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'WAV Audio File',
              accept: { 'audio/wav': ['.wav'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(wavBlob);
          await writable.close();
          savedViaPicker = true;
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error('FilePicker save error:', err);
          } else {
            setIsExporting(false);
            return;
          }
        }
      }

      if (!savedViaPicker) {
        const url = URL.createObjectURL(wavBlob);
        setDownloadUrl(url);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
      }
    } catch (err) {
      console.error('Failed to render master WAV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#12161e] border border-[#232c3c] rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1c2432]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Export Master Audio Mix
              </h3>
              <p className="text-[11px] text-[#717e92]">
                Custom file naming & folder location export
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

        {/* Options */}
        <div className="flex flex-col gap-3 font-mono text-xs">
          {/* File Name Input */}
          <div className="flex flex-col gap-1 bg-[#0e1218] p-3 rounded-lg border border-[#1b222e]">
            <label className="text-[#808d9f] font-sans text-xs mb-1">Export File Name:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder="Enter file name..."
                className="flex-1 bg-[#171d27] border border-[#2b3547] rounded px-3 py-2 text-xs text-white font-sans focus:outline-hidden"
              />
              <span className="text-[#717e92] font-mono text-xs px-2 py-2 bg-[#141a24] rounded border border-[#222a38]">.wav</span>
            </div>
          </div>

          {/* PCM Bit Depth */}
          <div className="flex items-center justify-between bg-[#0e1218] p-3 rounded-lg border border-[#1b222e]">
            <span className="text-[#808d9f] font-sans">PCM Bit Depth:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setBitDepth(16)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  bitDepth === 16
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                16-bit
              </button>
              <button
                onClick={() => setBitDepth(24)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  bitDepth === 24
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                24-bit
              </button>
            </div>
          </div>

          {/* Sample Rate */}
          <div className="flex items-center justify-between bg-[#0e1218] p-3 rounded-lg border border-[#1b222e]">
            <span className="text-[#808d9f] font-sans">Sample Rate:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSampleRate(44100)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  sampleRate === 44100
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                44.1 kHz
              </button>
              <button
                onClick={() => setSampleRate(48000)}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  sampleRate === 48000
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                48.0 kHz
              </button>
            </div>
          </div>

          {/* Channels */}
          <div className="flex items-center justify-between bg-[#0e1218] p-3 rounded-lg border border-[#1b222e]">
            <span className="text-[#808d9f] font-sans">Channels:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setChannels('stereo')}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  channels === 'stereo'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                Stereo
              </button>
              <button
                onClick={() => setChannels('mono')}
                className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                  channels === 'mono'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#181f2a] text-[#788599] hover:text-white'
                }`}
              >
                Mono
              </button>
            </div>
          </div>

          {/* Peak Normalization */}
          <label className="flex items-center justify-between bg-[#0e1218] p-3 rounded-lg border border-[#1b222e] cursor-pointer">
            <span className="text-[#808d9f] font-sans">Peak Normalize (-0.3 dBFS):</span>
            <input
              type="checkbox"
              checked={normalize}
              onChange={(e) => setNormalize(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
            />
          </label>
        </div>

        {/* Progress Bar when rendering */}
        {isExporting && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#8b98ac]">
              <span>Summing stems and encoding PCM...</span>
              <span className="text-emerald-400 font-bold">{(exportProgress * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-[#10141b] rounded-full overflow-hidden border border-[#202735]">
              <div
                className="h-full bg-blue-500 transition-all duration-200"
                style={{ width: `${exportProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#181f2a] hover:bg-[#222b3a] text-xs font-semibold text-[#8a96aa] hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Rendering...' : 'Render & Choose Export Location'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
