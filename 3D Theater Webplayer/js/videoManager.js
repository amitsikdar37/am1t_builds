import * as THREE from 'three';
import { fmtTime, showErr } from './utils.js';
import { updateScreenMasking, updateSubtitles } from './sceneBuilder.js';

export const video = document.getElementById('cinema-video');
video.volume = 1.0;
export const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.colorSpace = THREE.SRGBColorSpace;


export const vrfc = 'requestVideoFrameCallback' in video;
export function scheduleVRFC() {
  video.requestVideoFrameCallback(() => {
    videoTexture.needsUpdate = true;
    if (!video.paused && !video.ended) scheduleVRFC();
  });
}
video.addEventListener('play', () => { if (vrfc) scheduleVRFC(); });

export const state = { hasVideo: false };
let lastVT = -1;

export function updateVideo() {
  if (!vrfc && !video.paused && video.currentTime !== lastVT) {
    videoTexture.needsUpdate = true;
    lastVT = video.currentTime;
  }
  
  // Read active subtitle cues for the 3D Subtitle Mesh
  let subText = '';
  if (video.textTracks && video.textTracks.length > 0) {
    const activeCues = video.textTracks[0].activeCues;
    if (activeCues && activeCues.length > 0) {
      subText = activeCues[0].text;
    }
  }
  updateSubtitles(subText);
}

const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 16;
sampleCanvas.height = 16;
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

const targetColor = new THREE.Color(0,0,0);
const currentColor = new THREE.Color(0,0,0);
let targetIntensity = 0;
let currentIntensity = 0;

let lastGlowTime = 0;

export function updateScreenGlow(glowLight) {
  if (!state.hasVideo || video.paused || video.ended || !glowLight) return;

  const now = performance.now();
  if (now - lastGlowTime > 100) { // Throttle pixel extraction to 10 fps
    lastGlowTime = now;
    sampleCtx.drawImage(video, 0, 0, 16, 16);
    const frame = sampleCtx.getImageData(0, 0, 16, 16).data;
    
    let r=0, g=0, b=0;
    for(let i=0; i<frame.length; i+=4) {
      r += frame[i];
      g += frame[i+1];
      b += frame[i+2];
    }
    const count = frame.length / 4;
  
  // Three.js colors require setting from sRGB if source is sRGB
  targetColor.setRGB(r/255/count, g/255/count, b/255/count, THREE.SRGBColorSpace);

  // Get true luminance of the scene before modifying the color
  const luminance = 0.2126 * targetColor.r + 0.7152 * targetColor.g + 0.0722 * targetColor.b;

    // Extract HSL to boost saturation and normalize lightness.
    // This ensures bright daylight scenes don't just emit pure white,
    // but instead emit the beautiful true dominant hue of the scene.
    const hsl = {h: 0, s: 0, l: 0};
    targetColor.getHSL(hsl);
    
    // Boost saturation by 50% for a more cinematic lighting feel, cap at 1.0
    // Normalize lightness to 0.5 so the color itself doesn't influence brightness
    targetColor.setHSL(hsl.h, Math.min(1.0, hsl.s * 1.5), 0.5);

    // Intensity is now purely driven by the true luminance. 
    // Lowered the multiplier so it doesn't overexpose the front stage.
    targetIntensity = luminance * 20.0;
  }

  currentColor.lerp(targetColor, 0.08); // Smooth color transition
  currentIntensity += (targetIntensity - currentIntensity) * 0.08; // Smooth intensity transition

  glowLight.color.copy(currentColor);
  glowLight.intensity = currentIntensity;
}

export function loadVideoUrl(url, filename, onLoaded) {
  if (video.src && video.src.startsWith('blob:')) URL.revokeObjectURL(video.src);
  video.src = url;
  video.crossOrigin = 'anonymous'; // Important for WebGL textures!
  video.load();
  document.getElementById('hud-filename').textContent = filename;
  document.getElementById('welcome-screen').style.display = 'none';
  
  video.addEventListener('loadedmetadata', () => {
    document.getElementById('total-time').textContent = fmtTime(video.duration || 0);
    state.hasVideo = true;
    updateScreenMasking(video.videoWidth / video.videoHeight, videoTexture);
    video.play().catch(()=>{});
    if (onLoaded) onLoaded();
  }, { once: true });
  
  video.addEventListener('error', () => { 
    showErr('Cannot play this format.'); 
  }, { once: true });
}

export function loadSubtitleTrack(url) {
  Array.from(video.querySelectorAll('track')).forEach(t => t.remove());
  if (url) {
    const track = document.createElement('track');
    track.src = url;
    track.kind = 'subtitles';
    track.default = true;
    
    video.appendChild(track);
    
    // Immediately set mode to 'hidden' AFTER appending so the browser parses cues
    // but does NOT render the default browser subtitle UI (we use our own 3D mesh).
    // Doing this BEFORE appendChild has no effect, so order matters here.
    if (video.textTracks && video.textTracks.length > 0) {
      video.textTracks[video.textTracks.length - 1].mode = 'hidden';
    }
    
    // Also set on load as a safety net in case the track isn't ready yet
    track.addEventListener('load', () => {
      if (video.textTracks && video.textTracks.length > 0) {
        video.textTracks[video.textTracks.length - 1].mode = 'hidden';
      }
    });
  }
}
