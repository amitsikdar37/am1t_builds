import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * The gift.json writer.
 *
 * gift.json is the single contract between the Studio and the museum. The
 * Studio's live preview and the exported static site run the exact same viewer
 * code against this file, so whatever the sender previews is literally what the
 * recipient gets — there is no second rendering path that could drift.
 *
 * Everything written here is validated and clamped rather than trusted, because
 * a malformed manifest would fail at the recipient's end, where nobody can fix
 * it.
 */

export const MANIFEST_VERSION = 1;

/** Asset paths in the manifest are relative to this folder inside the site. */
export const ASSET_DIR = 'a';

const MAX_FRAMES = 16;
const MIN_FRAMES = 1;
const MAX_CANDLES = 12;
const MIN_CANDLES = 1;
const MAX_CAPTION = 80;
const MAX_LETTER = 1200;
const MAX_NAME = 40;

function clampInt(v, lo, hi, fallback) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function clampText(v, max, fallback = '') {
  if (typeof v !== 'string') return fallback;
  const t = v.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * Build a manifest object from the Studio's working state.
 *
 * @param {object} state
 * @param {string} state.name       recipient's name
 * @param {string} state.letter     the personal message shown at the finale
 * @param {number} state.candles    candle count on the cake
 * @param {Array}  state.frames     processed media descriptors, in wall order
 * @param {object|null} state.music processed audio descriptor
 * @param {number} state.musicVolume
 */
export function buildManifest(state) {
  // Wall assignment balances against what has actually been placed rather than
  // alternating on index. Plain alternation breaks as soon as the sender pins a
  // few frames by hand — pin three to the left and the "alternating" auto
  // frames happily pile onto the left too.
  const wallCount = { L: 0, R: 0 };

  const frames = (Array.isArray(state.frames) ? state.frames : [])
    .slice(0, MAX_FRAMES)
    .map((f) => {
      const wall =
        f.wall === 'L' || f.wall === 'R'
          ? f.wall
          : (wallCount.L <= wallCount.R ? 'L' : 'R');
      wallCount[wall]++;

      const entry = {
        type: f.type === 'video' ? 'video' : 'photo',
        src: `${ASSET_DIR}/${f.src}`,
        caption: clampText(f.caption, MAX_CAPTION),
        wall,
        w: clampInt(f.w, 1, 8192, 1024),
        h: clampInt(f.h, 1, 8192, 768),
      };

      if (f.lqip) entry.lqip = `${ASSET_DIR}/${f.lqip}`;

      if (entry.type === 'video') {
        if (f.poster) entry.poster = `${ASSET_DIR}/${f.poster}`;
      } else if (f.src512) {
        entry.src512 = `${ASSET_DIR}/${f.src512}`;
      }

      return entry;
    });

  const manifest = {
    v: MANIFEST_VERSION,
    name: clampText(state.name, MAX_NAME, 'Friend') || 'Friend',
    theme: 'midnight-gold',
    letter: clampText(state.letter, MAX_LETTER),
    candles: clampInt(state.candles, MIN_CANDLES, MAX_CANDLES, 5),
    frames,
  };

  if (state.music?.src) {
    const vol = Number(state.musicVolume);
    manifest.music = {
      src: `${ASSET_DIR}/${state.music.src}`,
      volume: Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.45,
    };
  }

  return manifest;
}

/**
 * Explain why a manifest isn't ready to publish yet. Returns [] when it is.
 * The Studio surfaces these to the sender before export rather than letting a
 * broken gift reach the recipient.
 */
export function validateManifest(manifest) {
  const problems = [];

  if (!manifest.frames || manifest.frames.length < MIN_FRAMES) {
    problems.push('Add at least one photo before publishing.');
  }
  if (manifest.frames && manifest.frames.length > MAX_FRAMES) {
    problems.push(`The corridor holds ${MAX_FRAMES} frames — remove a few.`);
  }
  if (!manifest.name || manifest.name === 'Friend') {
    problems.push("Set the birthday person's name.");
  }

  const videos = (manifest.frames || []).filter((f) => f.type === 'video').length;
  if (videos > 3) {
    problems.push(
      `${videos} videos is more than a phone can decode smoothly — keep it to 3.`
    );
  }

  return problems;
}

export async function writeManifest(manifest, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, 'gift.json');
  await fs.writeFile(dest, JSON.stringify(manifest, null, 2), 'utf8');
  return dest;
}

export { MAX_FRAMES, MAX_CANDLES };
