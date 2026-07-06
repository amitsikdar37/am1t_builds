// phase1_harvest.js — Playwright-powered site harvester
// Phase 1 of the Website Cloner pipeline.
// Collects: screenshots, HTML, CSS, computed styles, metadata, asset inventory.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { extractPalette, truncate } = require('./utils');
const { harvestAnimations } = require('./animation_harvest');

/**
 * Main harvest function.
 * @param {string} url - Target URL to scrape
 * @param {string} bundleDir - Directory to save all harvested files
 * @param {function} onProgress - Callback(message: string) for live progress updates
 * @returns {Promise<object>} Summary of what was harvested
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
    recordVideo: {
      dir: bundleDir,
      size: { width: 1440, height: 900 }
    }
  });

  const page = await context.newPage();

  // ── Intercept network responses to capture CSS ──────────────────────────────
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
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch (err) {
    // Fallback: domcontentloaded is more permissive
    onProgress('⚠️  networkidle timed out — retrying with domcontentloaded...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // Let lazy-loaded content settle
  await page.waitForTimeout(2500);

  // ── Screenshots ───────────────────────────────────────────────────────────────
  onProgress('📸 Taking full-page screenshot...');
  await page.screenshot({
    path: path.join(bundleDir, 'screenshot_full.png'),
    fullPage: true,
    type: 'png',
  });

  onProgress('📸 Taking viewport (above-the-fold) screenshot...');
  await page.screenshot({
    path: path.join(bundleDir, 'screenshot_viewport.png'),
    fullPage: false,
    type: 'png',
  });

  // ── Raw HTML ──────────────────────────────────────────────────────────────────
  onProgress('📄 Extracting rendered HTML (post-JS execution)...');
  const rawHTML = await page.content();
  fs.writeFileSync(path.join(bundleDir, 'raw.html'), rawHTML, 'utf8');

  // ── Metadata & Design Tokens ──────────────────────────────────────────────────
  onProgress('🎨 Extracting metadata, colors, fonts, and DOM structure...');
  const metadata = await page.evaluate(() => {
    // Basic page info
    const title = document.title;
    const pageUrl = window.location.href;

    // Meta tags
    const metaTags = {};
    document.querySelectorAll('meta').forEach((m) => {
      const key =
        m.getAttribute('name') ||
        m.getAttribute('property') ||
        m.getAttribute('http-equiv');
      if (key) metaTags[key] = m.getAttribute('content');
    });

    // Google Fonts imports
    const googleFonts = [
      ...document.querySelectorAll('link[href*="fonts.google"], link[href*="fonts.gstatic"]'),
    ].map((l) => l.href);

    // Colors & fonts from computed styles of key elements
    const colorSet = new Set();
    const fontSet = new Set();
    const keySelectors = [
      'body', 'header', 'nav', 'main', 'footer',
      'h1', 'h2', 'h3', 'p', 'a', 'button',
      'section', 'article', '.hero', '.banner', '.container',
    ];
    keySelectors.forEach((sel) => {
      const els = document.querySelectorAll(sel);
      els.forEach((el) => {
        try {
          const cs = window.getComputedStyle(el);
          ['color', 'background-color', 'border-color', 'outline-color'].forEach((prop) => {
            const val = cs.getPropertyValue(prop);
            if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
              colorSet.add(val);
            }
          });
          const ff = cs.getPropertyValue('font-family');
          if (ff) fontSet.add(ff.split(',')[0].trim().replace(/["']/g, ''));
        } catch (_) {}
      });
    });

    // Images (first 40)
    const images = [...document.querySelectorAll('img')]
      .slice(0, 40)
      .map((img) => ({
        src: img.src,
        alt: img.alt || '',
        width: img.naturalWidth || img.getAttribute('width') || 0,
        height: img.naturalHeight || img.getAttribute('height') || 0,
      }));

    // Navigation links
    const navLinks = [...document.querySelectorAll('nav a, header a')]
      .slice(0, 20)
      .map((a) => ({ href: a.href, text: a.textContent?.trim().slice(0, 60) }));

    // Heading hierarchy
    const headings = ['h1', 'h2', 'h3', 'h4'].flatMap((tag) =>
      [...document.querySelectorAll(tag)].slice(0, 5).map((el) => ({
        tag,
        text: el.textContent?.trim().slice(0, 150),
      }))
    );

    // DOM structure snapshot (max depth 5)
    function snapshot(el, depth = 0) {
      if (!el || depth > 5) return null;
      const cs = window.getComputedStyle(el);
      const bgColor = cs.backgroundColor;
      return {
        tag: el.tagName?.toLowerCase(),
        id: el.id || undefined,
        classes: [...el.classList].slice(0, 6),
        text:
          el.childNodes.length > 0 && el.firstChild?.nodeType === 3
            ? el.firstChild.textContent?.trim().slice(0, 120)
            : undefined,
        bg: bgColor !== 'rgba(0, 0, 0, 0)' ? bgColor : undefined,
        color: cs.color || undefined,
        fontSize: cs.fontSize || undefined,
        display: cs.display || undefined,
        children: depth < 4
          ? [...el.children]
              .slice(0, 8)
              .map((c) => snapshot(c, depth + 1))
              .filter(Boolean)
          : undefined,
      };
    }

    return {
      title,
      url: pageUrl,
      metaTags,
      googleFonts,
      colors: [...colorSet].slice(0, 40),
      fonts: [...fontSet].slice(0, 15),
      images,
      navLinks,
      headings,
      domStructure: snapshot(document.body),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollHeight: document.body.scrollHeight,
    };
  });

  fs.writeFileSync(
    path.join(bundleDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );

  // ── Computed Styles ───────────────────────────────────────────────────────────
  onProgress('🖌️  Capturing computed styles for key elements...');
  const computedStyles = await page.evaluate(() => {
    const selectors = [
      'body', 'header', 'nav', 'main', 'footer',
      'h1', 'h2', 'h3', 'p', 'a', 'button',
      'section', 'article', '.container', '.wrapper', '.hero',
    ];
    const importantProps = [
      'color', 'background-color', 'background-image', 'background-size',
      'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
      'margin', 'padding', 'border', 'border-radius',
      'display', 'flex-direction', 'justify-content', 'align-items', 'gap',
      'width', 'max-width', 'height', 'min-height',
      'position', 'box-shadow', 'text-align', 'text-transform',
      'grid-template-columns', 'grid-template-rows',
    ];
    const result = {};
    selectors.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const cs = window.getComputedStyle(el);
      result[sel] = {};
      importantProps.forEach((p) => {
        result[sel][p] = cs.getPropertyValue(p);
      });
      result[sel]['_preview'] = el.outerHTML.slice(0, 600);
    });
    return result;
  });

  fs.writeFileSync(
    path.join(bundleDir, 'computed_styles.json'),
    JSON.stringify(computedStyles, null, 2),
    'utf8'
  );

  // ── CSS ───────────────────────────────────────────────────────────────────────
  onProgress('🎨 Merging all CSS (inline + linked stylesheets)...');
  const inlineCSS = await page.evaluate(() =>
    [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n\n')
  );

  const mergedCSS = [
    `/* ===== INLINE STYLES ===== */\n${inlineCSS}`,
    ...cssFiles.map((f) => `/* ===== ${f.url} ===== */\n${f.content}`),
  ].join('\n\n');

  fs.writeFileSync(path.join(bundleDir, 'styles.css'), mergedCSS, 'utf8');

  // ── Inline JavaScript ─────────────────────────────────────────────────────────
  onProgress('⚡ Extracting inline JavaScript...');
  const inlineJS = await page.evaluate(() =>
    [...document.querySelectorAll('script:not([src])')].map((s) => s.textContent).join('\n\n')
  );
  fs.writeFileSync(path.join(bundleDir, 'inline_scripts.js'), inlineJS, 'utf8');

  // ── Asset Inventory ───────────────────────────────────────────────────────────
  onProgress('📦 Building asset inventory...');
  const externalJS = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((s) => s.src)
  );

  const externalCSS = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href)
  );

  const assets = {
    externalJS,
    externalCSS,
    interceptedCSS: cssFiles.map((f) => ({ url: f.url, sizeBytes: f.content.length })),
    images: metadata.images,
  };
  fs.writeFileSync(path.join(bundleDir, 'assets.json'), JSON.stringify(assets, null, 2), 'utf8');

  // ── Section Snapshot ──────────────────────────────────────────────────────────
  onProgress('🗂️  Snapshotting page sections...');
  const sections = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll(
        'header, nav, section, .hero, .banner, footer, main > div, main > section'
      ),
    ].slice(0, 15);
    return candidates.map((el) => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: [...el.classList].slice(0, 6),
        offsetTop: rect.top + window.scrollY,
        height: rect.height,
        bg: cs.backgroundColor,
        textContent: el.textContent?.trim().slice(0, 300),
      };
    }).filter((s) => s.height > 30);
  });

  fs.writeFileSync(path.join(bundleDir, 'sections.json'), JSON.stringify(sections, null, 2), 'utf8');

  // ── Animation Intelligence ─────────────────────────────────────────────────
  // Captures GSAP, Webflow IX2, CSS keyframes, scroll triggers, scroll-state screenshots
  let animationSummary = {};
  try {
    animationSummary = await harvestAnimations(page, bundleDir, onProgress);
  } catch (err) {
    onProgress(`⚠️  Animation harvest had an error: ${err.message} — continuing...`);
  }

  // ── Color Palette ─────────────────────────────────────────────────────────────
  onProgress('🎨 Extracting color palette...');
  const palette = extractPalette(metadata.colors);
  fs.writeFileSync(
    path.join(bundleDir, 'palette.json'),
    JSON.stringify({ palette, raw: metadata.colors }, null, 2),
    'utf8'
  );

  // ── Write Summary ─────────────────────────────────────────────────────────────
  const summary = {
    url,
    title: metadata.title,
    harvestedAt: new Date().toISOString(),
    files: {
      screenshots: [
        'screenshot_full.png',
        'screenshot_viewport.png',
        'scroll_video.webm',
      ],
      data: [
        'metadata.json',
        'computed_styles.json',
        'assets.json',
        'sections.json',
        'palette.json',
        'animations.json',
      ],
      code: ['raw.html', 'styles.css', 'inline_scripts.js'],
    },
    stats: {
      cssFilesIntercepted: cssFiles.length,
      imagesFound: metadata.images.length,
      headings: metadata.headings.length,
      colorTokens: palette.length,
      fonts: metadata.fonts,
      htmlSize: `${(rawHTML.length / 1024).toFixed(1)} KB`,
      cssSize: `${(mergedCSS.length / 1024).toFixed(1)} KB`,
      // Animation stats
      animLibraries: animationSummary.librariesDetected || [],
      keyframeCount: animationSummary.keyframeCount || 0,
      animatedElements: animationSummary.animatedElementCount || 0,
      scrollTriggers: animationSummary.scrollTriggerCount || 0,
      gsapScrollTriggers: animationSummary.gsapScrollTriggerCount || 0,
    },
  };

  fs.writeFileSync(path.join(bundleDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

  // We need to wait for the video to finish saving, so we close the context first
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();
  
  if (videoPath) {
    fs.renameSync(videoPath, path.join(bundleDir, 'scroll_video.webm'));
  }

  onProgress('✅ Phase 1 complete — bundle saved to disk!');

  return summary;
}

module.exports = { harvestSite };
