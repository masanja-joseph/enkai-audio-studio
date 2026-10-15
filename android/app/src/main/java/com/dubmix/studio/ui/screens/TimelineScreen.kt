package com.dubmix.studio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dubmix.studio.data.model.AudioClipEntity
import com.dubmix.studio.data.model.AudioTrackEntity

@Composable
fun TimelineScreen(
    tracks: List<AudioTrackEntity>,
    clipsByTrack: Map<String, List<AudioClipEntity>>,
    playheadSeconds: Float,
    onSeek: (Float) -> Unit,
    onAddVocalLayer: () -> Unit,
    onToggleMute: (String) -> Unit,
    onToggleSolo: (String) -> Unit,
    onToggleArm: (String) -> Unit,
    onOpenRecordBooth: (String) -> Unit,
    onOpenVocalFx: (String) -> Unit
) {
    var zoomLevel by remember { mutableFloatStateOf(40f) } // pixels per second
    val horizontalScroll = rememberScrollState()
    val verticalScroll = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0C0E14))
    ) {
        // Timeline Sub-toolbar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF131822))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onAddVocalLayer,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                    shape = RoundedCornerShape(6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add", modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Dub Vocal Layer", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }

                Text(
                    text = "${tracks.size} Vocal Tracks",
                    color = Color(0xFF818C9D),
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Zoom controls
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                IconButton(
                    onClick = { zoomLevel = (zoomLevel - 10f).coerceAtLeast(20f) },
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.Remove, contentDescription = "Zoom out", tint = Color.White, modifier = Modifier.size(16.dp))
                }
                Text(
                    text = "${zoomLevel.toInt()}px/s",
                    color = Color.White,
                    fontSize = 10.sp,
                    fontFamily = FontFamily.Monospace
                )
                IconButton(
                    onClick = { zoomLevel = (zoomLevel + 10f).coerceAtMost(120f) },
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Zoom in", tint = Color.White, modifier = Modifier.size(16.dp))
                }
            }
        }

        // Timeline Workspace: Left Track Headers & Right Scrubbable Waves
        Row(modifier = Modifier.fillMaxSize()) {
            // Track Headers Column
            Column(
                modifier = Modifier
                    .width(160.dp)
                    .fillMaxHeight()
                    .background(Color(0xFF10141C))
                    .border(1.dp, Color(0xFF1C2432))
                    .verticalScroll(verticalScroll)
            ) {
                // Spacer for ruler
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(26.dp)
                        .background(Color(0xFF141924))
                        .padding(horizontal = 8.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text("TRACKS", color = Color(0xFF6B788E), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }

                tracks.forEach { track ->
                    TrackHeaderCard(
                        track = track,
                        onToggleMute = { onToggleMute(track.id) },
                        onToggleSolo = { onToggleSolo(track.id) },
                        onToggleArm = { 
                            onToggleArm(track.id)
                            onOpenRecordBooth(track.id)
                        },
                        onOpenFx = { onOpenVocalFx(track.id) }
                    )
                }
            }

            // Right Timeline Workspace with Horizontal Scrolling
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .horizontalScroll(horizontalScroll)
                    .verticalScroll(verticalScroll)
            ) {
                // Timecode Ruler
                Box(
                    modifier = Modifier
                        .width((zoomLevel * 60).dp)
                        .height(26.dp)
                        .background(Color(0xFF0F131A))
                        .border(1.dp, Color(0xFF1C2432))
                        .clickable { onSeek(playheadSeconds) }
                ) {
                    Row(modifier = Modifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                        for (sec in 0..60 step 5) {
                            Box(
                                modifier = Modifier
                                    .width((zoomLevel * 5).dp)
                                    .fillMaxHeight(),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                Text(
                                    text = "${sec}s",
                                    color = Color(0xFF606D82),
                                    fontSize = 9.sp,
                                    fontFamily = FontFamily.Monospace,
                                    modifier = Modifier.padding(start = 4.dp)
                                )
                            }
                        }
                    }
                }

                // Track Waveform Lanes
                tracks.forEach { track ->
                    val clips = clipsByTrack[track.id] ?: emptyList()
                    TrackLane(
                        track = track,
                        clips = clips,
                        zoomLevel = zoomLevel,
                        playheadSeconds = playheadSeconds
                    )
                }
            }
        }
    }
}

@Composable
fun TrackHeaderCard(
    track: AudioTrackEntity,
    onToggleMute: () -> Unit,
    onToggleSolo: () -> Unit,
    onToggleArm: () -> Unit,
    onOpenFx: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .height(72.dp)
            .background(Color(0xFF10141C))
            .border(1.dp, Color(0xFF1C2330))
            .padding(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = track.name,
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
            IconButton(onClick = onOpenFx, modifier = Modifier.size(20.dp)) {
                Icon(Icons.Default.Tune, contentDescription = "FX", tint = Color(0xFFA855F7), modifier = Modifier.size(13.dp))
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Mute button
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.muted) Color(0xFFD97706) else Color(0xFF1C222D))
                    .clickable { onToggleMute() },
                contentAlignment = Alignment.Center
            ) {
                Text("M", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }

            // Solo button
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.solo) Color(0xFFFACC15) else Color(0xFF1C222D))
                    .clickable { onToggleSolo() },
                contentAlignment = Alignment.Center
            ) {
                Text("S", color = if (track.solo) Color.Black else Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }

            // Record Arm button
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.armedForRecord) Color(0xFFEF4444) else Color(0xFF1C222D))
                    .clickable { onToggleArm() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.FiberManualRecord, contentDescription = "Record", tint = Color.White, modifier = Modifier.size(10.dp))
            }

            Text(
                text = "${(track.volume * 100).toInt()}%",
                color = Color(0xFF7A879A),
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(start = 2.dp)
            )
        }
    }
}

@Composable
fun TrackLane(
    track: AudioTrackEntity,
    clips: List<AudioClipEntity>,
    zoomLevel: Float,
    playheadSeconds: Float
) {
    Box(
        modifier = Modifier
            .width((zoomLevel * 60).dp)
            .height(72.dp)
            .background(Color(0xFF090C12))
            .border(1.dp, Color(0xFF161C27))
    ) {
        // Clips
        clips.forEach { clip ->
            val leftDp = (clip.startTimeSeconds * zoomLevel).dp
            val widthDp = (clip.durationSeconds * zoomLevel).coerceAtLeast(24f).dp

            Box(
                modifier = Modifier
                    .offset(x = leftDp, y = 4.dp)
                    .width(widthDp)
                    .height(64.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFF17202E))
                    .border(1.dp, Color(0xFF2E3D52), RoundedCornerShape(4.dp))
                    .padding(4.dp)
            ) {
                Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.SpaceBetween) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = clip.name,
                            color = Color.White,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1
                        )
                        if (clip.isCleaned) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(Color(0xFF10B981).copy(alpha = 0.2f))
                                    .border(1.dp, Color(0xFF10B981), RoundedCornerShape(3.dp))
                                    .padding(horizontal = 3.dp, vertical = 1.dp)
                            ) {
                                Text("CLEANED", color = Color(0xFF10B981), fontSize = 7.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Text(
                        text = "${String.format("%.2f", clip.durationSeconds)}s",
                        color = Color(0xFF7A8B9E),
                        fontSize = 8.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }
        }

        // Playhead Line
        val playheadOffset = (playheadSeconds * zoomLevel).dp
        Box(
            modifier = Modifier
                .offset(x = playheadOffset)
                .width(2.dp)
                .fillMaxHeight()
                .background(Color(0xFFEF4444))
        )
    }
}
