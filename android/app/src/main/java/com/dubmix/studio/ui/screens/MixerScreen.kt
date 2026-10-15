package com.dubmix.studio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.dubmix.studio.data.model.AudioTrackEntity

@Composable
fun MixerScreen(
    tracks: List<AudioTrackEntity>,
    masterVolume: Float,
    onTrackVolumeChanged: (trackId: String, volume: Float) -> Unit,
    onTrackPanChanged: (trackId: String, pan: Float) -> Unit,
    onToggleMute: (trackId: String) -> Unit,
    onToggleSolo: (trackId: String) -> Unit,
    onMasterVolumeChanged: (volume: Float) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0C11))
            .padding(12.dp)
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Track Channel Strips
        tracks.forEach { track ->
            MixerChannelStrip(
                track = track,
                onVolumeChanged = { onTrackVolumeChanged(track.id, it) },
                onPanChanged = { onTrackPanChanged(track.id, it) },
                onToggleMute = { onToggleMute(track.id) },
                onToggleSolo = { onToggleSolo(track.id) }
            )
        }

        // Master Output Strip
        MasterChannelStrip(
            masterVolume = masterVolume,
            onMasterVolumeChanged = onMasterVolumeChanged
        )
    }
}

@Composable
fun MixerChannelStrip(
    track: AudioTrackEntity,
    onVolumeChanged: (Float) -> Unit,
    onPanChanged: (Float) -> Unit,
    onToggleMute: () -> Unit,
    onToggleSolo: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(96.dp)
            .fillMaxHeight()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF111620))
            .border(1.dp, Color(0xFF1E2838), RoundedCornerShape(8.dp))
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Track Name & Color Strip
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(Color(0xFF10B981))
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = track.name,
                color = Color.White,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }

        // Stereo Pan
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = if (track.pan == 0f) "C" else if (track.pan < 0) "L${(-track.pan * 100).toInt()}" else "R${(track.pan * 100).toInt()}",
                color = Color(0xFF94A3B8),
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
            Slider(
                value = track.pan,
                onValueChange = onPanChanged,
                valueRange = -1.0f..1.0f,
                modifier = Modifier.fillMaxWidth().height(18.dp)
            )
        }

        // Vertical Fader
        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "${(track.volume * 100).toInt()}%",
                color = Color.White,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Slider(
                value = track.volume,
                onValueChange = onVolumeChanged,
                valueRange = 0.0f..2.0f,
                modifier = Modifier.fillMaxHeight(0.8f)
            )
        }

        // Mute & Solo
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(24.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.muted) Color(0xFFD97706) else Color(0xFF1E2633))
                    .clickable { onToggleMute() },
                contentAlignment = Alignment.Center
            ) {
                Text("M", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }

            Box(
                modifier = Modifier
                    .weight(1f)
                    .height(24.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (track.solo) Color(0xFFFACC15) else Color(0xFF1E2633))
                    .clickable { onToggleSolo() },
                contentAlignment = Alignment.Center
            ) {
                Text("S", color = if (track.solo) Color.Black else Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun MasterChannelStrip(
    masterVolume: Float,
    onMasterVolumeChanged: (Float) -> Unit
) {
    Column(
        modifier = Modifier
            .width(108.dp)
            .fillMaxHeight()
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFF141926))
            .border(2.dp, Color(0xFF2563EB), RoundedCornerShape(8.dp))
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(Color(0xFF2563EB))
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "MASTER",
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Stereo Out",
                color = Color(0xFF7A8B9E),
                fontSize = 9.sp
            )
        }

        Column(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "${(masterVolume * 100).toInt()}%",
                color = Color.White,
                fontSize = 10.sp,
                fontFamily = FontFamily.Monospace
            )
            Slider(
                value = masterVolume,
                onValueChange = onMasterVolumeChanged,
                valueRange = 0.0f..1.5f,
                modifier = Modifier.fillMaxHeight(0.85f)
            )
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(24.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(Color(0xFF1E293B)),
            contentAlignment = Alignment.Center
        ) {
            Text("0.0 dB", color = Color(0xFF38BDF8), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
        }
    }
}
