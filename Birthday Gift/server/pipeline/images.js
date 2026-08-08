import path from 'node:path';
import sharp from 'sharp';

/**
 * Image processing.
 *
 * The recipient may be on a mid-range phone over mobile data, so a raw 4MB
 * camera JPEG never ships. Every photo becomes three WebP derivatives:
 *
 *   full (1024px)  — desktop / HIGH tier
 *   mid  (512px)   — phones, which is most recipients
 *   lqip (32px)    — a blurred stand-in that loads instantly and means no frame
 *                    is ever blank while its real texture streams in
 *
 * EXIF orientation is baked in and then stripped, because a photo rotated only
 * by metadata renders sideways on a texture — the GPU doesn't read EXIF.
 */

/** Longest-edge budgets per derivative. */
const SIZES = {
  full: 1024,
  mid: 512,
  lqip: 32,
};

/**
 * Process one uploaded image into its three tiers.
 *
 * @param {string} srcPath  absolute path to the uploaded original
 * @param {string} outDir   absolute directory to write derivatives into
 * @param {string} slug     filename stem for the outputs (no extension)
 * @returns {Promise<{src: string, mid: string, lqip: string, w: number, h: number}>}
 *          paths are relative to outDir's parent-facing asset root
 */
export async function processImage(srcPath, outDir, slug) {
  // `rotate()` with no argument applies the EXIF orientation. Doing this before
  // resize matters: a portrait photo tagged as rotated would otherwise be
  // measured and cropped along the wrong axis.
  const base = sharp(srcPath).rotate();
  const meta = await base.metadata();

  const outputs = {};
  for (const [key, edge] of Object.entries(SIZES)) {
    const file = key === 'full' ? `${slug}.webp` : `${slug}_${key}.webp`;
    const dest = path.join(outDir, file);

    // A fresh pipeline per derivative. Reusing one sharp instance across
    // multiple resizes gives you whatever the last resize set, not three sizes.
    let pipe = sharp(srcPath)
      .rotate()
      .resize({
        width: edge,
        height: edge,
        fit: 'inside',          // preserve aspect; never crop the subject out
        withoutEnlargement: true,
      });

    if (key === 'lqip') {
      // A hard blur on a 32px image costs nothing and stops the placeholder
      // looking like a broken low-res thumbnail.
      pipe = pipe.blur(1.4).webp({ quality: 50 });
    } else {
      pipe = pipe.webp({ quality: 78, effort: 5 });
    }

    const info = await pipe.toFile(dest);
    outputs[key] = { file, w: info.width, h: info.height };
  }

  return {
    type: 'photo',
    src: outputs.full.file,
    // Key name matches what the viewer's srcFor() looks for on 512-tier devices.
    src512: outputs.mid.file,
    lqip: outputs.lqip.file,
    // Report the full-tier dimensions — the viewer uses these for frame aspect,
    // and all three derivatives share the same aspect ratio.
    w: outputs.full.w,
    h: outputs.full.h,
    origW: meta.width ?? outputs.full.w,
    origH: meta.height ?? outputs.full.h,
  };
}

/**
 * Extract a still WebP poster from an already-generated video frame image.
 * Kept here rather than in video.js so all WebP encoding settings live together.
 */
export async function makePoster(framePath, outDir, slug) {
  const file = `${slug}_poster.webp`;
  const info = await sharp(framePath)
    .resize({ width: SIZES.full, height: SIZES.full, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 74 })
    .toFile(path.join(outDir, file));

  const lqipFile = `${slug}_lqip.webp`;
  await sharp(framePath)
    .resize({ width: SIZES.lqip, height: SIZES.lqip, fit: 'inside' })
    .blur(1.4)
    .webp({ quality: 50 })
    .toFile(path.join(outDir, lqipFile));

  return { file, lqipFile, w: info.width, h: info.height };
}

export { SIZES };
