#include "AudioEngine.h"
#include <android/log.h>
#include <cmath>
#include <algorithm>

#define TAG "DubMixAudioEngine"
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

namespace dubmix {

AudioEngine* AudioEngine::getInstance() {
    static AudioEngine instance;
    return &instance;
}

AudioEngine::AudioEngine() {}

AudioEngine::~AudioEngine() {
    stop();
}

bool AudioEngine::start() {
    if (mStream && mStream->getState() == oboe::StreamState::Started) {
        mIsPlaying = true;
        return true;
    }

    oboe::AudioStreamBuilder builder;
    builder.setFormat(oboe::AudioFormat::Float)
        ->setChannelCount(oboe::ChannelCount::Stereo)
        ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
        ->setSharingMode(oboe::SharingMode::Exclusive)
        ->setDataCallback(this)
        ->setErrorCallback(this);

    oboe::Result result = builder.openStream(mStream);
    if (result != oboe::Result::OK) {
        LOGE("Failed to open audio stream: %s", oboe::convertToText(result));
        return false;
    }

    result = mStream->requestStart();
    if (result != oboe::Result::OK) {
        LOGE("Failed to start audio stream: %s", oboe::convertToText(result));
        return false;
    }

    mIsPlaying = true;
    return true;
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

void AudioEngine::setPlayheadFrame(int64_t frame) {
    mCurrentFrame = std::max((int64_t)0, frame);
}

int64_t AudioEngine::getPlayheadFrame() {
    return mCurrentFrame.load();
}

void AudioEngine::updateTrackVolume(int32_t trackId, float volume) {
    std::lock_guard<std::mutex> lock(mTrackMutex);
    for (auto& t : mTracks) {
        if (t.id == trackId) {
            t.volume = volume;
            break;
        }
    }
}

void AudioEngine::updateTrackPan(int32_t trackId, float pan) {
    std::lock_guard<std::mutex> lock(mTrackMutex);
    for (auto& t : mTracks) {
        if (t.id == trackId) {
            t.pan = pan;
            break;
        }
    }
}

void AudioEngine::updateTrackMute(int32_t trackId, bool muted) {
    std::lock_guard<std::mutex> lock(mTrackMutex);
    for (auto& t : mTracks) {
        if (t.id == trackId) {
            t.muted = muted;
            break;
        }
    }
}

void AudioEngine::updateTrackSolo(int32_t trackId, bool solo) {
    std::lock_guard<std::mutex> lock(mTrackMutex);
    for (auto& t : mTracks) {
        if (t.id == trackId) {
            t.solo = solo;
            break;
        }
    }
}

void AudioEngine::setMasterVolume(float volume) {
    mMasterVolume = volume;
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

    float peakL = 0.0f;
    float peakR = 0.0f;
    float masterVol = mMasterVolume.load();

    {
        std::lock_guard<std::mutex> lock(mTrackMutex);

        bool anySolo = false;
        for (const auto& track : mTracks) {
            if (track.solo) {
                anySolo = true;
                break;
            }
        }

        for (const auto& track : mTracks) {
            if (track.muted || (anySolo && !track.solo)) {
                continue;
            }

            // Calculate equal-power stereo pan coefficients
            float pan = std::max(-1.0f, std::min(1.0f, track.pan));
            float angle = (pan + 1.0f) * (M_PI / 4.0f);
            float panGainL = std::cos(angle) * track.volume;
            float panGainR = std::sin(angle) * track.volume;

            for (const auto& clip : track.clips) {
                int64_t clipStart = clip.startFrame;
                int64_t clipEnd = clip.startFrame + clip.durationFrames;

                // Check overlap
                if (clipEnd <= startFrame || clipStart >= endFrame) {
                    continue;
                }

                int32_t bufferOffset = 0;
                int64_t readFrame = startFrame;

                if (startFrame < clipStart) {
                    bufferOffset = static_cast<int32_t>(clipStart - startFrame);
                    readFrame = clipStart;
                }

                int32_t framesToMix = static_cast<int32_t>(
                    std::min((int64_t)(numFrames - bufferOffset), clipEnd - readFrame));

                for (int32_t i = 0; i < framesToMix; ++i) {
                    int64_t sourceIdx = (readFrame - clipStart + clip.sourceOffsetFrames + i);
                    if (sourceIdx < 0 || sourceIdx >= (int64_t)clip.pcmData.size()) continue;

                    float sample = clip.pcmData[sourceIdx] * clip.volume;
                    int32_t outIdx = (bufferOffset + i) * 2;

                    output[outIdx] += sample * panGainL;
                    output[outIdx + 1] += sample * panGainR;
                }
            }
        }
    }

    // Apply master volume and peak limiting
    for (int32_t i = 0; i < numFrames * 2; i += 2) {
        float l = output[i] * masterVol;
        float r = output[i + 1] * masterVol;

        // Soft clipper / limiter to avoid digital overs
        l = std::tanh(l);
        r = std::tanh(r);

        output[i] = l;
        output[i + 1] = r;

        peakL = std::max(peakL, std::abs(l));
        peakR = std::max(peakR, std::abs(r));
    }

    mMasterPeakLeft.store(peakL);
    mMasterPeakRight.store(peakR);
    mCurrentFrame.store(endFrame);

    return oboe::DataCallbackResult::Continue;
}

void AudioEngine::onErrorAfterClose(oboe::AudioStream *oboeStream, oboe::Result result) {
    LOGE("Audio stream error after close: %s", oboe::convertToText(result));
}

} // namespace dubmix
