import { FrameRecord } from '../types';

export interface EditRenderOptions {
  canvas: HTMLCanvasElement;
  frames: FrameRecord[];
  actionType: 'drink' | 'glasses' | 'manual';
  eyeCenter?: { x: number; y: number }; // normalized 0-1
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

    const { canvas, frames, eyeCenter, isMirrored = false, onComplete, onDropImpact } = options;
    
    // Filter only valid, open bitmaps
    const validFrames = frames.filter(f => f && f.bitmap && f.bitmap.width > 0 && f.bitmap.height > 0);
    if (validFrames.length === 0) {
      console.warn('No valid video frames found for edit!');
      onComplete();
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    const startTime = performance.now();
    const totalDuration = 11000; // 11s duration matching audio
    const wastedStartTime = 4700; // 4.7s mark: GTA "Wasted" / Mogged effect starts
    const wastedDuration = 1000; // EXACTLY 1.0 second duration as requested!
    const wastedEndTime = wastedStartTime + wastedDuration; // 5.7s
    const dropBeatTime = 6500; // 6.5s: 808 slowed drop
    const beatKicks = [6500, 7300, 7890, 8480, 9060, 9650]; // exact audio 808 beats

    let wastedFired = false;
    let dropFired = false;

    const totalFrames = validFrames.length;
    const peakIndex = Math.floor(totalFrames * 0.85);

    const getValidFrame = (idx: number): FrameRecord => {
      const clamped = Math.min(totalFrames - 1, Math.max(0, idx));
      return validFrames[clamped];
    };

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

      // 1. Calculate Frame Index
      let currentFrameIdx = 0;
      let delayFrameIdx1 = 0;
      let delayFrameIdx2 = 0;

      if (elapsed < wastedStartTime) {
        // Build up: slow-mo ramp approaching peak action
        const buildRatio = elapsed / wastedStartTime;
        const rampIdx = Math.floor(buildRatio * peakIndex);
        currentFrameIdx = Math.min(peakIndex, Math.max(0, rampIdx));
      } else if (elapsed >= wastedStartTime && elapsed < wastedEndTime) {
        // During 1-second Wasted / Mogged effect: freeze on peak frame
        currentFrameIdx = peakIndex;
      } else {
        // Beat Drop: cycling delayed cuts
        const postDropElapsed = elapsed - dropBeatTime;
        const cycle = (postDropElapsed % 1200) / 1200;
        currentFrameIdx = Math.floor(cycle * (totalFrames - 1));
        delayFrameIdx1 = (currentFrameIdx - 12 + totalFrames) % totalFrames;
        delayFrameIdx2 = (currentFrameIdx - 24 + totalFrames) % totalFrames;
      }

      const fCenter = getValidFrame(currentFrameIdx);
      const fLeft = getValidFrame(delayFrameIdx1);
      const fRight = getValidFrame(delayFrameIdx2);

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

      // 3. Render Video Frames
      const isWastedPhase = elapsed >= wastedStartTime && elapsed < wastedEndTime;

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

      } else if (elapsed < dropBeatTime) {
        // Build-up camera: Full screen edge-to-edge
        if (fCenter && fCenter.bitmap) {
          this.drawCover(ctx, fCenter.bitmap, 0, 0, w, h, isMirrored);
        }

        // Build-up HUD reticle
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2;
        const boxSize = 180 + Math.sin(elapsed * 0.008) * 15;
        ctx.strokeRect((w - boxSize) / 2, (h - boxSize) / 2, boxSize, boxSize);

      } else {
        // Multi-Angle Split-Screen (After 6.5s Drop)
        // Draw 3 columns edge-to-edge with ZERO black overlay!
        const colW = w / 3;

        // Left Panel (Delayed Cut with subtle red tint)
        if (fLeft && fLeft.bitmap) {
          this.drawCover(ctx, fLeft.bitmap, 0, 0, colW, h, isMirrored);
        }
        ctx.fillStyle = 'rgba(255, 0, 60, 0.15)';
        ctx.fillRect(0, 0, colW, h);

        // Center Panel (Current action, high saturation)
        if (fCenter && fCenter.bitmap) {
          this.drawCover(ctx, fCenter.bitmap, colW, 0, colW, h, isMirrored);
        }

        // Right Panel (Delayed Cut with subtle cyan tint)
        if (fRight && fRight.bitmap) {
          this.drawCover(ctx, fRight.bitmap, colW * 2, 0, colW, h, isMirrored);
        }
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fillRect(colW * 2, 0, colW, h);

        // Glowing neon dividers between panels
        ctx.strokeStyle = '#ff0044';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff0044';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(colW, 0);
        ctx.lineTo(colW, h);
        ctx.moveTo(colW * 2, 0);
        ctx.lineTo(colW * 2, h);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Global color boost on the drop
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = 'rgba(255, 0, 80, 0.10)';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }

      // 4. White Flash at 6.5s drop
      if (elapsed >= dropBeatTime && elapsed < dropBeatTime + 280) {
        const flashAlpha = 1 - (elapsed - dropBeatTime) / 280;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.9})`;
        ctx.fillRect(0, 0, w, h);
      }

      // 5. Cinematic 2.39:1 Letterbox Bars
      const letterboxH = h * 0.10;
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, letterboxH);
      ctx.fillRect(0, h - letterboxH, w, letterboxH);

      // 6. === THE 1-SECOND "MOGGED" PNG OVERLAY (Exact match to Reference Image 3) ===
      if (isWastedPhase) {
        ctx.save();

        // Calculate center position directly over the user's eyes
        const targetX = eyeCenter ? eyeCenter.x * w : w / 2;
        const targetY = eyeCenter ? eyeCenter.y * h : h * 0.38;

        // Box size: compact, covering ONLY the eyes (matching reference Image 3)
        // Image aspect ratio: 420x100 = 4.2
        const boxW = Math.max(160, Math.min(w * 0.35, 360));
        const boxH = boxW / 4.2;
        const boxX = targetX - boxW / 2;
        const boxY = targetY - boxH / 2;

        // Subtle soft red aura/flare behind the box (as in Image 3)
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
          // Fallback if image still loading: clean black box with red text
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

      // 7. Sleek Timecode in Letterbox Bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '12px "Share Tech Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`MOG EDIT // ${(elapsed / 1000).toFixed(2)}s / 11.00s // STATUS: ASCENDED`, 20, letterboxH - 10);

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

  public stop() {
    this.isRendering = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const sigmaEditRenderer = new SigmaEditRenderer();
