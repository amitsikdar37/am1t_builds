import path from 'node:path';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import archiver from 'archiver';

import { buildManifest, validateManifest, writeManifest, ASSET_DIR } from './manifest.js';

/**
 * Export: turn the working gift into a self-contained static site.
 *
 * The output of this module is the whole product. Everything else — the Studio,
 * this server, the raw originals — exists only on the sender's machine. What
 * lands in dist/ is what the birthday person will open, so it must be complete
 * and must not reference anything outside itself.
 *
 * Layout of dist/:
 *   index.html          the viewer, with hashed JS inlined/linked
 *   assets/*.js         the bundled engine
 *   gift.json           the manifest
 *   a/*.webp|mp4|mp3    the processed media
 */

/** Files that must exist in dist/ for the gift to work at all. */
const REQUIRED = ['index.html', 'gift.json'];

/**
 * Copy the processed assets into the built site.
 *
 * Only assets the manifest actually references are copied. Deleting a frame in
 * the Studio unlinks its files, but a crash mid-delete could leave orphans
 * behind, and shipping a stranger's stray photo inside someone's birthday gift
 * is not a failure mode worth risking.
 */
async function copyReferencedAssets(manifest, assetsDir, destDir) {
  const wanted = new Set();

  for (const f of manifest.frames || []) {
    for (const key of ['src', 'src512', 'lqip', 'poster']) {
      // Manifest paths carry the `a/` prefix; on disk they are bare filenames.
      if (f[key]) wanted.add(path.basename(f[key]));
    }
  }
  if (manifest.music?.src) wanted.add(path.basename(manifest.music.src));

  const outDir = path.join(destDir, ASSET_DIR);
  await fs.mkdir(outDir, { recursive: true });

  let bytes = 0;
  const missing = [];

  for (const name of wanted) {
    const from = path.join(assetsDir, name);
    try {
      const stat = await fs.stat(from);
      await fs.copyFile(from, path.join(outDir, name));
      bytes += stat.size;
    } catch {
      missing.push(name);
    }
  }

  return { count: wanted.size - missing.length, bytes, missing };
}

/**
 * Run `vite build` as a child process rather than calling Vite's JS API.
 *
 * The API path fails here: this server is an ES module, and Vite's terser
 * plugin reaches for `require` when it loads the minifier, which throws inside
 * an ESM scope. Shelling out sidesteps that entirely and has a better property
 * besides — the exported bundle is produced by the identical code path as
 * `npm run build`, so the gift can never differ from what the sender would get
 * building by hand.
 *
 * Vite's own JS entry is invoked with this process's node binary rather than
 * going through `npx`. On Windows the npm bins are `.cmd` shims, and Node 22
 * refuses to spawn those without `shell: true` — which would in turn put the
 * project path through a command-line parser. "D:\VS Code\..." has a space in
 * it, so that is a real breakage, not a hypothetical one.
 */
function runViteBuild(root) {
  return new Promise((resolve, reject) => {
    const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [viteBin, 'build'], {
      cwd: root,
      shell: false,
    });

    let log = '';
    child.stdout?.on('data', (d) => { log += d; });
    child.stderr?.on('data', (d) => { log += d; });

    child.on('error', (err) =>
      reject(new Error(`Could not run the bundler: ${err.message}`))
    );
    child.on('close', (code) => {
      if (code === 0) return resolve(log);
      // The tail is where Rollup puts the actual reason; the head is banner.
      reject(new Error(`Bundling failed.\n${log.slice(-2000)}`));
    });
  });
}
async function dirSize(dir) {
  let total = 0;
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? await dirSize(full) : (await fs.stat(full)).size;
  }
  return total;
}

/** Zip a directory, for the drag-and-drop publish path. */
function zipDir(srcDir, destZip) {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(destZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    out.on('close', () => resolve(archive.pointer()));
    // Both streams can fail independently — a disk-full error surfaces on the
    // write stream, a bad entry on the archiver. Only listening to one would
    // hang the promise forever on the other.
    out.on('error', reject);
    archive.on('error', reject);
    // Zip entries at the archive root, not nested under the directory name:
    // Netlify Drop publishes whatever sits at the top level of the zip, so an
    // extra wrapping folder would serve a directory listing instead of the gift.
    archive.directory(srcDir, false);
    archive.pipe(out);
    archive.finalize();
  });
}

/**
 * Build and assemble the publishable site.
 *
 * @param {object} opts
 * @param {object} opts.state       the Studio working state
 * @param {string} opts.root        project root (holds vite.config.js)
 * @param {string} opts.assetsDir   where processed media lives
 * @param {string} opts.distDir     output directory
 * @param {boolean} [opts.zip]      also produce gift.zip alongside dist/
 */
export async function exportGift({ state, root, assetsDir, distDir, zip = true }) {
  const manifest = buildManifest(state);
  const problems = validateManifest(manifest);
  if (problems.length) {
    const err = new Error(problems.join(' '));
    err.problems = problems;
    throw err;
  }

  await runViteBuild(root);

  await writeManifest(manifest, distDir);
  const assets = await copyReferencedAssets(manifest, assetsDir, distDir);

  for (const name of REQUIRED) {
    await fs.access(path.join(distDir, name)).catch(() => {
      throw new Error(`Export is incomplete — ${name} is missing from dist/.`);
    });
  }

  const totalBytes = await dirSize(distDir);

  let zipPath = null;
  let zipBytes = 0;
  if (zip) {
    // Written beside dist/, never inside it — a zip of the site living within
    // the site would be published along with it on the next export.
    zipPath = path.join(path.dirname(distDir), 'gift.zip');
    zipBytes = await zipDir(distDir, zipPath);
  }

  return {
    distDir,
    zipPath,
    zipBytes,
    totalBytes,
    frames: manifest.frames.length,
    videos: manifest.frames.filter((f) => f.type === 'video').length,
    hasMusic: Boolean(manifest.music),
    assets,
  };
}

export { zipDir, dirSize };
