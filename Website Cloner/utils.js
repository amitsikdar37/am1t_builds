// utils.js — Helper utilities for the Website Cloner pipeline


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

module.exports = { formatSize, urlToSlug, generateSessionId };
