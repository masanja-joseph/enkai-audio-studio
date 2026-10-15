package com.dubmix.studio.audio

import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.*

/**
 * Native Offline Multitrack WAV Exporter
 * Performs 32-bit floating point summing and PCM encoding with peak normalization.
 */
object NativeWavExporter {

    fun exportMixToWav(
        outputFile: File,
        tracks: List<TrackPlaybackState>,
        totalDurationSeconds: Float,
        sampleRate: Int = 48000,
        bitDepth: Int = 24,
        normalize: Boolean = true,
        onProgress: ((progress: Float) -> Unit)? = null
    ): Boolean {
        val totalFrames = (totalDurationSeconds * sampleRate).toLong()
        if (totalFrames <= 0) return false

        val fos = FileOutputStream(outputFile)
        val placeholderHeader = ByteArray(44)
        fos.write(placeholderHeader)

        val anySolo = tracks.any { it.isSolo }
        val chunkSize = 2048
        var currentF = 0L

        // Store peak for normalization
        var maxPeak = 0.0f

        val tempFloatL = FloatArray(totalFrames.toInt())
        val tempFloatR = FloatArray(totalFrames.toInt())

        while (currentF < totalFrames) {
            val framesToProcess = min(chunkSize.toLong(), totalFrames - currentF).toInt()

            for (track in tracks) {
                if (track.isMuted || (anySolo && !track.isSolo)) continue

                val pan = max(-1.0f, min(1.0f, track.pan))
                val angle = (pan + 1.0f) * (Math.PI.toFloat() / 4.0f)
                val panGainL = cos(angle.toDouble()).toFloat() * track.volume
                val panGainR = sin(angle.toDouble()).toFloat() * track.volume

                for (clip in track.clips) {
                    val clipStart = clip.startFrame
                    val clipEnd = clip.startFrame + clip.durationFrames

                    if (clipEnd <= currentF || clipStart >= currentF + framesToProcess) continue

                    var bufferOffset = 0
                    var readF = currentF
                    if (currentF < clipStart) {
                        bufferOffset = (clipStart - currentF).toInt()
                        readF = clipStart
                    }

                    val count = min(framesToProcess - bufferOffset, (clipEnd - readF).toInt())
                    for (i in 0 until count) {
                        val srcIdx = (readF - clipStart + i).toInt()
                        if (srcIdx < 0 || srcIdx >= clip.samples.size) continue

                        val sample = clip.samples[srcIdx] * clip.volume
                        val outIdx = (currentF + bufferOffset + i).toInt()

                        tempFloatL[outIdx] += sample * panGainL
                        tempFloatR[outIdx] += sample * panGainR
                    }
                }
            }

            currentF += framesToProcess
            onProgress?.invoke(0.5f * (currentF.toFloat() / totalFrames))
        }

        // Measure peak
        for (i in 0 until totalFrames.toInt()) {
            val absL = abs(tempFloatL[i])
            val absR = abs(tempFloatR[i])
            if (absL > maxPeak) maxPeak = absL
            if (absR > maxPeak) maxPeak = absR
        }

        val normGain = if (normalize && maxPeak > 1e-4f) {
            0.966f / maxPeak // -0.3 dBFS peak ceiling
        } else {
            1.0f
        }

        // Write stereo PCM data (16-bit or 24-bit)
        val bytesPerSample = bitDepth / 8
        val byteBuf = ByteBuffer.allocate(chunkSize * 2 * bytesPerSample).order(ByteOrder.LITTLE_ENDIAN)

        var totalBytesWritten = 0L
        var writeF = 0L

        while (writeF < totalFrames) {
            val count = min(chunkSize.toLong(), totalFrames - writeF).toInt()
            byteBuf.clear()

            for (i in 0 until count) {
                val idx = (writeF + i).toInt()
                val l = max(-1.0f, min(1.0f, tempFloatL[idx] * normGain))
                val r = max(-1.0f, min(1.0f, tempFloatR[idx] * normGain))

                if (bitDepth == 16) {
                    byteBuf.putShort((l * 32767f).toInt().toShort())
                    byteBuf.putShort((r * 32767f).toInt().toShort())
                } else {
                    // 24-bit PCM: 3 bytes Little Endian per channel
                    val intL = (l * 8388607f).toInt()
                    byteBuf.put((intL and 0xFF).toByte())
                    byteBuf.put(((intL shr 8) and 0xFF).toByte())
                    byteBuf.put(((intL shr 16) and 0xFF).toByte())

                    val intR = (r * 8388607f).toInt()
                    byteBuf.put((intR and 0xFF).toByte())
                    byteBuf.put(((intR shr 8) and 0xFF).toByte())
                    byteBuf.put(((intR shr 16) and 0xFF).toByte())
                }
            }

            val written = count * 2 * bytesPerSample
            fos.write(byteBuf.array(), 0, written)
            totalBytesWritten += written

            writeF += count
            onProgress?.invoke(0.5f + 0.5f * (writeF.toFloat() / totalFrames))
        }

        fos.flush()
        fos.close()

        // Write standard RIFF WAV header
        writeWavHeader(outputFile, totalBytesWritten, sampleRate, 2, bitDepth)
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
