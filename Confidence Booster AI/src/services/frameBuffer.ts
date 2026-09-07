import { FrameRecord } from '../types';

export class RollingFrameBuffer {
  private buffer: FrameRecord[] = [];
  private maxDurationMs = 6000; // retain sliding 6 seconds of video
  private isCapturing = true;
  // Bitmaps that are actively being used by an edit replay clip.
  // DO NOT close these bitmaps when shifting out of buffer!
  private protectedBitmaps = new Set<ImageBitmap>();

  /**
   * Pushes a new video frame into the rolling buffer
   */
  public async pushFrame(video: HTMLVideoElement): Promise<void> {
    if (!this.isCapturing || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    try {
      // Limit resolution to a balanced 720p or 640p for blistering 60fps rendering without memory bloat
      const targetWidth = Math.min(video.videoWidth, 854);
      const targetHeight = Math.round(targetWidth * (video.videoHeight / video.videoWidth));

      if (targetWidth <= 0 || targetHeight <= 0) return;

      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(video, {
          resizeWidth: targetWidth,
          resizeHeight: targetHeight,
          resizeQuality: 'medium'
        });
      } catch {
        // Fallback without options if browser has issue
        bitmap = await createImageBitmap(video);
      }

      const now = performance.now();
      this.buffer.push({
        bitmap,
        timestamp: now
      });

      // Prune frames older than maxDurationMs
      const cutoff = now - this.maxDurationMs;
      while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
        const oldFrame = this.buffer.shift();
        if (oldFrame) {
          // CRITICAL FIX: Do NOT close bitmap if it is currently in an active replay clip!
          if (!this.protectedBitmaps.has(oldFrame.bitmap)) {
            oldFrame.bitmap.close();
          }
        }
      }
    } catch {
      // Ignore frame grab exceptions if camera is transitioning
    }
  }

  /**
   * Returns a snapshot array of the recorded frames up to the trigger point
   * Marks them as protected so they will NOT be closed during editing or replay!
   */
  public getReplayClip(durationMs = 4500): FrameRecord[] {
    if (this.buffer.length === 0) return [];
    const now = performance.now();
    const cutoff = now - durationMs;
    const filtered = this.buffer.filter(f => f.timestamp >= cutoff && f.bitmap && f.bitmap.width > 0);
    const clip = filtered.length > 0 ? filtered : this.buffer.filter(f => f.bitmap && f.bitmap.width > 0);

    // Protect all bitmaps in this clip from premature closing
    for (const f of clip) {
      this.protectedBitmaps.add(f.bitmap);
    }

    return [...clip];
  }

  /**
   * Called when edit replay completes or is canceled to cleanly free GPU memory
   */
  public releaseClip(frames: FrameRecord[]): void {
    if (!frames || frames.length === 0) return;
    for (const f of frames) {
      this.protectedBitmaps.delete(f.bitmap);
      // If the frame is no longer in this.buffer, close it now
      const stillInBuffer = this.buffer.some(b => b.bitmap === f.bitmap);
      if (!stillInBuffer) {
        try {
          f.bitmap.close();
        } catch {
          // Already closed
        }
      }
    }
  }

  public getFrameCount(): number {
    return this.buffer.length;
  }

  public setCapturing(val: boolean) {
    this.isCapturing = val;
  }

  public clear() {
    for (const item of this.buffer) {
      if (!this.protectedBitmaps.has(item.bitmap)) {
        try {
          item.bitmap.close();
        } catch {}
      }
    }
    this.buffer = [];
  }
}

export const frameBuffer = new RollingFrameBuffer();
