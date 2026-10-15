package com.dubmix.studio.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.*
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.*

data class TrackPlaybackState(
    val trackId: String,
    var volume: Float = 1.0f,
    var pan: Float = 0.0f,
    var isMuted: Boolean = false,
    var isSolo: Boolean = false,
    val clips: MutableList<NativeClipPlaybackData> = mutableListOf()
)

data class NativeClipPlaybackData(
    val clipId: String,
    val startFrame: Long,
    val durationFrames: Long,
    val samples: FloatArray,
    var volume: Float = 1.0f
)

/**
 * Native Android Multitrack Playback & Mixing Engine
 * Provides synchronized playback of multiple Dub Vocal layers and dialogue guides.
 */
class NativeAudioPlayer {

    companion object {
        const val SAMPLE_RATE = 48000
    }

    private var audioTrack: AudioTrack? = null
    private var playbackJob: Job? = null
    var isPlaying = false
        private set

    var currentFrame: Long = 0L
        private set
    var masterVolume: Float = 1.0f

    val tracks = mutableMapOf<String, TrackPlaybackState>()

    fun startPlayback(onPlayheadUpdated: ((seconds: Float) -> Unit)? = null) {
        if (isPlaying) return

        val minBufferSize = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_STEREO,
            AudioFormat.ENCODING_PCM_FLOAT
        )
        val bufferSize = max(minBufferSize * 2, 4096)

        audioTrack = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                    .setSampleRate(SAMPLE_RATE)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_STEREO)
                    .build()
            )
            .setBufferSizeInBytes(bufferSize * 4) // Float = 4 bytes
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack?.play()
        isPlaying = true

        playbackJob = CoroutineScope(Dispatchers.Default).launch {
            val numFramesPerChunk = 512
            val stereoBuffer = FloatArray(numFramesPerChunk * 2)

            while (isActive && isPlaying) {
                stereoBuffer.fill(0f)
                val startF = currentFrame
                val endF = startF + numFramesPerChunk

                val anySolo = tracks.values.any { it.isSolo }

                for (track in tracks.values) {
                    if (track.isMuted || (anySolo && !track.isSolo)) continue

                    val pan = max(-1.0f, min(1.0f, track.pan))
                    val angle = (pan + 1.0f) * (Math.PI.toFloat() / 4.0f)
                    val panGainL = cos(angle.toDouble()).toFloat() * track.volume
                    val panGainR = sin(angle.toDouble()).toFloat() * track.volume

                    for (clip in track.clips) {
                        val clipStart = clip.startFrame
                        val clipEnd = clip.startFrame + clip.durationFrames

                        if (clipEnd <= startF || clipStart >= endF) continue

                        var bufferOffset = 0
                        var readF = startF
                        if (startF < clipStart) {
                            bufferOffset = (clipStart - startF).toInt()
                            readF = clipStart
                        }

                        val framesToMix = min(
                            numFramesPerChunk - bufferOffset,
                            (clipEnd - readF).toInt()
                        )

                        for (i in 0 until framesToMix) {
                            val srcIdx = (readF - clipStart + i).toInt()
                            if (srcIdx < 0 || srcIdx >= clip.samples.size) continue

                            val sample = clip.samples[srcIdx] * clip.volume
                            val outIdx = (bufferOffset + i) * 2

                            stereoBuffer[outIdx] += sample * panGainL
                            stereoBuffer[outIdx + 1] += sample * panGainR
                        }
                    }
                }

                // Apply master volume and soft limiting
                for (i in 0 until numFramesPerChunk * 2 step 2) {
                    stereoBuffer[i] = tanh((stereoBuffer[i] * masterVolume).toDouble()).toFloat()
                    stereoBuffer[i + 1] = tanh((stereoBuffer[i + 1] * masterVolume).toDouble()).toFloat()
                }

                audioTrack?.write(
                    stereoBuffer,
                    0,
                    stereoBuffer.size,
                    AudioTrack.WRITE_BLOCKING
                )

                currentFrame = endF
                val seconds = currentFrame.toFloat() / SAMPLE_RATE

                withContext(Dispatchers.Main) {
                    onPlayheadUpdated?.invoke(seconds)
                }
            }
        }
    }

    fun pausePlayback() {
        isPlaying = false
        playbackJob?.cancel()
        playbackJob = null
        try {
            audioTrack?.pause()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun stopPlayback() {
        isPlaying = false
        playbackJob?.cancel()
        playbackJob = null
        currentFrame = 0L

        try {
            audioTrack?.stop()
            audioTrack?.release()
            audioTrack = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun seekToSeconds(seconds: Float) {
        currentFrame = max(0L, (seconds * SAMPLE_RATE).toLong())
    }

    fun loadWavClip(
        trackId: String,
        clipId: String,
        startSeconds: Float,
        wavFile: File,
        volume: Float = 1.0f
    ) {
        if (!wavFile.exists()) return
        val fis = FileInputStream(wavFile)
        val header = ByteArray(44)
        fis.read(header)
        val dataLen = ByteBuffer.wrap(header, 40, 4).order(ByteOrder.LITTLE_ENDIAN).int
        val numShorts = dataLen / 2

        val rawBytes = ByteArray(dataLen)
        fis.read(rawBytes)
        fis.close()

        val shortBuf = ByteBuffer.wrap(rawBytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        val floatSamples = FloatArray(numShorts)
        for (i in 0 until numShorts) {
            floatSamples[i] = shortBuf.get(i) / 32768f
        }

        val startFrame = (startSeconds * SAMPLE_RATE).toLong()
        val clip = NativeClipPlaybackData(
            clipId = clipId,
            startFrame = startFrame,
            durationFrames = numShorts.toLong(),
            samples = floatSamples,
            volume = volume
        )

        val track = tracks.getOrPut(trackId) { TrackPlaybackState(trackId) }
        track.clips.removeAll { it.clipId == clipId }
        track.clips.add(clip)
    }
}
