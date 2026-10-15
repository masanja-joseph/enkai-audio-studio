package com.dubmix.studio

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.dubmix.studio.audio.NativeAudioPlayer
import com.dubmix.studio.audio.NativeAudioRecorder
import com.dubmix.studio.audio.NativeDenoiseMetrics
import com.dubmix.studio.audio.NativeDenoiseParams
import com.dubmix.studio.audio.NativeVocalDenoiseDSP
import com.dubmix.studio.audio.NativeWavExporter
import com.dubmix.studio.data.model.AudioClipEntity
import com.dubmix.studio.data.model.AudioTrackEntity
import com.dubmix.studio.data.model.TrackType
import com.dubmix.studio.ui.screens.MixerScreen
import com.dubmix.studio.ui.screens.RecordingBoothDialog
import com.dubmix.studio.ui.screens.TimelineScreen
import com.dubmix.studio.ui.screens.VocalDspScreen
import com.dubmix.studio.ui.theme.CharcoalBackground
import com.dubmix.studio.ui.theme.DubMixStudioTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : ComponentActivity() {

    private val recorder = NativeAudioRecorder()
    private val player = NativeAudioPlayer()

    private val requestRecordAudioLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (!isGranted) {
            Toast.makeText(this, "Microphone permission is required for vocal recording", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            requestRecordAudioLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }

        setContent {
            DubMixStudioTheme {
                Surface(
                    modifier = Modifier.fillMaxSize().background(CharcoalBackground),
                    color = CharcoalBackground
                ) {
                    EnkaiStudioApp(
                        recorder = recorder,
                        player = player,
                        filesDir = filesDir
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        recorder.stopRecording()
        player.stopPlayback()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EnkaiStudioApp(
    recorder: NativeAudioRecorder,
    player: NativeAudioPlayer,
    filesDir: File
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    var playheadSeconds by remember { mutableFloatStateOf(0f) }
    var isPlaying by remember { mutableStateOf(false) }

    // Multitrack state
    val tracks = remember {
        mutableStateListOf(
            AudioTrackEntity(
                id = "trk_dub_1",
                projectId = "p1",
                name = "Dub Vocal 1",
                type = TrackType.DUB_VOCAL,
                colorHex = "#10B981",
                armedForRecord = true,
                orderIndex = 0
            ),
            AudioTrackEntity(
                id = "trk_dub_2",
                projectId = "p1",
                name = "Dub Vocal 2",
                type = TrackType.DUB_VOCAL,
                colorHex = "#3B82F6",
                armedForRecord = false,
                orderIndex = 1
            ),
            AudioTrackEntity(
                id = "trk_guide",
                projectId = "p1",
                name = "Guide Reference",
                type = TrackType.GUIDE_REFERENCE,
                colorHex = "#F59E0B",
                armedForRecord = false,
                orderIndex = 2
            )
        )
    }

    val clipsByTrack = remember {
        mutableStateMapOf<String, MutableList<AudioClipEntity>>(
            "trk_dub_1" to mutableListOf(),
            "trk_dub_2" to mutableListOf(),
            "trk_guide" to mutableListOf()
        )
    }

    // Recording booth modal state
    var showRecordBooth by remember { mutableStateOf(false) }
    var activeBoothTrackId by remember { mutableStateOf("trk_dub_1") }
    var isRecordingNow by remember { mutableStateOf(false) }
    var recordElapsedSeconds by remember { mutableFloatStateOf(0f) }
    var currentTakeRawFile by remember { mutableStateOf<File?>(null) }
    var currentTakeCleanFile by remember { mutableStateOf<File?>(null) }
    var cleanupMetrics by remember { mutableStateOf<NativeDenoiseMetrics?>(null) }
    var hasCapturedTake by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Enkai Audio Studio", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Box(
                            modifier = Modifier
                                .background(Color(0xFF10B981).copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text("Native Android Engine", color = Color(0xFF10B981), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                actions = {
                    // Export Master WAV button
                    Button(
                        onClick = {
                            coroutineScope.launch(Dispatchers.IO) {
                                val exportFile = File(filesDir, "Enkai_Master_Export_${System.currentTimeMillis()}.wav")
                                NativeWavExporter.exportMixToWav(
                                    outputFile = exportFile,
                                    tracks = player.tracks.values.toList(),
                                    totalDurationSeconds = 15.0f,
                                    sampleRate = 48000,
                                    bitDepth = 24,
                                    normalize = true
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB)),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Icon(Icons.Default.Download, contentDescription = "Export", modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Export WAV", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF10141D))
            )
        },
        bottomBar = {
            Column {
                // Transport Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF131824))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        IconButton(
                            onClick = {
                                player.stopPlayback()
                                isPlaying = false
                                playheadSeconds = 0f
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = "Stop", tint = Color.White)
                        }

                        IconButton(
                            onClick = {
                                if (isPlaying) {
                                    player.pausePlayback()
                                    isPlaying = false
                                } else {
                                    player.startPlayback { sec -> playheadSeconds = sec }
                                    isPlaying = true
                                }
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = "Play",
                                tint = Color(0xFF10B981)
                            )
                        }

                        IconButton(
                            onClick = {
                                activeBoothTrackId = tracks.firstOrNull { it.armedForRecord }?.id ?: tracks[0].id
                                showRecordBooth = true
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.FiberManualRecord, contentDescription = "Record", tint = Color(0xFFEF4444))
                        }
                    }

                    // Timecode
                    Text(
                        text = String.format("00:00:%05.2f", playheadSeconds),
                        color = Color.White,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Workspace Tabs
                NavigationBar(containerColor = Color(0xFF10141D)) {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        label = { Text("Timeline") },
                        icon = { Icon(Icons.Default.ViewTimeline, contentDescription = "Timeline") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        label = { Text("Mixer") },
                        icon = { Icon(Icons.Default.Tune, contentDescription = "Mixer") }
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        label = { Text("Vocal DSP") },
                        icon = { Icon(Icons.Default.GraphicEq, contentDescription = "DSP") }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            when (selectedTab) {
                0 -> TimelineScreen(
                    tracks = tracks,
                    clipsByTrack = clipsByTrack,
                    playheadSeconds = playheadSeconds,
                    onSeek = { 
                        playheadSeconds = it
                        player.seekToSeconds(it)
                    },
                    onAddVocalLayer = {
                        val newIndex = tracks.size + 1
                        val newTrack = AudioTrackEntity(
                            id = "trk_dub_$newIndex",
                            projectId = "p1",
                            name = "Dub Vocal $newIndex",
                            type = TrackType.DUB_VOCAL,
                            colorHex = "#10B981",
                            orderIndex = tracks.size
                        )
                        tracks.add(newTrack)
                        clipsByTrack[newTrack.id] = mutableListOf()
                    },
                    onToggleMute = { trackId ->
                        val idx = tracks.indexOfFirst { it.id == trackId }
                        if (idx != -1) {
                            val t = tracks[idx]
                            tracks[idx] = t.copy(muted = !t.muted)
                            player.tracks[trackId]?.isMuted = !t.muted
                        }
                    },
                    onToggleSolo = { trackId ->
                        val idx = tracks.indexOfFirst { it.id == trackId }
                        if (idx != -1) {
                            val t = tracks[idx]
                            tracks[idx] = t.copy(solo = !t.solo)
                            player.tracks[trackId]?.isSolo = !t.solo
                        }
                    },
                    onToggleArm = { trackId ->
                        val idx = tracks.indexOfFirst { it.id == trackId }
                        if (idx != -1) {
                            tracks[idx] = tracks[idx].copy(armedForRecord = !tracks[idx].armedForRecord)
                        }
                    },
                    onOpenRecordBooth = { trackId ->
                        activeBoothTrackId = trackId
                        showRecordBooth = true
                    },
                    onOpenVocalFx = {
                        selectedTab = 2
                    }
                )
                1 -> MixerScreen(
                    tracks = tracks,
                    masterVolume = player.masterVolume,
                    onTrackVolumeChanged = { tId, vol ->
                        val idx = tracks.indexOfFirst { it.id == tId }
                        if (idx != -1) {
                            tracks[idx] = tracks[idx].copy(volume = vol)
                            player.tracks[tId]?.volume = vol
                        }
                    },
                    onTrackPanChanged = { tId, pan ->
                        val idx = tracks.indexOfFirst { it.id == tId }
                        if (idx != -1) {
                            tracks[idx] = tracks[idx].copy(pan = pan)
                            player.tracks[tId]?.pan = pan
                        }
                    },
                    onToggleMute = { tId ->
                        val idx = tracks.indexOfFirst { it.id == tId }
                        if (idx != -1) {
                            val t = tracks[idx]
                            tracks[idx] = t.copy(muted = !t.muted)
                            player.tracks[tId]?.isMuted = !t.muted
                        }
                    },
                    onToggleSolo = { tId ->
                        val idx = tracks.indexOfFirst { it.id == tId }
                        if (idx != -1) {
                            val t = tracks[idx]
                            tracks[idx] = t.copy(solo = !t.solo)
                            player.tracks[tId]?.isSolo = !t.solo
                        }
                    },
                    onMasterVolumeChanged = { vol ->
                        player.masterVolume = vol
                    }
                )
                2 -> VocalDspScreen(
                    tracks = tracks,
                    selectedTrackId = activeBoothTrackId,
                    onSelectTrack = { activeBoothTrackId = it }
                )
            }

            // Modal Recording Booth with Offline Vocal Denoise DSP
            if (showRecordBooth) {
                val currentTrackName = tracks.firstOrNull { it.id == activeBoothTrackId }?.name ?: "Dub Vocal"

                RecordingBoothDialog(
                    trackName = currentTrackName,
                    playheadSeconds = playheadSeconds,
                    isRecording = isRecordingNow,
                    recordDurationSeconds = recordElapsedSeconds,
                    currentPeakDb = recorder.currentPeakDb,
                    isClipping = recorder.isClipping,
                    hasCapturedTake = hasCapturedTake,
                    capturedRawFile = currentTakeRawFile,
                    cleanedFile = currentTakeCleanFile,
                    cleanupMetrics = cleanupMetrics,
                    onStartRecording = { voiceOptimized, gainLinear ->
                        val rawFile = File(filesDir, "Take_${System.currentTimeMillis()}_RAW.wav")
                        currentTakeRawFile = rawFile
                        val started = recorder.startRecording(
                            outputFile = rawFile,
                            useVoiceOptimizedSource = voiceOptimized,
                            inputGainLinear = gainLinear
                        ) { sec -> recordElapsedSeconds = sec }
                        if (started) {
                            isRecordingNow = true
                            hasCapturedTake = false
                        }
                    },
                    onStopRecording = {
                        recorder.stopRecording()
                        isRecordingNow = false
                        hasCapturedTake = true

                        // Run default offline denoise on the captured file
                        currentTakeRawFile?.let { raw ->
                            val cleanFile = File(filesDir, raw.name.replace("_RAW.wav", "_CLEAN.wav"))
                            val metrics = NativeVocalDenoiseDSP.processWavFile(
                                inputFile = raw,
                                outputFile = cleanFile,
                                params = NativeDenoiseParams()
                            )
                            currentTakeCleanFile = cleanFile
                            cleanupMetrics = metrics
                        }
                    },
                    onApplyDenoise = { params ->
                        currentTakeRawFile?.let { raw ->
                            val cleanFile = File(filesDir, raw.name.replace("_RAW.wav", "_CLEAN.wav"))
                            val metrics = NativeVocalDenoiseDSP.processWavFile(
                                inputFile = raw,
                                outputFile = cleanFile,
                                params = params
                            )
                            currentTakeCleanFile = cleanFile
                            cleanupMetrics = metrics
                        }
                    },
                    onApproveTake = { applyCleanup ->
                        val fileToUse = if (applyCleanup && currentTakeCleanFile != null) {
                            currentTakeCleanFile!!
                        } else {
                            currentTakeRawFile!!
                        }

                        val clipId = "clip_${System.currentTimeMillis()}"
                        val clipDuration = recordElapsedSeconds.coerceAtLeast(1.0f)
                        val newClip = AudioClipEntity(
                            id = clipId,
                            trackId = activeBoothTrackId,
                            assetId = fileToUse.absolutePath,
                            name = "Take ${clipsByTrack[activeBoothTrackId]?.size?.plus(1)}",
                            startTimeSeconds = playheadSeconds,
                            durationSeconds = clipDuration,
                            isCleaned = applyCleanup
                        )

                        clipsByTrack[activeBoothTrackId]?.add(newClip)
                        player.loadWavClip(
                            trackId = activeBoothTrackId,
                            clipId = clipId,
                            startSeconds = playheadSeconds,
                            wavFile = fileToUse
                        )

                        showRecordBooth = false
                        hasCapturedTake = false
                        currentTakeRawFile = null
                        currentTakeCleanFile = null
                    },
                    onRetake = {
                        hasCapturedTake = false
                        recordElapsedSeconds = 0f
                        currentTakeRawFile?.delete()
                        currentTakeCleanFile?.delete()
                        currentTakeRawFile = null
                        currentTakeCleanFile = null
                    },
                    onDismiss = {
                        if (isRecordingNow) {
                            recorder.stopRecording()
                            isRecordingNow = false
                        }
                        showRecordBooth = false
                    }
                )
            }
        }
    }
}
