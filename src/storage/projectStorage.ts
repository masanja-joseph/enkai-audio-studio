import { AudioProject, AudioTrack, VocalEffectsRack } from '../types/daw';
import { 
  createCinematicDialogueBuffer, 
  createCinematicScoreBuffer, 
  createFilmAmbienceBuffer, 
  createSoundEffectsBuffer 
} from '../audio/SampleAudioGenerator';
import { extractPeaks } from '../audio/WaveformGenerator';

const DB_NAME = 'DubMixStudio_DB';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_ASSETS = 'assets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
    };
  });
}

export function getDefaultVocalEffects(): VocalEffectsRack {
  return {
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
  };
}

export async function createInitialDemoProject(audioCtx: AudioContext): Promise<AudioProject> {
  const projectId = 'proj_' + Date.now();
  
  // Authentic cinematic dialogue guide buffer for reference dubbing
  const dialogueBuffer = createCinematicDialogueBuffer(audioCtx, 8.0);

  const assetDialogue = {
    id: 'asset_diag_' + Date.now(),
    name: 'Original_English_Line_A.wav',
    duration: dialogueBuffer.duration,
    sampleRate: dialogueBuffer.sampleRate,
    channels: dialogueBuffer.numberOfChannels,
    waveformPeaks: extractPeaks(dialogueBuffer, 400),
    audioBuffer: dialogueBuffer,
  };

  const tracks: AudioTrack[] = [
    {
      id: 'trk_dub_1',
      name: 'Dub Vocal 1',
      type: 'dub_vocal',
      color: '#10b981', // emerald
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
      armedForRecord: true,
      effects: {
        ...getDefaultVocalEffects(),
        equalizer: {
          ...getDefaultVocalEffects().equalizer,
          highGain: 2.5, // Crisp vocal air
        },
      },
      clips: [],
    },
    {
      id: 'trk_dub_2',
      name: 'Dub Vocal 2',
      type: 'dub_vocal',
      color: '#3b82f6', // blue
      volume: 1.0,
      pan: 0.0,
      muted: false,
      solo: false,
      armedForRecord: false,
      effects: getDefaultVocalEffects(),
      clips: [],
    },
    {
      id: 'trk_dub_3',
      name: 'Dub Vocal 3',
      type: 'dub_vocal',
      color: '#8b5cf6', // purple
      volume: 0.9,
      pan: 0.0,
      muted: false,
      solo: false,
      armedForRecord: false,
      effects: getDefaultVocalEffects(),
      clips: [],
    },
    {
      id: 'trk_guide',
      name: 'Guide Track (Original Scene)',
      type: 'guide_reference',
      color: '#f59e0b', // amber
      volume: 0.8,
      pan: 0.0,
      muted: false,
      solo: false,
      armedForRecord: false,
      effects: getDefaultVocalEffects(),
      clips: [
        {
          id: 'clip_diag_1',
          assetId: assetDialogue.id,
          name: 'Scene Dialogue Guide',
          startTime: 1.0,
          duration: 7.5,
          offset: 0,
          volume: 0.9,
          pan: 0,
          fadeIn: 0.1,
          fadeOut: 0.2,
          muted: false,
        },
      ],
    },
  ];

  const project: AudioProject = {
    id: projectId,
    name: 'Enkai Dubbing Project 1',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sampleRate: 48000,
    bitDepth: 24,
    duration: 15.0,
    tracks,
    assets: {
      [assetDialogue.id]: assetDialogue,
    },
    takes: [],
    videoMarkers: [
      { id: 'vm_1', time: 1.0, label: 'Commander speaks', speaker: 'Cmdr. Vance' },
      { id: 'vm_2', time: 4.8, label: 'Hull breach alarm', speaker: 'Alarm' },
      { id: 'vm_3', time: 6.7, label: 'Secondary prompt', speaker: 'Cmdr. Vance' },
    ],
  };

  return project;
}

export async function saveProject(project: AudioProject): Promise<void> {
  const db = await openDB();

  // Strip AudioBuffer out of project state for clean IndexedDB storage,
  // while saving binary blobs in the assets store
  const cleanProject = {
    ...project,
    updatedAt: Date.now(),
    assets: Object.fromEntries(
      Object.entries(project.assets).map(([id, a]) => [
        id,
        {
          id: a.id,
          name: a.name,
          duration: a.duration,
          sampleRate: a.sampleRate,
          channels: a.channels,
          waveformPeaks: a.waveformPeaks,
        },
      ])
    ),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
    const pStore = tx.objectStore(STORE_PROJECTS);
    const aStore = tx.objectStore(STORE_ASSETS);

    pStore.put(cleanProject);

    // Save asset binary data
    for (const asset of Object.values(project.assets)) {
      if (asset.audioBuffer) {
        // Store raw Float32Array channel data
        const channels: Float32Array[] = [];
        for (let c = 0; c < asset.audioBuffer.numberOfChannels; c++) {
          channels.push(asset.audioBuffer.getChannelData(c));
        }
        aStore.put({
          id: asset.id,
          name: asset.name,
          sampleRate: asset.audioBuffer.sampleRate,
          channels: asset.audioBuffer.numberOfChannels,
          length: asset.audioBuffer.length,
          data: channels,
        });
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProject(id: string, audioCtx: AudioContext): Promise<AudioProject | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readonly');
    const pStore = tx.objectStore(STORE_PROJECTS);
    const aStore = tx.objectStore(STORE_ASSETS);

    const req = pStore.get(id);

    req.onsuccess = async () => {
      const proj = req.result as AudioProject | undefined;
      if (!proj) {
        resolve(null);
        return;
      }

      // Reconstruct AudioBuffers
      for (const assetId of Object.keys(proj.assets)) {
        const assetReq = aStore.get(assetId);
        await new Promise<void>((res) => {
          assetReq.onsuccess = () => {
            const raw = assetReq.result;
            if (raw && raw.data && audioCtx) {
              const buffer = audioCtx.createBuffer(raw.channels, raw.length, raw.sampleRate);
              for (let c = 0; c < raw.channels; c++) {
                buffer.copyToChannel(raw.data[c], c);
              }
              proj.assets[assetId].audioBuffer = buffer;
            }
            res();
          };
          assetReq.onerror = () => res(); // graceful fallback
        });
      }

      resolve(proj);
    };

    req.onerror = () => reject(req.error);
  });
}

export async function listSavedProjects(): Promise<{
  id: string;
  name: string;
  updatedAt: number;
  trackCount: number;
  duration: number;
  sampleRate: number;
}[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS], 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.getAll();

    req.onsuccess = () => {
      const result = req.result as AudioProject[];
      console.log('listSavedProjects: result', result);
      const list = result.map((p) => ({
        id: p.id,
        name: p.name,
        updatedAt: p.updatedAt,
        trackCount: p.tracks.length,
        duration: p.duration,
        sampleRate: p.sampleRate,
      }));
      resolve(list.sort((a, b) => b.updatedAt - a.updatedAt));
    };

    req.onerror = () => {
      console.error('listSavedProjects: error', req.error);
      reject(req.error);
    };
  });
}

export async function deleteProjectFromDB(id: string): Promise<void> {
  const db = await openDB();

  // Get project first to identify assets to delete
  const project = await new Promise<AudioProject | null>((resolve) => {
    const tx = db.transaction([STORE_PROJECTS], 'readonly');
    const store = tx.objectStore(STORE_PROJECTS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  if (!project) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PROJECTS, STORE_ASSETS], 'readwrite');
    const pStore = tx.objectStore(STORE_PROJECTS);
    const aStore = tx.objectStore(STORE_ASSETS);
    
    pStore.delete(id);
    for (const assetId of Object.keys(project.assets)) {
      aStore.delete(assetId);
    }
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
