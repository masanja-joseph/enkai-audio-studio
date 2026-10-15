package com.dubmix.studio.audio

import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.*

data class NativeDenoiseParams(
    val highPassEnabled: Boolean = true,
    val highPassFreq: Float = 90f,
    val noiseGateEnabled: Boolean = true,
    val gateThresholdDb: Float = -42f,
    val gateRatio: Float = 3.5f,
    val gateAttackMs: Float = 8f,
    val gateReleaseMs: Float = 140f,
    val spectralDenoiseEnabled: Boolean = true,
    val reductionAmountDb: Float = 10f
)

data class NativeDenoiseMetrics(
    val originalRmsDb: Float,
    val cleanedRmsDb: Float,
    val noiseReducedDb: Float,
    val originalPeakDb: Float,
    val cleanedPeakDb: Float
)

/**
 * Native Android Offline Vocal Cleanup & Noise Reduction DSP
 * Operates purely on local PCM sample data without external network dependencies.
 */
object NativeVocalDenoiseDSP {

    fun processWavFile(
        inputFile: File,
        outputFile: File,
        params: NativeDenoiseParams
    ): NativeDenoiseMetrics {
        val fis = FileInputStream(inputFile)
        val header = ByteArray(44)
        fis.read(header)

        val sampleRate = ByteBuffer.wrap(header, 24, 4).order(ByteOrder.LITTLE_ENDIAN).int
        val channels = ByteBuffer.wrap(header, 22, 2).order(ByteOrder.LITTLE_ENDIAN).short.toInt()
        val bitsPerSample = ByteBuffer.wrap(header, 34, 2).order(ByteOrder.LITTLE_ENDIAN).short.toInt()
        val dataLen = ByteBuffer.wrap(header, 40, 4).order(ByteOrder.LITTLE_ENDIAN).int

        val totalSamples = dataLen / (bitsPerSample / 8)
        val rawBytes = ByteArray(dataLen)
        fis.read(rawBytes)
        fis.close()

        val shortBuf = ByteBuffer.wrap(rawBytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
        val floatSamples = FloatArray(totalSamples)
        for (i in 0 until totalSamples) {
            floatSamples[i] = shortBuf.get(i) / 32768.0f
        }

        val originalMetrics = calculateMetrics(floatSamples)

        // Step 1: High-pass filter for rumble
        var processed = if (params.highPassEnabled) {
            applyHighPassFilter(floatSamples, sampleRate, params.highPassFreq)
        } else {
            floatSamples
        }

        // Step 2: Spectral Subtraction for continuous background noise
        if (params.spectralDenoiseEnabled) {
            processed = applySpectralDenoise(processed, sampleRate, params.reductionAmountDb)
        }

        // Step 3: Downward Expander for noise between spoken dialogue lines
        if (params.noiseGateEnabled) {
            processed = applyDownwardExpander(
                processed,
                sampleRate,
                params.gateThresholdDb,
                params.gateRatio,
                params.gateAttackMs,
                params.gateReleaseMs
            )
        }

        val cleanedMetrics = calculateMetrics(processed)

        // Write cleaned WAV file
        val fos = FileOutputStream(outputFile)
        val outHeader = ByteArray(44)
        System.arraycopy(header, 0, outHeader, 0, 44)
        fos.write(outHeader)

        val outByteBuf = ByteBuffer.allocate(processed.size * 2).order(ByteOrder.LITTLE_ENDIAN)
        for (sample in processed) {
            val clamped = max(-1.0f, min(1.0f, sample))
            outByteBuf.putShort((clamped * 32767.0f).toInt().toShort())
        }
        fos.write(outByteBuf.array())
        fos.flush()
        fos.close()

        return NativeDenoiseMetrics(
            originalRmsDb = round(originalMetrics.first * 10) / 10f,
            cleanedRmsDb = round(cleanedMetrics.first * 10) / 10f,
            noiseReducedDb = max(0f, round((originalMetrics.first - cleanedMetrics.first) * 10) / 10f),
            originalPeakDb = round(originalMetrics.second * 10) / 10f,
            cleanedPeakDb = round(cleanedMetrics.second * 10) / 10f
        )
    }

    private fun calculateMetrics(samples: FloatArray): Pair<Float, Float> {
        if (samples.isEmpty()) return Pair(-100f, -100f)
        var sumSq = 0.0
        var maxPeak = 0.0f
        for (s in samples) {
            val absVal = abs(s)
            if (absVal > maxPeak) maxPeak = absVal
            sumSq += (absVal * absVal).toDouble()
        }
        val rms = sqrt(sumSq / samples.size).toFloat()
        val rmsDb = if (rms > 1e-6f) 20f * log10(rms) else -100f
        val peakDb = if (maxPeak > 1e-6f) 20f * log10(maxPeak) else -100f
        return Pair(rmsDb, peakDb)
    }

    /**
     * 2nd-order Butterworth Highpass Filter
     */
    private fun applyHighPassFilter(samples: FloatArray, sampleRate: Int, cutoffFreq: Float): FloatArray {
        if (cutoffFreq <= 10f) return samples.clone()
        val out = FloatArray(samples.size)

        val omega = (2.0 * Math.PI * cutoffFreq) / sampleRate
        val sinOmega = sin(omega)
        val cosOmega = cos(omega)
        val alpha = sinOmega / (2.0 * 0.7071067811865476)

        val b0 = (1.0 + cosOmega) / 2.0
        val b1 = -(1.0 + cosOmega)
        val b2 = (1.0 + cosOmega) / 2.0
        val a0 = 1.0 + alpha
        val a1 = -2.0 * cosOmega
        val a2 = 1.0 - alpha

        val nb0 = (b0 / a0).toFloat()
        val nb1 = (b1 / a0).toFloat()
        val nb2 = (b2 / a0).toFloat()
        val na1 = (a1 / a0).toFloat()
        val na2 = (a2 / a0).toFloat()

        var x1 = 0f
        var x2 = 0f
        var y1 = 0f
        var y2 = 0f

        for (i in samples.indices) {
            val x0 = samples[i]
            val y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2
            x2 = x1
            x1 = x0
            y2 = y1
            y1 = y0
            out[i] = y0
        }

        return out
    }

    /**
     * Downward Expander / Noise Gate
     */
    private fun applyDownwardExpander(
        samples: FloatArray,
        sampleRate: Int,
        thresholdDb: Float,
        ratio: Float,
        attackMs: Float,
        releaseMs: Float
    ): FloatArray {
        val out = FloatArray(samples.size)
        val thresholdLinear = 10.0.pow((thresholdDb / 20.0).toDouble()).toFloat()
        val attackCoeff = exp(-1.0 / (sampleRate * (attackMs / 1000.0))).toFloat()
        val releaseCoeff = exp(-1.0 / (sampleRate * (releaseMs / 1000.0))).toFloat()

        var envelope = 0.0f
        val minGain = 10.0.pow((-30.0 / 20.0)).toFloat() // Max 30dB reduction

        for (i in samples.indices) {
            val absInput = abs(samples[i])
            envelope = if (absInput > envelope) {
                attackCoeff * envelope + (1f - attackCoeff) * absInput
            } else {
                releaseCoeff * envelope + (1f - releaseCoeff) * absInput
            }

            var gain = 1.0f
            if (envelope < thresholdLinear && envelope > 1e-7f) {
                val envDb = 20f * log10(envelope)
                val diffDb = envDb - thresholdDb
                val expansionDb = diffDb * (ratio - 1.0f)
                val rawGain = 10.0.pow((expansionDb / 20.0).toDouble()).toFloat()
                gain = max(minGain, rawGain)
            } else if (envelope <= 1e-7f) {
                gain = minGain
            }

            out[i] = samples[i] * gain
        }

        return out
    }

    /**
     * Spectral Denoise (STFT with Spectral Subtraction & Over-subtraction)
     */
    private fun applySpectralDenoise(
        samples: FloatArray,
        sampleRate: Int,
        reductionAmountDb: Float
    ): FloatArray {
        val frameSize = 1024
        val hopSize = 256
        if (samples.size < frameSize * 2) return samples.clone()

        val numBins = frameSize / 2 + 1
        val noiseProfile = FloatArray(numBins)

        // Estimate noise floor from the first 300ms of room tone
        val leadIn = min((sampleRate * 0.3f).toInt(), samples.size / 4)
        val window = FloatArray(frameSize) { i ->
            (0.5 * (1.0 - cos((2.0 * Math.PI * i) / (frameSize - 1)))).toFloat()
        }

        var noiseFrameCount = 0
        val re = FloatArray(frameSize)
        val im = FloatArray(frameSize)

        for (pos in 0 until (leadIn - frameSize) step hopSize) {
            for (i in 0 until frameSize) {
                re[i] = samples[pos + i] * window[i]
                im[i] = 0f
            }
            fft(re, im)
            for (k in 0 until numBins) {
                noiseProfile[k] += sqrt(re[k] * re[k] + im[k] * im[k])
            }
            noiseFrameCount++
        }

        if (noiseFrameCount > 0) {
            for (k in 0 until numBins) {
                noiseProfile[k] /= noiseFrameCount
            }
        }

        val out = FloatArray(samples.size)
        val winSum = FloatArray(samples.size)
        val maxAttenuationLinear = 10.0.pow((-abs(reductionAmountDb) / 20.0).toDouble()).toFloat()
        val oversubtraction = 1.3f

        for (pos in 0..(samples.size - frameSize) step hopSize) {
            for (i in 0 until frameSize) {
                re[i] = samples[pos + i] * window[i]
                im[i] = 0f
            }
            fft(re, im)

            for (k in 0 until numBins) {
                val mag = sqrt(re[k] * re[k] + im[k] * im[k])
                val noiseMag = noiseProfile[k] * oversubtraction
                val gain = if (mag > 1e-7f) {
                    max(maxAttenuationLinear, (mag - noiseMag) / mag)
                } else {
                    maxAttenuationLinear
                }

                re[k] *= gain
                im[k] *= gain
                if (k > 0 && k < frameSize / 2) {
                    re[frameSize - k] = re[k]
                    im[frameSize - k] = -im[k]
                }
            }

            ifft(re, im)

            for (i in 0 until frameSize) {
                out[pos + i] += re[i] * window[i]
                winSum[pos + i] += window[i] * window[i]
            }
        }

        for (i in samples.indices) {
            if (winSum[i] > 1e-4f) {
                out[i] /= winSum[i]
            } else {
                out[i] = samples[i]
            }
        }

        return out
    }

    private fun fft(re: FloatArray, im: FloatArray) {
        val n = re.size
        var j = 0
        for (i in 0 until n - 1) {
            if (i < j) {
                val tr = re[i]; re[i] = re[j]; re[j] = tr
                val ti = im[i]; im[i] = im[j]; im[j] = ti
            }
            var k = n shr 1
            while (k <= j) {
                j -= k
                k = k shr 1
            }
            j += k
        }

        var len = 2
        while (len <= n) {
            val half = len shr 1
            val angle = (-2.0 * Math.PI / len).toFloat()
            val wStepRe = cos(angle.toDouble()).toFloat()
            val wStepIm = sin(angle.toDouble()).toFloat()

            for (i in 0 until n step len) {
                var wRe = 1.0f
                var wIm = 0.0f
                for (k in 0 until half) {
                    val uRe = re[i + k]
                    val uIm = im[i + k]
                    val vRe = re[i + k + half] * wRe - im[i + k + half] * wIm
                    val vIm = re[i + k + half] * wIm + im[i + k + half] * wRe

                    re[i + k] = uRe + vRe
                    im[i + k] = uIm + vIm
                    re[i + k + half] = uRe - vRe
                    im[i + k + half] = uIm - vIm

                    val nextWRe = wRe * wStepRe - wIm * wStepIm
                    val nextWIm = wRe * wStepIm + wIm * wStepRe
                    wRe = nextWRe
                    wIm = nextWIm
                }
            }
            len = len shl 1
        }
    }

    private fun ifft(re: FloatArray, im: FloatArray) {
        for (i in im.indices) im[i] = -im[i]
        fft(re, im)
        val n = re.size
        for (i in re.indices) {
            re[i] /= n
            im[i] = -im[i] / n
        }
    }
}
