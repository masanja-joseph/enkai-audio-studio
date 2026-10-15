package com.dubmix.studio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.dubmix.studio.data.model.VocalEffectsConfig

@Composable
fun VocalDspScreen(
    tracks: List<AudioTrackEntity>,
    selectedTrackId: String,
    onSelectTrack: (String) -> Unit
) {
    var fxConfig by remember { mutableStateOf(VocalEffectsConfig()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0C11))
            .padding(12.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Track Selector
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "Vocal Processing DSP Rack",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "EQ · Dynamics Compressor · Reverb · Rumble Filter",
                    color = Color(0xFF7A8B9E),
                    fontSize = 10.sp
                )
            }

            // Quick Preset Buttons
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Button(
                    onClick = {
                        fxConfig = fxConfig.copy(
                            highPassFreq = 95f,
                            eqMidGainDb = 2.5f,
                            compThresholdDb = -19f,
                            compRatio = 4.0f
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(6.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                ) {
                    Text("Dialogue Clarity", fontSize = 10.sp, color = Color(0xFF60A5FA))
                }
            }
        }

        // Section 1: High-Pass Rumble & Parametric EQ
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF11151F))
                .border(1.dp, Color(0xFF1D2636), RoundedCornerShape(8.dp))
                .padding(12.dp)
        ) {
            Text(
                text = "1. Parametric Equalizer & High-Pass",
                color = Color(0xFF38BDF8),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("High-Pass Cutoff: ${fxConfig.highPassFreq.toInt()} Hz", color = Color.White, fontSize = 11.sp)
                Slider(
                    value = fxConfig.highPassFreq,
                    onValueChange = { fxConfig = fxConfig.copy(highPassFreq = it) },
                    valueRange = 40f..200f,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Dialogue Mid Gain: ${String.format("%.1f", fxConfig.eqMidGainDb)} dB", color = Color.White, fontSize = 11.sp)
                Slider(
                    value = fxConfig.eqMidGainDb,
                    onValueChange = { fxConfig = fxConfig.copy(eqMidGainDb = it) },
                    valueRange = -12f..12f,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Section 2: Dynamics Compressor
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF11151F))
                .border(1.dp, Color(0xFF1D2636), RoundedCornerShape(8.dp))
                .padding(12.dp)
        ) {
            Text(
                text = "2. Speech Dynamics Compressor",
                color = Color(0xFFA855F7),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Threshold: ${fxConfig.compThresholdDb.toInt()} dB", color = Color.White, fontSize = 11.sp)
                Slider(
                    value = fxConfig.compThresholdDb,
                    onValueChange = { fxConfig = fxConfig.copy(compThresholdDb = it) },
                    valueRange = -40f..0f,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Ratio: ${String.format("%.1f", fxConfig.compRatio)}:1", color = Color.White, fontSize = 11.sp)
                Slider(
                    value = fxConfig.compRatio,
                    onValueChange = { fxConfig = fxConfig.copy(compRatio = it) },
                    valueRange = 1f..12f,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Section 3: Reverb
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(Color(0xFF11151F))
                .border(1.dp, Color(0xFF1D2636), RoundedCornerShape(8.dp))
                .padding(12.dp)
        ) {
            Text(
                text = "3. Studio Dubbing Stage Reverb",
                color = Color(0xFF10B981),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Wet Amount: ${(fxConfig.reverbWet * 100).toInt()}%", color = Color.White, fontSize = 11.sp)
                Slider(
                    value = fxConfig.reverbWet,
                    onValueChange = { fxConfig = fxConfig.copy(reverbWet = it) },
                    valueRange = 0f..0.6f,
                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp)
                )
            }
        }
    }
}
