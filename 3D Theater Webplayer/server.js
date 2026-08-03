const express = require('express');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const path = require('path');
const fs = require('fs');

// Configure ffmpeg to use the local static binaries
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
app.use(cors());

// Serve the frontend static files
app.use(express.static(path.join(__dirname, '')));

// Create the movies directory if it doesn't exist
const MOVIES_DIR = path.join(__dirname, 'movies');
const THUMBNAILS_DIR = path.join(__dirname, 'thumbnails');

if (!fs.existsSync(MOVIES_DIR)) {
  fs.mkdirSync(MOVIES_DIR);
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR);
}

// 1. Get Library (List all movies in the movies directory)
app.get('/api/movies', (req, res) => {
  fs.readdir(MOVIES_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to read movies directory' });
    const movies = files.filter(f => /\.(mp4|mkv|webm|mov|m4v|ogv)$/i.test(f));
    res.json(movies);
  });
});

// 2. Get Metadata (List all Audio and Subtitle tracks)
app.get('/api/metadata/:filename', (req, res) => {
  const file = path.join(MOVIES_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
  
  ffmpeg.ffprobe(file, (err, metadata) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to probe file' });
    }
    
    const audioTracks = [];
    const subtitleTracks = [];
    
    metadata.streams.forEach(stream => {
      if (stream.codec_type === 'audio') {
        audioTracks.push({
          index: stream.index,
          language: stream.tags?.language || stream.tags?.LANGUAGE || 'Unknown',
          title: stream.tags?.title || stream.tags?.TITLE || `Audio Track ${audioTracks.length + 1}`,
          codec: stream.codec_name,
          channels: stream.channels
        });
      } else if (stream.codec_type === 'subtitle') {
        subtitleTracks.push({
          index: stream.index,
          language: stream.tags?.language || stream.tags?.LANGUAGE || 'Unknown',
          title: stream.tags?.title || stream.tags?.TITLE || `Subtitle Track ${subtitleTracks.length + 1}`,
          codec: stream.codec_name
        });
      }
    });
    
    res.json({ audioTracks, subtitleTracks });
  });
});

// 3. Stream Video
app.get('/stream/:filename', (req, res) => {
  const file = path.join(MOVIES_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send('Not Found');

  const stat = fs.statSync(file);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const fileStream = fs.createReadStream(file, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': req.params.filename.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
    };
    res.writeHead(206, head);
    fileStream.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': req.params.filename.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(file).pipe(res);
  }
});

// 4. Extract Subtitles as WebVTT on the fly
app.get('/subtitles/:filename/:trackIndex', (req, res) => {
  const file = path.join(MOVIES_DIR, req.params.filename);
  const trackIndex = parseInt(req.params.trackIndex);
  
  if (!fs.existsSync(file)) return res.status(404).send('Not Found');
  
  // Set headers for WebVTT
  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  // Allow caching so we don't re-extract every time
  res.setHeader('Cache-Control', 'public, max-age=3600'); 
  
  // Use FFmpeg to extract the specific subtitle track, format as webvtt, and pipe to the HTTP response
  const command = ffmpeg(file)
    .outputOptions([
      `-map 0:${trackIndex}`,
      '-f webvtt'
    ])
    .on('error', (err) => {
      // Expected on client disconnect
    });
    
  command.pipe(res, { end: true });
  
  req.on('close', () => {
    command.kill('SIGKILL');
  });
});

// 5. Extract Audio Track on the fly (Live Transcode to WebM Opus)
app.get('/audio/:filename/:trackIndex', (req, res) => {
  const file = path.join(MOVIES_DIR, req.params.filename);
  const trackIndex = parseInt(req.params.trackIndex);
  const start = parseFloat(req.query.start) || 0;
  
  if (!fs.existsSync(file)) return res.status(404).send('Not Found');
  
  res.setHeader('Content-Type', 'audio/webm');
  
  // Use FFmpeg to instantly transcode the specific audio track to WebM Opus
  // This preserves 5.1 surround sound channels!
  const command = ffmpeg(file)
    .setStartTime(start)
    .outputOptions([
      `-map 0:${trackIndex}`,
      '-c:a libopus',
      '-b:a 320k',
      '-ac 6',
      '-f webm'
    ])
    .on('error', (err) => {
      // Expected when the browser disconnects due to seeking
    });
    
  command.pipe(res);
  
  // CRITICAL FIX: Explicitly kill the FFmpeg process if the browser aborts the request (e.g. during seeking).
  // Without this, orphaned FFmpeg processes will run infinitely in the background and choke the server!
  req.on('close', () => {
    command.kill('SIGKILL');
  });
});

// 6. Generate and Serve Movie Thumbnail
app.get('/thumbnail/:filename', (req, res) => {
  const file = path.join(MOVIES_DIR, req.params.filename);
  if (!fs.existsSync(file)) return res.status(404).send('Not Found');

  const thumbName = `${req.params.filename}.jpg`;
  const thumbPath = path.join(THUMBNAILS_DIR, thumbName);

  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }

  // Extract a thumbnail using FFmpeg at the 10-minute mark (or 10% if short)
  ffmpeg(file)
    .screenshots({
      timestamps: ['00:10:00.000'],
      filename: thumbName,
      folder: THUMBNAILS_DIR,
      size: '320x180'
    })
    .on('end', () => {
      if (fs.existsSync(thumbPath)) {
        res.sendFile(thumbPath);
      } else {
        res.status(500).send('Error generating thumbnail');
      }
    })
    .on('error', (err) => {
      console.error('Thumbnail error:', err.message);
      if (!res.headersSent) res.status(500).send('Error generating thumbnail');
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(`🍿 IMAX Media Server is running!`);
  console.log(`🎬 Open http://localhost:${PORT} in your browser`);
  console.log(`📁 Place your videos in: ${MOVIES_DIR}`);
  console.log(`===========================================`);
});
