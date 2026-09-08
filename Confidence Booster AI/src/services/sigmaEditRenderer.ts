import { FrameRecord } from '../types';

export interface EditRenderOptions {
  canvas: HTMLCanvasElement;
  frames?: FrameRecord[];
  getSessionFrames?: () => FrameRecord[];
  getCurrentEyeCenter?: () => { x: number; y: number } | undefined;
  actionType: 'drink' | 'glasses' | 'manual';
  eyeCenter?: { x: number; y: number }; // fallback normalized 0-1
  isMirrored?: boolean;
  startTime?: number; // exact synchronized audio start timestamp
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
    const totalDuration = 11000; // 11s duration matching audio
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
        // Plays gesture in buttery slow-mo with Cold Phonk anti-warmth grade!
        ctx.save();
        ctx.filter = 'contrast(130%) brightness(98%) saturate(84%) hue-rotate(-8deg)';
        if (fCenter && fCenter.bitmap) {
          this.drawCover(ctx, fCenter.bitmap, 0, 0, w, h, isMirrored);
        }
        this.applyColdPhonkGrade(ctx, 0, 0, w, h);
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
   * 2026 Ice Phonk Color Grading (Anti-Warmth CC)
   * Eliminates yellow/warm room lighting and imparts an icy, chiseled, cold steel aesthetic.
   */
  private applyColdPhonkGrade(
    ctx: CanvasRenderingContext2D,
    x = 0,
    y = 0,
    w?: number,
    h?: number
  ) {
    const width = w ?? ctx.canvas.width;
    const height = h ?? ctx.canvas.height;

    ctx.save();

    // 1. Ice Cyan Color Toning (Crushes yellow room tint in soft-light mode)
    ctx.globalCompositeOperation = 'soft-light';
    const coldGrad = ctx.createLinearGradient(x, y, x, y + height);
    coldGrad.addColorStop(0, 'rgba(0, 195, 255, 0.22)'); // icy cyan top
    coldGrad.addColorStop(1, 'rgba(20, 70, 160, 0.26)'); // deep cold navy bottom
    ctx.fillStyle = coldGrad;
    ctx.fillRect(x, y, width, height);

    // 2. Cold Steel Shadow Vignette (Crushed navy/black edges to focus lighting on face)
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(
      x + width / 2,
      y + height * 0.44,
      height * 0.28,
      x + width / 2,
      y + height / 2,
      Math.max(width, height) * 0.76
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.65, 'rgba(0, 18, 38, 0.38)'); // cold steel shadow
    vignette.addColorStop(1, 'rgba(0, 8, 20, 0.76)');     // deep crushed navy black
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

    ctx.save();

    // Instant scale transform (Hard Cut Jump)
    ctx.translate(focusX, focusY);
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

    // 4. Signature Cold Phonk Grade
    if (!isFlashFrame) {
      this.applyColdPhonkGrade(ctx, 0, 0, w, h);
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

    // High clarity & contrast on the foreground subject (Cold Phonk Anti-Warmth)
    ctx.filter = 'contrast(132%) brightness(100%) saturate(84%) hue-rotate(-8deg)';
    this.drawCover(ctx, frame.bitmap, cardX, cardY, cardW, cardH, isMirrored);

    // Subtle cold steel color grade on the pop-up subject
    this.applyColdPhonkGrade(ctx, cardX, cardY, cardW, cardH);

    ctx.restore(); // restore shadow & clip
    ctx.restore(); // restore main save
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
