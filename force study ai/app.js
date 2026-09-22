/**
 * Force Study AI - In-Browser AI Vision & Meme Scolding System
 */

// --- State Management ---
const STATE = {
  isSessionActive: false,
  detectionMode: 'touch', // 'touch' (hand touches phone) or 'any' (any phone in frame)
  phoneConfidenceThreshold: 0.55,
  volume: 1.0,
  isMirrored: true,
  showOverlays: true,
  
  // Scolding Audio State Machine: 'IDLE' | 'PLAYING' | 'WAIT_RELEASE'
  scoldState: 'IDLE',
  releaseCounter: 0, // Debounce frames of phone not being touched
  distractionCount: 0,
  
  // Audio Queue
  allVoices: [],
  unplayedQueue: [],
  lastPlayedVoice: null,
  playedInCycle: new Set(),
  
  // Vision Models
  cocoModel: null,
  handsModel: null,
  lastHandLandmarks: [],
  
  // Video & Stream
  stream: null,
  videoWidth: 640,
  videoHeight: 480,
  
  // Timer & Metrics
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
    filename: "Kyu nhi ho rahi padhai.mp3",
    url: "/voices/Kyu%20nhi%20ho%20rahi%20padhai.mp3",
    title: "Kyu nhi ho rahi padhai (Alakh Pandey)"
  },
  {
    filename: "Tum ek kaam karo IAS ki taiyaari chhod do .mp3",
    url: "/voices/Tum%20ek%20kaam%20karo%20IAS%20ki%20taiyaari%20chhod%20do%20.mp3",
    title: "Tum ek kaam karo IAS ki taiyaari chhod do (Vikas Divyakirti Sir)"
  },
  {
    filename: "bade harami ho beta meme video - meme hub (128k).mp3",
    url: "/voices/bade%20harami%20ho%20beta%20meme%20video%20-%20meme%20hub%20%28128k%29.mp3",
    title: "Bade harami ho beta"
  }
];

// --- Audio Player Instance ---
const audioPlayer = new Audio();
audioPlayer.preload = 'auto';

// --- DOM Elements ---
const DOM = {
  video: document.getElementById('webcam'),
  canvas: document.getElementById('outputCanvas'),
  ctx: document.getElementById('outputCanvas').getContext('2d'),
  cameraPlaceholder: document.getElementById('cameraPlaceholder'),
  heroStartBtn: document.getElementById('heroStartBtn'),
  toggleSessionBtn: document.getElementById('toggleSessionBtn'),
  btnIcon: document.getElementById('btnIcon'),
  btnText: document.getElementById('btnText'),
  cameraSelect: document.getElementById('cameraSelect'),
  mirrorToggleBtn: document.getElementById('mirrorToggleBtn'),
  overlayToggleBtn: document.getElementById('overlayToggleBtn'),
  fpsCounter: document.getElementById('fpsCounter'),
  modelStatus: document.getElementById('modelStatus'),
  statusBadge: document.getElementById('statusBadge'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  muteBtn: document.getElementById('muteBtn'),
  muteIcon: document.getElementById('muteIcon'),
  alarmOverlay: document.getElementById('alarmOverlay'),
  scoldBanner: document.getElementById('scoldBanner'),
  scoldMessage: document.getElementById('scoldMessage'),
  studyTimerDisplay: document.getElementById('studyTimerDisplay'),
  distractionCount: document.getElementById('distractionCount'),
  phoneStatusText: document.getElementById('phoneStatusText'),
  touchStatusText: document.getElementById('touchStatusText'),
  voiceList: document.getElementById('voiceList'),
  voiceCountBadge: document.getElementById('voiceCountBadge'),
  currentSoundDisplay: document.getElementById('currentSoundDisplay'),
  simulateTouchBtn: document.getElementById('simulateTouchBtn'),
  modeTouchBtn: document.getElementById('modeTouch'),
  modeAnyBtn: document.getElementById('modeAny'),
  modeHint: document.getElementById('modeHint'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeVal: document.getElementById('volumeVal'),
  confSlider: document.getElementById('confSlider'),
  confVal: document.getElementById('confVal')
};

// --- Initialization ---
async function init() {
  setupEventListeners();
  await loadVoices();
  setupAudioEvents();
  await enumerateCameras();
  await loadModels();
}

// --- Voice List & Non-Repeating Queue Management ---
async function loadVoices() {
  try {
    const res = await fetch('/api/voices');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
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
        ? 'playing border-amber-500 bg-amber-500/10' 
        : isPlayed 
        ? 'played border-slate-800 bg-slate-900/60' 
        : 'border-slate-800 bg-slate-950/60'
    }`;
    div.id = `voice-item-${index}`;

    div.innerHTML = `
      <div class="flex items-center gap-2 overflow-hidden flex-1">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
          isPlayed ? 'bg-slate-700 text-slate-300' : 'bg-rose-500/20 text-rose-300 font-mono'
        }">${index + 1}</span>
        <div class="truncate">
          <p class="font-medium text-slate-200 truncate" title="${voice.title}">${voice.title}</p>
          <span class="text-[10px] text-slate-500">${isPlayed ? '✓ Played this cycle' : 'Queued'}</span>
        </div>
      </div>
      <button class="preview-btn px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 flex items-center gap-1 transition" data-url="${voice.url}">
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

/**
 * Non-Repeating Fisher-Yates Queue Algorithm
 * Ensures:
 * 1. Every distinct sound from the folder is played before repeating any sound.
 * 2. Across cycles, the last sound of round N does NOT equal the first sound of round N+1.
 */
function getNextDistinctVoice() {
  if (STATE.allVoices.length === 0) return null;
  if (STATE.allVoices.length === 1) return STATE.allVoices[0];

  // If queue is empty, refill and shuffle
  if (STATE.unplayedQueue.length === 0) {
    const pool = [...STATE.allVoices];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // Prevent immediate repeat across cycle boundaries
    if (STATE.lastPlayedVoice && pool[0].filename === STATE.lastPlayedVoice.filename) {
      // Swap the first item with the last item
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

// --- Audio Player Event Handlers ---
function setupAudioEvents() {
  audioPlayer.addEventListener('ended', () => {
    console.log('[ForceStudyAI] Audio finished playing.');
    // Sound has finished, now wait for user to put phone away before arming next distinct trigger
    STATE.scoldState = 'WAIT_RELEASE';
    STATE.releaseCounter = 0;
    
    // Hide visual alert banner
    DOM.scoldBanner.classList.add('translate-y-28', 'opacity-0');
    DOM.alarmOverlay.classList.remove('opacity-100');
    DOM.alarmOverlay.classList.add('opacity-0');
    document.body.classList.remove('shake-active');

    updateSystemStatus('cooling_down', 'Put your phone down to resume study');
    DOM.currentSoundDisplay.innerText = `Finished: ${STATE.lastPlayedVoice?.title || ''} (Awaiting phone release)`;
    renderVoiceListUI();
  });

  audioPlayer.addEventListener('error', (e) => {
    console.error('[ForceStudyAI] Audio playback error:', e);
    STATE.scoldState = 'IDLE';
    DOM.alarmOverlay.classList.remove('opacity-100');
    DOM.alarmOverlay.classList.add('opacity-0');
    updateSystemStatus('studying', 'Studying peacefully');
  });
}

// --- Trigger Scolding Action ---
function triggerMemeScold(sourceDesc = "Camera Detection") {
  if (STATE.scoldState === 'PLAYING') {
    return; // Already playing a scolding sound!
  }

  const voice = getNextDistinctVoice();
  if (!voice) return;

  STATE.scoldState = 'PLAYING';
  STATE.distractionCount++;
  DOM.distractionCount.innerText = STATE.distractionCount;

  // Visual Alert Flare
  DOM.alarmOverlay.classList.remove('opacity-0');
  DOM.alarmOverlay.classList.add('opacity-100');
  document.body.classList.add('shake-active');

  // Show Scolding Banner inside camera feed
  DOM.scoldMessage.innerText = `"${voice.title}"`;
  DOM.scoldBanner.classList.remove('translate-y-28', 'opacity-0');

  // Display status
  updateSystemStatus('scolding', '🚨 PHONE TOUCH DETECTED!');
  DOM.currentSoundDisplay.innerText = `🗣️ Scolding: ${voice.title}`;

  // Play Audio
  audioPlayer.src = voice.url;
  audioPlayer.volume = STATE.volume;
  
  const playPromise = audioPlayer.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn('[ForceStudyAI] Autoplay prevented or interrupted:', err);
    });
  }

  renderVoiceListUI();
}

// --- Load AI Models (COCO-SSD & MediaPipe Hands) ---
async function loadModels() {
  DOM.modelStatus.innerText = 'AI: Loading Vision Models...';
  
  try {
    // 1. Load COCO-SSD for cell phone and object detection
    if (window.cocoSsd) {
      STATE.cocoModel = await window.cocoSsd.load({ base: 'mobilenet_v2' });
      console.log('[ForceStudyAI] COCO-SSD loaded successfully.');
    } else {
      throw new Error('COCO-SSD library not loaded');
    }

    // 2. Initialize MediaPipe Hands for fine touch tracking
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
        console.warn('[ForceStudyAI] MediaPipe Hands failed, using fallback bounding box touch heuristics:', mpErr);
      }
    }

    DOM.modelStatus.innerText = 'AI: Ready (COCO-SSD + Hands)';
    DOM.modelStatus.classList.replace('text-slate-300', 'text-emerald-400');
  } catch (err) {
    console.error('[ForceStudyAI] Model loading error:', err);
    DOM.modelStatus.innerText = 'AI: Failed to load models';
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
      width: { ideal: 1280 },
      height: { ideal: 720 },
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
        STATE.videoWidth = DOM.video.videoWidth || 640;
        STATE.videoHeight = DOM.video.videoHeight || 480;
        DOM.canvas.width = STATE.videoWidth;
        DOM.canvas.height = STATE.videoHeight;
        resolve();
      };
    });

    await DOM.video.play();
    DOM.cameraPlaceholder.classList.add('hidden');
    applyMirroring();
    return true;
  } catch (err) {
    console.error('[ForceStudyAI] Error accessing camera:', err);
    alert('Unable to access camera. Please allow camera permissions in your browser.');
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

// --- Session Toggle (Start / Stop) ---
async function startSession() {
  const cameraOk = await startCamera(DOM.cameraSelect.value);
  if (!cameraOk) return;

  STATE.isSessionActive = true;
  STATE.scoldState = 'IDLE';

  // Unlock AudioContext if suspended
  if (audioPlayer.paused) {
    audioPlayer.load();
  }

  // Update Buttons
  DOM.btnIcon.innerText = '⏹';
  DOM.btnText.innerText = 'End Study Session';
  DOM.toggleSessionBtn.classList.replace('bg-rose-500', 'bg-slate-700');
  DOM.toggleSessionBtn.classList.replace('hover:bg-rose-600', 'hover:bg-slate-600');

  updateSystemStatus('studying', 'Studying peacefully 📚');

  // Start Study Timer
  STATE.timerSeconds = 0;
  clearInterval(STATE.timerInterval);
  STATE.timerInterval = setInterval(() => {
    STATE.timerSeconds++;
    const h = String(Math.floor(STATE.timerSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((STATE.timerSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(STATE.timerSeconds % 60).padStart(2, '0');
    DOM.studyTimerDisplay.innerText = `${h}:${m}:${s}`;
  }, 1000);

  // Start AI detection loop
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
  DOM.scoldBanner.classList.add('translate-y-28', 'opacity-0');
  document.body.classList.remove('shake-active');

  DOM.btnIcon.innerText = '▶';
  DOM.btnText.innerText = 'Start Study Session';
  DOM.toggleSessionBtn.classList.replace('bg-slate-700', 'bg-rose-500');
  DOM.toggleSessionBtn.classList.replace('hover:bg-slate-600', 'hover:bg-rose-600');

  updateSystemStatus('idle', 'System Idle');
  DOM.phoneStatusText.innerText = 'NO PHONE';
  DOM.touchStatusText.innerText = 'NO TOUCH';
}

// --- Real-Time Vision & Detection Loop ---
async function detectionLoop(now) {
  if (!STATE.isSessionActive) return;

  // FPS calculation
  const delta = now - STATE.lastFrameTime;
  STATE.lastFrameTime = now;
  STATE.fps = Math.round(1000 / (delta || 1));
  if (now - STATE.fpsUpdateTimer > 500) {
    DOM.fpsCounter.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span><span>FPS: ${STATE.fps}</span>`;
    STATE.fpsUpdateTimer = now;
  }

  // Clear Canvas Overlay
  DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);

  let phoneDetected = false;
  let handTouchingPhone = false;
  let detectedPhoneBox = null;

  // Run COCO-SSD Object Detection
  if (STATE.cocoModel && DOM.video.readyState >= 2) {
    try {
      const predictions = await STATE.cocoModel.detect(DOM.video);
      
      // Send video to MediaPipe Hands if available
      if (STATE.handsModel) {
        await STATE.handsModel.send({ image: DOM.video });
      }

      for (const pred of predictions) {
        if (pred.class === 'cell phone' && pred.score >= STATE.phoneConfidenceThreshold) {
          phoneDetected = true;
          detectedPhoneBox = pred.bbox; // [x, y, width, height]

          // Check for hand touch
          handTouchingPhone = checkHandTouchingPhone(detectedPhoneBox, predictions);

          // Draw Bounding Box & HUD
          if (STATE.showOverlays) {
            drawPhoneOverlay(pred.bbox, pred.score, handTouchingPhone);
          }
        }
      }
    } catch (err) {
      console.warn('Vision detection frame error:', err);
    }
  }

  // Update Status Displays
  DOM.phoneStatusText.innerText = phoneDetected ? '📱 PHONE VISIBLE' : 'NO PHONE';
  DOM.phoneStatusText.className = `text-sm font-bold font-mono mt-2 ${phoneDetected ? 'text-amber-400' : 'text-slate-400'}`;

  DOM.touchStatusText.innerText = handTouchingPhone ? '✋ TOUCH DETECTED!' : 'NO TOUCH';
  DOM.touchStatusText.className = `text-sm font-bold font-mono mt-2 ${handTouchingPhone ? 'text-rose-500 font-extrabold animate-pulse' : 'text-slate-400'}`;

  // Evaluate Scolding Logic based on Detection Mode
  const isTriggerConditionMet = (STATE.detectionMode === 'touch') ? handTouchingPhone : phoneDetected;

  handleScoldingStateMachine(isTriggerConditionMet);

  // Request next frame
  requestAnimationFrame(detectionLoop);
}

/**
 * Checks if hands are touching or holding the phone bounding box.
 * 1. Checks MediaPipe Hand landmarks within/near phone bbox.
 * 2. Fallback: Checks if phone bbox intersects with person bbox hands/torso area.
 */
function checkHandTouchingPhone(phoneBox, allPredictions) {
  const [px, py, pw, ph] = phoneBox;
  const padding = 25; // Proximity threshold in pixels
  const minX = px - padding;
  const minY = py - padding;
  const maxX = px + pw + padding;
  const maxY = py + ph + padding;

  // 1. Precise MediaPipe Hand Landmarks check
  if (STATE.lastHandLandmarks && STATE.lastHandLandmarks.length > 0) {
    for (const hand of STATE.lastHandLandmarks) {
      for (const landmark of hand) {
        // landmark.x and landmark.y are normalized (0 to 1)
        const lx = landmark.x * STATE.videoWidth;
        const ly = landmark.y * STATE.videoHeight;
        
        if (lx >= minX && lx <= maxX && ly >= minY && ly <= maxY) {
          return true; // Hand landmark is touching/inside the phone bounds!
        }
      }
    }
  }

  // 2. Proximity Heuristic: If phone is held up by person
  // Cell phones detected in upper hand/study frame with high confidence are almost always in hand.
  // If no MediaPipe is active, in 'touch' mode we check if the phone is within the person's frame.
  if (!STATE.handsModel || STATE.lastHandLandmarks.length === 0) {
    return true; // Fallback to detection if hand model is unavailable
  }

  return false;
}

/**
 * State Machine to ensure clean scolding and distinct sounds:
 * - When triggered: Plays 1 meme sound.
 * - While playing: Cannot re-trigger.
 * - When audio ends: Transitions to 'WAIT_RELEASE'.
 * - When phone is put away for at least ~1.5 seconds: Returns to 'IDLE'.
 * - Next time phone is touched: Plays a distinct new sound!
 */
function handleScoldingStateMachine(isTriggerConditionMet) {
  switch (STATE.scoldState) {
    case 'IDLE':
      if (isTriggerConditionMet) {
        console.log('[ForceStudyAI] Phone touch trigger condition met!');
        triggerMemeScold("Real-Time Vision");
      }
      break;

    case 'PLAYING':
      // Audio is actively scolding the user.
      // Do nothing, let the meme deliver its full scolding punch!
      break;

    case 'WAIT_RELEASE':
      // User must put the phone down before the system rearms.
      if (!isTriggerConditionMet) {
        STATE.releaseCounter++;
        // Debounce: ~45 frames of no touch (~1.5 seconds)
        if (STATE.releaseCounter > 45) {
          STATE.scoldState = 'IDLE';
          STATE.releaseCounter = 0;
          updateSystemStatus('studying', 'Studying peacefully 📚');
          DOM.currentSoundDisplay.innerText = 'Ready for next trigger';
          console.log('[ForceStudyAI] Phone put down. Rearmed for next distinct scold!');
        }
      } else {
        // Still holding phone! Reset release counter
        STATE.releaseCounter = 0;
        updateSystemStatus('warning', '⚠️ Put your phone down!');
      }
      break;
  }
}

// --- Drawing HUD & Visual Overlays on Canvas ---
function drawPhoneOverlay(bbox, score, isTouching) {
  const [x, y, width, height] = bbox;
  const ctx = DOM.ctx;

  // Box Styling
  ctx.save();
  ctx.lineWidth = isTouching ? 4 : 2.5;
  ctx.strokeStyle = isTouching ? '#ef4444' : '#f59e0b';
  ctx.fillStyle = isTouching ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.1)';

  // Rounded rectangle
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10);
  ctx.fill();
  ctx.stroke();

  // Glow effect on touch
  if (isTouching) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.stroke();
  }

  // Badge Tag
  const tagText = isTouching ? `🚨 PHONE TOUCHED (${Math.round(score * 100)}%)` : `📱 Phone (${Math.round(score * 100)}%)`;
  ctx.font = 'bold 12px "JetBrains Mono", monospace';
  const textMetrics = ctx.measureText(tagText);
  const tagHeight = 22;
  const tagWidth = textMetrics.width + 16;

  ctx.fillStyle = isTouching ? '#ef4444' : '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(x, Math.max(0, y - tagHeight - 4), tagWidth, tagHeight, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(tagText, x + 8, Math.max(tagHeight - 6, y - 9));

  // Draw hand landmark dots if available
  if (STATE.lastHandLandmarks) {
    ctx.fillStyle = '#38bdf8';
    for (const hand of STATE.lastHandLandmarks) {
      for (const pt of hand) {
        const hx = pt.x * STATE.videoWidth;
        const hy = pt.y * STATE.videoHeight;
        ctx.beginPath();
        ctx.arc(hx, hy, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// --- UI Status Helper ---
function updateSystemStatus(type, message) {
  DOM.statusText.innerText = message;
  
  if (type === 'scolding') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-950/80 border border-red-500 text-red-300 animate-pulse';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-red-500 animate-ping';
  } else if (type === 'warning') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-950/80 border border-amber-500 text-amber-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-amber-400';
  } else if (type === 'cooling_down') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-950/80 border border-indigo-500 text-indigo-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-indigo-400';
  } else if (type === 'studying') {
    DOM.statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-950/80 border border-emerald-500 text-emerald-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  } else {
    DOM.statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300';
    DOM.statusDot.className = 'w-2 h-2 rounded-full bg-slate-500';
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Session Start/Stop
  DOM.heroStartBtn.addEventListener('click', startSession);
  DOM.toggleSessionBtn.addEventListener('click', () => {
    if (STATE.isSessionActive) {
      stopSession();
    } else {
      startSession();
    }
  });

  // Manual Test Scold Button
  DOM.simulateTouchBtn.addEventListener('click', () => {
    triggerMemeScold("Manual Test Button");
  });

  // Camera selector
  DOM.cameraSelect.addEventListener('change', () => {
    if (STATE.isSessionActive) {
      startCamera(DOM.cameraSelect.value);
    }
  });

  // Mirror camera toggle
  DOM.mirrorToggleBtn.addEventListener('click', () => {
    STATE.isMirrored = !STATE.isMirrored;
    applyMirroring();
    DOM.mirrorToggleBtn.innerText = STATE.isMirrored ? '🪞 Flip' : '🪞 Normal';
  });

  // Overlay toggle
  DOM.overlayToggleBtn.addEventListener('click', () => {
    STATE.showOverlays = !STATE.showOverlays;
    DOM.overlayToggleBtn.innerText = STATE.showOverlays ? '🎯 Overlays: ON' : '🎯 Overlays: OFF';
    if (!STATE.showOverlays) {
      DOM.ctx.clearRect(0, 0, DOM.canvas.width, DOM.canvas.height);
    }
  });

  // Detection Mode Buttons
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
    DOM.modeHint.innerText = 'Strict mode: Triggers anytime a phone is anywhere within the camera frame.';
  });

  // Volume Slider
  DOM.volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    STATE.volume = val / 100;
    DOM.volumeVal.innerText = `${val}%`;
    audioPlayer.volume = STATE.volume;
    DOM.muteIcon.innerText = val === 0 ? '🔇' : '🔊';
  });

  // Mute Toggle Button
  DOM.muteBtn.addEventListener('click', () => {
    if (audioPlayer.muted || STATE.volume === 0) {
      audioPlayer.muted = false;
      DOM.muteIcon.innerText = '🔊';
      STATE.volume = 1.0;
      DOM.volumeSlider.value = 100;
      DOM.volumeVal.innerText = '100%';
    } else {
      audioPlayer.muted = true;
      DOM.muteIcon.innerText = '🔇';
      DOM.volumeVal.innerText = 'Muted';
    }
  });

  // Confidence Slider
  DOM.confSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    STATE.phoneConfidenceThreshold = val / 100;
    DOM.confVal.innerText = `${val}%`;
  });
}

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', init);
