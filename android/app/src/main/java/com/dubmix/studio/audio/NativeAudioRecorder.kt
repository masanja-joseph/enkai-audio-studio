package com.dubmix.studio.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.*
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Native Android Audio Recording Engine
 * Uses hardware AudioRecord with VOICE_RECOGNITION source for acoustic noise-optimized vocal capture,
 * capturing uncompressed 48000 Hz 16-bit PCM WAV files.
 */
class NativeAudioRecorder {

    companion object {
        const val SAMPLE_RATE = 48000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private var isRecording = false

    // Real-time amplitude and peak metrics
    var currentPeakDb: Float = -100f
        private set
    var currentRmsDb: Float = -100f
        private set
    var isClipping: Boolean = false
        private set

    @SuppressLint("MissingPermission")
    fun startRecording(
        outputFile: File,
        useVoiceOptimizedSource: Boolean = true,
        inputGainLinear: Float = 1.0f,
        onProgress: ((durationSeconds: Float) -> Unit)? = null
    ): Boolean {
        if (isRecording) return false

        val minBufferSize = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT
        )
        val bufferSize = max(minBufferSize * 2, 4096)

        // Select speech-optimized hardware audio source when requested
        val audioSource = if (useVoiceOptimizedSource) {
            MediaRecorder.AudioSource.VOICE_RECOGNITION
        } else {
            MediaRecorder.AudioSource.MIC
        }

        try {
            audioRecord = AudioRecord(
                audioSource,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                audioRecord?.release()
                audioRecord = null
                return false
            }

            audioRecord?.startRecording()
            isRecording = true

            recordingJob = CoroutineScope(Dispatchers.IO).launch {
                val shortBuffer = ShortArray(bufferSize / 2)
                val fos = FileOutputStream(outputFile)

                // Write 44-byte placeholder for standard RIFF WAV header
                val placeholderHeader = ByteArray(44)
                fos.write(placeholderHeader)

                var totalBytesWritten = 0L
                val startTimeMs = System.currentTimeMillis()

                val byteBuffer = ByteBuffer.allocate(bufferSize)
                byteBuffer.order(ByteOrder.LITTLE_ENDIAN)

                while (isActive && isRecording) {
                    val readShorts = audioRecord?.read(shortBuffer, 0, shortBuffer.size) ?: -1
                    if (readShorts > 0) {
                        byteBuffer.clear()
                        var sumSq = 0.0
                        var maxPeak = 0f

                        for (i in 0 until readShorts) {
                            var sample = shortBuffer[i].toFloat() * inputGainLinear
                            if (sample > 32767f) sample = 32767f
                            if (sample < -32768f) sample = -32768f

                            val shortSample = sample.toInt().toShort()
                            byteBuffer.putShort(shortSample)

                            val absVal = abs(shortSample.toFloat()) / 32768f
                            if (absVal > maxPeak) maxPeak = absVal
                            sumSq += (absVal * absVal).toDouble()
                        }

                        val rms = sqrt(sumSq / readShorts).toFloat()
                        currentRmsDb = if (rms > 1e-5f) 20f * log10(rms) else -100f
                        currentPeakDb = if (maxPeak > 1e-5f) 20f * log10(maxPeak) else -100f
                        isClipping = maxPeak >= 0.98f

                        fos.write(byteBuffer.array(), 0, readShorts * 2)
                        totalBytesWritten += (readShorts * 2)

                        val elapsedSec = (System.currentTimeMillis() - startTimeMs) / 1000f
                        withContext(Dispatchers.Main) {
                            onProgress?.invoke(elapsedSec)
                        }
                    }
                }

                fos.flush()
                fos.close()

                // Finalize standard RIFF WAV header
                writeWavHeader(outputFile, totalBytesWritten, SAMPLE_RATE, 1, 16)
            }

            return true
        } catch (e: Exception) {
            e.printStackTrace()
            stopRecording()
            return false
        }
    }

    fun stopRecording(): Boolean {
        isRecording = false
        recordingJob?.cancel()
        recordingJob = null

        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            e.printStackTrace()
        }

        currentPeakDb = -100f
        currentRmsDb = -100f
        isClipping = false
        return true
    }

    private fun writeWavHeader(
        file: File,
        totalAudioLen: Long,
        sampleRate: Int,
        channels: Int,
        bitsPerSample: Int
    ) {
        val totalDataLen = totalAudioLen + 36
        val byteRate = (sampleRate * channels * bitsPerSample / 8).toLong()

        val header = ByteArray(44)
        header[0] = 'R'.code.toByte()
        header[1] = 'I'.code.toByte()
        header[2] = 'F'.code.toByte()
        header[3] = 'F'.code.toByte()
        header[4] = (totalDataLen and 0xffL).toByte()
        header[5] = ((totalDataLen shr 8) and 0xffL).toByte()
        header[6] = ((totalDataLen shr 16) and 0xffL).toByte()
        header[7] = ((totalDataLen shr 24) and 0xffL).toByte()
        header[8] = 'W'.code.toByte()
        header[9] = 'A'.code.toByte()
        header[10] = 'V'.code.toByte()
        header[11] = 'E'.code.toByte()
        header[12] = 'f'.code.toByte()
        header[13] = 'm'.code.toByte()
        header[14] = 't'.code.toByte()
        header[15] = ' '.code.toByte()
        header[16] = 16
        header[17] = 0
        header[18] = 0
        header[19] = 0
        header[20] = 1 // PCM
        header[21] = 0
        header[22] = channels.toByte()
        header[23] = 0
        header[24] = (sampleRate and 0xff).toByte()
        header[25] = ((sampleRate shr 8) and 0xff).toByte()
        header[26] = ((sampleRate shr 16) and 0xff).toByte()
        header[27] = ((sampleRate shr 24) and 0xff).toByte()
        header[28] = (byteRate and 0xffL).toByte()
        header[29] = ((byteRate shr 8) and 0xffL).toByte()
        header[30] = ((byteRate shr 16) and 0xffL).toByte()
        header[31] = ((byteRate shr 24) and 0xffL).toByte()
        header[32] = ((channels * bitsPerSample / 8)).toByte()
        header[33] = 0
        header[34] = bitsPerSample.toByte()
        header[35] = 0
        header[36] = 'd'.code.toByte()
        header[37] = 'a'.code.toByte()
        header[38] = 't'.code.toByte()
        header[39] = 'a'.code.toByte()
        header[40] = (totalAudioLen and 0xffL).toByte()
        header[41] = ((totalAudioLen shr 8) and 0xffL).toByte()
        header[42] = ((totalAudioLen shr 16) and 0xffL).toByte()
        header[43] = ((totalAudioLen shr 24) and 0xffL).toByte()

        val raf = RandomAccessFile(file, "rw")
        raf.seek(0)
        raf.write(header)
        raf.close()
    }
}
