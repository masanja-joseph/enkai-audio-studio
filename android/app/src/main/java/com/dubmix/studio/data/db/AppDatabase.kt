package com.dubmix.studio.data.db

import androidx.room.*
import com.dubmix.studio.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ProjectDao {
    @Query("SELECT * FROM projects ORDER BY updatedAt DESC")
    fun getAllProjects(): Flow<List<AudioProjectEntity>>

    @Query("SELECT * FROM projects WHERE id = :id")
    suspend fun getProjectById(id: String): AudioProjectEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertProject(project: AudioProjectEntity)

    @Delete
    suspend fun deleteProject(project: AudioProjectEntity)

    @Query("SELECT * FROM tracks WHERE projectId = :projectId ORDER BY orderIndex ASC")
    fun getTracksForProject(projectId: String): Flow<List<AudioTrackEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTracks(tracks: List<AudioTrackEntity>)

    @Query("SELECT * FROM clips WHERE trackId = :trackId")
    suspend fun getClipsForTrack(trackId: String): List<AudioClipEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClips(clips: List<AudioClipEntity>)

    @Query("DELETE FROM clips WHERE id = :clipId")
    suspend fun deleteClip(clipId: String)

    @Query("SELECT * FROM takes WHERE trackId = :trackId ORDER BY timestamp DESC")
    suspend fun getTakesForTrack(trackId: String): List<RecordingTakeEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTake(take: RecordingTakeEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAsset(asset: AudioAssetEntity)
}

@Database(
    entities = [
        AudioProjectEntity::class,
        AudioTrackEntity::class,
        AudioClipEntity::class,
        AudioAssetEntity::class,
        RecordingTakeEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun projectDao(): ProjectDao
}
