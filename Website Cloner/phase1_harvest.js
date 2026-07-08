// phase1_harvest.js — Playwright-powered site harvester
// Zero-AI architecture: captures the live site and assembles a self-executing clone.
// No animation harvesting, no AI prompts, no JSON dumps. Just the clone.

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const prettier = require('prettier');
const AdmZip = require('adm-zip');

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

  // ── Assemble self-executing clones ──────────────────────────────────────────
  onProgress('🏗️  Assembling self-executing clone (Initial HTML + Base)...');

  // We use the INITIAL HTML here, not the mutated DOM.
  let baseHTML = initialHTML;

  // 1. Inject <base> tag so all relative paths resolve to original site
  const baseTag = `<base href="${finalUrl}">`;
  if (baseHTML.match(/<head[^>]*>/i)) {
    baseHTML = baseHTML.replace(/(<head[^>]*>)/i, `$1\n${baseTag}`);
  } else {
    baseHTML = `<head>\n${baseTag}\n</head>\n` + baseHTML;
  }

  // Strip dev-server scripts
  baseHTML = baseHTML.replace(/<script([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs, code) => {
    if (
      code.includes('localhost') || code.includes('127.0.0.1') ||
      code.includes('webpack-dev-server') || code.includes('__webpack_hmr') ||
      code.includes('sockjs') || code.includes('hot-reload')
    ) return '';
    return match;
  });

  // 2. Create the split, maintainable version (index.html + styles.css)
  const linkTag = `\n<link rel="stylesheet" href="styles.css" id="website-cloner-css">\n`;
  let splitHTML = baseHTML;
  if (splitHTML.includes('</head>')) {
    splitHTML = splitHTML.replace('</head>', `${linkTag}</head>`);
  } else {
    splitHTML = splitHTML.replace(/(<body[^>]*>)/i, `<head>${linkTag}</head>\n$1`);
  }

  // 3. Create the single-file standalone version (for easy downloading)
  const styleTag = `\n<style id="website-cloner-css">\n${mergedCSS}\n</style>\n`;
  let standaloneHTML = baseHTML;
  if (standaloneHTML.includes('</head>')) {
    standaloneHTML = standaloneHTML.replace('</head>', `${styleTag}</head>`);
  } else {
    standaloneHTML = standaloneHTML.replace(/(<body[^>]*>)/i, `<head>${styleTag}</head>\n$1`);
  }

  // 4. Format the split, maintainable code using Prettier
  onProgress('✨ Formatting code to be highly maintainable...');
  let formattedHTML = splitHTML;
  let formattedCSS = mergedCSS;
  try {
    formattedHTML = await prettier.format(splitHTML, { parser: 'html', printWidth: 100, htmlWhitespaceSensitivity: 'ignore' });
    formattedCSS = await prettier.format(mergedCSS, { parser: 'css' });
  } catch (e) {
    onProgress('⚠️ Formatting failed (possibly due to syntax errors in scraped code) — continuing with raw code.');
  }

  // 5. Save to output/
  const bundleId = path.basename(bundleDir);
  const outputDir = path.join(__dirname, 'output', bundleId);
  fs.mkdirSync(outputDir, { recursive: true });
  
  // Save formatted files for maintainability
  fs.writeFileSync(path.join(outputDir, 'styles.css'), formattedCSS, 'utf8');
  fs.writeFileSync(path.join(outputDir, 'index.html'), formattedHTML, 'utf8');
  
  // Save standalone version (unformatted to save space, used mostly for iframe UI)
  fs.writeFileSync(path.join(outputDir, 'clone_standalone.html'), standaloneHTML, 'utf8');

  // 6. Create ZIP project
  onProgress('📦 Zipping project...');
  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from(formattedHTML, 'utf8'));
  zip.addFile('styles.css', Buffer.from(formattedCSS, 'utf8'));
  zip.writeZip(path.join(outputDir, 'clone_project.zip'));

  // Also keep a copy in the bundle for reference
  fs.writeFileSync(path.join(bundleDir, 'clone.html'), standaloneHTML, 'utf8');

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
