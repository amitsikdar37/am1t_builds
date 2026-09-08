import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision';

export class SelfieSegmenterService {
  private segmenter: ImageSegmenter | null = null;
  private isLoading = false;
  private isLoaded = false;

  private maskSmallCanvas: HTMLCanvasElement;
  private maskSmallCtx: CanvasRenderingContext2D | null;

  // Frame cutout cache to ensure buttery 60fps rendering without recomputing
  private cutoutCache = new WeakMap<ImageBitmap, HTMLCanvasElement>();

  constructor() {
    this.maskSmallCanvas = document.createElement('canvas');
    this.maskSmallCanvas.width = 256;
    this.maskSmallCanvas.height = 256;
    this.maskSmallCtx = this.maskSmallCanvas.getContext('2d', { willReadFrequently: true });
  }

  public async initialize(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      this.segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/selfie_segmenter.tflite',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      });

      this.isLoaded = true;
      console.log('Selfie Segmenter AI initialized successfully (GPU)!');
    } catch (err) {
      console.warn('GPU Selfie Segmenter initialization failed, attempting CPU fallback...', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        this.segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/selfie_segmenter.tflite',
            delegate: 'CPU'
          },
          runningMode: 'IMAGE',
          outputConfidenceMasks: true,
          outputCategoryMask: false
        });
        this.isLoaded = true;
        console.log('Selfie Segmenter AI initialized successfully (CPU fallback)!');
      } catch (cpuErr) {
        console.error('Failed to load Selfie Segmenter on CPU:', cpuErr);
      }
    } finally {
      this.isLoading = false;
    }
  }

  public isReady(): boolean {
    return this.isLoaded && this.segmenter !== null;
  }

  /**
   * Isolates the recorded person with a pixel-accurate neural alpha matte.
   * Returns an offscreen canvas containing ONLY the subject (hair, body, arms, gesture)
   * with transparent background.
   */
  public getPersonCutout(
    sourceBitmap: ImageBitmap,
    destW: number,
    destH: number,
    isMirrored = false
  ): HTMLCanvasElement | null {
    if (!this.segmenter || !sourceBitmap || sourceBitmap.width === 0) return null;

    // Check memory cache
    const cached = this.cutoutCache.get(sourceBitmap);
    if (cached && cached.width === destW && cached.height === destH) {
      return cached;
    }

    try {
      // 1. Run neural segmentation
      const result = this.segmenter.segment(sourceBitmap);
      const masks = result.confidenceMasks;
      if (!masks || masks.length === 0) return null;

      const mask = masks[0];
      const maskW = mask.width;
      const maskH = mask.height;
      const floatData = mask.getAsFloat32Array();

      if (this.maskSmallCanvas.width !== maskW || this.maskSmallCanvas.height !== maskH) {
        this.maskSmallCanvas.width = maskW;
        this.maskSmallCanvas.height = maskH;
      }

      if (!this.maskSmallCtx) return null;
      const imgData = this.maskSmallCtx.createImageData(maskW, maskH);
      const d = imgData.data;

      // Anti-aliased feathering: converts confidence values [0..1] to smooth alpha
      for (let i = 0; i < floatData.length; i++) {
        const conf = floatData[i];
        let alpha = 0;
        if (conf > 0.25) {
          // Smooth ramp from 0.25 to 0.75
          alpha = Math.min(255, Math.max(0, Math.round(((conf - 0.25) / 0.5) * 255)));
        }
        const idx = i * 4;
        d[idx] = 255;
        d[idx + 1] = 255;
        d[idx + 2] = 255;
        d[idx + 3] = alpha;
      }

      this.maskSmallCtx.putImageData(imgData, 0, 0);

      // 2. Composite onto target cutout canvas
      const cutoutCanvas = document.createElement('canvas');
      cutoutCanvas.width = destW;
      cutoutCanvas.height = destH;
      const cCtx = cutoutCanvas.getContext('2d');
      if (!cCtx) return null;

      // Draw source with cover & mirror
      const imgW = sourceBitmap.width;
      const imgH = sourceBitmap.height;
      const scale = Math.max(destW / imgW, destH / imgH);
      const sw = Math.min(imgW, destW / scale);
      const sh = Math.min(imgH, destH / scale);
      const sx = Math.max(0, (imgW - sw) / 2);
      const sy = Math.max(0, (imgH - sh) / 2);

      cCtx.save();
      if (isMirrored) {
        cCtx.translate(destW, 0);
        cCtx.scale(-1, 1);
      }
      cCtx.drawImage(sourceBitmap, sx, sy, sw, sh, 0, 0, destW, destH);
      cCtx.restore();

      // Apply mask via destination-in
      cCtx.save();
      cCtx.globalCompositeOperation = 'destination-in';
      cCtx.imageSmoothingEnabled = true;
      cCtx.imageSmoothingQuality = 'high';
      cCtx.drawImage(this.maskSmallCanvas, 0, 0, destW, destH);
      cCtx.restore();

      this.cutoutCache.set(sourceBitmap, cutoutCanvas);
      return cutoutCanvas;
    } catch (e) {
      console.warn('Neural segmentation failed for frame:', e);
      return null;
    }
  }

  /**
   * Pre-segments gesture frames in the background during the 1.8s EDITING radar window
   */
  public presegmentBitmaps(bitmaps: ImageBitmap[], destW: number, destH: number, isMirrored = false) {
    if (!this.segmenter) return;
    let idx = 0;
    const step = () => {
      if (idx >= bitmaps.length || !this.segmenter) return;
      const bmp = bitmaps[idx++];
      if (bmp && !this.cutoutCache.has(bmp)) {
        this.getPersonCutout(bmp, destW, destH, isMirrored);
      }
      if (idx < bitmaps.length) {
        setTimeout(step, 0);
      }
    };
    step();
  }
}

export const selfieSegmenter = new SelfieSegmenterService();
