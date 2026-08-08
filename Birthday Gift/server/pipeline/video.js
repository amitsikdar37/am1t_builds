import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { makePoster } from './images.js';

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Video processing.
 *
 * Mobile hardware video decoders are a genuinely scarce resource — a mid-range
 * Android can typically keep one or two H.264 streams decoding smoothly and
 * will start dropping frames across the *whole page* past that. So videos are
 * capped in count upstream (MAX_VIDEOS), transcoded down hard, and every one
 * also gets a poster image so a frame can display something without a decoder
 * attached at all.
 *
 * Audio is stripped deliberately: the gift has one background music track, and
 * several videos unmuting over it would be chaos.
 */

export const MAX_VIDEOS = 3;

/** Longest edge for video. 720 is the sweet spot for phone decode headroom. */
const MAX_EDGE = 720;

/**
 * Transcode one uploaded video to a phone-friendly MP4 plus a WebP poster.
 *
 * @param {string} srcPath absolute path to the uploaded original
 * @param {string} outDir  absolute directory for outputs
 * @param {string} slug    filename stem
 */
export async function processVideo(srcPath, outDir, slug) {
  const file = `${slug}.mp4`;
  const dest = path.join(outDir, file);

  // ffmpeg-static ships only the ffmpeg binary — there is no ffprobe alongside
  // it. Rather than add a second dependency just to read a duration, we take it
  // from the `codecData` event ffmpeg emits as it opens the input, which costs
  // nothing because the transcode has to read the header anyway.
  let duration = 0;

  await new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .videoCodec('libx264')
      .noAudio()
      .outputOptions([
        // Scale the long edge to MAX_EDGE, keep aspect, and force even
        // dimensions — H.264 4:2:0 requires them and odd values hard-fail.
        `-vf scale='if(gt(iw,ih),min(${MAX_EDGE},iw),-2)':'if(gt(iw,ih),-2,min(${MAX_EDGE},ih))',fps=24`,
        '-crf 28',
        '-preset medium',
        '-profile:v main',
        // Level 3.1 is the widest-supported ceiling that still allows 720p24.
        '-level 3.1',
        '-pix_fmt yuv420p',
        // Puts the index at the front so playback can start before the whole
        // file arrives — essential over mobile data.
        '-movflags +faststart',
      ])
      .on('codecData', (data) => {
        duration = parseDuration(data.duration);
      })
      .on('error', reject)
      .on('end', resolve)
      .save(dest);
  });

  // Grab a frame ~1s in (or at the start for very short clips) for the poster.
  const posterTime = duration > 1.5 ? 1 : 0;
  const tmpFrame = path.join(os.tmpdir(), `${slug}_frame_${Date.now()}.png`);

  await new Promise((resolve, reject) => {
    // Seek the transcoded file, not the original: it is smaller, already in the
    // final aspect, and guaranteed decodable by the same binary that wrote it.
    ffmpeg(dest)
      .seekInput(posterTime)
      .frames(1)
      .on('error', reject)
      .on('end', resolve)
      .save(tmpFrame);
  });

  const poster = await makePoster(tmpFrame, outDir, slug);
  await fs.unlink(tmpFrame).catch(() => {});

  const stat = await fs.stat(dest);

  return {
    type: 'video',
    src: file,
    poster: poster.file,
    lqip: poster.lqipFile,
    w: poster.w,
    h: poster.h,
    duration,
    bytes: stat.size,
  };
}

/** "00:00:04.00" -> 4. Returns 0 for the "N/A" ffmpeg emits on some inputs. */
function parseDuration(str) {
  if (typeof str !== 'string') return 0;
  const parts = str.split(':').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
