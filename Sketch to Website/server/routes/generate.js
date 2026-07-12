import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const router = express.Router();
const jobs = new Map();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, '../temp');

// Helper to recursively read directory into flat object { "src/App.jsx": "content" }
async function readDirRecursive(dir, baseDir = dir, filesObj = {}) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/'); // normalize for Windows
    if (entry.isDirectory()) {
      await readDirRecursive(fullPath, baseDir, filesObj);
    } else {
      filesObj[relPath] = await fs.readFile(fullPath, 'utf-8');
    }
  }
  return filesObj;
}

// ─────────────────────────────────────────────────────────
// POST /api/generate  —  Start a new generation job
// ─────────────────────────────────────────────────────────
router.post('/generate', async (req, res) => {
  const { image, mimeType } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'No image data provided.' });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Ensure temp dir exists
  await fs.mkdir(TEMP_DIR, { recursive: true });

  jobs.set(jobId, {
    status: 'pending',
    events: [],
    listeners: [],
    result: null,
    error: null
  });

  processJob(jobId, image);
  res.json({ jobId });
});

// ─────────────────────────────────────────────────────────
// GET /api/generate/:id/progress  —  SSE stream
// ─────────────────────────────────────────────────────────
router.get('/generate/:id/progress', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);

  job.events.forEach(evt => res.write(`data: ${JSON.stringify(evt)}\n\n`));

  if (job.status === 'complete' || job.status === 'error') {
    clearInterval(heartbeat);
    return res.end();
  }

  job.listeners.push(res);
  req.on('close', () => {
    clearInterval(heartbeat);
    job.listeners = job.listeners.filter(l => l !== res);
  });
});

// ─────────────────────────────────────────────────────────
// Background job processor (using local agy CLI)
// ─────────────────────────────────────────────────────────
async function processJob(jobId, base64Image) {
  const job = jobs.get(jobId);

  const emit = (event) => {
    job.events.push(event);
    job.listeners.forEach(res => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (_) {}
    });
  };

  const closeListeners = () => {
    job.listeners.forEach(res => { try { res.end(); } catch (_) {} });
    job.listeners = [];
    setTimeout(() => jobs.delete(jobId), 10 * 60 * 1000);
  };

  const sketchPath = path.join(TEMP_DIR, `sketch_${jobId}.png`);
  const outputDir = path.join(TEMP_DIR, `output_${jobId}`);

  try {
    // 1. Save Image
    emit({ type: 'progress', step: 'analyzing', message: 'Saving sketch & waking up local Agent...' });
    const buffer = Buffer.from(base64Image, 'base64');
    await fs.writeFile(sketchPath, buffer);

    // 2. Spawn agy CLI
    emit({ type: 'progress', step: 'generating', message: 'Agent is building your site locally (Check terminal for progress)...' });
    
    // Normalize paths for execution
    const normalizedSketch = sketchPath.replace(/\\/g, '/');
    const normalizedOut = outputDir.replace(/\\/g, '/');

    const prompt = `CRITICAL TASK: You are an autonomous code generator. Do not analyze the workspace. Do not write markdown reports. Your ONLY task is to look at the sketch image at ${normalizedSketch} and generate a Vite React website. Output ALL files EXACTLY into the directory ${normalizedOut}. DO NOT write them anywhere else. Include preview.html at the root. You must create the actual files on disk. Do NOT ask for confirmation. Execute immediately. WARNING: You are in a headless environment. DO NOT run Invoke-WebRequest or any powershell commands that may trigger interactive security prompts.`;
    
    console.log(`\n[${jobId}] ─────────────────────────────────────────────────────────────`);
    console.log(`[${jobId}] Spawning local agent: agy`);
    console.log(`[${jobId}] ─────────────────────────────────────────────────────────────\n`);

    await new Promise((resolve, reject) => {
      const agyProcess = spawn('agy', [
        '--dangerously-skip-permissions', 
        '--new-project',
        '--print-timeout', '10m',
        '--print', prompt
      ], {
        cwd: TEMP_DIR,
        shell: true
      });

      agyProcess.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      agyProcess.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      agyProcess.on('close', (code) => {
        console.log(`\n[${jobId}] ─────────────────────────────────────────────────────────────`);
        if (code !== 0) {
          console.error(`[${jobId}] Agent exited with error code ${code}`);
          reject(new Error(`Agent failed to execute. Exit code: ${code}`));
        } else {
          console.log(`[${jobId}] Agent completed successfully.`);
          resolve();
        }
      });
    });

    // 3. Read Output Files
    emit({ type: 'progress', step: 'parsing', message: 'Packaging generated files...' });
    const files = await readDirRecursive(outputDir);
    const fileCount = Object.keys(files).length;
    
    if (fileCount === 0) {
      throw new Error("Agent finished but no files were found in the output directory.");
    }

    // Dummy layout since we don't have Phase 1 layout JSON anymore
    const layout = { pageType: "Generated Site", pageTitle: "Sketch Output" };

    // 4. Complete
    job.status = 'complete';
    job.result = { layout, files };
    emit({ type: 'complete', layout, files, fileCount });
    closeListeners();

  } catch (error) {
    console.error(`[${jobId}] Error:`, error.message);
    job.status = 'error';
    emit({ type: 'error', message: error.message });
    closeListeners();
  } finally {
    // Cleanup Temp Files
    try {
      await fs.unlink(sketchPath).catch(() => {});
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
    } catch (e) {
      console.error(`[${jobId}] Cleanup error:`, e.message);
    }
  }
}

export default router;
