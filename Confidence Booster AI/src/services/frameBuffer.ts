import { FrameRecord, MultiTakeClips, PostTriggerMoments } from '../types';

export class RollingFrameBuffer {
  private buffer: FrameRecord[] = [];
  private maxDurationMs = 7500; // retain sliding 7.5 seconds of video to hold rich past takes
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
   * Grabs a 2400ms pre-roll so the full physical action (drinking water / glasses adjust)
   * is captured completely and replayed during the tension setup!
   */
  public startLiveSession(preRollMs = 0): void {
    this.stopLiveSession();
    this.isSessionActive = true;
    const now = performance.now();
    this.sessionStartTimestamp = now;

    if (preRollMs > 0) {
      const cutoff = now - preRollMs;
      const preRoll = this.buffer.filter(f => f.timestamp >= cutoff && f.bitmap && f.bitmap.width > 0);
      this.sessionFrames = [...preRoll];

      for (const f of this.sessionFrames) {
        this.protectedBitmaps.add(f.bitmap);
      }
    } else {
      this.sessionFrames = [];
    }

    console.log(`[FrameBuffer] Live session started with ${this.sessionFrames.length} frames.`);
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

  /**
   * Captures multiple structured past takes from the rolling buffer:
   * - climax: Past 0ms to -1200ms (peak sip / glasses touch / intense direct stare)
   * - motion: Past -1200ms to -2800ms (physical movement: raising cup / reaching up)
   * - setup: Past -2800ms to -5000ms (earlier neutral posture / glancing take)
   * - allAction: The combined clip for slow-mo tension buildup
   * All frame bitmaps are protected from garbage collection until explicitly released.
   */
  public getMultiTakeClips(preRollDurationMs = 5000): MultiTakeClips {
    const valid = this.buffer.filter(f => f.bitmap && f.bitmap.width > 0);
    if (valid.length === 0) {
      return { setup: [], motion: [], climax: [], allAction: [] };
    }

    const now = performance.now();
    const cutoff = now - preRollDurationMs;
    const allAction = valid.filter(f => f.timestamp >= cutoff);
    const pool = allAction.length >= 10 ? allAction : valid;

    const len = pool.length;
    // Slicing into 3 distinct takes
    const setupEnd = Math.max(1, Math.floor(len * 0.35));
    const motionEnd = Math.max(setupEnd + 1, Math.floor(len * 0.75));

    const setup = pool.slice(0, setupEnd);
    const motion = pool.slice(setupEnd, motionEnd);
    const climax = pool.slice(motionEnd);

    // Protect all bitmaps in these takes
    for (const f of pool) {
      this.protectedBitmaps.add(f.bitmap);
    }

    return {
      setup: setup.length > 0 ? setup : pool,
      motion: motion.length > 0 ? motion : pool,
      climax: climax.length > 0 ? climax : pool,
      allAction: pool
    };
  }

  public releaseMultiTakes(takes: MultiTakeClips): void {
    if (!takes) return;
    if (takes.allAction) this.releaseClip(takes.allAction);
    if (takes.setup) this.releaseClip(takes.setup);
    if (takes.motion) this.releaseClip(takes.motion);
    if (takes.climax) this.releaseClip(takes.climax);
  }

  /**
   * Dynamically extracts and categorizes moments that occurred AFTER the trigger timestamp:
   * - startMoment: The user's initial reaction/posture right after trigger (150ms - 1200ms)
   * - motionMoment: The action movement (e.g. raising cup/hand) (1200ms - 2600ms)
   * - climaxMoment: The peak action right before the drop (2600ms - 3350ms)
   * - dropMoments: Discrete micro-clips captured in real time as the drop plays (3570ms+)
   */
  public getPostTriggerMoments(sessionStartTime: number, _nowTimestamp?: number): PostTriggerMoments {
    const valid = this.sessionFrames.filter(
      f => f && f.bitmap && f.bitmap.width > 0 && f.timestamp >= sessionStartTime
    );

    const startMoment: FrameRecord[] = [];
    const motionMoment: FrameRecord[] = [];
    const climaxMoment: FrameRecord[] = [];
    const dropMoments: FrameRecord[][] = [];

    let currentDropChunk: FrameRecord[] = [];

    for (const f of valid) {
      const dt = f.timestamp - sessionStartTime;
      if (dt >= 100 && dt < 1600) {
        startMoment.push(f);
      } else if (dt >= 1600 && dt < 3200) {
        motionMoment.push(f);
      } else if (dt >= 3200 && dt <= 4940) {
        climaxMoment.push(f);
      } else if (dt > 4940) {
        currentDropChunk.push(f);
        if (currentDropChunk.length >= 15) {
          dropMoments.push([...currentDropChunk]);
          currentDropChunk = [];
        }
      }
    }
    if (currentDropChunk.length > 5) {
      dropMoments.push(currentDropChunk);
    }

    // Strictly post-trigger fallback: NEVER fall back to pre-trigger buffer!
    const fallback = valid;
    const lastFrame = fallback.length > 0 ? [fallback[fallback.length - 1]] : [];

    return {
      startMoment: startMoment.length > 0 ? startMoment : (fallback.length > 0 ? fallback.slice(0, Math.min(10, fallback.length)) : lastFrame),
      motionMoment: motionMoment.length > 0 ? motionMoment : (fallback.length > 0 ? fallback.slice(Math.max(0, Math.floor(fallback.length * 0.3)), Math.floor(fallback.length * 0.7)) : lastFrame),
      climaxMoment: climaxMoment.length > 0 ? climaxMoment : lastFrame,
      dropMoments,
      allRecorded: valid
    };
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
