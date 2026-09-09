import { FrameRecord, EditPresetId, MultiTakeClips } from '../types';

export interface EditRenderOptions {
  canvas: HTMLCanvasElement;
  frames?: FrameRecord[];
  actionFrames?: FrameRecord[]; // captured physical action (drinking / glasses adjust)
  multiTakes?: MultiTakeClips;   // structured past takes (setup, motion, climax) for beat-synced montage!
  getSessionFrames?: () => FrameRecord[];
  getCurrentEyeCenter?: () => { x: number; y: number } | undefined;
  actionType: 'drink' | 'glasses' | 'manual';
  eyeCenter?: { x: number; y: number }; // fallback normalized 0-1
  isMirrored?: boolean;
  startTime?: number; // exact synchronized audio start timestamp
  durationMs?: number; // exact track duration matching audio completion!
  preset?: EditPresetId;
  onComplete: () => void;
  onDropImpact: () => void;
}

export class SigmaEditRenderer {
  private isRendering = false;
  private animFrameId: number | null = null;
  private moggedImage: HTMLImageElement | null = null;
  private moggedImageLoaded = false;

  constructor() {
    this.loadMoggedPng();
  }

  private loadMoggedPng() {
    const img = new Image();
    img.src = '/pngs/MoggedPng.jpeg';
    img.onload = () => {
      this.moggedImage = img;
      this.moggedImageLoaded = true;
      console.log('MoggedPng overlay loaded successfully!');
    };
    img.onerror = () => {
      console.warn('Failed to load /pngs/MoggedPng.jpeg, checking alternative paths...');
      // Fallback path
      const fallbackImg = new Image();
      fallbackImg.src = '/src/pngs/MoggedPng.jpeg';
      fallbackImg.onload = () => {
        this.moggedImage = fallbackImg;
        this.moggedImageLoaded = true;
      };
    };
  }

  /**
   * Universal helper: Draw an ImageBitmap to destination rectangle with object-fit: cover
   * Guarantees zero black borders, perfect subject centering, and horizontal mirror alignment!
   */
  private drawCover(
    ctx: CanvasRenderingContext2D,
    img: ImageBitmap | null | undefined,
    destX: number,
    destY: number,
    destW: number,
    destH: number,
    mirror = false
  ) {
    if (!img || img.width === 0 || img.height === 0) return;
    const imgW = img.width;
    const imgH = img.height;
    const scale = Math.max(destW / imgW, destH / imgH);
    const sw = Math.min(imgW, destW / scale);
    const sh = Math.min(imgH, destH / scale);
    const sx = Math.max(0, (imgW - sw) / 2);
    const sy = Math.max(0, (imgH - sh) / 2);

    if (mirror) {
      ctx.save();
      ctx.translate(destX + destW, destY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
    }
  }

  public startEdit(options: EditRenderOptions) {
    this.stop();
    this.isRendering = true;

    if (options.preset === 'ghost_trail_impact' || options.preset === 'parallax_dual_speed') {
      this.startGhostTrailImpact(options);
      return;
    }

    // Ensure MoggedPng is loaded
    if (!this.moggedImageLoaded) {
      this.loadMoggedPng();
    }

    const { canvas, isMirrored = false, onComplete, onDropImpact } = options;

    const getFrames = (): FrameRecord[] => {
      if (options.getSessionFrames) {
        const live = options.getSessionFrames();
        if (live && live.length > 0) return live;
      }
      return options.frames || [];
    };

    // Number of frames captured during the initial gesture (the ~1.8s EDITING window)
    const initialRawFrames = getFrames().filter(f => f && f.bitmap && f.bitmap.width > 0);
    const initialGestureCount = Math.max(1, initialRawFrames.length);

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const startTime = options.startTime ?? performance.now();
    const totalDuration = options.durationMs ?? 11150; // exact duration matching audio track completion
    const wastedStartTime = 4750; // 4.75s mark: GTA "Wasted" / Mogged effect starts (exact audio peak)
    const popupStartTime = 5250;  // 5.25s: user image pops up from below (overlapping MOGGED text)
    const zoomStartTime = 6100;   // 6.1s: explosive full-screen zoom takeover begins
    const dropBeatTime = 6710;    // 6.71s: EXACT 808 drop impact in audio waveform
    const popupEndTime = 6710;    // Exactly 6.71s: full-screen takeover hits precisely on the 808 drop
    const beatKicks = [6710, 7470, 8050, 8640, 9260, 9880, 10500]; // exact audio 808 beats measured from audio waveform!

    let wastedFired = false;
    let dropFired = false;

    // Snapshot variables for the 4.7s Present-Action snap
    let frozenMoggedFrame: FrameRecord | null = null;
    let frozenEyeCenter: { x: number; y: number } | undefined = undefined;

    const renderLoop = (now: number) => {
      if (!this.isRendering) return;

      const elapsed = now - startTime;

      // Event triggers
      if (elapsed >= wastedStartTime && !wastedFired) {
        wastedFired = true;
        onDropImpact();
      }

      if (elapsed >= dropBeatTime && !dropFired) {
        dropFired = true;
        onDropImpact();
      }

      const w = canvas.width;
      const h = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Dynamically fetch current valid frames from the live session
      const currentFrames = getFrames().filter(f => f && f.bitmap && f.bitmap.width > 0);
      if (currentFrames.length === 0) {
        this.animFrameId = requestAnimationFrame(renderLoop);
        ctx.restore();
        return;
      }

      const totalFrames = currentFrames.length;
      const getValidFrame = (idx: number): FrameRecord => {
        const clamped = Math.min(totalFrames - 1, Math.max(0, idx));
        return currentFrames[clamped];
      };

      // 1. Calculate Frame Selection across Edit Phases
      let fCenter: FrameRecord;

      if (elapsed < wastedStartTime) {
        // --- PHASE 1: SLOW-MOTION BUILD-UP (0.0s to 4.75s) ---
        // Plays the initial trigger gesture (e.g. touching glasses / sip) in buttery slow motion!
        const buildRatio = elapsed / wastedStartTime;
        const rampIdx = Math.floor(buildRatio * (initialGestureCount - 1));
        const safeRampIdx = Math.min(initialGestureCount - 1, Math.max(0, rampIdx));
        fCenter = getValidFrame(safeRampIdx);

      } else if (elapsed >= wastedStartTime && elapsed < popupEndTime) {
        // --- PHASE 2: GTA "WASTED" / MOGGED EFFECT (4.75s to 6.71s) ---
        // Snaps to the latest present camera frame and holds it on the background layer!
        if (!frozenMoggedFrame) {
          frozenMoggedFrame = currentFrames[currentFrames.length - 1];
          frozenEyeCenter = options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : options.eyeCenter;
        }
        fCenter = frozenMoggedFrame;

      } else {
        // --- PHASE 3: LIVE CAMERA WITH HARD CUT JUMPS (6.71s to 11.0s) ---
        // Continuous live camera feed with instant hard jump cuts on the beat!
        const latestIdx = totalFrames - 1;
        fCenter = getValidFrame(latestIdx);
      }

      // Dynamic eye position (frozen during mogged phase, live tracking during drop phase)
      const liveEye = options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : undefined;
      const effectiveEye = (elapsed >= wastedStartTime && elapsed < popupEndTime)
        ? (frozenEyeCenter || liveEye || options.eyeCenter)
        : (liveEye || frozenEyeCenter || options.eyeCenter);

      // 2. Camera Shake (active only during Wasted impact)
      let shakeX = 0;
      let shakeY = 0;

      if (elapsed >= wastedStartTime && elapsed < wastedStartTime + 300) {
        // Wasted impact shock
        const shock = 1 - (elapsed - wastedStartTime) / 300;
        shakeX = (Math.random() - 0.5) * shock * 30;
        shakeY = (Math.random() - 0.5) * shock * 30;
      }

      if (shakeX !== 0 || shakeY !== 0) {
        ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
        ctx.translate(-w / 2, -h / 2);
      }

      // 3. Render Background Layer
      const isWastedPhase = elapsed >= wastedStartTime && elapsed < popupEndTime;

      if (elapsed < wastedStartTime) {
        // --- PHASE 1: SLOW-MOTION BUILD-UP (0.0s to 4.75s) ---
        // Plays gesture in buttery slow-mo with commercial cinematic grade!
        ctx.save();
        ctx.filter = 'contrast(120%) brightness(100%) saturate(108%)';
        if (fCenter && fCenter.bitmap) {
          this.drawCover(ctx, fCenter.bitmap, 0, 0, w, h, isMirrored);
        }
        this.applyCinematicGrade(ctx, 0, 0, w, h);
        ctx.restore();

      } else if (isWastedPhase) {
        // --- PHASE 2: GTA "WASTED" / MOGGED EFFECT (4.75s to 6.71s) ---
        ctx.save();
        ctx.filter = 'grayscale(100%) contrast(140%) brightness(95%)';
        if (fCenter && fCenter.bitmap) {
          this.drawCover(ctx, fCenter.bitmap, 0, 0, w, h, isMirrored);
        }
        ctx.restore();

        // Soft dark vignette around perimeter
        const radialGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
        radialGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
        ctx.fillStyle = radialGrad;
        ctx.fillRect(0, 0, w, h);

      } else {
        // --- PHASE 3: HARD CUT JUMP EFFECTS (6.71s to 11.0s) ---
        this.renderBeatHardSnaps(ctx, fCenter, w, h, elapsed, beatKicks, effectiveEye, isMirrored);
      }

      // 4. === THE "MOGGED" PNG OVERLAY ON BACKGROUND LAYER ===
      if (isWastedPhase) {
        ctx.save();

        // Calculate center position directly over the user's eyes from present snap
        const effectiveEyePos = frozenEyeCenter || (options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : options.eyeCenter);
        const targetX = effectiveEyePos ? effectiveEyePos.x * w : w / 2;
        const targetY = effectiveEyePos ? effectiveEyePos.y * h : h * 0.38;

        // Box size: compact, covering eyes (matching reference Image 3)
        // Image aspect ratio: 420x100 = 4.2
        const boxW = Math.max(160, Math.min(w * 0.35, 360));
        const boxH = boxW / 4.2;
        const boxX = targetX - boxW / 2;
        const boxY = targetY - boxH / 2;

        // Soft red aura behind the box
        const glowGrad = ctx.createRadialGradient(targetX, targetY, 10, targetX, targetY, boxW * 0.55);
        glowGrad.addColorStop(0, 'rgba(230, 0, 30, 0.45)');
        glowGrad.addColorStop(0.6, 'rgba(180, 0, 20, 0.15)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(boxX - 30, boxY - 30, boxW + 60, boxH + 60);

        // Draw the user-provided Mogged PNG overlay image
        if (this.moggedImage && this.moggedImageLoaded) {
          ctx.drawImage(this.moggedImage, boxX, boxY, boxW, boxH);
        } else {
          ctx.fillStyle = '#000000';
          ctx.fillRect(boxX, boxY, boxW, boxH);
          ctx.font = 'bold 36px sans-serif';
          ctx.fillStyle = '#ff0033';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('MOGGED', targetX, targetY);
        }

        ctx.restore();
      }

      // 5. === FOREGROUND SUBJECT POP-UP & FULL-SCREEN ZOOM TAKEOVER ===
      // Exact match to user's reference image:
      // - Pops up from below between 5.2s and 6.2s
      // - Physically overlaps and partially covers the MOGGED text, leaving the left red "M" visible
      // - Then violently zooms in covering the full screen on the 6.5s 808 drop
      if (elapsed >= popupStartTime && elapsed < popupEndTime) {
        const latestFrame = currentFrames[totalFrames - 1];
        this.renderPopUpZoomTakeover(
          ctx,
          latestFrame,
          w,
          h,
          elapsed,
          popupStartTime,
          zoomStartTime,
          popupEndTime,
          isMirrored
        );
      }

      ctx.restore();

      if (elapsed < totalDuration) {
        this.animFrameId = requestAnimationFrame(renderLoop);
      } else {
        this.isRendering = false;
        onComplete();
      }
    };

    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  private getLastKickIndex(beatKicks: number[], elapsed: number): number {
    for (let i = beatKicks.length - 1; i >= 0; i--) {
      if (elapsed >= beatKicks[i]) return i;
    }
    return -1;
  }

  /**
   * Professional Commercial Phonk Color Grading
   * Delivers punchy S-curve contrast, healthy natural skin tones, and rich neutral crushed blacks.
   * ZERO cyan or blue border artifacts.
   */
  private applyCinematicGrade(
    ctx: CanvasRenderingContext2D,
    x = 0,
    y = 0,
    w?: number,
    h?: number
  ) {
    const width = w ?? ctx.canvas.width;
    const height = h ?? ctx.canvas.height;

    ctx.save();

    // 1. Subtle warm-golden highlight / cool-neutral shadow tone mapping (soft-light)
    ctx.globalCompositeOperation = 'soft-light';
    const filmGrad = ctx.createLinearGradient(x, y, x, y + height);
    filmGrad.addColorStop(0, 'rgba(255, 235, 210, 0.08)'); // subtle warm highlight glow
    filmGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    filmGrad.addColorStop(1, 'rgba(12, 12, 18, 0.12)');     // neutral deep film shadow density
    ctx.fillStyle = filmGrad;
    ctx.fillRect(x, y, width, height);

    // 2. Pure Neutral Optical Dark Vignette (Smooth feathered edge darkness, NEVER colored blue)
    ctx.globalCompositeOperation = 'source-over';
    const cx = x + width / 2;
    const cy = y + height * 0.48;
    const rInner = Math.min(width, height) * 0.35;
    const rOuter = Math.max(width, height) * 0.72;
    const vignette = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.68, 'rgba(0, 0, 0, 0.18)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)'); // pure neutral black, zero blue
    ctx.fillStyle = vignette;
    ctx.fillRect(x, y, width, height);

    ctx.restore();
  }

  /**
   * HARD CUT JUMP EFFECTS (PERFECTLY SYNCED WITH AUDIO 808 BEATS)
   * - Instant scale jumps: Instant jump-cuts between extreme face close-up and wide shot
   * - Hard RGB chromatic split on bass hits (first 160ms with exponential decay)
   * - High-contrast flash frames on beat transients (first 65ms)
   * - Perfectly synced with exact audio kicks: [6710, 7470, 8050, 8640, 9260, 9880, 10500]
   * - Signature Cold Phonk color grading throughout
   */
  private renderBeatHardSnaps(
    ctx: CanvasRenderingContext2D,
    frame: FrameRecord,
    w: number,
    h: number,
    elapsed: number,
    beatKicks: number[],
    effectiveEye: { x: number; y: number } | undefined,
    isMirrored: boolean
  ) {
    if (!frame || !frame.bitmap) return;

    const kickIdx = this.getLastKickIndex(beatKicks, elapsed);
    const lastKickTime = kickIdx >= 0 ? beatKicks[kickIdx] : beatKicks[0];
    const timeSinceKick = elapsed - lastKickTime;

    // Alternating Hard Jump Cut Scale:
    // Kick 0 (6710ms - Main 808 Drop): Instant Extreme Close-Up Slam (1.68x) right on drop!
    // Kick 1 (7470ms - 2nd Kick): Instant Wide Angle Snap (1.12x)
    // Kick 2 (8050ms - 3rd Kick): Instant Extreme Face Close-Up Snap (1.75x)
    // Kick 3 (8640ms - 4th Kick): Instant Wide Angle Snap (1.12x)
    // Kick 4 (9260ms - 5th Kick): Instant Extreme Face Close-Up Snap (1.78x)
    // Kick 5 (9880ms - 6th Kick): Instant Wide Angle Snap (1.12x)
    // Kick 6 (10500ms - 7th Kick): Instant Climax Face Slam (1.82x)
    const isCloseUpKick = (kickIdx === 0 || kickIdx === 2 || kickIdx === 4 || kickIdx === 6);
    let jumpScale = 1.12;

    if (isCloseUpKick) {
      if (kickIdx === 6) jumpScale = 1.82;
      else if (kickIdx === 4) jumpScale = 1.78;
      else if (kickIdx === 2) jumpScale = 1.75;
      else jumpScale = 1.68;
    } else {
      jumpScale = 1.12;
    }

    // Framing focus: locked onto user's eyes/jaw during close-up snaps, center during wide
    let focusX = w / 2;
    let focusY = h / 2;
    if (isCloseUpKick) {
      focusX = effectiveEye ? effectiveEye.x * w : w / 2;
      focusY = effectiveEye ? effectiveEye.y * h : h * 0.38;
    }

    // 1-frame violent jagged shake: ±15px random displacement dropping straight back over 60ms
    let shakeX = 0;
    let shakeY = 0;
    if (timeSinceKick < 60) {
      if (timeSinceKick < 30) {
        const signX = (kickIdx % 2 === 0) ? 1 : -1;
        const signY = (kickIdx % 3 === 0) ? 1 : -1;
        shakeX = signX * (14 + ((kickIdx * 5) % 5));
        shakeY = signY * (14 + ((kickIdx * 7) % 5));
      } else {
        shakeX = (kickIdx % 2 === 0 ? 1 : -1) * 3;
        shakeY = (kickIdx % 3 === 0 ? 1 : -1) * 3;
      }
    }

    ctx.save();

    // Instant scale transform + violent jagged shake (Hard Cut Jump)
    ctx.translate(focusX + shakeX, focusY + shakeY);
    ctx.scale(jumpScale, jumpScale);
    ctx.translate(-focusX, -focusY);

    // 2. High-Contrast Flash Frames (first 65ms of every beat hit)
    const isFlashFrame = timeSinceKick < 65;
    if (isFlashFrame) {
      ctx.filter = 'contrast(280%) brightness(190%) saturate(140%)';
    } else {
      ctx.filter = 'contrast(135%) brightness(98%) saturate(84%) hue-rotate(-8deg)';
    }

    // Draw live webcam feed
    this.drawCover(ctx, frame.bitmap, 0, 0, w, h, isMirrored);

    // 3. Hard RGB Chromatic Split on Bass Hit (first 160ms of kick impact)
    if (timeSinceKick < 160 && !isFlashFrame) {
      const splitProgress = 1 - timeSinceKick / 160;
      const splitDist = Math.pow(splitProgress, 1.2) * 26; // 26px hard split

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.pow(splitProgress, 1.5) * 0.70;

      // Hard Red channel shear
      ctx.filter = 'hue-rotate(90deg) contrast(180%) brightness(120%)';
      this.drawCover(ctx, frame.bitmap, -splitDist, -2, w, h, isMirrored);

      // Hard Cyan channel shear
      ctx.filter = 'hue-rotate(-90deg) contrast(180%) brightness(120%)';
      this.drawCover(ctx, frame.bitmap, splitDist, 2, w, h, isMirrored);

      ctx.restore();
    }

    // 4. Commercial Cinematic Grade
    if (!isFlashFrame) {
      this.applyCinematicGrade(ctx, 0, 0, w, h);
    }

    ctx.restore();
  }

  /**
   * FOREGROUND POP-UP FROM BELOW & EXPLOSIVE FULL-SCREEN ZOOM TAKEOVER
   * Directly replicates the user's reference image:
   * - Foreground subject pops up from beneath the bottom edge.
   * - Physically overlaps the MOGGED text on the background, leaving the left red "M" visible.
   * - Then violently zooms in on the 808 drop until it covers the entire screen edge-to-edge.
   */
  private renderPopUpZoomTakeover(
    ctx: CanvasRenderingContext2D,
    frame: FrameRecord,
    w: number,
    h: number,
    elapsed: number,
    popupStartTime: number,
    zoomStartTime: number,
    popupEndTime: number,
    isMirrored: boolean
  ) {
    if (!frame || !frame.bitmap) return;

    ctx.save();

    // Initial card dimensions during pop-up
    const initialW = w * 0.58;
    const initialH = h * 0.75;
    // PERFECT HORIZONTAL CENTER
    const initialX = (w - initialW) / 2;
    const startY = h; // starts completely below the screen
    const targetY = h * 0.20; // settled height in upper-center

    let cardX = initialX;
    let cardY = targetY;
    let cardW = initialW;
    let cardH = initialH;
    let cornerRadius = 16;
    let shadowAlpha = 0.92;

    const isZooming = elapsed >= zoomStartTime;

    if (!isZooming) {
      // 1. POP-UP FROM BELOW (5200ms to 6200ms) - PERFECT HORIZONTAL CENTER
      const t = Math.min(1, Math.max(0, (elapsed - popupStartTime) / (zoomStartTime - popupStartTime)));
      // Snappy overshoot spring easing
      const s = 1.6;
      const springT = (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s) + 1;
      const clampedSpring = Math.max(0, springT);

      // Springs straight up into the perfect center
      cardX = initialX;
      cardY = startY - clampedSpring * (startY - targetY);
      cardW = initialW;
      cardH = initialH;
      cornerRadius = 16;
      shadowAlpha = 0.92;
    } else {
      // 2. ZOOM IN AND EXPAND TO FIT THE SCREEN FRAME (6200ms to 6750ms)
      const zT = Math.min(1, Math.max(0, (elapsed - zoomStartTime) / (popupEndTime - zoomStartTime)));
      // Smooth S-curve ease-in-out for explosive expansion
      const ease = zT < 0.5 ? 2 * zT * zT : 1 - Math.pow(-2 * zT + 2, 2) / 2;

      // Card bounding box smoothly expands directly into the full screen frame [0, 0, w, h]
      cardX = initialX * (1 - ease) + 0 * ease;
      cardY = targetY * (1 - ease) + 0 * ease;
      cardW = initialW * (1 - ease) + w * ease;
      cardH = initialH * (1 - ease) + h * ease;

      cornerRadius = Math.max(0, 16 * (1 - ease * 1.5));
      shadowAlpha = Math.max(0, 0.92 * (1 - ease));
    }

    // Drop shadow while in floating card mode
    ctx.save();
    if (shadowAlpha > 0.05) {
      ctx.shadowColor = `rgba(0, 0, 0, ${shadowAlpha})`;
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 12;
    }

    // Clipping path: rounded portrait mask during rise, smoothly expands to full screen frame
    ctx.beginPath();
    if (cornerRadius > 0.5 && typeof ctx.roundRect === 'function') {
      ctx.roundRect(cardX, cardY, cardW, cardH, cornerRadius);
    } else {
      ctx.rect(cardX, cardY, cardW, cardH);
    }
    ctx.clip();

    // High clarity & contrast on the foreground subject (Clean cinematic film look)
    ctx.filter = 'contrast(122%) brightness(101%) saturate(108%)';
    this.drawCover(ctx, frame.bitmap, cardX, cardY, cardW, cardH, isMirrored);

    // Subtle cinematic grade on the pop-up subject
    this.applyCinematicGrade(ctx, cardX, cardY, cardW, cardH);

    ctx.restore(); // restore shadow & clip
    ctx.restore(); // restore main save
  }

  /**
   * PHONK GHOST-TRAIL & BEAT IMPACT ENGINE
   * Pure canvas math, frame buffers, holographic motion trails, RGB split, and hard beat snaps.
   * Zero machine learning models. Locked 60 FPS.
   * Total Duration: 4.5 Seconds (4500ms)
   */
  private startGhostTrailImpact(options: EditRenderOptions) {
    const { canvas, isMirrored = false, onComplete, onDropImpact } = options;

    const getFrames = (): FrameRecord[] => {
      if (options.getSessionFrames) {
        const live = options.getSessionFrames();
        if (live && live.length > 0) return live;
      }
      return options.frames || [];
    };

    const initialRawFrames = getFrames().filter(f => f && f.bitmap && f.bitmap.width > 0);

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const startTime = options.startTime ?? performance.now();
    const totalDuration = options.durationMs ?? 15940; // Full duration matching complete Montagem Tomada audio
    const dropBeatTime = 3570;  // 3.57s: Exact 808 drop impact in Montagem Tomada

    // Complete measured 808 sub-bass kick timestamps across the full 15.94s track
    const beatKicks = [
      3570, 3790, 4050, 4260, 4470, 4720, 4940, 5220, 5470, 5720,
      6010, 6230, 6450, 6730, 7080, 7320, 7550, 7960, 8260, 8510,
      8720, 8950, 9160, 9400, 9620, 9900, 10120, 10360, 10580, 10800,
      11020, 11230, 11530, 11750, 12010, 12350, 12620, 12830, 13070, 13340,
      13550, 13790, 14010, 14220, 14460, 14700, 14920
    ];

    // Multi-Take Clips: structured past takes (climax, motion, setup) and full action clip
    const multiTakes = options.multiTakes;
    const allActionFrames = (multiTakes?.allAction && multiTakes.allAction.length > 5)
      ? multiTakes.allAction
      : ((options.actionFrames && options.actionFrames.length > 5) ? options.actionFrames : initialRawFrames);
    const actionCount = Math.max(1, allActionFrames.length);

    const climaxTake = (multiTakes?.climax && multiTakes.climax.length > 0) ? multiTakes.climax : allActionFrames;
    const motionTake = (multiTakes?.motion && multiTakes.motion.length > 0) ? multiTakes.motion : allActionFrames;
    const setupTake = (multiTakes?.setup && multiTakes.setup.length > 0) ? multiTakes.setup : allActionFrames;

    let dropFired = false;
    let frozenFrameRecord: FrameRecord | null = null;

    const renderLoop = (now: number) => {
      if (!this.isRendering) return;

      const elapsed = now - startTime;

      if (elapsed >= dropBeatTime && !dropFired) {
        dropFired = true;
        onDropImpact();
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Dynamically fetch live present camera frames
      const liveFrames = getFrames().filter(f => f && f.bitmap && f.bitmap.width > 0);
      const latestLiveFrame = liveFrames[liveFrames.length - 1] || initialRawFrames[0];

      // ----------------------------------------------------
      // PHASE 1: THE ACTION SETUP & TENSION (0.0s - 3.25s)
      // Replays the physical action (taking a drink / touching glasses)
      // ----------------------------------------------------
      if (elapsed < 3250) {
        // Continuous slow zoom toward the eyes/action (scale: 1.0 -> 1.15)
        const tZoom = elapsed / 3250;
        const scale = 1.0 + tZoom * 0.15;

        // Smoothly replay the captured physical action up to the climax
        const actionRatio = Math.min(1, Math.max(0, elapsed / 3250));
        const frameIdx = Math.floor(actionRatio * (actionCount - 1));
        const frame = allActionFrames[frameIdx] || allActionFrames[0];

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip(); // strict boundary clip

        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);

        // Professional Film Grade: rich natural skin tones, crisp contrast, ZERO cyan tint
        ctx.filter = 'contrast(118%) saturate(110%) brightness(101%)';
        this.drawCover(ctx, frame?.bitmap, 0, 0, w, h, isMirrored);
        this.applyCinematicGrade(ctx, 0, 0, w, h);

        // Action badge in bottom corner
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(16, h - 38, 200, 24);
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1;
        ctx.strokeRect(16, h - 38, 200, 24);
        ctx.fillStyle = '#00ff66';
        ctx.font = 'bold 10px monospace';
        const actionLabel = options.actionType === 'drink'
          ? '⚡ ACTION: HYDRATION SIP'
          : options.actionType === 'glasses'
          ? '⚡ ACTION: GLASSES ADJUST'
          : '⚡ ACTION: DETECTED';
        ctx.fillText(actionLabel, 24, h - 22);
        ctx.restore();

        ctx.restore();
      }

      // ----------------------------------------------------
      // PHASE 2: THE PRE-DROP "HALT" (3.25s - 3.57s)
      // Freezes right on the peak of the action (cup on mouth / glasses on nose)
      // ----------------------------------------------------
      else if (elapsed >= 3250 && elapsed < 3570) {
        // Freeze Frame: Hold the video playhead completely static on the peak action frame for 0.32s
        if (!frozenFrameRecord) {
          frozenFrameRecord = allActionFrames[actionCount - 1] || allActionFrames[0];
        }

        // Zoom Pop: Instant hard step to scale(1.25)
        const scale = 1.25;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();

        ctx.translate(w / 2, h / 2);
        ctx.scale(scale, scale);
        ctx.translate(-w / 2, -h / 2);

        // Invert Strobe:
        // 3250ms - 3350ms: Full negative flash (invert(100%))
        // 3350ms - 3450ms: Back to normal
        // 3450ms - 3570ms: Black & white high contrast (grayscale(100%) contrast(250%))
        if (elapsed < 3350) {
          ctx.filter = 'invert(100%) contrast(130%)';
        } else if (elapsed < 3450) {
          ctx.filter = 'contrast(125%) saturate(105%)';
        } else {
          ctx.filter = 'grayscale(100%) contrast(240%) brightness(105%)';
        }

        this.drawCover(ctx, frozenFrameRecord?.bitmap, 0, 0, w, h, isMirrored);
        this.applyCinematicGrade(ctx, 0, 0, w, h);
        ctx.restore();
      }

      // ----------------------------------------------------
      // PHASE 3: THE DROP & MULTI-TAKE MONTAGE (3.57s - 14.5s)
      // Dynamically merges past saved clip moments with live webcam video on beats!
      // ----------------------------------------------------
      else if (elapsed >= 3570 && elapsed < 14500) {
        // Find most recent kick
        let dtKick = 999;
        let lastKickIdx = 0;
        for (let i = 0; i < beatKicks.length; i++) {
          const k = beatKicks[i];
          if (elapsed >= k && (elapsed - k) < dtKick) {
            dtKick = elapsed - k;
            lastKickIdx = i;
          }
        }

        // 1-FRAME VIOLENT JAGGED SHAKE (±15px random displacement dropping straight back in 60ms)
        let shakeX = 0;
        let shakeY = 0;

        if (dtKick < 60) {
          if (dtKick < 30) {
            const signX = (lastKickIdx % 2 === 0) ? 1 : -1;
            const signY = (lastKickIdx % 3 === 0) ? 1 : -1;
            shakeX = signX * (14 + ((lastKickIdx * 7) % 6)); // 14px to 19px
            shakeY = signY * (14 + ((lastKickIdx * 11) % 6));
          } else {
            shakeX = (lastKickIdx % 2 === 0 ? 1 : -1) * 3;
            shakeY = (lastKickIdx % 3 === 0 ? 1 : -1) * 3;
          }
        }

        // === MULTI-TAKE MONTAGE CUT SEQUENCER ===
        // Rhythmically cuts between past saved moments and live webcam movements!
        type TakeType = 'PAST_CLIMAX' | 'PAST_MOTION' | 'PAST_SETUP' | 'LIVE_FEED';
        let currentTakeType: TakeType = 'LIVE_FEED';
        let snapScale = 1.12;
        let isCloseUp = false;

        // Stage 1: Initial Drop Shock (Kicks 0 - 11: 3.57s - 6.45s)
        if (lastKickIdx < 12) {
          if (lastKickIdx === 0 || lastKickIdx === 2 || lastKickIdx === 6 || lastKickIdx === 10) {
            currentTakeType = 'PAST_CLIMAX'; // Flash cut to peak sip / intense gaze!
            snapScale = 1.72;
            isCloseUp = true;
          } else if (lastKickIdx === 4 || lastKickIdx === 8) {
            currentTakeType = 'PAST_MOTION'; // Flash cut to raising drink / glasses movement
            snapScale = 1.40;
          } else {
            currentTakeType = 'LIVE_FEED';   // Cut back to user reacting live
            snapScale = 1.12;
          }
        }
        // Stage 2: Rapid-Fire Multi-Take Montage (Kicks 12 - 24: 6.45s - 9.62s)
        else if (lastKickIdx < 25) {
          const cyclePattern: TakeType[] = [
            'PAST_SETUP',  'LIVE_FEED',
            'PAST_MOTION', 'LIVE_FEED',
            'PAST_CLIMAX', 'LIVE_FEED',
            'PAST_MOTION', 'PAST_CLIMAX',
            'LIVE_FEED',   'PAST_CLIMAX',
            'LIVE_FEED',   'PAST_MOTION',
            'LIVE_FEED'
          ];
          const patternIdx = (lastKickIdx - 12) % cyclePattern.length;
          currentTakeType = cyclePattern[patternIdx];

          if (currentTakeType === 'PAST_CLIMAX') {
            snapScale = 1.76;
            isCloseUp = true;
          } else if (currentTakeType === 'PAST_MOTION') {
            snapScale = 1.42;
          } else if (currentTakeType === 'PAST_SETUP') {
            snapScale = 1.25;
          } else {
            snapScale = 1.12;
          }
        }
        // Stage 3: Speed Ramp & Glitch Flash Cuts (Kicks 25 - 37: 9.62s - 12.83s)
        else if (lastKickIdx < 38) {
          // On kick transients (<90ms), inject rapid glitch cuts to past takes!
          if (dtKick < 90) {
            currentTakeType = (lastKickIdx % 2 === 0) ? 'PAST_CLIMAX' : 'PAST_MOTION';
            snapScale = 1.70;
            isCloseUp = (currentTakeType === 'PAST_CLIMAX');
          } else {
            currentTakeType = 'LIVE_FEED';
            snapScale = 1.14;
          }
        }
        // Stage 4: Climax Frenzy & Quad-Echo Surge (Kicks 38+: 12.83s - 14.5s)
        else {
          if (lastKickIdx % 2 === 0) {
            currentTakeType = 'PAST_CLIMAX';
            snapScale = 1.76;
            isCloseUp = true;
          } else {
            currentTakeType = 'LIVE_FEED';
            snapScale = 1.16;
          }
        }

        // Punch kick scale transient
        if (dtKick < 50 && !isCloseUp) {
          snapScale = Math.max(snapScale, 1.26);
        }

        // Select the active frame based on the active take type
        let activeFrame: FrameRecord;
        if (currentTakeType === 'PAST_CLIMAX') {
          // 3-frame micro-shatter around the peak climax moment
          const microIdx = Math.max(0, climaxTake.length - 1 - (Math.floor(dtKick / 35) % Math.min(3, climaxTake.length)));
          activeFrame = climaxTake[microIdx] || climaxTake[climaxTake.length - 1] || latestLiveFrame;
        } else if (currentTakeType === 'PAST_MOTION') {
          // Rapid forward movement playback
          const motionIdx = Math.floor((dtKick / 40)) % motionTake.length;
          activeFrame = motionTake[motionIdx] || motionTake[0] || latestLiveFrame;
        } else if (currentTakeType === 'PAST_SETUP') {
          const setupIdx = Math.floor((dtKick / 50)) % setupTake.length;
          activeFrame = setupTake[setupIdx] || setupTake[0] || latestLiveFrame;
        } else {
          // Live camera feed
          activeFrame = latestLiveFrame;
        }

        // Focus framing: lock onto eyes/face during close-ups, center during wide
        let focusX = w / 2;
        let focusY = h / 2;
        if (isCloseUp) {
          const liveEye = options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : undefined;
          const eye = liveEye || options.eyeCenter;
          focusX = eye ? eye.x * w : w / 2;
          focusY = eye ? eye.y * h : h * 0.38;
        }

        ctx.save();
        // Strict boundary clip: eliminates any border bleed or side stripes
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();

        // Apply violent 1-frame shake + instant snap scale
        ctx.translate(focusX + shakeX, focusY + shakeY);
        ctx.scale(snapScale, snapScale);
        ctx.translate(-focusX, -focusY);

        // --- SILVER HOLOGRAPHIC GHOST ECHO TRAILS (ZERO BLUE BORDERS) ---
        const isQuadEcho = lastKickIdx >= 38;
        // Trail 1: Ethereal silver motion echo (-8 frames)
        const trail1Frame = liveFrames[Math.max(0, liveFrames.length - 8)] || liveFrames[0];
        if (trail1Frame && trail1Frame.bitmap) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = 0.22;
          ctx.filter = 'grayscale(90%) contrast(135%) brightness(112%)'; // silver holographic, ZERO cyan
          ctx.translate(w / 2 - 8, h / 2);
          ctx.translate(-w / 2, -h / 2);
          this.drawCover(ctx, trail1Frame.bitmap, 0, 0, w, h, isMirrored);
          ctx.restore();
        }

        // Trail 2: Secondary silver echo (-14 frames)
        if (isQuadEcho || lastKickIdx < 12) {
          const trail2Frame = liveFrames[Math.max(0, liveFrames.length - 14)] || liveFrames[0];
          if (trail2Frame && trail2Frame.bitmap) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.14;
            ctx.filter = 'grayscale(90%) contrast(135%) brightness(112%)';
            ctx.translate(w / 2 + 8, h / 2);
            ctx.translate(-w / 2, -h / 2);
            this.drawCover(ctx, trail2Frame.bitmap, 0, 0, w, h, isMirrored);
            ctx.restore();
          }
        }

        // Main frame rendering with clean commercial film color grading
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        const isRgbSplit = dtKick < 55;
        if (isRgbSplit) {
          // Hard RGB chromatic split on bass kicks (strictly clipped with ZERO border bleed)
          ctx.filter = 'drop-shadow(-6px 0 0 rgba(255, 30, 60, 0.7)) drop-shadow(6px 0 0 rgba(0, 180, 255, 0.7)) contrast(124%) saturate(112%)';
        } else {
          ctx.filter = 'contrast(118%) saturate(110%) brightness(101%)';
        }

        this.drawCover(ctx, activeFrame?.bitmap, 0, 0, w, h, isMirrored);
        this.applyCinematicGrade(ctx, 0, 0, w, h);
        ctx.restore();

        ctx.restore(); // restore shake, snap scale, and clip

        // 1-frame bleached white blast on main 808 drop impact (3.57s - 3.63s)
        if (elapsed >= 3570 && elapsed < 3630) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
      }

      // ----------------------------------------------------
      // PHASE 4: STUTTER CLIMAX & OUTRO RESET (14.5s - totalDuration)
      // Synchronized to finish with the complete audio!
      // ----------------------------------------------------
      else {
        let displayFrame: FrameRecord;

        if (elapsed < 15200) {
          // 3-frame violent stutter loop
          const twitchPattern = [0, 1, 2, 1, 0, 1, 2, 1];
          const stutterOffset = twitchPattern[Math.floor((elapsed - 14500) / 33) % twitchPattern.length];
          const pool = climaxTake.length > 3 ? climaxTake : liveFrames;
          displayFrame = pool[(pool.length - 1 - stutterOffset + pool.length) % pool.length];
        } else {
          displayFrame = latestLiveFrame;
        }

        // Smooth ease transforms back to default
        let outroScale = 1.12;
        let fadeAlpha = 1.0;

        if (elapsed >= 15200) {
          const tFade = Math.min(1, (elapsed - 15200) / Math.max(100, totalDuration - 15200));
          outroScale = 1.12 - tFade * 0.12; // 1.12 -> 1.00
          fadeAlpha = 1.0 - tFade * 0.35;   // gentle fade out
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.clip();

        ctx.translate(w / 2, h / 2);
        ctx.scale(outroScale, outroScale);
        ctx.translate(-w / 2, -h / 2);
        ctx.globalAlpha = fadeAlpha;

        ctx.filter = 'contrast(116%) saturate(106%) brightness(101%)';
        this.drawCover(ctx, displayFrame?.bitmap, 0, 0, w, h, isMirrored);
        this.applyCinematicGrade(ctx, 0, 0, w, h);
        ctx.restore();
      }

      ctx.restore();

      if (elapsed < totalDuration) {
        this.animFrameId = requestAnimationFrame(renderLoop);
      } else {
        this.stop();
        onComplete();
      }
    };

    this.animFrameId = requestAnimationFrame(renderLoop);
  }

  public stop() {
    this.isRendering = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const sigmaEditRenderer = new SigmaEditRenderer();
