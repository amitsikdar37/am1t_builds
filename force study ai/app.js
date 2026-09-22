/**
 * Force Study AI - Fullscreen Cyber Study Monitor
 * Complete In-Browser AI Vision, User Tracking Reticle & Non-Repeating Meme Scolder
 */

// --- Global State ---
const STATE = {
  isSessionActive: false,
  detectionMode: 'touch', // 'touch' (hand touches phone) or 'any' (any phone in sight)
  phoneConfidenceThreshold: 0.55,
  personConfidenceThreshold: 0.45,
  volume: 1.0,
  isMirrored: true,
  isFullscreen: false,

  // Audio Scolding State Machine: 'IDLE' | 'PLAYING' | 'WAIT_RELEASE'
  scoldState: 'IDLE',
  releaseCounter: 0,
  distractionCount: 0,

  // Non-Repeating Audio Queue
  allVoices: [],
  unplayedQueue: [],
  lastPlayedVoice: null,
  playedInCycle: new Set(),

  // Vision Models
  cocoModel: null,
  handsModel: null,
  lastHandLandmarks: [],

  // Smoothed User Tracking Square (Cyber Reticle)
  userTracker: {
    currentX: 0,
    currentY: 0,
    currentSize: 0,
    targetX: 0,
    targetY: 0,
    targetSize: 0,
    active: false,
    alpha: 0
  },

  // Video & Stream
  stream: null,
  videoWidth: 1280,
  videoHeight: 720,

  // Timer & FPS
  timerSeconds: 0,
  timerInterval: null,
  lastFrameTime: performance.now(),
  fps: 0,
  fpsUpdateTimer: 0
};

// Fallback voices in case API is unavailable
const FALLBACK_VOICES = [
  {
    filename: "Abe Padhai Likhai me Dhyan Do, IAS YAS Bno - Munna bhaiya - Memes World (128k).mp3",
    url: "/voices/Abe%20Padhai%20Likhai%20me%20Dhyan%20Do%2C%20IAS%20YAS%20Bno%20-%20Munna%20bhaiya%20-%20Memes%20World%20%28128k%29.mp3",
    title: "Abe Padhai Likhai me Dhyan Do, IAS YAS Bno (Munna Bhaiya)"
  },
  {
    filename: "bade harami ho beta meme video - meme hub (128k).mp3",
    url: "/voices/bade%20harami%20ho%20beta%20meme%20video%20-%20meme%20hub%20%28128k%29.mp3",
    title: "Bade harami ho beta"
  },
  {
    filename: "Kyu nhi ho rahi padhai.mp3",
    url: "/voices/Kyu%20nhi%20ho%20rahi%20padhai.mp3",
    title: "Kyu nhi ho rahi padhai (Alakh Pandey)"
  },
  {
    filename: "Tum ek kaam karo IAS ki taiyaari chhod do .mp3",
    url: "/voices/Tum%20ek%20kaam%20karo%20IAS%20ki%20taiyaari%20chhod%20do%20.mp3",
    title: "Tum ek kaam karo IAS ki taiyaari chhod do (Vikas Sir)"
  }
];

// Audio Player Instance
const audioPlayer = new Audio();
audioPlayer.preload = 'auto';

// DOM Elements Cache
const DOM = {
  video: document.getElementById('webcam'),
  canvas: document.getElementById('outputCanvas'),
  ctx: document.getElementById('outputCanvas').getContext('2d'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  heroStartBtn: document.getElementById('heroStartBtn'),
  toggleSessionBtn: document.getElementById('toggleSessionBtn'),
  btnIcon: document.getElementById('btnIcon'),
  btnText: document.getElementById('btnText'),
  mirrorToggleBtn: document.getElementById('mirrorToggleBtn'),
  fullscreenToggleBtn: document.getElementById('fullscreenToggleBtn'),
  openDrawerBtn: document.getElementById('openDrawerBtn'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  metadataDrawer: document.getElementById('metadataDrawer'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  fpsCounter: document.getElementById('fpsCounter'),
  modelStatus: document.getElementById('modelStatus'),
  statusBadge: document.getElementById('statusBadge'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  alarmOverlay: document.getElementById('alarmOverlay'),
  scoldBanner: document.getElementById('scoldBanner'),
  scoldMessage: document.getElementById('scoldMessage'),
  studyTimerDisplay: document.getElementById('studyTimerDisplay'),
  drawerTimerDisplay: document.getElementById('drawerTimerDisplay'),
  distractionCount: document.getElementById('distractionCount'),
  drawerSlackingDisplay: document.getElementById('drawerSlackingDisplay'),
  phoneStatusText: document.getElementById('phoneStatusText'),
  touchStatusText: document.getElementById('touchStatusText'),
  voiceList: document.getElementById('voiceList'),
  voiceCountBadge: document.getElementById('voiceCountBadge'),
  currentSoundDisplay: document.getElementById('currentSoundDisplay'),
  quickScoldIndicator: document.getElementById('quickScoldIndicator'),
  simulateTouchBtn: document.getElementById('simulateTouchBtn'),
  modeTouchBtn: document.getElementById('modeTouch'),
  modeAnyBtn: document.getElementById('modeAny'),
  modeHint: document.getElementById('modeHint'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeVal: document.getElementById('volumeVal'),
  confSlider: document.getElementById('confSlider'),
  confVal: document.getElementById('confVal'),
  cameraSelect: document.getElementById('cameraSelect')
};

// --- Initialization ---
async function init() {
  setupEventListeners();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  await loadVoices();
  setupAudioEvents();
  await enumerateCameras();
  await loadModels();
}

function resizeCanvas() {
  DOM.canvas.width = window.innerWidth;
  DOM.canvas.height = window.innerHeight;
}

// --- Coordinate Space Mapping (Object-Cover Math) ---
function getCoverTransform() {
  const cw = DOM.canvas.width;
  const ch = DOM.canvas.height;
  const vw = STATE.videoWidth || 1280;
  const vh = STATE.videoHeight || 720;

  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;

  return { scale, offsetX, offsetY };
}

function videoBoxToScreen(box) {
  const [vx, vy, vw, vh] = box;
  const { scale, offsetX, offsetY } = getCoverTransform();

  return {
    x: vx * scale + offsetX,
    y: vy * scale + offsetY,
    w: vw * scale,
    h: vh * scale
  };
}

// --- Voice Discovery & Non-Repeating Queue ---
async function loadVoices() {
  try {
    const res = await fetch('/api/voices');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.voices && data.voices.length > 0) {
      STATE.allVoices = data.voices;
    } else {
      STATE.allVoices = FALLBACK_VOICES;
    }
  } catch (err) {
    console.warn('Using fallback voice list:', err);
    STATE.allVoices = FALLBACK_VOICES;
  }

  DOM.voiceCountBadge.innerText = `${STATE.allVoices.length} sounds`;
  renderVoiceListUI();
}

function renderVoiceListUI() {
  DOM.voiceList.innerHTML = '';
  STATE.allVoices.forEach((voice, index) => {
    const isPlayed = STATE.playedInCycle.has(voice.filename);
    const isCurrent = STATE.lastPlayedVoice && STATE.lastPlayedVoice.filename === voice.filename && STATE.scoldState === 'PLAYING';

    const div = document.createElement('div');
    div.className = `voice-item p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
      isCurrent
        ? 'playing border-amber-500 bg-amber-500/15'
        : isPlayed
        ? 'played border-slate-800 bg-slate-950/40 text-slate-400'
        : 'border-slate-800 bg-slate-950/80 text-slate-200'
    }`;

    div.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden flex-1">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
          isPlayed ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/20 text-rose-300 font-mono'
        }">${index + 1}</span>
        <div class="truncate">
          <p class="font-medium truncate" title="${voice.title}">${voice.title}</p>
          <span class="text-[10px] text-slate-500">${isPlayed ? '✓ Played this cycle' : 'Queued'}</span>
        </div>
      </div>
      <button class="preview-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] border border-slate-700 flex items-center gap-1 transition" data-url="${voice.url}">
        <span>▶</span> Play
      </button>
    `;

    div.querySelector('.preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      previewSound(voice);
    });

    DOM.voiceList.appendChild(div);
  });
}

function previewSound(voice) {
  audioPlayer.src = voice.url;
  audioPlayer.volume = STATE.volume;
  audioPlayer.play().catch(e => console.error('Preview play error:', e));
  DOM.currentSoundDisplay.innerText = `Previewing: ${voice.title}`;
}

function getNextDistinctVoice() {
  if (STATE.allVoices.length === 0) return null;
  if (STATE.allVoices.length === 1) return STATE.allVoices[0];

  // Refill and Fisher-Yates shuffle if queue is exhausted
  if (STATE.unplayedQueue.length === 0) {
    const pool = [...STATE.allVoices];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Prevent immediate repetition across cycle boundary
    if (STATE.lastPlayedVoice && pool[0].filename === STATE.lastPlayedVoice.filename) {
      const temp = pool[0];
      pool[0] = pool[pool.length - 1];
      pool[pool.length - 1] = temp;
    }

    STATE.unplayedQueue = pool;
    STATE.playedInCycle.clear();
  }

  const selectedVoice = STATE.unplayedQueue.shift();
  STATE.lastPlayedVoice = selectedVoice;
  STATE.playedInCycle.add(selectedVoice.filename);

  renderVoiceListUI();
  return selectedVoice;
}

// --- Audio Player Events ---
function setupAudioEvents() {
  audioPlayer.addEventListener('ended', () => {
    console.log('[ForceStudyAI] Audio finished playing.');
    STATE.scoldState = 'WAIT_RELEASE';
    STATE.releaseCounter = 0;

    // Smoothly slide toast out and remove ambient glow
    DOM.scoldBanner.classList.add('-translate-y-20', 'opacity-0');
    DOM.alarmOverlay.classList.remove('scold-ambient-active', 'opacity-100');
    DOM.alarmOverlay.classList.add('opacity-0');

    updateSystemStatus('cooling_down', 'Put phone down to resume');
    DOM.currentSoundDisplay.innerText = `Finished: ${STATE.lastPlayedVoice?.title || ''}`;
    DOM.quickScoldIndicator.innerText = 'Put your phone away to resume';
    renderVoiceListUI();
  });

  audioPlayer.addEventListener('error', (e) => {
    console.error('[ForceStudyAI] Audio playback error:', e);
    STATE.scoldState = 'IDLE';
    DOM.alarmOverlay.classList.remove('scold-ambient-active', 'opacity-100');
    DOM.alarmOverlay.classList.add('opacity-0');
    updateSystemStatus('studying', 'Studying peacefully');
  });
}

// --- Trigger Scolding Action ---
function triggerMemeScold(sourceDesc = "Camera Detection") {
  if (STATE.scoldState === 'PLAYING') return;

  const voice = getNextDistinctVoice();
  if (!voice) return;

  STATE.scoldState = 'PLAYING';
  STATE.distractionCount++;
  
  DOM.distractionCount.innerText = STATE.distractionCount;
  DOM.drawerSlackingDisplay.innerText = `${STATE.distractionCount}`;

  // Smooth Cinematic Ambient Edge Vignette
  DOM.alarmOverlay.classList.remove('opacity-0');
  DOM.alarmOverlay.classList.add('scold-ambient-active', 'opacity-100');

  // Slide down sleek top HUD toast
  DOM.scoldMessage.innerText = `"${voice.title}"`;
  DOM.scoldBanner.classList.remove('-translate-y-20', 'opacity-0');

  // Status Displays
  updateSystemStatus('scolding', 'DISTRACTION INTERCEPTED');
  DOM.currentSoundDisplay.innerText = `Playing: ${voice.title}`;
  DOM.quickScoldIndicator.innerText = `Scolding: ${voice.title}`;

  // Play Audio
  audioPlayer.src = voice.url;
  audioPlayer.volume = STATE.volume;
  audioPlayer.play().catch(err => {
    console.warn('[ForceStudyAI] Autoplay prevented:', err);
  });

  renderVoiceListUI();
}

// --- AI Models Loading ---
async function loadModels() {
  DOM.modelStatus.innerText = 'AI: Loading Models...';

  try {
    if (window.cocoSsd) {
      STATE.cocoModel = await window.cocoSsd.load({ base: 'mobilenet_v2' });
      console.log('[ForceStudyAI] COCO-SSD loaded.');
    }

    if (window.Hands) {
      try {
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        hands.onResults(onHandResults);
        STATE.handsModel = hands;
        console.log('[ForceStudyAI] MediaPipe Hands initialized.');
      } catch (mpErr) {
        console.warn('[ForceStudyAI] MediaPipe Hands init warning:', mpErr);
      }
    }

    DOM.modelStatus.innerText = 'AI: Ready (Vision + Tracker)';
    DOM.modelStatus.classList.replace('text-slate-300', 'text-emerald-400');
  } catch (err) {
    console.error('[ForceStudyAI] Model loading error:', err);
    DOM.modelStatus.innerText = 'AI: Load Error';
    DOM.modelStatus.classList.replace('text-slate-300', 'text-rose-400');
  }
}

function onHandResults(results) {
  STATE.lastHandLandmarks = results.multiHandLandmarks || [];
}

// --- Camera & Video Handling ---
async function enumerateCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    DOM.cameraSelect.innerHTML = '';

    if (videoDevices.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = 'Default Camera';
      DOM.cameraSelect.appendChild(opt);
      return;
    }

    videoDevices.forEach((device, index) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.innerText = device.label || `Camera ${index + 1}`;
      DOM.cameraSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn('Camera enumeration error:', err);
  }
}

async function startCamera(deviceId = null) {
  if (STATE.stream) {
    STATE.stream.getTracks().forEach(t => t.stop());
  }

  const constraints = {
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' })
    },
    audio: false
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    STATE.stream = stream;
    DOM.video.srcObject = stream;

    await new Promise((resolve) => {
      DOM.video.onloadedmetadata = () => {
        STATE.videoWidth = DOM.video.videoWidth || 1280;
        STATE.videoHeight = DOM.video.videoHeight || 720;
        resizeCanvas();
        resolve();
      };
    });

    await DOM.video.play();
    DOM.cameraPlaceholder.classList.add('hidden');
    applyMirroring();
    return true;
  } catch (err) {
    console.error('[ForceStudyAI] Camera error:', err);
    alert('Unable to access camera. Please allow camera access.');
    return false;
  }
}

function stopCamera() {
  if (STATE.stream) {
    STATE.stream.getTracks().forEach(t => t.stop());
    STATE.stream = null;
  }
  DOM.video.srcObject = null;
  DOM.cameraPlaceholder.classList.remove('hidden');
  DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
  STATE.userTracker.active = false;
  STATE.userTracker.alpha = 0;
}

function applyMirroring() {
  if (STATE.isMirrored) {
    DOM.video.classList.add('mirrored');
    DOM.canvas.classList.add('mirrored');
  } else {
    DOM.video.classList.remove('mirrored');
    DOM.canvas.classList.remove('mirrored');
  }
}

// --- Session Lifecycle ---
async function startSession() {
  const cameraOk = await startCamera(DOM.cameraSelect.value);
  if (!cameraOk) return;

  STATE.isSessionActive = true;
  STATE.scoldState = 'IDLE';

  if (audioPlayer.paused) {
    audioPlayer.load();
  }

  DOM.btnIcon.innerText = '⏹';
  DOM.btnText.innerText = 'End Session';
  DOM.toggleSessionBtn.classList.replace('bg-rose-500', 'bg-slate-700');
  DOM.toggleSessionBtn.classList.replace('hover:bg-rose-600', 'hover:bg-slate-600');

  updateSystemStatus('studying', 'Studying peacefully 📚');
  DOM.quickScoldIndicator.innerText = 'Studying in progress...';

  // Timer
  STATE.timerSeconds = 0;
  clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(() => {
    STATE.timerSeconds++;
    const h = String(Math.floor(STATE.timerSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((STATE.timerSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(STATE.timerSeconds % 60).padStart(2, '0');
    const formatted = `${h}:${m}:${s}`;
    DOM.studyTimerDisplay.innerText = formatted;
    DOM.drawerTimerDisplay.innerText = formatted;
  }, 1000);

  requestAnimationFrame(detectionLoop);
}

function stopSession() {
  STATE.isSessionActive = false;
  stopCamera();
  clearInterval(STATE.timerInterval);

  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  STATE.scoldState = 'IDLE';

  DOM.alarmOverlay.classList.remove('opacity-100');
  DOM.alarmOverlay.classList.add('opacity-0');
  DOM.scoldBanner.classList.add('translate-y-36', 'opacity-0');
  document.body.classList.remove('shake-active');

  DOM.btnIcon.innerText = '▶';
  DOM.btnText.innerText = 'Start Session';
  DOM.toggleSessionBtn.classList.replace('bg-slate-700', 'bg-rose-500');
  DOM.toggleSessionBtn.classList.replace('hover:bg-slate-600', 'hover:bg-rose-600');

  updateSystemStatus('idle', 'System Idle');
  DOM.phoneStatusText.innerText = 'NO PHONE';
  DOM.touchStatusText.innerText = 'NO TOUCH';
  DOM.quickScoldIndicator.innerText = 'Session ended';
}

// --- Real-Time Vision & Detection Loop ---
async function detectionLoop(now) {
  if (!STATE.isSessionActive) return;

  // FPS
  const delta = now - STATE.lastFrameTime;
  STATE.lastFrameTime = now;
  STATE.fps = Math.round(1000 / (delta || 1));
  if (now - STATE.fpsUpdateTimer > 500) {
    DOM.fpsCounter.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span><span>FPS: ${STATE.fps}</span>`;
    STATE.fpsUpdateTimer = now;
  }

  // Clear Canvas
  DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

  let phoneDetected = false;
  let handTouchingPhone = false;
  let detectedPhoneBox = null;
  let primaryPersonBox = null;

  if (STATE.cocoModel && DOM.video.readyState >= 2) {
    try {
      const predictions = await STATE.cocoModel.detect(DOM.video);

      if (STATE.handsModel) {
        await STATE.handsModel.send({ image: DOM.video });
      }

      // 1. Find User (Person) for continuous tracking square
      let maxPersonArea = 0;
      for (const pred of predictions) {
        if (pred.class === 'person' && pred.score >= STATE.personConfidenceThreshold) {
          const area = pred.bbox[2] * pred.bbox[3];
          if (area > maxPersonArea) {
            maxPersonArea = area;
            primaryPersonBox = pred.bbox;
          }
        }
      }

      // 2. Find Smartphone
      for (const pred of predictions) {
        if (pred.class === 'cell phone' && pred.score >= STATE.phoneConfidenceThreshold) {
          phoneDetected = true;
          detectedPhoneBox = pred.bbox;
          handTouchingPhone = checkHandTouchingPhone(detectedPhoneBox);

          // Draw Phone Highlight
          drawPhoneBox(detectedPhoneBox, pred.score, handTouchingPhone);
        }
      }
    } catch (err) {
      console.warn('Vision detection frame error:', err);
    }
  }

  // Update & Draw Smoothed Cyber User Tracking Reticle
  updateAndDrawUserTracker(primaryPersonBox, handTouchingPhone || (phoneDetected && STATE.detectionMode === 'any'));

  // Update Status Displays
  DOM.phoneStatusText.innerText = phoneDetected ? '📱 PHONE VISIBLE' : 'NO PHONE';
  DOM.phoneStatusText.className = `text-xs font-bold font-mono mt-1 block truncate ${phoneDetected ? 'text-amber-400' : 'text-slate-400'}`;

  DOM.touchStatusText.innerText = handTouchingPhone ? '✋ TOUCH DETECTED!' : 'NO TOUCH';
  DOM.touchStatusText.className = `text-xs font-bold font-mono mt-1 block truncate ${handTouchingPhone ? 'text-rose-500 font-extrabold animate-pulse' : 'text-slate-400'}`;

  // Evaluate Scolding State Machine
  const isTriggerMet = (STATE.detectionMode === 'touch') ? handTouchingPhone : phoneDetected;
  handleScoldingStateMachine(isTriggerMet);

  requestAnimationFrame(detectionLoop);
}

// --- Check Hand Touching Phone ---
function checkHandTouchingPhone(phoneBox) {
  const [px, py, pw, ph] = phoneBox;
  const padding = 30; // Proximity threshold
  const minX = px - padding;
  const minY = py - padding;
  const maxX = px + pw + padding;
  const maxY = py + ph + padding;

  if (STATE.lastHandLandmarks && STATE.lastHandLandmarks.length > 0) {
    for (const hand of STATE.lastHandLandmarks) {
      for (const landmark of hand) {
        const lx = landmark.x * STATE.videoWidth;
        const ly = landmark.y * STATE.videoHeight;
        if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
          return true;
        }
      }
    }
  }

  // Fallback if MediaPipe Hands is unavailable
  if (!STATE.handsModel || STATE.lastHandLandmarks.length === 0) {
    return true;
  }

  return false;
}

// --- State Machine ---
function handleScoldingStateMachine(isTriggerConditionMet) {
  switch (STATE.scoldState) {
    case 'IDLE':
      if (isTriggerConditionMet) {
        triggerMemeScold("Real-Time Vision");
      }
      break;

    case 'PLAYING':
      // Meme is speaking; ignore re-triggers
      break;

    case 'WAIT_RELEASE':
      if (!isTriggerConditionMet) {
        STATE.releaseCounter++;
        if (STATE.releaseCounter > 40) { // ~1.3s of no touch
          STATE.scoldState = 'IDLE';
          STATE.releaseCounter = 0;
          updateSystemStatus('studying', 'Studying peacefully 📚');
          DOM.currentSoundDisplay.innerText = 'Ready for next trigger';
          DOM.quickScoldIndicator.innerText = 'Studying peacefully 📚';
        }
      } else {
        STATE.releaseCounter = 0;
        updateSystemStatus('warning', '⚠️ Put your phone down!');
      }
      break;
  }
}

/**
 * Precision Minimalist User Tracking Reticle
 * Apple Vision Pro / Futuristic Sensor Aesthetic:
 * - Ultra-fine 1.5px corner brackets with micro-dots
 * - Transparent interior (no muddy box fill)
 * - Micro-HUD telemetry tags (User ID, Attentive status, Focus score)
 * - Smooth kinematic motion dampening (lerp 0.14)
 */
function updateAndDrawUserTracker(personBox, isAlertActive) {
  const tracker = STATE.userTracker;

  if (personBox) {
    const screenBox = videoBoxToScreen(personBox);
    
    // Balanced upper-body frame
    const boxSize = Math.max(screenBox.w * 0.9, screenBox.h * 0.65);
    const centerX = screenBox.x + screenBox.w / 2;
    const centerY = screenBox.y + screenBox.h * 0.36;

    tracker.targetX = centerX - boxSize / 2;
    tracker.targetY = centerY - boxSize / 2;
    tracker.targetSize = boxSize;

    if (!tracker.active) {
      tracker.currentX = tracker.targetX;
      tracker.currentY = tracker.targetY;
      tracker.currentSize = tracker.targetSize;
      tracker.active = true;
    }

    // Smooth fluid motion interpolation
    const lerpSpeed = 0.14;
    tracker.currentX += (tracker.targetX - tracker.currentX) * lerpSpeed;
    tracker.currentY += (tracker.targetY - tracker.currentY) * lerpSpeed;
    tracker.currentSize += (tracker.targetSize - tracker.currentSize) * lerpSpeed;
    tracker.alpha = Math.min(1, tracker.alpha + 0.08);
  } else {
    tracker.alpha = Math.max(0, tracker.alpha - 0.04);
    if (tracker.alpha === 0) tracker.active = false;
  }

  if (tracker.alpha <= 0) return;

  const ctx = DOM.ctx;
  const x = tracker.currentX;
  const y = tracker.currentY;
  const size = tracker.currentSize;
  const bracketLen = Math.min(26, size * 0.15);

  ctx.save();
  ctx.globalAlpha = tracker.alpha;

  // Minimalist Color Palette: Ice Cyan for Focus, Coral Rose for Distraction
  const primaryColor = isAlertActive ? '#f43f5e' : '#38bdf8';
  const glowColor = isAlertActive ? 'rgba(244, 63, 94, 0.4)' : 'rgba(56, 189, 248, 0.3)';

  // 1. Subtle Faint Border (Very low opacity guide)
  ctx.lineWidth = 1;
  ctx.strokeStyle = isAlertActive ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.08)';
  ctx.setLineDash([4, 6]);
  ctx.strokeRect(x, y, size, size);
  ctx.setLineDash([]); // Reset dash

  // 2. High-Precision Corner Brackets
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = primaryColor;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Top-Left ┌
  ctx.beginPath();
  ctx.moveTo(x, y + bracketLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + bracketLen, y);
  ctx.stroke();

  // Top-Right ┐
  ctx.beginPath();
  ctx.moveTo(x + size - bracketLen, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + bracketLen);
  ctx.stroke();

  // Bottom-Left └
  ctx.beginPath();
  ctx.moveTo(x, y + size - bracketLen);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x + bracketLen, y + size);
  ctx.stroke();

  // Bottom-Right ┘
  ctx.beginPath();
  ctx.moveTo(x + size - bracketLen, y + size);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size, y + size - bracketLen);
  ctx.stroke();

  // 3. Micro Corner Vertex Dots
  ctx.fillStyle = primaryColor;
  const dotR = 1.5;
  const corners = [[x, y], [x + size, y], [x, y + size], [x + size, y + size]];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 4. Subtle Center Targeting Reticle
  const midX = x + size / 2;
  const midY = y + size / 2;
  const tickLen = 7;
  ctx.lineWidth = 1;
  ctx.strokeStyle = isAlertActive ? 'rgba(244, 63, 94, 0.6)' : 'rgba(56, 189, 248, 0.4)';
  ctx.beginPath();
  ctx.moveTo(midX - tickLen, midY); ctx.lineTo(midX - 2, midY);
  ctx.moveTo(midX + 2, midY); ctx.lineTo(midX + tickLen, midY);
  ctx.moveTo(midX, midY - tickLen); ctx.lineTo(midX, midY - 2);
  ctx.moveTo(midX, midY + 2); ctx.lineTo(midX, midY + tickLen);
  ctx.stroke();

  // 5. Micro HUD Telemetry Tags (Clean glass style)
  ctx.shadowBlur = 0;
  ctx.font = '500 9px "JetBrains Mono", monospace';

  // Left Tag: Subject ID
  const tagLeft = isAlertActive ? '[ DISTRACTION INTERCEPTED ]' : '[ SUBJECT: STUDENT ]';
  ctx.fillStyle = isAlertActive ? '#fda4af' : '#94a3b8';
  ctx.fillText(tagLeft, x + 2, Math.max(12, y - 6));

  // Right Status Pill: Attentive vs Alert
  const statusLabel = isAlertActive ? '● ALERT' : '● ATTENTIVE';
  const statusWidth = ctx.measureText(statusLabel).width;
  ctx.fillStyle = primaryColor;
  ctx.fillText(statusLabel, x + size - statusWidth - 2, Math.max(12, y - 6));

  // Bottom Telemetry: Focus Lock
  const bottomLabel = isAlertActive ? 'PROTOCOL: ACTIVE' : 'FOCUS: 99.4%';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
  ctx.fillText(bottomLabel, x + 2, y + size + 12);

  ctx.restore();
}

/**
 * Precision Smartphone Detection Frame
 * Minimalist outline with subtle corner accents and hand connection tether
 */
function drawPhoneBox(bbox, score, isTouching) {
  const screenBox = videoBoxToScreen(bbox);
  const { x, y, w, h } = screenBox;
  const ctx = DOM.ctx;

  ctx.save();
  const boxColor = isTouching ? '#f43f5e' : '#f59e0b';
  
  // 1. Subtle Bounding Box
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = boxColor;
  ctx.fillStyle = isTouching ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.04)';
  ctx.shadowColor = boxColor;
  ctx.shadowBlur = isTouching ? 12 : 4;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();

  // 2. Corner tick accents
  const tick = Math.min(10, Math.min(w, h) * 0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(x, y + tick); ctx.lineTo(x, y); ctx.lineTo(x + tick, y);
  // Bottom-right
  ctx.moveTo(x + w - tick, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - tick);
  ctx.stroke();

  // 3. Elegant Dark Glass Pill Label
  ctx.shadowBlur = 0;
  ctx.font = '500 9px "JetBrains Mono", monospace';
  const labelText = isTouching 
    ? `INTERCEPTED · ${Math.round(score * 100)}%` 
    : `SMARTPHONE · ${Math.round(score * 100)}%`;
  
  const textWidth = ctx.measureText(labelText).width;
  const pillW = textWidth + 14;
  const pillH = 18;
  const pillY = Math.max(4, y - pillH - 3);

  ctx.fillStyle = 'rgba(3, 7, 18, 0.85)';
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, pillY, pillW, pillH, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isTouching ? '#fda4af' : '#fef3c7';
  ctx.fillText(labelText, x + 7, pillY + 12);

  // 4. Laser Interaction Tether if Hand is Touching
  if (isTouching && STATE.lastHandLandmarks && STATE.lastHandLandmarks.length > 0) {
    const hand = STATE.lastHandLandmarks[0];
    if (hand && hand[8]) { // Index fingertip
      const screenPt = videoBoxToScreen([
        hand[8].x * STATE.videoWidth, 
        hand[8].y * STATE.videoHeight, 
        0, 0
      ]);

      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(screenPt.x, screenPt.y);
      ctx.lineTo(x + w / 2, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Fingertip micro pulse dot
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(screenPt.x, screenPt.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

// --- System Status Badge ---
function updateSystemStatus(type, message) {
  DOM.statusText.innerText = message;

  if (type === 'scolding') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-red-950/90 border border-red-500 text-red-300 animate-pulse';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-red-500 animate-ping';
  } else if (type === 'warning') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/90 border border-amber-500 text-amber-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
  } else if (type === 'cooling_down') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-950/90 border border-indigo-500 text-indigo-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-indigo-400';
  } else if (type === 'studying') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/90 border border-emerald-500 text-emerald-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  } else {
    DOM.statusBadge.className = 'flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-900/80 border border-slate-700 text-slate-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-slate-500';
  }
}

// --- Metadata Drawer Controls ---
function openDrawer() {
  DOM.metadataDrawer.classList.add('drawer-open');
  DOM.drawerBackdrop.classList.add('backdrop-open');
}

function closeDrawer() {
  DOM.metadataDrawer.classList.remove('drawer-open');
  DOM.drawerBackdrop.classList.remove('backdrop-open');
}

// --- Browser Fullscreen API Toggle ---
function toggleBrowserFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.warn('Error enabling fullscreen:', err);
    });
    STATE.isFullscreen = true;
    DOM.fullscreenToggleBtn.innerText = '⛶';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    STATE.isFullscreen = false;
    DOM.fullscreenToggleBtn.innerText = '⛶';
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Session Start / Stop
  DOM.heroStartBtn.addEventListener('click', startSession);
  DOM.toggleSessionBtn.addEventListener('click', () => {
    if (STATE.isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  });

  // Drawer Open / Close
  DOM.openDrawerBtn.addEventListener('click', openDrawer);
  DOM.closeDrawerBtn.addEventListener('click', closeDrawer);
  DOM.drawerBackdrop.addEventListener('click', closeDrawer);

  // Fullscreen Button
  DOM.fullscreenToggleBtn.addEventListener('click', toggleBrowserFullscreen);

  // Mirror Camera Toggle
  DOM.mirrorToggleBtn.addEventListener('click', () => {
    STATE.isMirrored = !STATE.isMirrored;
    applyMirroring();
    DOM.mirrorToggleBtn.innerText = STATE.isMirrored ? '🪞' : '🪞';
  });

  // Test Scold Manual Button
  DOM.simulateTouchBtn.addEventListener('click', () => {
    triggerMemeScold("Manual Test");
  });

  // Camera Selector
  DOM.cameraSelect.addEventListener('change', () => {
    if (STATE.isSessionActive) {
      startCamera(DOM.cameraSelect.value);
    }
  });

  // Mode Buttons
  DOM.modeTouchBtn.addEventListener('click', () => {
    STATE.detectionMode = 'touch';
    DOM.modeTouchBtn.classList.add('active');
    DOM.modeAnyBtn.classList.remove('active');
    DOM.modeHint.innerText = 'Recommended: Triggers only when your hand touches or holds the phone.';
  });

  DOM.modeAnyBtn.addEventListener('click', () => {
    STATE.detectionMode = 'any';
    DOM.modeAnyBtn.classList.add('active');
    DOM.modeTouchBtn.classList.remove('active');
    DOM.modeHint.innerText = 'Strict mode: Triggers whenever any phone is anywhere within the camera frame.';
  });

  // Volume Slider
  DOM.volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    STATE.volume = val / 100;
    DOM.volumeVal.innerText = `${val}%`;
    audioPlayer.volume = STATE.volume;
  });

  // Confidence Slider
  DOM.confSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    STATE.phoneConfidenceThreshold = val / 100;
    DOM.confVal.innerText = `${val}%`;
  });
}

// Bootstrap
window.addEventListener('DOMContentLoaded', init);
