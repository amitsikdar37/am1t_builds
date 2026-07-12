import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import generateRouter from './routes/generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (one level up from server/)
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware — accept any localhost port so Vite port-hopping still works
app.use(cors({
  origin: (origin, callback) => {
    // Allow any localhost origin (handles Vite using 5173, 5174, 5175, etc.)
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Large body limit for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api', generateRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', engine: 'agy-local-cli' });
});

const server = app.listen(PORT, () => {
  console.log('');
  console.log('  🚀 \x1b[36mSketch → Website Server\x1b[0m');
  console.log(`  🌐 Running at: \x1b[4mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  🤖 Engine:     \x1b[33mLocal Antigravity (agy) CLI\x1b[0m`);
  console.log('');
});

// Graceful port-in-use error — prevents nodemon crash loops
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ❌ \x1b[31mPort ${PORT} is already in use!\x1b[0m`);
    console.error(`  Run this to fix it: \x1b[33mnpx kill-port ${PORT}\x1b[0m\n`);
    process.exit(0); // exit 0 so nodemon doesn't restart
  } else {
    throw err;
  }
});
