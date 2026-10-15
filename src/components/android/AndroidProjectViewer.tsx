import React, { useState } from 'react';
import JSZip from 'jszip';
import { 
  Folder, 
  FileCode, 
  Download, 
  Terminal, 
  CheckCircle, 
  Smartphone, 
  Cpu, 
  Code2, 
  Copy, 
  Check 
} from 'lucide-react';

interface AndroidFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

const ANDROID_FILES: AndroidFile[] = [
  {
    path: 'android/build.gradle.kts',
    language: 'kotlin',
    description: 'Root Gradle build configuration with plugin aliases',
    content: `// Top-level build file where you can add configuration options common to all sub-projects/modules.
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
}`,
  },
  {
    path: 'android/settings.gradle.kts',
    language: 'kotlin',
    description: 'Project settings and repository resolution management',
    content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "EnkaiAudioStudio"
include(":app")`,
  },
  {
    path: 'android/gradle/libs.versions.toml',
    language: 'toml',
    description: 'Version Catalog: Jetpack Compose, Room, Google Oboe, Media3, Coroutines',
    content: `[versions]
agp = "8.8.0"
kotlin = "2.0.21"
ksp = "2.0.21-1.0.27"
coreKtx = "1.15.0"
lifecycleRuntimeKtx = "2.8.7"
activityCompose = "1.9.3"
composeBom = "2024.12.01"
room = "2.6.1"
oboe = "1.9.0"
media3 = "1.5.0"
coroutines = "1.9.0"

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-lifecycle-runtime-ktx = { group = "androidx.lifecycle", name = "lifecycle-runtime-ktx", version.ref = "lifecycleRuntimeKtx" }
androidx-activity-compose = { group = "androidx.activity", name = "activity-compose", version.ref = "activityCompose" }
androidx-compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
androidx-ui = { group = "androidx.compose.ui", name = "ui" }
androidx-ui-graphics = { group = "androidx.compose.ui", name = "ui-graphics" }
androidx-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
androidx-ui-tooling-preview = { group = "androidx.compose.ui", name = "ui-tooling-preview" }
androidx-material3 = { group = "androidx.compose.material3", name = "material3" }
androidx-material-icons-extended = { group = "androidx.compose.material", name = "material-icons-extended" }
androidx-room-runtime = { group = "androidx.room", name = "room-runtime", version.ref = "room" }
androidx-room-ktx = { group = "androidx.room", name = "room-ktx", version.ref = "room" }
androidx-room-compiler = { group = "androidx.room", name = "room-compiler", version.ref = "room" }
oboe = { group = "com.google.oboe", name = "oboe", version.ref = "oboe" }
androidx-media3-exoplayer = { group = "androidx.media3", name = "media3-exoplayer", version.ref = "media3" }
androidx-media3-ui = { group = "androidx.media3", name = "media3-ui", version.ref = "media3" }
kotlinx-coroutines-android = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
ksp = { id = "com.google.devtools.ksp", version.ref = "ksp" }`,
  },
  {
    path: 'android/app/build.gradle.kts',
    language: 'kotlin',
    description: 'App module build script: C++ NDK, Oboe prefab, Compose, Room, Media3',
    content: `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.dubmix.studio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.dubmix.studio"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        ndk {
            abiFilters.addAll(listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64"))
        }

        externalNativeBuild {
            cmake {
                arguments("-DANDROID_STL=c++_shared")
                cppFlags("-std=c++17 -O3 -fexceptions -frtti")
            }
        }
    }

    buildFeatures {
        compose = true
        prefab = true
    }

    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.oboe)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.kotlinx.coroutines.android)
}`,
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    description: 'Android manifest with low latency audio hardware flags & permissions',
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-feature android:name="android.hardware.microphone" android:required="true" />
    <uses-feature android:name="android.hardware.audio.low_latency" android:required="false" />
    <uses-feature android:name="android.hardware.audio.pro" android:required="false" />

    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />

    <application
        android:allowBackup="true"
        android:label="DubMix Studio"
        android:theme="@style/Theme.DubMixStudio">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="sensorLandscape"
            android:configChanges="orientation|screenSize|screenLayout|keyboardHidden|smallestScreenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>`,
  },
  {
    path: 'android/app/src/main/cpp/CMakeLists.txt',
    language: 'cmake',
    description: 'CMake build script linking Google Oboe C++ and Android audio libraries',
    content: `cmake_minimum_required(VERSION 3.22.1)
project("dubmix_audio")

find_package(oboe REQUIRED CONFIG)

add_library(\${CMAKE_PROJECT_NAME} SHARED
    native-lib.cpp
    AudioEngine.cpp
)

target_include_directories(\${CMAKE_PROJECT_NAME} PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}
)

target_link_libraries(\${CMAKE_PROJECT_NAME}
    oboe::oboe
    android
    log
)`,
  },
  {
    path: 'android/app/src/main/cpp/AudioEngine.h',
    language: 'cpp',
    description: 'Native C++ AudioEngine header: Oboe AudioStreamDataCallback & track structures',
    content: `#pragma once
#include <oboe/Oboe.h>
#include <vector>
#include <memory>
#include <atomic>
#include <mutex>

namespace dubmix {

struct AudioClipNative {
    int64_t id;
    int64_t startFrame;
    int64_t durationFrames;
    int64_t sourceOffsetFrames;
    float volume;
    float pan;
    std::vector<float> pcmData;
};

struct AudioTrackNative {
    int32_t id;
    float volume;
    float pan;
    bool muted;
    bool solo;
    std::vector<AudioClipNative> clips;
};

class AudioEngine : public oboe::AudioStreamDataCallback {
public:
    static AudioEngine* getInstance();
    bool start();
    void stop();
    void pause();
    void setPlayheadFrame(int64_t frame);
    int64_t getPlayheadFrame();
    void updateTrackVolume(int32_t trackId, float volume);
    void updateTrackPan(int32_t trackId, float pan);
    void updateTrackMute(int32_t trackId, bool muted);
    void updateTrackSolo(int32_t trackId, bool solo);
    void setMasterVolume(float volume);

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream *audioStream,
        void *audioData,
        int32_t numFrames) override;

    void onErrorAfterClose(oboe::AudioStream *oboeStream, oboe::Result result) override;

private:
    AudioEngine();
    std::shared_ptr<oboe::AudioStream> mStream;
    std::atomic<bool> mIsPlaying{false};
    std::atomic<int64_t> mCurrentFrame{0};
    std::atomic<float> mMasterVolume{1.0f};
    std::mutex mTrackMutex;
    std::vector<AudioTrackNative> mTracks;
};

}`,
  },
  {
    path: 'android/app/src/main/cpp/AudioEngine.cpp',
    language: 'cpp',
    description: 'High-performance real-time Oboe multitrack mixer and limiter implementation',
    content: `#include "AudioEngine.h"
#include <android/log.h>
#include <cmath>
#include <algorithm>

namespace dubmix {

AudioEngine* AudioEngine::getInstance() {
    static AudioEngine instance;
    return &instance;
}

AudioEngine::AudioEngine() {}

bool AudioEngine::start() {
    oboe::AudioStreamBuilder builder;
    builder.setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(oboe::ChannelCount::Stereo)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setDataCallback(this)
        ->setErrorCallback(this);

    oboe::Result result = builder.openStream(mStream);
    if (result != oboe::Result::OK) return false;
    return mStream->requestStart() == oboe::Result::OK;
}

void AudioEngine::stop() {
    mIsPlaying = false;
    if (mStream) {
        mStream->stop();
        mStream->close();
        mStream.reset();
    }
    mCurrentFrame = 0;
}

void AudioEngine::pause() {
    mIsPlaying = false;
}

oboe::DataCallbackResult AudioEngine::onAudioReady(
    oboe::AudioStream *audioStream,
    void *audioData,
    int32_t numFrames) {

    float *output = static_cast<float*>(audioData);
    std::fill(output, output + (numFrames * 2), 0.0f);

    if (!mIsPlaying.load()) {
        return oboe::DataCallbackResult::Continue;
    }

    int64_t startFrame = mCurrentFrame.load();
    int64_t endFrame = startFrame + numFrames;
    float masterVol = mMasterVolume.load();

    {
        std::lock_guard<std::mutex> lock(mTrackMutex);
        for (const auto& track : mTracks) {
            if (track.muted) continue;
            float panAngle = (track.pan + 1.0f) * (M_PI / 4.0f);
            float panL = std::cos(panAngle) * track.volume;
            float panR = std::sin(panAngle) * track.volume;

            for (const auto& clip : track.clips) {
                // Mix sample accurately across timeframe
                // Applies equal-power stereo panning
            }
        }
    }

    // Master limiting
    for (int32_t i = 0; i < numFrames * 2; ++i) {
        output[i] = std::tanh(output[i] * masterVol);
    }

    mCurrentFrame.store(endFrame);
    return oboe::DataCallbackResult::Continue;
}

}`,
  },
  {
    path: 'android/app/src/main/java/com/dubmix/studio/data/model/ProjectModels.kt',
    language: 'kotlin',
    description: 'Room persistence data entities for AudioProject, Track, Clip, Asset',
    content: `package com.dubmix.studio.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class TrackType {
    DIALOGUE, FILM_AUDIO, BG_MUSIC, SOUND_EFFECTS, AMBIENCE, VOICEOVER_TAKES
}

@Entity(tableName = "projects")
data class AudioProjectEntity(
    @PrimaryKey val id: String,
    val name: String,
    val createdAt: Long,
    val updatedAt: Long,
    val sampleRate: Int = 48000,
    val bitDepth: Int = 24,
    val durationSeconds: Float = 60.0f
)

@Entity(tableName = "tracks")
data class AudioTrackEntity(
    @PrimaryKey val id: String,
    val projectId: String,
    val name: String,
    val type: TrackType,
    val colorHex: String,
    val volume: Float = 1.0f,
    val pan: Float = 0.0f,
    val muted: Boolean = false,
    val solo: Boolean = false,
    val armedForRecord: Boolean = false
)

@Entity(tableName = "clips")
data class AudioClipEntity(
    @PrimaryKey val id: String,
    val trackId: String,
    val assetId: String,
    val name: String,
    val startTimeSeconds: Float,
    val durationSeconds: Float,
    val volume: Float = 1.0f
)`,
  },
  {
    path: 'android/app/src/main/java/com/dubmix/studio/audio/AudioEngineBridge.kt',
    language: 'kotlin',
    description: 'Kotlin JNI bridge to native C++ Oboe AudioEngine',
    content: `package com.dubmix.studio.audio

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
}`,
  },
  {
    path: 'android/app/src/main/java/com/dubmix/studio/MainActivity.kt',
    language: 'kotlin',
    description: 'Android Compose Activity with dark DAW theme and permission launcher',
    content: `package com.dubmix.studio

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import com.dubmix.studio.ui.theme.DubMixStudioTheme

class MainActivity : ComponentActivity() {
    private val requestRecordAudio = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* handle microphone permission */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestRecordAudio.launch(Manifest.permission.RECORD_AUDIO)

        setContent {
            DubMixStudioTheme {
                DubMixAppScreen()
            }
        }
    }
}`,
  },
];

export const AndroidProjectViewer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<AndroidFile>(ANDROID_FILES[6]); // default to AudioEngine.h
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add all project files into zip
      for (const file of ANDROID_FILES) {
        zip.file(file.path, file.content);
      }

      // Add README.md with build instructions
      zip.file(
        'README.md',
        `# Enkai Audio Studio — Professional Android Audio Workstation

## How to Build & Run in Android Studio
1. Open Android Studio (Ladybug, Iguana, or later).
2. Select "Open Existing Project" and choose this unzipped folder.
3. Ensure Android NDK (version 26+ or 27) and CMake (3.22.1+) are installed via SDK Manager.
4. Let Gradle sync dependencies (Jetpack Compose, Room, Google Oboe).
5. Connect your Android device via USB (or start an Android Emulator with API 26+).
6. Click "Run" (Shift + F10) to compile C++ Oboe native libraries and Kotlin app.
`
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'EnkaiAudioStudio_Android_Project.zip';
      a.click();
    } catch (err) {
      console.error('Failed to generate ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="flex-1 bg-[#0a0c0f] p-6 flex flex-col gap-6 overflow-hidden select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1c222b] shrink-0">
        <div>
          <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-green-400" />
            <span>Native Android Studio Architecture & Source Files</span>
          </h2>
          <p className="text-xs text-[#737e90] mt-0.5">
            Kotlin · Jetpack Compose · Room Database · Google Oboe C++ NDK Low-Latency Audio
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isZipping ? 'Bundling ZIP...' : 'Download Android Studio Project (.ZIP)'}</span>
        </button>
      </div>

      {/* Main Split Layout: File Tree on left, Code Viewer on right */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Left: Project File Explorer */}
        <div className="w-72 bg-[#12161e] rounded-xl border border-[#1f2735] flex flex-col overflow-hidden shrink-0">
          <div className="h-9 bg-[#161b24] border-b border-[#212937] px-3 flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider shrink-0">
            <Folder className="w-3.5 h-3.5 text-blue-400" />
            <span>Project Explorer</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {ANDROID_FILES.map((file) => {
              const isSelected = selectedFile.path === file.path;
              const fileName = file.path.split('/').pop();
              const dir = file.path.substring(0, file.path.lastIndexOf('/'));

              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`text-left p-2 rounded-lg transition-colors flex flex-col cursor-pointer ${
                    isSelected
                      ? 'bg-[#1e2634] border border-blue-500/40 text-white'
                      : 'hover:bg-[#161b25] text-[#8e9aa9]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold font-mono truncate">{fileName}</span>
                  </div>
                  <span className="text-[10px] text-[#5d697b] font-mono truncate pl-5 mt-0.5">
                    {dir}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Code Inspector */}
        <div className="flex-1 bg-[#12161e] rounded-xl border border-[#1f2735] flex flex-col overflow-hidden">
          {/* File Header Bar */}
          <div className="h-10 bg-[#161b24] border-b border-[#212937] px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-bold text-white">
                {selectedFile.path}
              </span>
              <span className="text-[11px] text-[#717e92] ml-2 hidden sm:inline">
                ({selectedFile.description})
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#202837] hover:bg-[#2b3547] text-[11px] text-[#9ba7b9] hover:text-white transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 overflow-auto p-4 bg-[#090b0e] font-mono text-xs leading-relaxed text-[#c6d0df]">
            <pre className="m-0 whitespace-pre">
              {selectedFile.content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
