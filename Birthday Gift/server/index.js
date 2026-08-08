import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';

import { processImage } from './pipeline/images.js';
import { processVideo, MAX_VIDEOS } from './pipeline/video.js';
import { processAudio } from './pipeline/audio.js';
import { exportGift } from './pipeline/export.js';
import { detectNetlifyCLI, publishViaCLI, DROP_URL } from './pipeline/publish.js';
import {
  buildManifest,
  validateManifest,
  writeManifest,
  ASSET_DIR,
  MAX_FRAMES,
} from './pipeline/manifest.js';

/**
 * The Studio backend.
 *
 * Runs only on the sender's PC. It never ships to the recipient — the published
 * gift is pure static files. Its whole job is to take heavy originals off the
 * sender's disk, grind them into phone-sized assets, and write gift.json.
 *
 * Because it is a localhost-only authoring tool bound to 127.0.0.1, it has no
 * auth. That is a deliberate scoping decision, not an oversight: exposing this
 * port to a network would let anyone write files into the gift directory, so it
 * stays on the loopback interface.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GIFTS_DIR = path.join(ROOT, 'gifts');
const WORK_SLUG = 'current';
const WORK_DIR = path.join(GIFTS_DIR, WORK_SLUG);
const RAW_DIR = path.join(WORK_DIR, 'raw');
const ASSETS_DIR = path.join(WORK_DIR, ASSET_DIR);
const STATE_FILE = path.join(WORK_DIR, 'state.json');
const DIST_DIR = path.join(ROOT, 'dist');

const PORT = 4321;

/** Upload limits. Generous for originals — everything gets shrunk downstream. */
const LIMITS = {
  image: 25 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
};

const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Working-state persistence ───────────────────────────────────────────────
// Kept on disk so closing the Studio mid-build doesn't lose an afternoon of
// captioning work.

const EMPTY_STATE = {
  name: '',
  letter: '',
  candles: 5,
  musicVolume: 0.45,
  frames: [],
  music: null,
};

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_STATE };
  }
}

async function writeState(state) {
  await fs.mkdir(WORK_DIR, { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

async function ensureDirs() {
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(ASSETS_DIR, { recursive: true });
}

/** Monotonic-ish id so asset filenames never collide across sessions. */
let idCounter = Date.now();
const nextId = () => `m${(idCounter++).toString(36)}`;

// ── Uploads ────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureDirs();
    cb(null, RAW_DIR);
  },
  filename: (req, file, cb) => {
    // Keep only the extension from the client-supplied name. Using the original
    // basename would let a crafted filename traverse out of RAW_DIR.
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^.\w]/g, '');
    cb(null, `${nextId()}${ext || '.bin'}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: LIMITS.video },
});

// ── Routes ─────────────────────────────────────────────────────────────────

app.get('/api/state', async (req, res) => {
  const state = await readState();
  res.json({ state, limits: { maxFrames: MAX_FRAMES, maxVideos: MAX_VIDEOS } });
});

/** Update the scalar fields (name, letter, candles, music volume). */
app.post('/api/state', async (req, res) => {
  const state = await readState();
  const { name, letter, candles, musicVolume } = req.body || {};

  if (name !== undefined) state.name = String(name);
  if (letter !== undefined) state.letter = String(letter);
  if (candles !== undefined) state.candles = Number(candles);
  if (musicVolume !== undefined) state.musicVolume = Number(musicVolume);

  await writeState(state);
  res.json({ state });
});

/**
 * Add photos or videos. Processing is sequential rather than parallel: sharp
 * and ffmpeg are both happy to saturate every core, and a sender dragging in 16
 * photos at once shouldn't make their machine unusable.
 */
app.post('/api/media', upload.array('files', MAX_FRAMES), async (req, res) => {
  await ensureDirs();
  const state = await readState();
  const added = [];
  const rejected = [];

  for (const file of req.files || []) {
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');

    if (!isVideo && !isImage) {
      rejected.push({ name: file.originalname, reason: 'Not an image or video.' });
      await fs.unlink(file.path).catch(() => {});
      continue;
    }

    if (state.frames.length + added.length >= MAX_FRAMES) {
      rejected.push({
        name: file.originalname,
        reason: `The corridor holds ${MAX_FRAMES} frames.`,
      });
      await fs.unlink(file.path).catch(() => {});
      continue;
    }

    const videoCount =
      state.frames.filter((f) => f.type === 'video').length +
      added.filter((f) => f.type === 'video').length;

    if (isVideo && videoCount >= MAX_VIDEOS) {
      // Not arbitrary: mobile hardware decoders stall past a couple of streams,
      // and that stall shows up as whole-page jank, not just a stuttery video.
      rejected.push({
        name: file.originalname,
        reason: `Phones can only decode ${MAX_VIDEOS} videos smoothly.`,
      });
      await fs.unlink(file.path).catch(() => {});
      continue;
    }

    const slug = path.basename(file.filename, path.extname(file.filename));

    try {
      const processed = isVideo
        ? await processVideo(file.path, ASSETS_DIR, slug)
        : await processImage(file.path, ASSETS_DIR, slug);

      added.push({ id: slug, caption: '', wall: null, ...processed });
    } catch (err) {
      rejected.push({
        name: file.originalname,
        reason: isVideo
          ? 'Could not transcode this video.'
          : 'Could not read this image.',
      });
      console.error(`[media] ${file.originalname}:`, err.message);
    } finally {
      // The original is only ever an input to the pipeline. Keeping 200MB of
      // raw phone video around per gift serves nobody.
      await fs.unlink(file.path).catch(() => {});
    }
  }

  state.frames.push(...added);
  await writeState(state);

  res.json({ state, added: added.length, rejected });
});

/** Replace a frame's caption / wall, or reorder the whole set. */
app.patch('/api/media/:id', async (req, res) => {
  const state = await readState();
  const frame = state.frames.find((f) => f.id === req.params.id);
  if (!frame) return res.status(404).json({ error: 'No such frame.' });

  const { caption, wall } = req.body || {};
  if (caption !== undefined) frame.caption = String(caption);
  if (wall !== undefined) frame.wall = wall === 'L' || wall === 'R' ? wall : null;

  await writeState(state);
  res.json({ state });
});

app.post('/api/media/order', async (req, res) => {
  const state = await readState();
  const order = Array.isArray(req.body?.order) ? req.body.order : [];

  const byId = new Map(state.frames.map((f) => [f.id, f]));
  const reordered = order.map((id) => byId.get(id)).filter(Boolean);

  // Anything the client didn't mention keeps its place at the end, so a stale
  // order array can never silently delete a frame.
  for (const f of state.frames) {
    if (!reordered.includes(f)) reordered.push(f);
  }

  state.frames = reordered;
  await writeState(state);
  res.json({ state });
});

app.delete('/api/media/:id', async (req, res) => {
  const state = await readState();
  const idx = state.frames.findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No such frame.' });

  const [frame] = state.frames.splice(idx, 1);

  for (const key of ['src', 'src512', 'lqip', 'poster']) {
    if (frame[key]) await fs.unlink(path.join(ASSETS_DIR, frame[key])).catch(() => {});
  }

  await writeState(state);
  res.json({ state });
});

/** Background music. One track per gift, so this replaces rather than appends. */
app.post('/api/music', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });

  await ensureDirs();
  const state = await readState();

  try {
    if (state.music?.src) {
      await fs.unlink(path.join(ASSETS_DIR, state.music.src)).catch(() => {});
    }
    state.music = await processAudio(req.file.path, ASSETS_DIR, `music_${nextId()}`);
    await writeState(state);
    res.json({ state });
  } catch (err) {
    console.error('[music]', err.message);
    res.status(422).json({ error: 'Could not process this audio file.' });
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
});

app.delete('/api/music', async (req, res) => {
  const state = await readState();
  if (state.music?.src) {
    await fs.unlink(path.join(ASSETS_DIR, state.music.src)).catch(() => {});
  }
  state.music = null;
  await writeState(state);
  res.json({ state });
});

/**
 * The live preview manifest. The Studio's embedded viewer fetches this exactly
 * as the published site fetches its static gift.json, so the preview exercises
 * the real code path rather than a mock.
 */
app.get('/api/gift.json', async (req, res) => {
  const state = await readState();
  const manifest = buildManifest(state);
  res.json(manifest);
});

app.get('/api/validate', async (req, res) => {
  const state = await readState();
  const manifest = buildManifest(state);
  res.json({ problems: validateManifest(manifest), manifest });
});

// ── Export & publish ───────────────────────────────────────────────────────

/**
 * Build the publishable site.
 *
 * Serialised behind a flag rather than queued: a second export while the first
 * is mid-flight would have two Vite builds racing to empty and refill the same
 * dist/, and the loser could ship a half-written site.
 */
let exporting = false;
let lastExport = null;

app.post('/api/export', async (req, res) => {
  if (exporting) {
    return res.status(409).json({ error: 'An export is already running.' });
  }
  exporting = true;

  try {
    const state = await readState();
    const result = await exportGift({
      state,
      root: ROOT,
      assetsDir: ASSETS_DIR,
      distDir: DIST_DIR,
    });
    lastExport = result;
    res.json({ ok: true, result });
  } catch (err) {
    // Validation failures are the sender's to fix and carry their own wording;
    // anything else is ours and gets logged.
    if (err.problems) {
      return res.status(422).json({ error: err.message, problems: err.problems });
    }
    console.error('[export]', err);
    res.status(500).json({ error: err.message || 'Export failed.' });
  } finally {
    exporting = false;
  }
});

/** Hand the sender the zip for the drag-and-drop publish route. */
app.get('/api/export/zip', async (req, res) => {
  const zipPath = path.join(ROOT, 'gift.zip');
  try {
    await fs.access(zipPath);
  } catch {
    return res.status(404).json({ error: 'Export the gift first.' });
  }
  res.download(zipPath, 'gift.zip');
});

/**
 * Which publish routes are open to this sender. Checked on demand rather than
 * at boot so installing the CLI mid-session is picked up without a restart.
 */
app.get('/api/publish/options', async (req, res) => {
  const cli = await detectNetlifyCLI();
  res.json({ cli, dropUrl: DROP_URL });
});

/**
 * Deploy to Netlify via the CLI.
 *
 * This is the one route that reaches outside the sender's machine, so it never
 * fires on its own — the Studio only calls it from an explicit button press
 * after showing what is about to be uploaded.
 */
app.post('/api/publish', async (req, res) => {
  try {
    await fs.access(path.join(DIST_DIR, 'index.html'));
  } catch {
    return res.status(409).json({ error: 'Export the gift before publishing.' });
  }

  const cli = await detectNetlifyCLI();
  if (!cli.installed || !cli.authenticated) {
    return res.status(409).json({
      error: 'Netlify CLI is not installed or not logged in.',
      dropUrl: DROP_URL,
    });
  }

  const result = await publishViaCLI({
    distDir: DIST_DIR,
    cwd: ROOT,
    siteName: req.body?.siteName,
  });

  if (!result.ok) {
    return res.status(502).json({ error: 'Deploy failed.', log: result.log });
  }

  res.json({ ok: true, url: result.url });
});

/**
 * A QR of the finished link, so the sender can open the gift on their own phone
 * and check it before sending — the recipient's device is the one that matters,
 * and it is never the one it was built on.
 */
app.get('/api/qr', async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Need a URL to encode.' });
  }
  const svg = await QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    color: { dark: '#1a1428', light: '#ffffff' },
  });
  res.set('Content-Type', 'image/svg+xml').send(svg);
});

// ── Static mounts ──────────────────────────────────────────────────────────
// Processed assets, served at the same relative path the published site uses.
// The manifest lives at /api/gift.json, so assets resolve relative to /api/.
app.use(`/api/${ASSET_DIR}`, express.static(ASSETS_DIR, { maxAge: 0 }));

// The preview iframe loads the real viewer from src/. That code imports `three`
// as a bare specifier, which a plain static mount cannot resolve — so Vite runs
// in middleware mode to do module resolution and transforms exactly as it will
// during the production build. The preview therefore exercises the same code
// path as the published gift rather than a lookalike.
const vite = await createViteServer({
  root: ROOT,
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  optimizeDeps: { include: ['three'] },
});
app.use(vite.middlewares);

// `appType: 'custom'` means Vite serves modules but not HTML, so the preview
// document is read and transformed by hand. Going through transformIndexHtml
// (rather than a static mount) is what injects the client runtime and rewrites
// the module script the same way the real dev server would.
app.get('/src/viewer/index.html', async (req, res, next) => {
  try {
    const file = path.join(ROOT, 'src', 'viewer', 'index.html');
    const raw = await fs.readFile(file, 'utf8');
    // Deliberately req.path, not req.originalUrl. The preview always carries a
    // ?gift= query, and Vite derives the ids for inline <style>/<script> blocks
    // by appending its own `?html-proxy&...` — so a URL that already has a query
    // produces a double-`?` id that its JSON and JS plugins fail to parse.
    const html = await vite.transformIndexHtml(req.path, raw);
    res.set('Content-Type', 'text/html').send(html);
  } catch (err) {
    vite.ssrFixStacktrace?.(err);
    next(err);
  }
});

app.use('/', express.static(path.join(ROOT, 'studio')));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(413).json({
      error: tooBig ? 'That file is too large.' : 'Upload failed.',
    });
  }
  console.error('[studio]', err);
  res.status(500).json({ error: 'Something went wrong.' });
});

await ensureDirs();

// Loopback only. See the note at the top of this file.
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Birthday Gift Studio -> http://localhost:${PORT}\n`);
});

export { app, WORK_DIR, ASSETS_DIR, buildManifest, writeManifest, readState };

