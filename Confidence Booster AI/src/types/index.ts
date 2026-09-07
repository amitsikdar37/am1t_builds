export type TriggerMode = 'both' | 'drink' | 'glasses' | 'manual';

export type AppState = 'MONITOR_LIVE' | 'TRIGGERED' | 'EDIT_PLAYBACK';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceData {
  detected: boolean;
  box: BoundingBox;
  pitch: number; // degrees (positive = tilted back)
  yaw: number;   // degrees
  roll: number;  // degrees
  mouthCenter: { x: number; y: number };
  noseBridge: { x: number; y: number };
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  confidence: number;
}

export interface HandPoint {
  x: number;
  y: number;
  isNearMouth: boolean;
  isNearEyes: boolean;
}

export interface HandData {
  detected: boolean;
  points: HandPoint[];
}

export interface TriggerMetrics {
  drinkScore: number; // 0 to 1
  glassesScore: number; // 0 to 1
  motionIntensity: number; // 0 to 1
  statusText: string;
}

export interface FrameRecord {
  bitmap: ImageBitmap;
  timestamp: number;
}

export type PhonkTrackId = 'marlon_mogged' | 'tokyo_drift' | 'cyber_sigma' | 'gigachad_anthem';

export interface PhonkTrackInfo {
  id: PhonkTrackId;
  title: string;
  bpm: number;
  vibe: string;
  dropDelaySeconds: number; // Exact moment the 808 drop lands
}

export interface AudioSettings {
  muted: boolean;
  volume: number; // 0 to 1
  selectedTrack: PhonkTrackId;
}
