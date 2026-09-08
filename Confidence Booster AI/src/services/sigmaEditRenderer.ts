import { FrameRecord } from '../types';

export interface EditRenderOptions {
  canvas: HTMLCanvasElement;
  frames?: FrameRecord[];
  getSessionFrames?: () => FrameRecord[];
  getCurrentEyeCenter?: () => { x: number; y: number } | undefined;
  actionType: 'drink' | 'glasses' | 'manual';
  eyeCenter?: { x: number; y: number }; // fallback normalized 0-1
  isMirrored?: boolean;
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

    const startTime = performance.now();
    const totalDuration = 11000; // 11s duration matching audio
    const wastedStartTime = 4700; // 4.7s mark: GTA "Wasted" / Mogged effect starts
    const popupStartTime = 5200;  // 5.2s: user image pops up from below (overlapping MOGGED text)
    const zoomStartTime = 6200;   // 6.2s: explosive full-screen zoom takeover begins
    const dropBeatTime = 6500;    // 6.5s: 808 drop impact (screen flash, vibration, RGB shear)
    const popupEndTime = 6750;    // 6.75s: full-screen takeover complete, hands off to velocity drop kicks
    const beatKicks = [6500, 7300, 7890, 8480, 9060, 9650]; // exact audio 808 beats

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
        // --- PHASE 1: SLOW-MOTION BUILD-UP (0.0s to 4.7s) ---
        // Plays the initial trigger gesture (e.g. touching glasses / sip) in buttery slow motion!
        const buildRatio = elapsed / wastedStartTime;
        const rampIdx = Math.floor(buildRatio * (initialGestureCount - 1));
        const safeRampIdx = Math.min(initialGestureCount - 1, Math.max(0, rampIdx));
        fCenter = getValidFrame(safeRampIdx);

      } else if (elapsed >= wastedStartTime && elapsed < popupEndTime) {
        // --- PHASE 2: GTA "WASTED" / MOGGED EFFECT (4.7s to 6.75s) ---
        // Snaps to the latest present camera frame and holds it on the background layer!
        if (!frozenMoggedFrame) {
          frozenMoggedFrame = currentFrames[currentFrames.length - 1];
          frozenEyeCenter = options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : options.eyeCenter;
        }
        fCenter = frozenMoggedFrame;

      } else {
        // --- PHASE 3 & 4: 808 BEAT DROP (6.75s to 11.0s) ---
        const latestIdx = totalFrames - 1;
        fCenter = getValidFrame(latestIdx);
      }

      // Dynamic eye position (frozen during mogged phase, live otherwise)
      const effectiveEye = frozenEyeCenter || (options.getCurrentEyeCenter ? options.getCurrentEyeCenter() : options.eyeCenter);

      // 2. Camera Shake & Beat Pulses
      let shakeX = 0;
      let shakeY = 0;
      let zoomPulse = 1.0;

      if (elapsed >= wastedStartTime && elapsed < wastedStartTime + 300) {
        // Wasted impact shock
        const shock = 1 - (elapsed - wastedStartTime) / 300;
        shakeX = (Math.random() - 0.5) * shock * 30;
        shakeY = (Math.random() - 0.5) * shock * 30;
      }

      // Check 808 beat kicks for rhythmic zoom punch & shake
      for (const kickTime of beatKicks) {
        if (elapsed >= kickTime && elapsed < kickTime + 280) {
          const punch = 1 - (elapsed - kickTime) / 280;
          zoomPulse = 1.0 + punch * 0.08;
          shakeX += (Math.random() - 0.5) * punch * 24;
          shakeY += (Math.random() - 0.5) * punch * 24;
          break;
        }
      }

      ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
      ctx.scale(zoomPulse, zoomPulse);
      ctx.translate(-w / 2, -h / 2);

      // 3. Render Background Layer
      const isWastedPhase = elapsed >= wastedStartTime && elapsed < popupEndTime;

      if (isWastedPhase) {
        // --- WASTED EFFECT: High-contrast Black & White / Grayscale background ---
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
        // --- PHASE 3: 808 BEAT DROP VELOCITY EFFECT (6.75s to 11.0s) ---
        // Pure Phonk Velocity: Alternating extreme close-up jump-cuts, RGB chromatic aberration shear & radial zoom shockwaves
        this.renderVelocityDrop(ctx, fCenter, w, h, elapsed, beatKicks, effectiveEye, isMirrored);
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
          dropBeatTime,
          isMirrored
        );
      }

      // 6. White Flash at 6.5s drop
      if (elapsed >= dropBeatTime && elapsed < dropBeatTime + 280) {
        const flashAlpha = 1 - (elapsed - dropBeatTime) / 280;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.9})`;
        ctx.fillRect(0, 0, w, h);
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
   * PRESET 1: Pure Phonk Velocity
   * Alternating extreme close-up jump-cuts on 808 kicks, RGB chromatic shear, and radial zoom shockwaves.
   */
  private renderVelocityDrop(
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
    const lastKickTime = kickIdx >= 0 ? beatKicks[kickIdx] : 0;
    const timeSinceKick = elapsed - lastKickTime;
    const isOddKick = kickIdx % 2 === 0;
    const isImpact = timeSinceKick < 260;

    ctx.save();

    // 1. Extreme Close-Up Jump-Cut on alternating kicks
    let zoom = 1.05;
    let focusX = w / 2;
    let focusY = h / 2;

    if (isOddKick && timeSinceKick < 550) {
      // Snaps tightly into eyes / jawline
      zoom = 1.55;
      if (effectiveEye) {
        focusX = effectiveEye.x * w;
        focusY = effectiveEye.y * h;
      }
    }

    ctx.translate(focusX, focusY);
    ctx.scale(zoom, zoom);
    ctx.translate(-focusX, -focusY);

    // 2. High-Contrast Bleach CC
    ctx.filter = 'contrast(135%) saturate(125%) brightness(105%)';

    // 3. RGB Chromatic Aberration Split on kick impact
    if (isImpact) {
      const splitDist = (1 - timeSinceKick / 260) * 18;

      // Base layer
      this.drawCover(ctx, frame.bitmap, 0, 0, w, h, isMirrored);

      // Red channel shear
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 0, 60, 0.35)';
      this.drawCover(ctx, frame.bitmap, -splitDist, 0, w, h, isMirrored);
      ctx.fillRect(0, 0, w, h);

      // Cyan channel shear
      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      this.drawCover(ctx, frame.bitmap, splitDist, 0, w, h, isMirrored);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Radial Zoom Shockwave
      const shockAlpha = (1 - timeSinceKick / 260) * 0.35;
      ctx.save();
      ctx.globalAlpha = shockAlpha;
      ctx.translate(w / 2, h / 2);
      ctx.scale(1.08, 1.08);
      ctx.translate(-w / 2, -h / 2);
      this.drawCover(ctx, frame.bitmap, 0, 0, w, h, isMirrored);
      ctx.restore();
    } else {
      this.drawCover(ctx, frame.bitmap, 0, 0, w, h, isMirrored);
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
    dropBeatTime: number,
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

    // High clarity & contrast on the foreground subject
    ctx.filter = 'contrast(135%) brightness(110%) saturate(120%)';
    this.drawCover(ctx, frame.bitmap, cardX, cardY, cardW, cardH, isMirrored);

    // RGB Chromatic Aberration shear on 6500ms 808 drop impact
    if (elapsed >= dropBeatTime && elapsed < dropBeatTime + 260) {
      const splitProgress = 1 - (elapsed - dropBeatTime) / 260;
      const splitDist = splitProgress * 18;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255, 0, 60, 0.35)';
      this.drawCover(ctx, frame.bitmap, cardX - splitDist, cardY, cardW, cardH, isMirrored);
      ctx.fillRect(cardX, cardY, cardW, cardH);

      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      this.drawCover(ctx, frame.bitmap, cardX + splitDist, cardY, cardW, cardH, isMirrored);
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.restore();
    }

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
