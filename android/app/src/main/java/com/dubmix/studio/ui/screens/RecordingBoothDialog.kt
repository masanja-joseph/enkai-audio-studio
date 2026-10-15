package com.dubmix.studio.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.window.Dialog
import com.dubmix.studio.audio.NativeDenoiseMetrics
import com.dubmix.studio.audio.NativeDenoiseParams
import java.io.File

@Composable
fun RecordingBoothDialog(
    trackName: String,
    playheadSeconds: Float,
    isRecording: Boolean,
    recordDurationSeconds: Float,
    currentPeakDb: Float,
    isClipping: Boolean,
    hasCapturedTake: Boolean,
    capturedRawFile: File?,
    cleanedFile: File?,
    cleanupMetrics: NativeDenoiseMetrics?,
    onStartRecording: (useVoiceOptimized: Boolean, gainLinear: Float) -> Unit,
    onStopRecording: () -> Unit,
    onApplyDenoise: (NativeDenoiseParams) -> Unit,
    onApproveTake: (applyCleanup: Boolean) -> Unit,
    onRetake: () -> Unit,
    onDismiss: () -> Unit
) {
    var useVoiceOptimized by remember { mutableStateOf(true) }
    var inputGainDb by remember { mutableFloatStateOf(0f) }
    var denoiseParams by remember { mutableStateOf(NativeDenoiseParams()) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .wrapContentHeight()
                .clip(RoundedCornerShape(16.dp))
                .border(1.dp, Color(0xFF263245), RoundedCornerShape(16.dp)),
            color = Color(0xFF10141D)
        ) {
            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Vocal Recording Booth",
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Target: $trackName · Timecode: ${String.format("%.2f", playheadSeconds)}s",
                            color = Color(0xFF7A899E),
                            fontSize = 11.sp
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFF8B98AC))
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Phase 1: Pre-recording calibration
                if (!hasCapturedTake) {
                    // Input source switch
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF0A0D13))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Button(
                            onClick = { useVoiceOptimized = true },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (useVoiceOptimized) Color(0xFF2563EB) else Color.Transparent
                            ),
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 4.dp)
                        ) {
                            Text("Voice Dialogue Mode", fontSize = 10.sp, color = Color.White)
                        }
                        Button(
                            onClick = { useVoiceOptimized = false },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (!useVoiceOptimized) Color(0xFF2563EB) else Color.Transparent
                            ),
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier.weight(1f),
                            contentPadding = PaddingValues(vertical = 4.dp)
                        ) {
                            Text("Raw Studio Mic Mode", fontSize = 10.sp, color = Color.White)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Input Level Meter & Clipping Alert
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF0A0D13))
                            .border(1.dp, Color(0xFF1B222E), RoundedCornerShape(8.dp))
                            .padding(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("MIC INPUT LEVEL", color = Color(0xFF788596), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            if (isClipping) {
                                Text("CLIP WARNING!", color = Color(0xFFEF4444), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            } else {
                                Text("${String.format("%.1f", currentPeakDb)} dBFS", color = Color.White, fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        // Peak meter bar
                        val normalizedPeak = ((currentPeakDb + 60f) / 60f).coerceIn(0f, 1f)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(Color(0xFF19202B))
                        ) {
                            Box(
                                modifier = Modifier
                                    .fillMaxHeight()
                                    .fillMaxWidth(normalizedPeak)
                                    .background(
                                        if (isClipping) Color(0xFFEF4444)
                                        else if (normalizedPeak > 0.85f) Color(0xFFFBBF24)
                                        else Color(0xFF10B981)
                                    )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Record / Stop controls
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = String.format("%.2fs", recordDurationSeconds),
                            color = Color.White,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        if (!isRecording) {
                            Button(
                                onClick = { 
                                    val linear = Math.pow(10.0, (inputGainDb / 20.0)).toFloat()
                                    onStartRecording(useVoiceOptimized, linear)
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                shape = RoundedCornerShape(24.dp),
                                modifier = Modifier.padding(horizontal = 24.dp)
                            ) {
                                Icon(Icons.Default.FiberManualRecord, contentDescription = "Record", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Start Recording Take", fontWeight = FontWeight.Bold)
                            }
                        } else {
                            Button(
                                onClick = onStopRecording,
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                shape = RoundedCornerShape(24.dp),
                                modifier = Modifier.padding(horizontal = 24.dp)
                            ) {
                                Icon(Icons.Default.Stop, contentDescription = "Stop", modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Stop & Finalize", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                // Phase 2: Post-Recording Offline Vocal Cleanup Studio
                if (hasCapturedTake && capturedRawFile != null) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF090D13))
                            .border(1.dp, Color(0xFF1D2635), RoundedCornerShape(10.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Offline Vocal Noise Reduction DSP",
                                color = Color(0xFFA855F7),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Button(
                                onClick = { onApplyDenoise(denoiseParams) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7E22CE)),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text("Recalculate DSP", fontSize = 9.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // High-Pass Filter Toggle
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("High-Pass Rumble Filter (${denoiseParams.highPassFreq.toInt()} Hz)", color = Color.White, fontSize = 11.sp)
                            Switch(
                                checked = denoiseParams.highPassEnabled,
                                onCheckedChange = { 
                                    denoiseParams = denoiseParams.copy(highPassEnabled = it)
                                    onApplyDenoise(denoiseParams)
                                }
                            )
                        }

                        // Dialogue Expander / Noise Gate
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Dialogue Expander Gate (${denoiseParams.gateThresholdDb.toInt()} dB)", color = Color.White, fontSize = 11.sp)
                            Switch(
                                checked = denoiseParams.noiseGateEnabled,
                                onCheckedChange = { 
                                    denoiseParams = denoiseParams.copy(noiseGateEnabled = it)
                                    onApplyDenoise(denoiseParams)
                                }
                            )
                        }

                        // Spectral Subtraction
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Spectral Denoise (-${denoiseParams.reductionAmountDb.toInt()} dB)", color = Color.White, fontSize = 11.sp)
                            Switch(
                                checked = denoiseParams.spectralDenoiseEnabled,
                                onCheckedChange = { 
                                    denoiseParams = denoiseParams.copy(spectralDenoiseEnabled = it)
                                    onApplyDenoise(denoiseParams)
                                }
                            )
                        }

                        // Cleanup Metrics Result
                        cleanupMetrics?.let {
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(Color(0xFF131A26))
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Noise Reduced: -${it.noiseReducedDb} dB", color = Color(0xFF10B981), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                Text("Clean RMS: ${it.cleanedRmsDb} dBFS", color = Color(0xFF94A3B8), fontSize = 10.sp)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Approval Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        OutlinedButton(
                            onClick = onRetake,
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Retake", fontSize = 11.sp)
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(
                                onClick = { onApproveTake(false) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155)),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Save Raw", fontSize = 11.sp)
                            }
                            Button(
                                onClick = { onApproveTake(true) },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Save Cleaned (Non-destructive)", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}
