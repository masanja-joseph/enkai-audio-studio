package com.dubmix.studio.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class TrackType {
    DUB_VOCAL,
    GUIDE_REFERENCE,
    DIALOGUE,
    FILM_AUDIO,
    BG_MUSIC,
    SOUND_EFFECTS,
    AMBIENCE,
    VOICEOVER_TAKES
}

@Entity(tableName = "projects")
data class AudioProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
    val updatedAt: Long,
    val sampleRate: Int = 48000,
    val bitDepth: Int = 24,
    val durationSeconds: Float = 60.0f,
    val videoUri: String? = null
)

@Entity(tableName = "tracks")
data class AudioTrackEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val name: String,
    val type: TrackType = TrackType.DUB_VOCAL,
    val colorHex: String = "#10b981",
    val volume: Float = 1.0f,
    val pan: Float = 0.0f,
    val muted: Boolean = false,
    val solo: Boolean = false,
    val armedForRecord: Boolean = false,
    val orderIndex: Int = 0
)

@Entity(tableName = "clips")
data class AudioClipEntity(
    @PrimaryKey val id: String,
    val trackId: String,
    val assetId: String,
    val name: String,
    val startTimeSeconds: Float,
    val durationSeconds: Float,
    val sourceOffsetSeconds: Float = 0.0f,
    val volume: Float = 1.0f,
    val pan: Float = 0.0f,
    val fadeInSeconds: Float = 0.04f,
    val fadeOutSeconds: Float = 0.04f,
    val muted: Boolean = false,
    val isCleaned: Boolean = false
)

@Entity(tableName = "assets")
data class AudioAssetEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val name: String,
    val filePath: String,
    val durationSeconds: Float,
    val sampleRate: Int = 48000,
    val channels: Int = 1
)

@Entity(tableName = "takes")
data class RecordingTakeEntity(
    @PrimaryKey val id: String,
    val trackId: String,
    val assetId: String,
    val originalAssetId: String?, // Non-destructive backup of raw take
    val name: String,
    val timestamp: Long,
    val durationSeconds: Float,
    val timelinePositionSeconds: Float,
    val status: String = "accepted",
    val isCleaned: Boolean = false
)

data class VocalEffectsConfig(
    val highPassFreq: Float = 90.0f,
    val eqLowGainDb: Float = 0.0f,
    val eqMidGainDb: Float = 1.5f,
    val eqMidFreqHz: Float = 2500.0f,
    val eqHighGainDb: Float = 2.0f,
    val compThresholdDb: Float = -18.0f,
    val compRatio: Float = 3.5f,
    val compAttackSec: Float = 0.015f,
    val compReleaseSec: Float = 0.15f,
    val compMakeupDb: Float = 3.0f,
    val pitchSemitones: Int = 0,
    val formantShift: Int = 0,
    val reverbWet: Float = 0.15f,
    val reverbDecaySec: Float = 1.8f
)
