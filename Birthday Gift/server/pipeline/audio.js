import path from 'node:path';
import fs from 'node:fs/promises';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Background audio.
 *
 * One track, looped by the viewer. Re-encoded to 96kbps mono-ish MP3 rather than
 * shipped as-is because a 40MB WAV or lossless FLAC would dwarf every photo in
 * the gift combined, and nobody can hear the difference on a phone speaker
 * under a room-tone music bed.
 *
 * MP3 rather than a more modern codec purely for reach: it plays everywhere,
 * including older iOS Safari, with no fallback logic in the viewer.
 */

/** Hard cap. A birthday visit is a couple of minutes; the track loops anyway. */
const MAX_SECONDS = 300;

export async function processAudio(srcPath, outDir, slug = 'music') {
  const file = `${slug}.mp3`;
  const dest = path.join(outDir, file);

  await new Promise((resolve, reject) => {
    ffmpeg(srcPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('96k')
      .audioChannels(2)
      .audioFrequency(44100)
      .duration(MAX_SECONDS)
      .outputOptions(['-write_xing 1'])
      .on('error', reject)
      .on('end', resolve)
      .save(dest);
  });

  const stat = await fs.stat(dest);
  return { src: file, bytes: stat.size };
}

export { MAX_SECONDS };
