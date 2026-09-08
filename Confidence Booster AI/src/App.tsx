import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

import { TriggerMode, FaceData, PhonkTrackId, FrameRecord, EditPresetId } from './types';
import { cameraManager } from './services/cameraManager';
import { frameBuffer } from './services/frameBuffer';
import { visionDetector } from './services/visionDetector';
import { phonkAudio } from './services/phonkAudioEngine';
import { sigmaEditRenderer } from './services/sigmaEditRenderer';
import { clipRecorder } from './services/clipRecorder';
import { draw3dTargetCube } from './services/cube3dRenderer';

import { TacticalHUD } from './components/TacticalHUD';
import { PipPlayer, PipState } from './components/PipPlayer';
import { ControlsBar } from './components/ControlsBar';
import { SoundboardModal } from './components/SoundboardModal';

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

  // Preload audio files on mount
  useEffect(() => {
    phonkAudio.preloadTomadaAudio();
    phonkAudio.preloadMoggedAudio();
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

    // Grab the past 2400ms where the user just performed the physical action (taking a drink / glasses touch)
    const actionClip = frameBuffer.getReplayClip(2400);
    activeReplayFramesRef.current = actionClip;

    // Start live progressive session with full 2400ms pre-roll so action frames are preserved
    frameBuffer.stopLiveSession();
    frameBuffer.startLiveSession(2400);

    // Lock PIP state into EDITING for a quick 200ms target lock (eliminates the 1.8s dead wait!)
    pipStateRef.current = 'EDITING';
    setPipState('EDITING');

    console.log(`[ConfidenceBooster] Action triggered (${actionType.toUpperCase()})! Captured ${actionClip.length} action frames.`);

    // Fast 200ms punchy transition to PLAYING
    window.setTimeout(() => {
      pipStateRef.current = 'PLAYING';
      setPipState('PLAYING');

      // Brief tick to ensure DOM canvas is ready and sized
      window.setTimeout(() => {
        const editCanvas = editCanvasRef.current;
        const currentSessionFrames = frameBuffer.getSessionFrames();
        if (!editCanvas || currentSessionFrames.length === 0) {
          console.warn('Canvas or frames not available, returning to standby');
          frameBuffer.stopLiveSession();
          pipStateRef.current = 'STANDBY';
          setPipState('STANDBY');
          return;
        }

        editCanvas.width = 640;
        editCanvas.height = 640;

        // Start video recording for 1-click download
        clipRecorder.startRecording(editCanvas, phonkAudio.getAudioStream());

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
            canvas: editCanvas,
            preset: stateRef.current.selectedPreset,
            startTime: audioStartTime,
            durationMs,
            actionFrames: actionClip,
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

  // Main Camera & AI Loop (Runs continuously, completely uninterrupted by PIP playback!)
  useEffect(() => {
    let active = true;

    const processLoop = async (now: number) => {
      if (!active) return;

      frameCountRef.current++;
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCountRef.current);
        frameCountRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      const video = videoRef.current;
      const liveCanvas = liveCanvasRef.current;

      if (video && video.readyState >= 2 && liveCanvas) {
        const cw = liveCanvas.width || window.innerWidth;
        const ch = liveCanvas.height || window.innerHeight;
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          // 1. Always buffer camera frames
          await frameBuffer.pushFrame(video);

          // 2. Draw live webcam feed edge-to-edge covering full screen
          const ctx = liveCanvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, cw, ch);

            // Scale video with object-fit: cover to fill full screen with zero black bars
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

            // Subtle tactical surveillance tint
            ctx.fillStyle = 'rgba(0, 255, 102, 0.02)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.restore();

            // 3. Process AI Face Tracking
            const result = visionDetector.detect(video, now, triggerMode);
            setFaceData(result.face);

            // 4. Draw the 3D WIREFRAME TARGET CUBE on the user's face (with mirror alignment!)
            if (result.face.detected) {
              draw3dTargetCube(ctx, result.face, cw, ch, isMirrored);
            }

            // 5. Trigger action if detected while in STANDBY
            if (result.triggeredAction && pipStateRef.current === 'STANDBY') {
              triggerAction(result.triggeredAction);
            }
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(processLoop);
    };

    animFrameRef.current = requestAnimationFrame(processLoop);

    return () => {
      active = false;
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

  // Keyboard shortcut: SPACEBAR for instant trigger
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        triggerAction('manual');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerAction]);

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
    } else {
      setSelectedTrack('marlon_mogged');
      phonkAudio.preloadMoggedAudio();
    }
  }, []);

  // Download Clip
  const handleDownloadClip = () => {
    const filename = (selectedPreset === 'ghost_trail_impact' || selectedPreset === 'parallax_dual_speed')
      ? `ghost_trail_edit_${Date.now()}.webm`
      : `sigma_mog_edit_${Date.now()}.webm`;
    clipRecorder.downloadLastClip(filename);
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
              <p className="text-xs text-gray-400 font-mono mt-1">
                FULLSCREEN SURVEILLANCE // AUTOMATIC MOG EDITS
              </p>
            </div>

            {cameraError ? (
              <div className="flex items-center gap-2 p-3 bg-red-950/70 border border-red-500 rounded text-red-300 text-xs">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{cameraError}</span>
              </div>
            ) : (
              <div className="text-xs text-gray-300 bg-gray-950/80 p-3.5 rounded border border-cyber-green/20 space-y-2 text-left w-full">
                <div className="flex items-center gap-2 text-cyber-green font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  HOW IT WORKS:
                </div>
                <div className="text-[11px] text-gray-400">
                  1. A 3D wireframe green cube locks onto your face in the live monitor.
                </div>
                <div className="text-[11px] text-gray-400">
                  2. Take a <strong className="text-cyber-green">sip from a drink</strong> or <strong className="text-cyber-cyan">adjust your glasses</strong>.
                </div>
                <div className="text-[11px] text-gray-400">
                  3. The top-right box shows <strong className="text-amber-400">EDITING...</strong> for 2s, then expands and plays your mog edit while the camera stays live!
                </div>
              </div>
            )}

            <button
              onClick={startCamera}
              className="w-full py-3 bg-cyber-green hover:bg-white text-black font-cyber font-bold text-sm tracking-wider rounded transition-all shadow-lg shadow-cyber-green/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              INITIALIZE LIVE FEED
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN EDGE-TO-EDGE LIVE CAMERA FEED WITH 3D GREEN CUBE */}
      <canvas
        ref={liveCanvasRef}
        className="absolute inset-0 w-full h-full object-cover block"
      />

      {/* Subtle Fullscreen CRT Scanlines & Vignette */}
      <div className="absolute inset-0 crt-scanlines opacity-35 pointer-events-none" />
      <div className="absolute inset-0 crt-vignette pointer-events-none" />

      {/* Minimal Tactical HUD: [ LIVE, CAM 01, REC timer (Overlaid on Fullscreen) */}
      {cameraActive && <TacticalHUD fps={fps} />}

      {/* PICTURE-IN-PICTURE VIDEO PLAYER BOX (Top Right / Expanded on Right Side) */}
      {cameraActive && (
        <PipPlayer
          state={pipState}
          editCanvasRef={editCanvasRef}
          onSkip={handleSkipPip}
          onDownload={handleDownloadClip}
          canDownload={hasDownloadableClip}
        />
      )}

      {/* Minimal Bottom Controls Bar */}
      {cameraActive && (
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
          triggerMode={triggerMode}
          onChangeTriggerMode={setTriggerMode}
          selectedPreset={selectedPreset}
          onChangePreset={handleSelectPreset}
          onForceTrigger={() => triggerAction('manual')}
          onDownloadClip={handleDownloadClip}
          hasDownloadableClip={hasDownloadableClip}
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

    </div>
  );
};

export default App;
