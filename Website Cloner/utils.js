// utils.js — Helper utilities for the Website Cloner pipeline

/**
 * Converts an rgb/rgba color string to a hex string.
 * @param {string} rgbStr e.g. "rgb(255, 99, 71)" or "rgba(255, 99, 71, 0.5)"
 * @returns {string} hex color e.g. "#ff6347"
 */
function rgbToHex(rgbStr) {
  if (!rgbStr || rgbStr === 'transparent') return null;
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Deduplicates and ranks colors by luminance difference (most distinct colors first).
 * @param {string[]} colors array of rgb/rgba strings
 * @returns {string[]} array of hex strings, top 12
 */
function extractPalette(colors) {
  const hexSet = new Set();
  const hexList = [];

  for (const c of colors) {
    const hex = rgbToHex(c);
    if (hex && hex !== '#000000' && hex !== '#ffffff' && !hexSet.has(hex)) {
      hexSet.add(hex);
      hexList.push(hex);
    }
  }

  return hexList.slice(0, 12);
}

/**
 * Truncates a string to a max length, appending "..." if cut.
 */
function truncate(str, maxLen = 2000) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '\n... [truncated]';
}

/**
 * Formats file size in human-readable form.
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Sanitizes a URL to a safe directory name.
 */
function urlToSlug(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]/gi, '_')
    .slice(0, 60);
}

/**
 * Generates a unique session ID.
 */
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

module.exports = { rgbToHex, extractPalette, truncate, formatSize, urlToSlug, generateSessionId };
