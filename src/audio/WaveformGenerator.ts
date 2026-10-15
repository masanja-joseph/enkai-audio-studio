/**
 * Peak extraction and downsampling for high-speed waveform rendering
 */

export function extractPeaks(audioBuffer: AudioBuffer, targetPoints: number = 400): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / targetPoints));
  const peaks: number[] = new Float64Array(targetPoints) as unknown as number[];

  for (let i = 0; i < targetPoints; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;

    for (let j = start; j < end; j++) {
      const absVal = Math.abs(channelData[j]);
      if (absVal > max) {
        max = absVal;
      }
    }
    peaks[i] = Math.min(1, max);
  }

  return Array.from(peaks);
}

/**
 * Draws waveform onto an HTML Canvas or 2D context efficiently
 */
export function drawWaveform(
  target: CanvasRenderingContext2D | HTMLCanvasElement,
  peaks: number[],
  arg3?: number | string,
  arg4?: number | string,
  arg5?: string,
  progressRatio: number = 0
) {
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let color = '#10b981';

  if (target instanceof HTMLCanvasElement) {
    ctx = target.getContext('2d');
    width = target.width;
    height = target.height;
    if (typeof arg3 === 'string') {
      color = arg3;
    }
  } else {
    ctx = target;
    width = typeof arg3 === 'number' ? arg3 : 100;
    height = typeof arg4 === 'number' ? arg4 : 50;
    if (typeof arg5 === 'string') {
      color = arg5;
    }
  }

  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  if (!peaks || peaks.length === 0) {
    // Draw subtle center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    return;
  }

  const centerY = height / 2;
  const step = width / peaks.length;

  // Background wave (unplayed)
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < peaks.length; i++) {
    const peak = peaks[i];
    const barHeight = Math.max(2, peak * (height / 2 - 2));
    const x = i * step;
    ctx.rect(x, centerY - barHeight, Math.max(1.5, step - 0.5), barHeight * 2);
  }
  ctx.fill();

  // Progress highlight if playing
  if (progressRatio > 0 && progressRatio <= 1) {
    const progressWidth = width * progressRatio;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, progressWidth, height);
    ctx.clip();
    
    // Draw lighter overlay
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(2, peak * (height / 2 - 2));
      const x = i * step;
      ctx.rect(x, centerY - barHeight, Math.max(1.5, step - 0.5), barHeight * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}
