#pragma once

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
    // EQ parameters
    float eqLowGainDb;
    float eqMidGainDb;
    float eqHighGainDb;
    // Compressor parameters
    float compThresholdDb;
    float compRatio;
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

    // AudioStreamDataCallback implementation
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream *audioStream,
        void *audioData,
        int32_t numFrames) override;

    void onErrorAfterClose(oboe::AudioStream *oboeStream, oboe::Result result) override;

private:
    AudioEngine();
    ~AudioEngine();

    std::shared_ptr<oboe::AudioStream> mStream;
    std::atomic<bool> mIsPlaying{false};
    std::atomic<int64_t> mCurrentFrame{0};
    std::atomic<float> mMasterVolume{1.0f};

    std::mutex mTrackMutex;
    std::vector<AudioTrackNative> mTracks;

    // Peak levels for UI metering (thread-safe atomics)
    std::atomic<float> mMasterPeakLeft{0.0f};
    std::atomic<float> mMasterPeakRight{0.0f};
};

} // namespace dubmix
