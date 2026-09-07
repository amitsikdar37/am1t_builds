import { FrameRecord } from '../types';

export class RollingFrameBuffer {
  private buffer: FrameRecord[] = [];
  private maxDurationMs = 6000; // retain sliding 6 seconds of video
  private isCapturing = true;

  // Bitmaps that are actively being used by an edit replay clip or live session.
  // DO NOT close these bitmaps when shifting out of buffer!
  private protectedBitmaps = new Set<ImageBitmap>();

  // Live Progressive Session: Records user actions starting from trigger moment onwards!
  private isSessionActive = false;
  private sessionFrames: FrameRecord[] = [];
  private sessionStartTimestamp = 0;

  /**
   * Starts a live present-clip editing session.
   * Grabs a small pre-roll (300ms) so the start of the gesture is smooth,
   * and continuously accumulates newly captured camera frames.
   */
  public startLiveSession(preRollMs = 350): void {
    this.stopLiveSession();
    this.isSessionActive = true;
    const now = performance.now();
    this.sessionStartTimestamp = now;

    // Grab pre-roll frames from just before the trigger
    const cutoff = now - preRollMs;
    const preRoll = this.buffer.filter(f => f.timestamp >= cutoff && f.bitmap && f.bitmap.width > 0);
    this.sessionFrames = [...preRoll];

    for (const f of this.sessionFrames) {
      this.protectedBitmaps.add(f.bitmap);
    }

    console.log(`[FrameBuffer] Live session started with ${this.sessionFrames.length} pre-roll frames.`);
  }

  /**
   * Returns the live-accumulating array of session frames
   */
  public getSessionFrames(): FrameRecord[] {
    return this.sessionFrames;
  }

  public getSessionStartTimestamp(): number {
    return this.sessionStartTimestamp;
  }

  public isLiveSessionActive(): boolean {
    return this.isSessionActive;
  }

  /**
   * Stops the live session and cleanly releases GPU bitmaps
   */
  public stopLiveSession(): void {
    if (!this.isSessionActive && this.sessionFrames.length === 0) return;
    this.isSessionActive = false;

    for (const f of this.sessionFrames) {
      this.protectedBitmaps.delete(f.bitmap);
      const stillInBuffer = this.buffer.some(b => b.bitmap === f.bitmap);
      if (!stillInBuffer) {
        try {
          f.bitmap.close();
        } catch {
          // Already closed
        }
      }
    }

    this.sessionFrames = [];
    console.log('[FrameBuffer] Live session ended and GPU resources safely recycled.');
  }

  /**
   * Pushes a new video frame into the rolling buffer and active live session
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
      const frameRecord: FrameRecord = {
        bitmap,
        timestamp: now
      };

      this.buffer.push(frameRecord);

      // If a live session is active, append to session frames and protect bitmap!
      if (this.isSessionActive) {
        this.protectedBitmaps.add(bitmap);
        this.sessionFrames.push(frameRecord);
      }

      // Prune frames older than maxDurationMs
      const cutoff = now - this.maxDurationMs;
      while (this.buffer.length > 0 && this.buffer[0].timestamp < cutoff) {
        const oldFrame = this.buffer.shift();
        if (oldFrame) {
          // CRITICAL FIX: Do NOT close bitmap if it is currently in an active replay clip or live session!
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
