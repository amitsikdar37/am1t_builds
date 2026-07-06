// animation_harvest.js — Deep animation intelligence extractor for Phase 1
// Captures: GSAP configs, Webflow IX2 data, CSS keyframes, scroll-triggered
// elements, Intersection Observer targets, library detection, and scroll-state screenshots.
//
// Called from harvestSite() after the page has fully loaded.

const path = require('path');
const fs   = require('fs');

/**
 * harvestAnimations(page, bundleDir, onProgress)
 *
 * Runs inside Playwright after page load and networkidle.
 * Saves `animations.json` and scroll-state screenshots to bundleDir.
 */
async function harvestAnimations(page, bundleDir, onProgress = () => {}) {
  onProgress('🎬 Harvesting animation intelligence...');

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. In-browser deep extraction
  // ─────────────────────────────────────────────────────────────────────────────
  const animationData = await page.evaluate(() => {

    // ── 1a. Library detection ──────────────────────────────────────────────────
    const libs = {
      gsap:              typeof window.gsap  !== 'undefined',
      scrollTrigger:     typeof window.ScrollTrigger !== 'undefined' ||
                         (typeof window.gsap !== 'undefined' && !!window.gsap.plugins?.scrollTrigger),
      lenis:             typeof window.Lenis !== 'undefined' || !!document.querySelector('[data-lenis]'),
      locomotiveScroll:  typeof window.LocomotiveScroll !== 'undefined' || !!document.querySelector('[data-scroll-container]'),
      aos:               typeof window.AOS !== 'undefined',
      animejs:           typeof window.anime !== 'undefined',
      framerMotion:      typeof window.FramerMotion !== 'undefined',
      webflowIX2:        typeof window.Webflow !== 'undefined' && !!document.querySelector('[data-wf-ix-anchor]'),
      observerJS:        typeof window.IntersectionObserver !== 'undefined',
      scrollReveal:      typeof window.ScrollReveal !== 'undefined',
      motionOne:         typeof window.Motion !== 'undefined',
      swiper:            typeof window.Swiper !== 'undefined',
      threeJS:           typeof window.THREE !== 'undefined',
      barba:             typeof window.barba !== 'undefined',
      splide:            typeof window.Splide !== 'undefined',
    };

    // ── 1b. Extract ALL CSS @keyframes ────────────────────────────────────────
    const keyframes = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule instanceof CSSKeyframesRule) {
              const frames = [];
              for (const keyframe of rule.cssRules) {
                frames.push({
                  keyText: keyframe.keyText,
                  cssText: keyframe.style?.cssText || '',
                });
              }
              keyframes.push({
                name: rule.name,
                frames,
                rawCSS: rule.cssText?.slice(0, 2000),
              });
            }
          }
        } catch (_) {} // cross-origin sheet
      }
    } catch (_) {}

    // ── 1c. Extract CSS animation/transition definitions from ALL rules ────────
    const cssAnimationRules = [];
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule instanceof CSSStyleRule) {
              const style = rule.style;
              const anim    = style.getPropertyValue('animation');
              const trans   = style.getPropertyValue('transition');
              const willChg = style.getPropertyValue('will-change');
              const transform = style.getPropertyValue('transform');
              if (anim || trans || willChg || (transform && transform !== 'none')) {
                cssAnimationRules.push({
                  selector: rule.selectorText?.slice(0, 200),
                  animation: anim || null,
                  transition: trans || null,
                  willChange: willChg || null,
                  transform: transform || null,
                  filter: style.getPropertyValue('filter') || null,
                  opacity: style.getPropertyValue('opacity') || null,
                });
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}

    // ── 1d. Animated element catalog ──────────────────────────────────────────
    // Scan every element on the page for computed animation/transition properties
    const animatedElements = [];
    const allEls = [...document.querySelectorAll('*')];
    for (const el of allEls.slice(0, 1500)) { // cap at 1500 for perf
      try {
        const cs = window.getComputedStyle(el);
        const anim  = cs.getPropertyValue('animation-name');
        const trans = cs.getPropertyValue('transition-property');
        const willChg = cs.getPropertyValue('will-change');
        const transform = cs.getPropertyValue('transform');

        if (
          (anim && anim !== 'none') ||
          (trans && trans !== 'all' && trans !== 'none') ||
          (willChg && willChg !== 'auto') ||
          (transform && transform !== 'none')
        ) {
          const rect = el.getBoundingClientRect();
          animatedElements.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: [...el.classList].slice(0, 8).join(' ') || null,
            dataAttrs: [...el.attributes]
              .filter(a => a.name.startsWith('data-'))
              .map(a => ({ name: a.name, value: a.value?.slice(0, 80) }))
              .slice(0, 10),
            rect: {
              top: Math.round(rect.top + window.scrollY),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            computed: {
              animationName: anim,
              animationDuration: cs.getPropertyValue('animation-duration'),
              animationTimingFunction: cs.getPropertyValue('animation-timing-function'),
              animationDelay: cs.getPropertyValue('animation-delay'),
              animationFillMode: cs.getPropertyValue('animation-fill-mode'),
              transitionProperty: trans,
              transitionDuration: cs.getPropertyValue('transition-duration'),
              transitionTimingFunction: cs.getPropertyValue('transition-timing-function'),
              willChange: willChg,
              transform: transform !== 'none' ? transform : null,
              opacity: cs.getPropertyValue('opacity'),
            },
          });
        }
      } catch (_) {}
    }

    // ── 1e. Scroll-trigger data attributes catalog ───────────────────────────
    // Common data attrs used by GSAP ScrollTrigger, AOS, ScrollReveal, Webflow
    const scrollAttrs = [
      'data-animate', 'data-animation', 'data-scroll',
      'data-aos', 'data-aos-animation',
      'data-gsap', 'data-gsap-from', 'data-gsap-to',
      'data-split', 'data-split-reveal',
      'data-wf-ix-anchor', 'data-nav-trigger',
      'data-parallax', 'data-speed',
      'data-inview', 'data-inview-delay',
      'data-reveal', 'data-sr',
      'data-target-translate', 'data-overlay-container',
    ];

    const scrollElements = [];
    for (const attr of scrollAttrs) {
      const els = document.querySelectorAll(`[${attr}]`);
      for (const el of els) {
        scrollElements.push({
          attr,
          value: el.getAttribute(attr),
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: [...el.classList].slice(0, 6).join(' ') || null,
          textSnippet: el.textContent?.trim().slice(0, 100) || null,
        });
      }
    }

    // ── 1f. Webflow IX2 (Interactions 2.0) data ──────────────────────────────
    // Webflow stores interaction configs in a window.__wf_reserved_ix2 variable
    // or as a script tag. Very detailed — includes scroll-based triggers, timelines.
    let webflowIX2Data = null;
    try {
      // Method 1: window global
      if (window.__wf_reserved_ix2) {
        webflowIX2Data = JSON.parse(JSON.stringify(window.__wf_reserved_ix2));
      }
      // Method 2: script tag with type="application/json" or id patterns
      if (!webflowIX2Data) {
        const ix2Script = document.querySelector('script[data-wf-page]');
        if (ix2Script) {
          // Page data is usually accessible from Webflow global
          if (window.Webflow && window.Webflow.require) {
            try {
              const ix2Module = window.Webflow.require('ix2');
              if (ix2Module && ix2Module.store) {
                webflowIX2Data = { type: 'webflow-ix2-store', data: 'present' };
              }
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    // ── 1g. GSAP ScrollTrigger instances ─────────────────────────────────────
    let gsapScrollTriggers = [];
    try {
      if (window.ScrollTrigger && window.ScrollTrigger.getAll) {
        gsapScrollTriggers = window.ScrollTrigger.getAll().map(st => ({
          trigger: st.trigger?.tagName?.toLowerCase() || null,
          triggerClass: st.trigger ? [...st.trigger.classList].join(' ') : null,
          start: st.start,
          end: st.end,
          scrub: st.scrub,
          pin: st.pin,
          markers: st.markers,
          animation: st.animation ? {
            duration: st.animation.duration(),
            progress: st.animation.progress(),
            vars: Object.keys(st.animation.vars || {}).slice(0, 20),
          } : null,
        })).slice(0, 50);
      }
    } catch (_) {}

    // ── 1h. GSAP registered tweens & timelines ────────────────────────────────
    let gsapTweens = [];
    try {
      if (window.gsap && window.gsap.globalTimeline) {
        const tl = window.gsap.globalTimeline;
        const children = tl.getChildren(true, true, true) || [];
        gsapTweens = children.slice(0, 80).map(t => ({
          type: t.constructor?.name || 'unknown',
          duration: t.duration ? t.duration() : null,
          delay: t.delay ? t.delay() : null,
          repeat: t.repeat ? t.repeat() : null,
          vars: t.vars ? Object.entries(t.vars)
            .filter(([k]) => !['onComplete', 'onUpdate', 'onStart', 'parent'].includes(k))
            .slice(0, 15)
            .reduce((acc, [k, v]) => {
              acc[k] = typeof v === 'function' ? '[function]' : String(v).slice(0, 60);
              return acc;
            }, {}) : {},
        }));
      }
    } catch (_) {}

    // ── 1i. CSS Custom Properties (CSS variables) used for animation ──────────
    const animVars = [];
    try {
      const rootStyles = window.getComputedStyle(document.documentElement);
      const rawText = Array.from(document.styleSheets)
        .map(s => {
          try { return Array.from(s.cssRules).map(r => r.cssText).join('\n'); } catch (_) { return ''; }
        })
        .join('\n');
      const varMatches = rawText.match(/--[\w-]+:\s*[^;]+/g) || [];
      const animVarNames = varMatches
        .filter(v => /duration|delay|ease|speed|transition|anim|timing/i.test(v))
        .slice(0, 30);
      animVars.push(...animVarNames);
    } catch (_) {}

    // ── 1j. Detect scroll behavior & smoothness ───────────────────────────────
    const scrollBehavior = {
      htmlScrollBehavior: window.getComputedStyle(document.documentElement).scrollBehavior,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
      hasLenis: typeof window.Lenis !== 'undefined',
      hasLocomotiveScroll: typeof window.LocomotiveScroll !== 'undefined',
      lenisDataAttr: !!document.querySelector('[data-lenis-prevent], [data-lenis-wrapper]'),
      scrollContainers: [...document.querySelectorAll('[data-scroll-container]')]
        .map(el => ({ tag: el.tagName.toLowerCase(), id: el.id })).slice(0, 5),
    };

    // ── 1k. Parallax-like elements ────────────────────────────────────────────
    const parallaxElements = [];
    const parallaxSels = [
      '[data-parallax]', '[data-speed]', '[data-scroll-speed]',
      '[data-rellax-speed]', '.parallax', '[data-depth]',
    ];
    parallaxSels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        parallaxElements.push({
          sel,
          speed: el.getAttribute('data-speed') || el.getAttribute('data-rellax-speed') || el.getAttribute('data-scroll-speed'),
          tag: el.tagName.toLowerCase(),
          classes: [...el.classList].join(' ').slice(0, 60),
        });
      });
    });

    // ── 1l. Split text / text reveal patterns ─────────────────────────────────
    const textRevealEls = [];
    const textSels = [
      '[data-split]', '[data-split-text]', '[data-split-reveal]',
      '.split-line', '.split-word', '.split-char',
      '[data-text-reveal]', '.reveal-text',
    ];
    textSels.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        textRevealEls.push({
          sel,
          tag: el.tagName.toLowerCase(),
          classes: [...el.classList].join(' ').slice(0, 60),
          text: el.textContent?.trim().slice(0, 120),
        });
      });
    });

    // ── 1m. Section-level animation metadata ─────────────────────────────────
    const sectionAnimMeta = [];
    document.querySelectorAll('section, [data-animate], [data-animation]').forEach(el => {
      const allDataAttrs = {};
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-')) {
          allDataAttrs[attr.name] = attr.value;
        }
      }
      if (Object.keys(allDataAttrs).length > 0) {
        const cs = window.getComputedStyle(el);
        sectionAnimMeta.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: [...el.classList].slice(0, 8).join(' '),
          dataAttrs: allDataAttrs,
          computedTransform: cs.transform !== 'none' ? cs.transform : null,
          computedOpacity: cs.opacity,
        });
      }
    });

    return {
      detectedLibraries: libs,
      keyframes,
      cssAnimationRules: cssAnimationRules.slice(0, 200),
      animatedElements: animatedElements.slice(0, 150),
      scrollElements,
      webflowIX2: webflowIX2Data,
      gsapScrollTriggers,
      gsapTweens,
      animationCSSVars: animVars,
      scrollBehavior,
      parallaxElements,
      textRevealElements: textRevealEls,
      sectionAnimationMetadata: sectionAnimMeta,
    };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Scroll-state screenshots (capture visual states at multiple scroll positions)
  // ─────────────────────────────────────────────────────────────────────────────
  onProgress('📸 Capturing scroll-state screenshots (0% to 100%, every 10%)...');

  const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  const scrollPositions = [
    { name: 'scroll_0pct',  fraction: 0 },
    { name: 'scroll_10pct', fraction: 0.10 },
    { name: 'scroll_20pct', fraction: 0.20 },
    { name: 'scroll_30pct', fraction: 0.30 },
    { name: 'scroll_40pct', fraction: 0.40 },
    { name: 'scroll_50pct', fraction: 0.50 },
    { name: 'scroll_60pct', fraction: 0.60 },
    { name: 'scroll_70pct', fraction: 0.70 },
    { name: 'scroll_80pct', fraction: 0.80 },
    { name: 'scroll_90pct', fraction: 0.90 },
    { name: 'scroll_100pct', fraction: 1.00 },
  ];

  const scrollScreenshots = [];
  for (const pos of scrollPositions) {
    const scrollY = Math.round(pos.fraction * (scrollHeight - viewportHeight));
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(600); // wait for scroll-triggered animations to settle
    const screenshotPath = path.join(bundleDir, `${pos.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' });
    scrollScreenshots.push({
      name: pos.name,
      file: `${pos.name}.png`,
      scrollY,
      fraction: pos.fraction,
    });
  }

  // Reset scroll back to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Element state at different scroll positions (transform/opacity snapshots)
  // ─────────────────────────────────────────────────────────────────────────────
  onProgress('📐 Snapshotting element visual states at scroll positions...');

  const elementScrollStates = [];
  // Key selectors to track across scroll positions
  const trackSelectors = [
    'h1', 'h2', '.hero', 'section:first-of-type',
    '[data-animate]', '[data-scroll]', '[data-gsap]',
    'img', 'video', 'canvas',
  ];

  for (const pos of scrollPositions) {
    const scrollY = Math.round(pos.fraction * (scrollHeight - viewportHeight));
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(500);

    const states = await page.evaluate((sels) => {
      const results = [];
      sels.forEach(sel => {
        const els = document.querySelectorAll(sel);
        [...els].slice(0, 3).forEach(el => {
          const cs = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          results.push({
            selector: sel,
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            classes: [...el.classList].slice(0, 4).join(' '),
            scrollY: window.scrollY,
            rect: {
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              inViewport: rect.top < window.innerHeight && rect.bottom > 0,
            },
            computed: {
              transform: cs.transform,
              opacity: cs.opacity,
              visibility: cs.visibility,
              clipPath: cs.clipPath !== 'none' ? cs.clipPath : null,
              filter: cs.filter !== 'none' ? cs.filter : null,
              scale: cs.scale !== 'none' ? cs.scale : null,
              translate: cs.translate !== 'none' ? cs.translate : null,
            },
          });
        });
      });
      return results;
    }, trackSelectors);

    elementScrollStates.push({ scrollFraction: pos.fraction, scrollY, states });
  }

  // Reset back to top
  await page.evaluate(() => window.scrollTo(0, 0));

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Extract Webflow IX2 JSON from embedded script tag (most complete source)
  // ─────────────────────────────────────────────────────────────────────────────
  onProgress('📜 Extracting Webflow IX2 / embedded animation JSON data...');

  const embeddedAnimJSON = await page.evaluate(() => {
    const results = {};

    // Webflow stores page-level interaction data in various JSON script tags
    const jsonScripts = document.querySelectorAll('script[type="application/json"], script[id*="ix"], script[id*="wf"]');
    jsonScripts.forEach(s => {
      try {
        const parsed = JSON.parse(s.textContent);
        // Grab anything that looks animation-related
        const hasAnimKeys = JSON.stringify(parsed).match(/interaction|animation|trigger|tween|timeline/i);
        if (hasAnimKeys) {
          results[s.id || 'json-' + Math.random().toString(36).slice(2)] = parsed;
        }
      } catch (_) {}
    });

    // Webflow IX2 specific: window.__wf_reserved_ix2 or Webflow.push
    try {
      if (window.__wf_reserved_ix2) {
        results['__wf_reserved_ix2'] = window.__wf_reserved_ix2;
      }
    } catch (_) {}

    // AOS config
    try {
      if (window.AOS && window.AOS._options) {
        results['aos_config'] = window.AOS._options;
      }
    } catch (_) {}

    // Lenis config
    try {
      if (window.lenis && window.lenis.options) {
        results['lenis_config'] = window.lenis.options;
      }
    } catch (_) {}

    return results;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Save animations.json
  // ─────────────────────────────────────────────────────────────────────────────
  const output = {
    harvestedAt: new Date().toISOString(),

    // What animation libraries/frameworks are active on this site
    detectedLibraries: animationData.detectedLibraries,

    // Scroll behavior configuration
    scrollBehavior: animationData.scrollBehavior,

    // All CSS @keyframes defined on the page
    cssKeyframes: animationData.keyframes,

    // CSS rules that have animation/transition/transform
    cssAnimationRules: animationData.cssAnimationRules,

    // Specific DOM elements that have computed animations
    animatedDOMElements: animationData.animatedElements,

    // Elements with scroll-trigger data attributes
    scrollTriggerElements: animationData.scrollElements,

    // Parallax elements
    parallaxElements: animationData.parallaxElements,

    // Text reveal / split-text elements
    textRevealElements: animationData.textRevealElements,

    // Section-level animation metadata
    sectionAnimationMetadata: animationData.sectionAnimationMetadata,

    // GSAP ScrollTrigger runtime instances
    gsapScrollTriggers: animationData.gsapScrollTriggers,

    // GSAP tween/timeline configs
    gsapTweens: animationData.gsapTweens,

    // Webflow IX2 and embedded animation JSON
    webflowIX2: animationData.webflowIX2,
    embeddedAnimJSON,

    // CSS animation variable declarations
    animationCSSVars: animationData.animationCSSVars,

    // Screenshots of page at different scroll percentages
    scrollScreenshots,

    // Visual element states captured at each scroll position
    elementScrollStates,

    // Summary stats
    summary: {
      librariesDetected: Object.keys(animationData.detectedLibraries)
        .filter(k => animationData.detectedLibraries[k]),
      keyframeCount: animationData.keyframes.length,
      animatedElementCount: animationData.animatedElements.length,
      scrollTriggerCount: animationData.scrollElements.length,
      gsapScrollTriggerCount: animationData.gsapScrollTriggers.length,
      parallaxElementCount: animationData.parallaxElements.length,
      textRevealCount: animationData.textRevealElements.length,
      scrollScreenshotFiles: scrollScreenshots.map(s => s.file),
    },
  };

  fs.writeFileSync(
    path.join(bundleDir, 'animations.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );

  onProgress(
    `✅ Animation harvest complete — ` +
    `${output.summary.keyframeCount} keyframes, ` +
    `${output.summary.animatedElementCount} animated elements, ` +
    `${output.summary.scrollTriggerCount} scroll triggers, ` +
    `${output.summary.librariesDetected.join(', ') || 'no libs detected'}`
  );

  return output.summary;
}

module.exports = { harvestAnimations };
