#include <jni.h>
#include "AudioEngine.h"

using namespace dubmix;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeStart(JNIEnv *env, jobject thiz) {
    return AudioEngine::getInstance()->start();
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativePause(JNIEnv *env, jobject thiz) {
    AudioEngine::getInstance()->pause();
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeStop(JNIEnv *env, jobject thiz) {
    AudioEngine::getInstance()->stop();
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetPlayheadFrame(JNIEnv *env, jobject thiz, jlong frame) {
    AudioEngine::getInstance()->setPlayheadFrame(frame);
}

JNIEXPORT jlong JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeGetPlayheadFrame(JNIEnv *env, jobject thiz) {
    return AudioEngine::getInstance()->getPlayheadFrame();
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetTrackVolume(JNIEnv *env, jobject thiz, jint track_id, jfloat volume) {
    AudioEngine::getInstance()->updateTrackVolume(track_id, volume);
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetTrackPan(JNIEnv *env, jobject thiz, jint track_id, jfloat pan) {
    AudioEngine::getInstance()->updateTrackPan(track_id, pan);
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetTrackMute(JNIEnv *env, jobject thiz, jint track_id, jboolean muted) {
    AudioEngine::getInstance()->updateTrackMute(track_id, muted);
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetTrackSolo(JNIEnv *env, jobject thiz, jint track_id, jboolean solo) {
    AudioEngine::getInstance()->updateTrackSolo(track_id, solo);
}

JNIEXPORT void JNICALL
Java_com_dubmix_studio_audio_AudioEngineBridge_nativeSetMasterVolume(JNIEnv *env, jobject thiz, jfloat volume) {
    AudioEngine::getInstance()->setMasterVolume(volume);
}

}
