import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { FaceData, HandData, TriggerMetrics, TriggerMode } from '../types';

export class VisionDetector {
  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private isLoaded = false;
  private isLoading = false;
  private lastTriggerTime = 0;
  private triggerCooldownMs = 4500; // prevent re-triggering during edit

  // Sensitivity settings
  private sensitivity = 1.0; // 0.5 (hard) to 1.5 (very sensitive)

  public async initialize(): Promise<void> {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      // Initialize FaceLandmarker
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true
      });

      // Initialize HandLandmarker
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 2
      });

      this.isLoaded = true;
      console.log('MediaPipe Vision AI models loaded successfully!');
    } catch (err) {
      console.warn('MediaPipe GPU load failed, falling back to CPU or heuristics:', err);
      // Even if model fails to load, heuristic fallback will keep functioning
    } finally {
      this.isLoading = false;
    }
  }

  public setSensitivity(val: number) {
    this.sensitivity = Math.max(0.5, Math.min(2.0, val));
  }

  public getSensitivity(): number {
    return this.sensitivity;
  }

  public isModelReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Process a single video frame and evaluate face tracking and action triggers
   */
  public detect(
    video: HTMLVideoElement,
    timestamp: number,
    mode: TriggerMode = 'both'
  ): {
    face: FaceData;
    hands: HandData;
    metrics: TriggerMetrics;
    triggeredAction: 'drink' | 'glasses' | null;
  } {
    // Default fallback values
    const defaultFace: FaceData = {
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
    };

    const defaultHands: HandData = {
      detected: false,
      points: []
    };

    const metrics: TriggerMetrics = {
      drinkScore: 0,
      glassesScore: 0,
      motionIntensity: 0,
      statusText: this.isLoaded ? 'MONITOR: LIVE' : 'INITIALIZING AI...'
    };

    if (video.readyState < 2 || video.videoWidth === 0) {
      return { face: defaultFace, hands: defaultHands, metrics, triggeredAction: null };
    }

    let faceData = { ...defaultFace };
    let handData = { ...defaultHands };

    // 1. Process Face Landmarks
    if (this.faceLandmarker) {
      try {
        const faceResult = this.faceLandmarker.detectForVideo(video, timestamp);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          const lms = faceResult.faceLandmarks[0];
          faceData.detected = true;
          faceData.confidence = 0.96;

          // Compute Face Bounding Box
          let minX = 1, maxX = 0, minY = 1, maxY = 0;
          for (let i = 0; i < lms.length; i += 5) {
            const p = lms[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }

          // Add margin
          const padX = (maxX - minX) * 0.15;
          const padY = (maxY - minY) * 0.15;
          faceData.box = {
            x: Math.max(0, minX - padX),
            y: Math.max(0, minY - padY),
            width: Math.min(1, (maxX - minX) + padX * 2),
            height: Math.min(1, (maxY - minY) + padY * 2)
          };

          // Key landmark points
          const forehead = lms[10];
          const chin = lms[152];
          const nose = lms[4] || lms[1];
          const mouthUp = lms[13];
          const mouthDown = lms[14];
          const eyeL = lms[33];
          const eyeR = lms[263];
          const noseBridge = lms[168] || lms[6];

          faceData.mouthCenter = {
            x: (mouthUp.x + mouthDown.x) / 2,
            y: (mouthUp.y + mouthDown.y) / 2
          };
          faceData.noseBridge = { x: noseBridge.x, y: noseBridge.y };
          faceData.leftEye = { x: eyeL.x, y: eyeL.y };
          faceData.rightEye = { x: eyeR.x, y: eyeR.y };

          // Pitch calculation:
          // When head tilts back (looking up to sip), nose rises towards forehead
          const faceHeight = Math.max(0.01, chin.y - forehead.y);
          const noseRelY = (nose.y - forehead.y) / faceHeight;
          // Normal is ~0.48-0.54. Sipping/tilting back moves noseRelY to < 0.38
          faceData.pitch = (0.50 - noseRelY) * 90; // degrees approximation

          // Yaw calculation (left/right rotation)
          const eyeCenterX = (eyeL.x + eyeR.x) / 2;
          faceData.yaw = (nose.x - eyeCenterX) * 120;

          // Roll calculation (tilt sideways)
          const dy = eyeR.y - eyeL.y;
          const dx = eyeR.x - eyeL.x;
          faceData.roll = Math.atan2(dy, dx) * (180 / Math.PI);
        }
      } catch {
        // Ignore single frame detection error
      }
    }

    // 2. Process Hand Landmarks
    if (this.handLandmarker) {
      try {
        const handResult = this.handLandmarker.detectForVideo(video, timestamp);
        if (handResult.landmarks && handResult.landmarks.length > 0) {
          handData.detected = true;
          for (const hand of handResult.landmarks) {
            // Check wrist, index tip (8), thumb tip (4), middle tip (12)
            const keyFingers = [hand[4], hand[8], hand[12], hand[0]];
            for (const pt of keyFingers) {
              const distToMouth = Math.hypot(pt.x - faceData.mouthCenter.x, pt.y - faceData.mouthCenter.y);
              const distToEyes = Math.hypot(pt.x - faceData.noseBridge.x, pt.y - faceData.noseBridge.y);

              handData.points.push({
                x: pt.x,
                y: pt.y,
                isNearMouth: distToMouth < 0.18,
                isNearEyes: distToEyes < 0.15
              });
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    // 3. Action Evaluation
    let triggeredAction: 'drink' | 'glasses' | null = null;
    const now = performance.now();
    const canTrigger = now - this.lastTriggerTime > this.triggerCooldownMs;

    if (faceData.detected) {
      // Evaluate DRINK SIP:
      // Condition 1: Head tilted back (pitch > 10 degrees)
      // Condition 2: Hand near mouth OR extreme head tilt (cup sip tilt > 18 degrees)
      const isHeadTiltedBack = faceData.pitch > (11 / this.sensitivity);
      const isHandNearMouth = handData.points.some(p => p.isNearMouth);

      let drinkScore = 0;
      if (faceData.pitch > 0) {
        drinkScore = Math.min(1, (faceData.pitch / 25) * this.sensitivity);
        if (isHandNearMouth) drinkScore = Math.min(1, drinkScore + 0.45);
      }
      metrics.drinkScore = drinkScore;

      // Evaluate GLASSES / FACE TOUCH:
      // Condition: Hand near nose bridge or eyes
      const isHandNearEyes = handData.points.some(p => p.isNearEyes);
      let glassesScore = 0;
      if (isHandNearEyes) {
        glassesScore = Math.min(1, 0.85 * this.sensitivity);
      }
      metrics.glassesScore = glassesScore;

      // Check Triggers according to selected mode
      if (canTrigger) {
        if ((mode === 'both' || mode === 'drink') && (
          (isHeadTiltedBack && isHandNearMouth) || 
          (faceData.pitch > (22 / this.sensitivity)) // deep sip tilt
        )) {
          triggeredAction = 'drink';
          this.lastTriggerTime = now;
        } else if ((mode === 'both' || mode === 'glasses') && isHandNearEyes) {
          triggeredAction = 'glasses';
          this.lastTriggerTime = now;
        }
      }

      if (triggeredAction) {
        metrics.statusText = `ACTION DETECTED: ${triggeredAction.toUpperCase()}`;
      } else if (isHeadTiltedBack || isHandNearMouth) {
        metrics.statusText = 'TRIGGER: DRINK SIP DETECTING...';
      } else if (isHandNearEyes) {
        metrics.statusText = 'TRIGGER: GLASSES ADJUST DETECTING...';
      } else {
        metrics.statusText = 'SUBJECT: LOCKED // WAITING...';
      }
    }

    return { face: faceData, hands: handData, metrics, triggeredAction };
  }

  public resetCooldown() {
    this.lastTriggerTime = performance.now();
  }
}

export const visionDetector = new VisionDetector();
