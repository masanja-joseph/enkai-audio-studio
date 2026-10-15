package com.dubmix.studio.audio

/**
 * Kotlin interface to high-performance C++ Oboe Audio Engine
 */
object AudioEngineBridge {
    init {
        System.loadLibrary("dubmix_audio")
    }

    external fun nativeStart(): Boolean
    external fun nativePause()
    external fun nativeStop()
    external fun nativeSetPlayheadFrame(frame: Long)
    external fun nativeGetPlayheadFrame(): Long
    external fun nativeSetTrackVolume(trackId: Int, volume: Float)
    external fun nativeSetTrackPan(trackId: Int, pan: Float)
    external fun nativeSetTrackMute(trackId: Int, muted: Boolean)
    external fun nativeSetTrackSolo(trackId: Int, solo: Boolean)
    external fun nativeSetMasterVolume(volume: Float)

    fun startPlayback(): Boolean = nativeStart()
    fun pausePlayback() = nativePause()
    fun stopPlayback() = nativeStop()
    fun seekToSeconds(seconds: Float, sampleRate: Int = 48000) {
        val frame = (seconds * sampleRate).toLong()
        nativeSetPlayheadFrame(frame)
    }
    fun getCurrentSeconds(sampleRate: Int = 48000): Float {
        return nativeGetPlayheadFrame().toFloat() / sampleRate
    }
}
