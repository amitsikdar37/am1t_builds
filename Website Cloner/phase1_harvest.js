// phase1_harvest.js — Playwright-powered site harvester
// Zero-AI architecture: captures the live site and assembles a self-executing clone.
// No animation harvesting, no AI prompts, no JSON dumps. Just the clone.

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

/**
 * harvestSite(url, bundleDir, onProgress)
 *
 * Visits the URL, captures a self-executing clone, and saves it to:
 *   1. harvested_bundle/<bundleId>/   — raw assets (screenshot, raw.html, styles.css)
 *   2. output/<bundleId>/index.html   — the finished, self-executing clone (served to UI)
 */
async function harvestSite(url, bundleDir, onProgress = () => {}) {
  fs.mkdirSync(bundleDir, { recursive: true });

  onProgress('🚀 Launching headless Chromium browser...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // ── Intercept CSS from network ──────────────────────────────────────────────
  const cssFiles = [];
  page.on('response', async (response) => {
    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('text/css') || response.url().endsWith('.css')) {
        const content = await response.text();
        cssFiles.push({ url: response.url(), content });
      }
    } catch (_) {}
  });

  // ── Navigate ─────────────────────────────────────────────────────────────────
  onProgress(`🌐 Navigating to ${url} ...`);
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (err) {
    onProgress('⚠️  networkidle timed out — retrying with domcontentloaded...');
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // Get the initial HTML exactly as the server sent it, before JS mutations.
  // This preserves loading screens and starting animation states perfectly!
  const initialHTML = await response.text();
  const finalUrl = response.url(); // in case of redirects

  // Let lazy-loaded content settle (so our screenshot looks good)
  await page.waitForTimeout(2500);

  // ── Screenshot (one, for history thumbnails) ──────────────────────────────────
  onProgress('📸 Taking screenshot...');
  await page.screenshot({
    path: path.join(bundleDir, 'screenshot.png'),
    fullPage: false,
    type: 'png',
  });

  // ── Rendered HTML (just for stats/records) ──────────────────────────────────
  onProgress('📄 Capturing rendered DOM...');
  const rawHTML = await page.content();
  fs.writeFileSync(path.join(bundleDir, 'raw.html'), rawHTML, 'utf8');

  // Also save the initial HTML for reference
  fs.writeFileSync(path.join(bundleDir, 'initial.html'), initialHTML, 'utf8');

  // ── Merge intercepted CSS ─────────────────────────────────────────────────────
  onProgress('🎨 Merging intercepted CSS...');
  const inlineCSS = await page.evaluate(() =>
    [...document.querySelectorAll('style')].map(s => s.textContent).join('\n\n')
  );
  const mergedCSS = [
    `/* ===== INLINE STYLES ===== */\n${inlineCSS}`,
    ...cssFiles.map(f => `/* ===== ${f.url} ===== */\n${f.content}`),
  ].join('\n\n');
  fs.writeFileSync(path.join(bundleDir, 'styles.css'), mergedCSS, 'utf8');

  // ── Get page title for summary ────────────────────────────────────────────────
  const title = await page.title();

  await context.close();
  await browser.close();

  // ── Assemble self-executing clone ─────────────────────────────────────────────
  onProgress('🏗️  Assembling self-executing clone (Initial HTML + Base)...');

  // We use the INITIAL HTML here, not the mutated DOM.
  // This guarantees loading screens and GSAP start states are exactly as they were.
  let cloneHTML = initialHTML;

  // 1. Inject <base> tag so all relative paths (images, scripts, CSS) resolve to original site
  const baseTag = `<base href="${finalUrl}">`;
  if (cloneHTML.match(/<head[^>]*>/i)) {
    cloneHTML = cloneHTML.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
  } else {
    cloneHTML = `<head>\n${baseTag}\n</head>\n` + cloneHTML;
  }

  // 2. Inject all intercepted CSS into <head> (makes clone fully self-contained)
  const styleTag = `\n<style id="website-cloner-css">\n${mergedCSS}\n</style>\n`;
  if (cloneHTML.includes('</head>')) {
    cloneHTML = cloneHTML.replace('</head>', `${styleTag}</head>`);
  } else {
    cloneHTML = cloneHTML.replace(/(<body[^>]*>)/i, `<head>${styleTag}</head>\n$1`);
  }

  // Strip ONLY dev-server / hot-reload inline scripts (they break locally)
  cloneHTML = cloneHTML.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, code) => {
    if (
      code.includes('localhost') ||
      code.includes('127.0.0.1') ||
      code.includes('webpack-dev-server') ||
      code.includes('__webpack_hmr') ||
      code.includes('sockjs') ||
      code.includes('hot-reload')
    ) {
      return ''; // remove only dev-only scripts
    }
    return match; // keep ALL other scripts (CDN libs, GSAP, Webflow, etc.)
  });

  // Save the finished clone to output/ so the UI preview works instantly
  const bundleId = path.basename(bundleDir);
  const outputDir = path.join(__dirname, 'output', bundleId);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), cloneHTML, 'utf8');

  // Also keep a copy in the bundle for reference
  fs.writeFileSync(path.join(bundleDir, 'clone.html'), cloneHTML, 'utf8');

  // ── Summary ───────────────────────────────────────────────────────────────────
  const summary = {
    url,
    title,
    harvestedAt: new Date().toISOString(),
    stats: {
      cssFilesIntercepted: cssFiles.length,
      htmlSize: `${(rawHTML.length / 1024).toFixed(1)} KB`,
      cssSize:  `${(mergedCSS.length / 1024).toFixed(1)} KB`,
    },
  };
  fs.writeFileSync(path.join(bundleDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  onProgress('✅ Clone complete! Loading preview...');
  return summary;
}

module.exports = { harvestSite };
