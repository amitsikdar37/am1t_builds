import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Zap, Radio, Tv } from 'lucide-react';
import confetti from 'canvas-confetti';

import { TriggerMode, FaceData, PhonkTrackId, FrameRecord, EditPresetId } from './types';
import { cameraManager } from './services/cameraManager';
import { frameBuffer } from './services/frameBuffer';
import { visionDetector } from './services/visionDetector';
import { phonkAudio } from './services/phonkAudioEngine';
import { sigmaEditRenderer } from './services/sigmaEditRenderer';
import { clipRecorder } from './services/clipRecorder';
import { draw3dTargetCube } from './services/cube3dRenderer';
import { unthrottledDriver } from './services/unthrottledDriver';

import { TacticalHUD } from './components/TacticalHUD';
import { PipPlayer, PipState } from './components/PipPlayer';
import { ControlsBar } from './components/ControlsBar';
import { SoundboardModal } from './components/SoundboardModal';
import { ObsStudioModal } from './components/ObsStudioModal';

export const App: React.FC = () => {
  // Application & PIP States
  const [pipState, setPipState] = useState<PipState>('STANDBY');
  const pipStateRef = useRef<PipState>('STANDBY');

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(true);
  const [triggerMode, setTriggerMode] = useState<TriggerMode>('both');
  const [selectedPreset, setSelectedPreset] = useState<EditPresetId>('ghost_trail_impact');
  const [sensitivity, setSensitivity] = useState(1.0);
  const [fps, setFps] = useState(30);

  // Audio State
  const [soundMuted, setSoundMuted] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<PhonkTrackId>('montagem_tomada');
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [hasDownloadableClip, setHasDownloadableClip] = useState(false);
  const [isConvertingMp4, setIsConvertingMp4] = useState(false);

  // OBS Studio & Live Broadcast States
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [streamTakeoverMode, setStreamTakeoverMode] = useState<'pip' | 'fullscreen'>('fullscreen');
  const [isZeroUi, setIsZeroUi] = useState(false);
  const [autoCyclePresets, setAutoCyclePresets] = useState(true);
  const [isProjectorActive, setIsProjectorActive] = useState(false);

  const autoCyclePresetsRef = useRef(true);
  const streamTakeoverModeRef = useRef<'pip' | 'fullscreen'>('fullscreen');
  const projectorWindowRef = useRef<Window | null>(null);
  const isProjectorActiveRef = useRef(false);

  useEffect(() => {
    isProjectorActiveRef.current = isProjectorActive;
  }, [isProjectorActive]);

  useEffect(() => {
    autoCyclePresetsRef.current = autoCyclePresets;
  }, [autoCyclePresets]);

  useEffect(() => {
    streamTakeoverModeRef.current = streamTakeoverMode;
  }, [streamTakeoverMode]);

  // Vision State
  const [faceData, setFaceData] = useState<FaceData>({
    detected: false,
    box: { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
    pitch: 0,
    yaw: 0,
    roll: 0,
    mouthCenter: { x: 0.5, y: 0.65 },
    noseBridge: { x: 0.5, y: 0.45 },
    leftEye: { x: 0.4, y: 0.4 },
    rightEye: { x: 0.6, y: 0.4 },
    confidence: 0
  });

  // DOM Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active replay frames ref to protect from premature GPU memory release
  const activeReplayFramesRef = useRef<FrameRecord[] | null>(null);

  // Frame and FPS tracking
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const animFrameRef = useRef<number | null>(null);

  // Stable state ref so callbacks never re-trigger or get cancelled by frame-by-frame re-renders
  const stateRef = useRef({
    faceData,
    isMirrored,
    selectedTrack,
    selectedPreset
  });
  useEffect(() => {
    stateRef.current = { faceData, isMirrored, selectedTrack, selectedPreset };
  });

  // Preload audio files on mount & listen to clip recorder state changes
  useEffect(() => {
    phonkAudio.preloadTomadaAudio();
    phonkAudio.preloadMoggedAudio();
    phonkAudio.preloadMoggerAudio();

    clipRecorder.setOnStateChange((converting) => {
      setIsConvertingMp4(converting);
    });
  }, []);

  // Handle window resizing so live canvas covers the entire display edge-to-edge
  useEffect(() => {
    const handleResize = () => {
      const liveCanvas = liveCanvasRef.current;
      if (liveCanvas) {
        liveCanvas.width = window.innerWidth;
        liveCanvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Step 1: Action Trigger (Drink sip, glasses adjust, or SPACEBAR)
  // Present-Clips Editing: Starts recording user's present action from this moment onwards!
  // Shows EDITING... for 1.8s while user performs the action, then EXPANDS and PLAYS live edit!
  const triggerAction = useCallback((actionType: 'drink' | 'glasses' | 'manual') => {
    if (pipStateRef.current !== 'STANDBY') return;

    // Wait until camera buffer is ready
    if (frameBuffer.getFrameCount() < 5) {
      console.warn('Frame buffer is still warming up, please wait a moment...');
      return;
    }

    // Grab a rich, high-density pre-roll clip of the physical action (3500ms ~105 frames)
    // This provides buttery-smooth, unlagged frame-by-frame slo-mo replay for sigma_hard_snaps and ghost_trail_impact
    const actionClip = frameBuffer.getReplayClip(3500);
    activeReplayFramesRef.current = actionClip;

    // Start live progressive recording session starting right now (from trigger moment onwards)!
    frameBuffer.stopLiveSession();
    frameBuffer.startLiveSession(0); // 0 pre-roll: Live session strictly records footage AFTER trigger
    const sessionStartTime = frameBuffer.getSessionStartTimestamp();

    // Lock PIP state into EDITING for a quick 200ms target lock
    pipStateRef.current = 'EDITING';
    setPipState('EDITING');

    console.log(`[ConfidenceBooster] Action triggered (${actionType.toUpperCase()})! Pre-roll action clip: ${actionClip.length} frames.`);

    // Fast 200ms punchy transition to PLAYING
    window.setTimeout(() => {
      pipStateRef.current = 'PLAYING';
      setPipState('PLAYING');

      // Brief tick to ensure DOM canvas is ready and sized
      window.setTimeout(() => {
        const editCanvas = editCanvasRef.current;

        // Route edit to OBS Pop-out Projector canvas if open, otherwise local editCanvas
        let targetCanvas: HTMLCanvasElement | null = editCanvas;
        let isProjectorTarget = false;

        if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
          try {
            const pDoc = projectorWindowRef.current.document;
            const pCanvas = pDoc.getElementById('projectorCanvas') as HTMLCanvasElement | null;
            if (pCanvas) {
              targetCanvas = pCanvas;
              isProjectorTarget = true;
            }
          } catch (e) {}
        }

        if (!targetCanvas || frameBuffer.getFrameCount() === 0) {
          console.warn('Canvas or camera frames not available, returning to standby');
          frameBuffer.stopLiveSession();
          pipStateRef.current = 'STANDBY';
          setPipState('STANDBY');
          return;
        }

        if (isProjectorTarget) {
          targetCanvas.width = 1280;
          targetCanvas.height = 720;
        } else {
          if (streamTakeoverModeRef.current === 'fullscreen') {
            targetCanvas.width = window.innerWidth;
            targetCanvas.height = window.innerHeight;
          } else {
            targetCanvas.width = 640;
            targetCanvas.height = 640;
          }
        }

        // Start video recording for 1-click download
        clipRecorder.startRecording(targetCanvas, phonkAudio.getAudioStream());

        let completed = false;
        const handlePlaybackComplete = () => {
          if (completed) return;
          completed = true;

          // Playback finished -> Reset PIP box back to standby!
          clipRecorder.stopRecording();
          setHasDownloadableClip(true);
          phonkAudio.stop();
          visionDetector.resetCooldown();
          pipStateRef.current = 'STANDBY';
          setPipState('STANDBY');

          // Free GPU memory safely
          frameBuffer.stopLiveSession();
          if (activeReplayFramesRef.current) {
            frameBuffer.releaseClip(activeReplayFramesRef.current);
            activeReplayFramesRef.current = null;
          }

          // Auto-cycle to next preset if enabled (so streamer never repeats the same edit twice on video chat!)
          if (autoCyclePresetsRef.current) {
            const cycleOrder: EditPresetId[] = ['ghost_trail_impact', 'dark_manga_strobe', 'sigma_hard_snaps'];
            const cur = stateRef.current.selectedPreset;
            const curIdx = cycleOrder.indexOf(cur);
            const nextIdx = (curIdx + 1) % cycleOrder.length;
            const nextPreset = cycleOrder[nextIdx];
            handleSelectPreset(nextPreset);
            console.log(`[OBS Streamer Mode] Auto-cycled to next preset: ${nextPreset}`);
          }
        };

        // Start viral audio playback and obtain sample-accurate audio clock timestamp and duration
        phonkAudio.playEditSequence(
          stateRef.current.selectedTrack,
          () => {
            confetti({
              particleCount: 50,
              spread: 90,
              origin: { x: 0.8, y: 0.5 },
              colors: ['#00ff66', '#ff0055', '#00f0ff', '#ffe600']
            });
          },
          handlePlaybackComplete
        ).then(({ startTime: audioStartTime, durationMs }) => {
          // Start the visual edit renderer locked to the exact audio clock and full track duration!
          const currentFace = stateRef.current.faceData;
          const currentMirrored = stateRef.current.isMirrored;

          sigmaEditRenderer.startEdit({
            canvas: targetCanvas!,
            preset: stateRef.current.selectedPreset,
            startTime: audioStartTime,
            durationMs,
            sessionStartTime,
            actionFrames: actionClip,
            getPostTriggerMoments: (nowTimestamp: number) =>
              frameBuffer.getPostTriggerMoments(sessionStartTime, nowTimestamp),
            getSessionFrames: () => frameBuffer.getSessionFrames(),
            getCurrentEyeCenter: () => {
              const f = stateRef.current.faceData;
              const m = stateRef.current.isMirrored;
              if (!f.detected) return undefined;
              return {
                x: m ? 1 - f.noseBridge.x : f.noseBridge.x,
                y: (f.leftEye.y + f.rightEye.y) / 2
              };
            },
            actionType,
            isMirrored: currentMirrored,
            eyeCenter: currentFace.detected
              ? {
                  x: currentMirrored ? 1 - currentFace.noseBridge.x : currentFace.noseBridge.x,
                  y: (currentFace.leftEye.y + currentFace.rightEye.y) / 2
                }
              : undefined,
            onDropImpact: () => {
              if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 150]);
              }
            },
            onComplete: handlePlaybackComplete
          });
        });
      }, 50);
    }, 200); // 200ms quick target lock transition
  }, []);

  // Main Camera & AI Loop (Runs continuously, unthrottled in background tabs and minimized windows!)
  useEffect(() => {
    let active = true;
    let isProcessing = false;
    let lastProcessTime = 0;

    const processLoop = async (now: number) => {
      if (!active) return;

      // Track open status of projector window
      const hasProjector = !!(projectorWindowRef.current && !projectorWindowRef.current.closed);
      if (hasProjector !== isProjectorActiveRef.current) {
        setIsProjectorActive(hasProjector);
        isProjectorActiveRef.current = hasProjector;
      }

      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      const video = videoRef.current;
      const liveCanvas = liveCanvasRef.current;

      if (video && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          // 1. Buffer camera frames for edit replay and post-trigger capture
          await frameBuffer.pushFrame(video);

          // 2. Process AI Face Tracking
          const result = visionDetector.detect(video, now, triggerMode);
          setFaceData(result.face);

          // 3. Trigger action if detected while in STANDBY
          if (result.triggeredAction && pipStateRef.current === 'STANDBY') {
            triggerAction(result.triggeredAction);
          }

          // 4. Render feed depending on whether OBS Projector is active or Local Main tab
          if (hasProjector) {
            // OBS PROJECTOR IS ACTIVE:
            // Offload rendering entirely to projector canvas. Do not render video on main tab!
            if (pipStateRef.current !== 'PLAYING') {
              try {
                const pDoc = projectorWindowRef.current!.document;
                const pCanvas = pDoc.getElementById('projectorCanvas') as HTMLCanvasElement | null;
                if (pCanvas) {
                  const pCtx = pCanvas.getContext('2d');
                  if (pCtx) {
                    const pw = pCanvas.width;
                    const ph = pCanvas.height;

                    pCtx.save();
                    pCtx.clearRect(0, 0, pw, ph);

                    const scale = Math.max(pw / vw, ph / vh);
                    const sw = pw / scale;
                    const sh = ph / scale;
                    const sx = Math.max(0, (vw - sw) / 2);
                    const sy = Math.max(0, (vh - sh) / 2);

                    if (isMirrored) {
                      pCtx.translate(pw, 0);
                      pCtx.scale(-1, 1);
                    }
                    pCtx.drawImage(video, sx, sy, sw, sh, 0, 0, pw, ph);

                    pCtx.fillStyle = 'rgba(0, 255, 102, 0.02)';
                    pCtx.fillRect(0, 0, pw, ph);
                    pCtx.restore();

                    // Draw 3D wireframe target cube directly on projector feed
                    if (result.face.detected) {
                      draw3dTargetCube(pCtx, result.face, pw, ph, isMirrored);
                    }
                  }
                }
              } catch (e) {
                // Ignore popup access or disposal errors
              }
            }
          } else if (liveCanvas) {
            // NORMAL LOCAL MODE: Render to liveCanvasRef on main window
            const cw = liveCanvas.width || window.innerWidth;
            const ch = liveCanvas.height || window.innerHeight;
            const ctx = liveCanvas.getContext('2d');
            if (ctx) {
              ctx.save();
              ctx.clearRect(0, 0, cw, ch);

              const scale = Math.max(cw / vw, ch / vh);
              const sw = cw / scale;
              const sh = ch / scale;
              const sx = Math.max(0, (vw - sw) / 2);
              const sy = Math.max(0, (vh - sh) / 2);

              if (isMirrored) {
                ctx.translate(cw, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);

              ctx.fillStyle = 'rgba(0, 255, 102, 0.02)';
              ctx.fillRect(0, 0, cw, ch);
              ctx.restore();

              // Draw 3D Target Cube
              if (result.face.detected) {
                draw3dTargetCube(ctx, result.face, cw, ch, isMirrored);
              }
            }
          }
        }
      }
    };

    // Safe ticker guarded against concurrent async runs and capped at ~60fps
    const safeTick = async (now: number) => {
      if (!active) return;
      if (now - lastProcessTime < 11) return;
      lastProcessTime = now;
      unthrottledDriver.recordRafTick(now);

      if (isProcessing) return;
      isProcessing = true;
      try {
        await processLoop(now);
      } finally {
        isProcessing = false;
      }

      // Schedule next frame
      scheduleNext();
    };

    const scheduleNext = () => {
      if (!active) return;
      animFrameRef.current = requestAnimationFrame(safeTick);

      // If projector window is open, also schedule on projector window RAF (which runs smoothly on desktop even if main tab is minimized!)
      if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
        try {
          projectorWindowRef.current.requestAnimationFrame(safeTick);
        } catch (e) {}
      }
    };

    // Register with unthrottled Web Worker clock driver (bypasses browser background tab freezing completely!)
    const unregisterWorker = unthrottledDriver.register(safeTick);

    // Kick off the loop
    scheduleNext();

    return () => {
      active = false;
      unregisterWorker();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isMirrored, triggerMode, triggerAction]);

  // Camera initialization
  const startCamera = async () => {
    setCameraError(null);
    if (!videoRef.current) return;

    try {
      phonkAudio.preloadMoggedAudio();
      await cameraManager.init(videoRef.current);
      setCameraActive(true);
      setIsMirrored(cameraManager.getIsMirrored());

      // Resize live canvas to full window
      if (liveCanvasRef.current) {
        liveCanvasRef.current.width = window.innerWidth;
        liveCanvasRef.current.height = window.innerHeight;
      }

      await visionDetector.initialize();
    } catch (err) {
      console.error('Camera startup error:', err);
      setCameraError('Webcam access was denied or not found. Please allow camera permissions to continue.');
    }
  };

  // Keyboard shortcut: SPACEBAR for instant trigger, ESC to exit Zero-UI mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerAction('manual');
      } else if (e.code === 'Escape') {
        setIsZeroUi(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAction]);

  // Launch Pop-out Clean Projector Window for OBS Window Capture
  const handleOpenProjector = useCallback(() => {
    if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
      projectorWindowRef.current.focus();
      return;
    }

    const win = window.open(
      '',
      'OBS_Projector_ConfidenceBooster',
      'width=1280,height=720,menubar=no,status=no,toolbar=no,location=no'
    );

    if (!win) {
      alert('Pop-up was blocked by your browser! Please allow pop-ups for this site to use the OBS Projector window.');
      return;
    }

    win.document.title = 'Confidence Booster - Clean OBS Projector Feed';
    win.document.body.style.margin = '0';
    win.document.body.style.padding = '0';
    win.document.body.style.background = '#000';
    win.document.body.style.overflow = 'hidden';
    win.document.body.style.display = 'flex';
    win.document.body.style.alignItems = 'center';
    win.document.body.style.justifyContent = 'center';
    win.document.body.style.width = '100vw';
    win.document.body.style.height = '100vh';

    const canvas = win.document.createElement('canvas');
    canvas.id = 'projectorCanvas';
    canvas.width = 1280;
    canvas.height = 720;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.objectFit = 'cover';
    canvas.style.display = 'block';
    projectorWindowRef.current = win;
    setIsProjectorActive(true);
    isProjectorActiveRef.current = true;

    // Listen for projector window closure to automatically restore local rendering
    const handleClose = () => {
      setIsProjectorActive(false);
      isProjectorActiveRef.current = false;
      projectorWindowRef.current = null;
    };
    win.addEventListener('beforeunload', handleClose);
    win.addEventListener('pagehide', handleClose);
  }, []);

  // Camera toggle
  const handleSwitchCamera = async () => {
    try {
      await cameraManager.toggleFacingMode();
      setIsMirrored(cameraManager.getIsMirrored());
    } catch (err) {
      console.warn('Switch camera error:', err);
    }
  };

  // Skip / Close PIP Player
  const handleSkipPip = () => {
    sigmaEditRenderer.stop();
    phonkAudio.stop();
    clipRecorder.stopRecording();
    setHasDownloadableClip(true);
    visionDetector.resetCooldown();
    pipStateRef.current = 'STANDBY';
    setPipState('STANDBY');
    frameBuffer.stopLiveSession();
    if (activeReplayFramesRef.current) {
      frameBuffer.releaseClip(activeReplayFramesRef.current);
      activeReplayFramesRef.current = null;
    }
  };

  // Preset selector
  const handleSelectPreset = useCallback((preset: EditPresetId) => {
    setSelectedPreset(preset);
    if (preset === 'ghost_trail_impact' || preset === 'parallax_dual_speed') {
      setSelectedTrack('montagem_tomada');
      phonkAudio.preloadTomadaAudio();
    } else if (preset === 'dark_manga_strobe') {
      setSelectedTrack('mogger');
      phonkAudio.preloadMoggerAudio();
    } else {
      setSelectedTrack('marlon_mogged');
      phonkAudio.preloadMoggedAudio();
    }
  }, []);

  // Download Clip in Universal MP4 Format
  const handleDownloadClip = async () => {
    let filename = `sigma_mog_edit_${Date.now()}.mp4`;
    if (selectedPreset === 'ghost_trail_impact' || selectedPreset === 'parallax_dual_speed') {
      filename = `ghost_trail_edit_${Date.now()}.mp4`;
    } else if (selectedPreset === 'dark_manga_strobe') {
      filename = `dark_manga_edit_${Date.now()}.mp4`;
    }
    await clipRecorder.downloadLastClip(filename);
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none font-mono text-white">
      
      {/* Hidden WebRTC source video */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Camera Permission / Welcome Screen */}
      {!cameraActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/95">
          <div className="max-w-lg w-full p-6 bg-[#0a0d14] border border-cyber-green rounded-lg shadow-2xl shadow-cyber-green/30 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-cyber-green/10 border border-cyber-green flex items-center justify-center text-cyber-green animate-pulse">
              <Camera className="w-8 h-8" />
            </div>

            <div>
              <h1 className="font-cyber font-bold text-2xl tracking-wider text-cyber-green text-glow-green">
                CONFIDENCE BOOSTER AI
              </h1>
              <p className="text-gray-400 text-xs mt-1">
                VIRAL PHONK WEBCAM &bull; 3D FACE TRACKING &bull; PRESENT ACTION RECORDING
              </p>
            </div>

            {cameraError ? (
              <div className="w-full p-3 bg-red-950/60 border border-red-500 rounded text-red-300 text-xs text-left">
                <p className="font-bold mb-1">Camera Access Error:</p>
                <p className="text-red-400 font-mono text-[11px] break-all">{cameraError}</p>
                <button
                  onClick={startCamera}
                  className="mt-3 w-full py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold transition-colors"
                >
                  RETRY CAMERA
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3">
                <div className="text-left text-xs text-gray-400 bg-black/50 p-3 rounded border border-gray-800 space-y-1.5">
                  <p className="text-cyber-green font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> HOW TO USE:
                  </p>
                  <p>&bull; Take a sip of water/coffee, OR adjust your glasses.</p>
                  <p>&bull; AI detects your gesture &bull; locks target &bull; triggers edit.</p>
                  <p>&bull; Press <kbd className="px-1.5 py-0.5 bg-gray-800 text-cyber-green rounded text-[10px]">SPACE</kbd> anytime to force trigger manually.</p>
                </div>

                <button
                  onClick={startCamera}
                  className="w-full py-3 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-sm tracking-wider rounded transition-all shadow-lg shadow-cyber-green/30 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  INITIALIZE TACTICAL CAM
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Fullscreen Webcam Canvas */}
      <canvas
        ref={liveCanvasRef}
        className={`w-full h-full object-cover block ${isProjectorActive ? 'hidden' : ''}`}
      />

      {/* ON AIR BROADCAST STATION CONSOLE (When OBS Projector is active) */}
      {isProjectorActive && cameraActive && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#050811]/95 backdrop-blur-md font-mono select-none px-6">
          <div className="relative max-w-xl w-full p-8 bg-[#090d18] border border-cyber-green rounded-xl shadow-2xl shadow-cyber-green/20 flex flex-col items-center text-center">
            {/* Pulsing On-Air Indicator */}
            <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-red-950/70 border border-red-500/80 text-red-400 text-xs font-bold tracking-widest animate-pulse mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg shadow-red-500 animate-ping" />
              <span>LIVE &bull; ON AIR IN OBS PROJECTOR</span>
            </div>

            <div className="w-20 h-20 rounded-full bg-cyber-green/10 border-2 border-cyber-green flex items-center justify-center text-cyber-green mb-5 shadow-lg shadow-cyber-green/30">
              <Tv className="w-10 h-10 animate-pulse text-cyber-cyan" />
            </div>

            <h2 className="text-xl font-bold font-cyber text-cyber-green tracking-wider mb-2">
              OBS BROADCAST PROJECTOR ACTIVE
            </h2>
            <p className="text-gray-300 text-xs leading-relaxed max-w-md mb-6">
              Local rendering is offloaded. Your clean webcam feed, AI gesture detection, and Phonk edits are rendering cleanly at unthrottled 60 FPS directly in the OBS Projector window.
            </p>

            {/* Status Info Grid */}
            <div className="w-full grid grid-cols-3 gap-3 bg-black/60 p-3 rounded-lg border border-gray-800 text-xs mb-6">
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-[10px] uppercase">Engine Status</span>
                <span className="text-cyber-green font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" /> 60 FPS Locked
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-[10px] uppercase">Active Preset</span>
                <span className="text-cyber-cyan font-bold truncate max-w-[120px] mt-0.5">
                  {selectedPreset === 'ghost_trail_impact' ? 'Ghost Trail' : selectedPreset === 'dark_manga_strobe' ? 'Dark Manga' : 'Sigma Mogged'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-gray-500 text-[10px] uppercase">AI Status</span>
                <span className="text-yellow-400 font-bold mt-0.5">
                  {pipState === 'STANDBY' ? 'Scanning...' : 'EDIT ACTIVE!'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => triggerAction('manual')}
                disabled={pipState !== 'STANDBY'}
                className="flex-1 py-2.5 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-xs rounded transition-all shadow-md shadow-cyber-green/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                FORCE DROP EDIT (SPACE)
              </button>
              <button
                onClick={() => {
                  if (projectorWindowRef.current) {
                    try {
                      projectorWindowRef.current.close();
                    } catch (e) {}
                    projectorWindowRef.current = null;
                  }
                  setIsProjectorActive(false);
                }}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs rounded border border-gray-700 transition-colors cursor-pointer"
              >
                RETURN TO LOCAL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tactical HUD Overlay (Reticle, Face Wireframe Cube, FPS, Status) */}
      {cameraActive && !isZeroUi && !isProjectorActive && <TacticalHUD fps={fps} />}

      {/* PICTURE-IN-PICTURE / FULLSCREEN STREAMER VIDEO PLAYER */}
      {cameraActive && !isProjectorActive && (
        <PipPlayer
          state={pipState}
          editCanvasRef={editCanvasRef}
          onSkip={handleSkipPip}
          onDownload={handleDownloadClip}
          canDownload={hasDownloadableClip}
          isConverting={isConvertingMp4}
          takeoverMode={streamTakeoverMode}
          isZeroUi={isZeroUi}
        />
      )}

      {/* Zero-UI Mode Floating Restore Badge */}
      {isZeroUi && (
        <div
          onClick={() => setIsZeroUi(false)}
          className="absolute top-3 left-3 z-50 px-3 py-1.5 bg-black/70 hover:bg-black/90 text-cyber-green hover:text-white border border-cyber-green/40 hover:border-cyber-green rounded-full text-xs font-mono flex items-center gap-2 cursor-pointer transition-all shadow-lg backdrop-blur-md opacity-40 hover:opacity-100"
          title="Click or press ESC to exit Zero-UI mode and restore controls"
        >
          <Radio className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
          <span>OBS BROADCAST MODE &bull; [ESC] RESTORE UI</span>
        </div>
      )}

      {/* Minimal Bottom Controls Bar */}
      {cameraActive && !isZeroUi && (
        <ControlsBar
          onSwitchCamera={handleSwitchCamera}
          onToggleMirror={() => setIsMirrored(cameraManager.toggleMirror())}
          isMirrored={isMirrored}
          soundMuted={soundMuted}
          onToggleSound={() => {
            const next = !soundMuted;
            setSoundMuted(next);
            phonkAudio.setMuted(next);
          }}
          onOpenSoundboard={() => setIsSoundboardOpen(true)}
          onOpenObsModal={() => setIsObsModalOpen(true)}
          triggerMode={triggerMode}
          onChangeTriggerMode={setTriggerMode}
          selectedPreset={selectedPreset}
          onChangePreset={handleSelectPreset}
          onForceTrigger={() => triggerAction('manual')}
          onDownloadClip={handleDownloadClip}
          hasDownloadableClip={hasDownloadableClip}
          isConverting={isConvertingMp4}
          sensitivity={sensitivity}
          onChangeSensitivity={(v) => {
            setSensitivity(v);
            visionDetector.setSensitivity(v);
          }}
          isEditing={pipState !== 'STANDBY'}
        />
      )}

      {/* Soundboard Modal */}
      <SoundboardModal
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        selectedTrack={selectedTrack}
        onSelectTrack={setSelectedTrack}
        volume={phonkAudio.getVolume()}
        onVolumeChange={(v) => phonkAudio.setVolume(v)}
      />

      {/* OBS Studio & Live Broadcast Modal */}
      <ObsStudioModal
        isOpen={isObsModalOpen}
        onClose={() => setIsObsModalOpen(false)}
        streamTakeoverMode={streamTakeoverMode}
        onToggleTakeoverMode={() => setStreamTakeoverMode(m => m === 'fullscreen' ? 'pip' : 'fullscreen')}
        autoCyclePresets={autoCyclePresets}
        onToggleAutoCycle={() => setAutoCyclePresets(v => !v)}
        onEnterZeroUi={() => setIsZeroUi(true)}
        onOpenProjector={handleOpenProjector}
        currentPreset={selectedPreset}
      />

    </div>
  );
};

export default App;
