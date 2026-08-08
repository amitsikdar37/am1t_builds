import { spawn } from 'node:child_process';

/**
 * Publishing: turning dist/ into a link the birthday person can open.
 *
 * Two paths, because the sender's setup is unknown:
 *
 *   drop  — no account, no install. The Studio hands them gift.zip and opens
 *           Netlify Drop; they drag it in and get a URL in about fifteen
 *           seconds. This always works.
 *   cli   — if netlify-cli happens to be installed and logged in, we can do the
 *           whole upload from here and print the URL directly.
 *
 * The CLI path is strictly an optimisation. Everything degrades to `drop`, and
 * the Studio never blocks on a tool the sender may not have.
 */

export const DROP_URL = 'https://app.netlify.com/drop';

/** Windows needs the .cmd shim; npm bins aren't directly executable there. */
const NETLIFY_BIN = process.platform === 'win32' ? 'netlify.cmd' : 'netlify';

/**
 * Run a command and capture its output.
 *
 * Timed out rather than awaited indefinitely: `netlify status` on a machine with
 * a half-configured install can sit waiting on a login prompt that nobody will
 * ever answer, and the Studio would appear to hang.
 */
function run(cmd, args, { cwd, timeout = 15000 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false });
    } catch {
      return resolve({ ok: false, code: -1, out: '', err: 'spawn failed' });
    }

    let out = '';
    let err = '';
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, code: -1, out, err: 'timed out' });
    }, timeout);

    child.stdout?.on('data', (d) => { out += d; });
    child.stderr?.on('data', (d) => { err += d; });
    child.on('error', () => finish({ ok: false, code: -1, out, err: 'not found' }));
    child.on('close', (code) => finish({ ok: code === 0, code, out, err }));
  });
}

/**
 * Can we publish directly, or does the sender need the drag-and-drop route?
 *
 * Being installed is not enough — an unauthenticated CLI would fail partway
 * through an upload, which is a worse experience than never offering the button.
 * So this checks for a logged-in account before claiming the CLI path works.
 */
export async function detectNetlifyCLI() {
  const version = await run(NETLIFY_BIN, ['--version'], { timeout: 10000 });
  if (!version.ok) return { installed: false, authenticated: false };

  const status = await run(NETLIFY_BIN, ['status'], { timeout: 15000 });
  const text = `${status.out}${status.err}`;
  const authenticated = status.ok && !/Not logged in|You are not logged/i.test(text);

  return {
    installed: true,
    authenticated,
    version: version.out.trim().split('\n')[0] || '',
  };
}

/** Pull the live URL out of the CLI's deploy output. */
function extractURL(text) {
  // Prefer the explicitly-labelled production URL. `netlify deploy --prod` also
  // prints a unique per-deploy permalink; handing the sender that one would give
  // the recipient a link that silently stops matching the site on any redeploy.
  const labelled = text.match(/(?:Website|Live)\s+URL:?\s*(https:\/\/\S+)/i);
  if (labelled) return labelled[1].replace(/[.,)]+$/, '');

  const any = text.match(/https:\/\/[a-z0-9-]+\.netlify\.app\S*/i);
  return any ? any[0].replace(/[.,)]+$/, '') : null;
}

/**
 * Deploy dist/ to production via the CLI.
 *
 * `--dir` is passed explicitly rather than relying on a netlify.toml, so this
 * works in a project that has never been linked to a Netlify site.
 */
export async function publishViaCLI({ distDir, cwd, siteName }) {
  const args = ['deploy', '--prod', '--dir', distDir];
  if (siteName) args.push('--site', siteName);

  // Deploys are uploads, not lookups — a gift with three videos over a slow
  // connection legitimately takes minutes.
  const result = await run(NETLIFY_BIN, args, { cwd, timeout: 10 * 60 * 1000 });
  const text = `${result.out}${result.err}`;
  const url = extractURL(text);

  if (!result.ok || !url) {
    return { ok: false, url: null, log: text.slice(-4000) };
  }
  return { ok: true, url, log: text.slice(-4000) };
}

export { extractURL };
