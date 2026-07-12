// server.js — Express backend for the Website Cloner
// Orchestrates Phase 1 (Playwright scraper) and streams progress via SSE.
// Phase 2 (clone generation) is handled by Antigravity AI reading the bundle.

const express = require('express');
const path = require('path');
const fs = require('fs');
const { harvestSite } = require('./phase1_harvest');
const { generateSessionId, urlToSlug, formatSize } = require('./utils');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve generated output files
app.use('/output', express.static(path.join(__dirname, 'output')));
// Serve bundle screenshots
app.use('/bundle', express.static(path.join(__dirname, 'harvested_bundle')));

// ── In-memory SSE client registry ────────────────────────────────────────────
const sseClients = new Map(); // sessionId → res

function sendEvent(sessionId, data) {
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// ── SSE Endpoint ──────────────────────────────────────────────────────────────
app.get('/api/progress/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send heartbeat immediately
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  sseClients.set(sessionId, res);

  req.on('close', () => {
    sseClients.delete(sessionId);
  });
});

// ── Clone Trigger Endpoint ────────────────────────────────────────────────────
app.post('/api/clone', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'A valid URL is required.' });
  }

  // Normalise URL
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  const sessionId = generateSessionId();
  const slug = urlToSlug(targetUrl);
  const bundleDir = path.join(__dirname, 'harvested_bundle', `${slug}_${sessionId}`);

  // Respond immediately with the session ID so the frontend can subscribe to SSE
  res.json({ status: 'started', sessionId, bundleId: `${slug}_${sessionId}` });

  // Run Phase 1 asynchronously
  setImmediate(async () => {
    try {
      sendEvent(sessionId, {
        type: 'phase',
        phase: 1,
        message: `Starting Phase 1 for: ${targetUrl}`,
      });

      const summary = await harvestSite(targetUrl, bundleDir, (msg) => {
        sendEvent(sessionId, { type: 'progress', phase: 1, message: msg });
      });

      sendEvent(sessionId, {
        type: 'phase1_complete',
        phase: 1,
        message: '✅ Clone ready!',
        summary,
        bundleId: `${slug}_${sessionId}`,
        screenshotUrl: `/bundle/${slug}_${sessionId}/screenshot.png`,
      });

    } catch (err) {
      console.error('[Phase 1 Error]', err);
      sendEvent(sessionId, {
        type: 'error',
        phase: 1,
        message: `❌ Phase 1 failed: ${err.message}`,
      });
    }
  });
});

// ── Bundle Info Endpoint ──────────────────────────────────────────────────────
app.get('/api/bundle/:bundleId', (req, res) => {
  const { bundleId } = req.params;
  const bundleDir = path.join(__dirname, 'harvested_bundle', bundleId);

  if (!fs.existsSync(bundleDir)) {
    return res.status(404).json({ error: 'Bundle not found.' });
  }

  const files = fs.readdirSync(bundleDir).map((f) => {
    const stat = fs.statSync(path.join(bundleDir, f));
    return { name: f, size: formatSize(stat.size), sizeBytes: stat.size };
  });

  const summaryPath = path.join(bundleDir, 'summary.json');
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
    : null;

  res.json({ bundleId, files, summary });
});


// ── Check if clone output exists for a bundle ─────────────────────────────────
app.get('/api/output/:bundleId/check', (req, res) => {
  const { bundleId } = req.params;
  // Phase 1 now auto-saves output/<bundleId>/index.html at the end of harvest
  const outputPath = path.join(__dirname, 'output', bundleId, 'index.html');

  if (!fs.existsSync(outputPath)) {
    return res.json({ exists: false });
  }

  const stat = fs.statSync(outputPath);
  res.json({
    exists: true,
    url: `/output/${bundleId}/index.html`,
    previewUrl: `http://localhost:${PORT || 3000}/output/${bundleId}/index.html`,
    sizeBytes: stat.size,
    size: formatSize(stat.size),
    generatedAt: stat.mtime.toISOString(),
  });
});

// ── List all past bundles ─────────────────────────────────────────────────────
app.get('/api/bundles', (req, res) => {
  const bundleRoot = path.join(__dirname, 'harvested_bundle');
  if (!fs.existsSync(bundleRoot)) return res.json({ bundles: [] });

  const dirs = fs.readdirSync(bundleRoot).filter((f) => {
    return fs.statSync(path.join(bundleRoot, f)).isDirectory();
  });

  const bundles = dirs.map((dir) => {
    const summaryPath = path.join(bundleRoot, dir, 'summary.json');
    const summary = fs.existsSync(summaryPath)
      ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
      : null;
    return { bundleId: dir, summary };
  });

  res.json({ bundles });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌐 Website Cloner server running at http://localhost:${PORT}\n`);
  console.log(`   Phase 1: Automated (Playwright)\n   Phase 2: Handled by Antigravity AI\n`);
});
