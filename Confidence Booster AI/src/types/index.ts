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

export interface MultiTakeClips {
  setup: FrameRecord[];    // Past -2.5s to -4.5s (earlier glance / setup take)
  motion: FrameRecord[];   // Past -1.0s to -2.5s (movement take: raising drink / hand)
  climax: FrameRecord[];   // Past 0s to -1.0s (peak action take: sip / glasses touch / direct stare)
  allAction: FrameRecord[]; // Full pre-roll action clip (for Phase 1 & 2)
}

export interface PostTriggerMoments {
  startMoment: FrameRecord[];    // Initial reaction / glance (0.2s - 1.2s after trigger)
  motionMoment: FrameRecord[];   // Movement (e.g. raising cup/hand) (1.2s - 2.6s after trigger)
  climaxMoment: FrameRecord[];   // Peak action right before drop (2.6s - 3.25s after trigger)
  dropMoments: FrameRecord[][];  // Discrete micro-clips captured during the drop
  allRecorded: FrameRecord[];    // All post-trigger frames
}

export type PhonkTrackId = 'marlon_mogged' | 'montagem_tomada' | 'tokyo_drift' | 'cyber_sigma' | 'gigachad_anthem';

export type EditPresetId = 'sigma_hard_snaps' | 'ghost_trail_impact' | 'parallax_dual_speed';

export interface EditPresetInfo {
  id: EditPresetId;
  name: string;
  trackId: PhonkTrackId;
  description: string;
  durationMs: number;
}

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
  selectedPreset: EditPresetId;
}
