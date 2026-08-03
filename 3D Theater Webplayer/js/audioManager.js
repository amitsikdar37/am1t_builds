import * as THREE from 'three';
import { ROOM_W, ROOM_H, SCR_W, SCR_Z, SCR_Y } from './config.js';

let initialized = false;
let audioListener = null;
let currentExternalAudio = null;
let currentSourceNode = null;
let videoSourceNode = null;
let videoGainNode = null;
let audioSplitter = null;
let audioCtx = null;
let mainVideo = null;
let currentExternalStartTime = 0;

// Generate a synthetic impulse response for the theatre reverb
function createImpulseResponse(duration, decay, ctx) {
  const length = ctx.sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);
  for (let i = 0; i < length; i++) {
    left[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    right[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

export function initAudio(camera, scene, video) {
  if (initialized) return;
  
  // 1. Create listener (the user's ears) and attach to camera
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);
  
  const ctx = audioListener.context;
  
  // Insert a Master Compressor to prevent clipping and "ducking" when signals sum
  const masterCompressor = ctx.createDynamicsCompressor();
  masterCompressor.threshold.value = -6;
  masterCompressor.knee.value = 15;
  masterCompressor.ratio.value = 3;
  masterCompressor.attack.value = 0.005;
  masterCompressor.release.value = 0.1;
  
  audioListener.gain.disconnect();
  audioListener.gain.connect(masterCompressor);
  masterCompressor.connect(ctx.destination);
  
  // Ensure AudioContext is running
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Mute the original HTML video element so we don't hear double audio natively
  video.muted = false; 
  mainVideo = video;
  audioCtx = ctx;
  
  videoSourceNode = ctx.createMediaElementSource(video);
  videoGainNode = ctx.createGain();
  videoGainNode.gain.value = 1.0;
  videoSourceNode.connect(videoGainNode);
  
  // Split source into 6 channels to fully support 5.1 Surround Sound
  audioSplitter = ctx.createChannelSplitter(6);
  videoGainNode.connect(audioSplitter);
  
  let isBufferingSync = false;
  
  // Sync logic for external audio tracks
  mainVideo.addEventListener('play', () => { if (currentExternalAudio && !isBufferingSync) currentExternalAudio.play(); });
  mainVideo.addEventListener('pause', () => { if (currentExternalAudio && !isBufferingSync) currentExternalAudio.pause(); });
  mainVideo.addEventListener('seeking', () => {
    if (currentExternalAudio) {
      // Just pause it so it doesn't play old audio while dragging the seek bar
      currentExternalAudio.pause();
    }
  });
  
  mainVideo.addEventListener('seeked', () => {
    if (currentExternalAudio && currentExternalAudio.dataset.rawUrl) {
      // Fetch the new audio stream ONLY once the seek is completely finished!
      switchAudioTrack(currentExternalAudio.dataset.rawUrl);
    }
  });
  // Removed toxic timeupdate sync for external audio.
  // The FFmpeg stream is a live pipe, attempting to set .currentTime on it will abort the HTTP connection!

  // 2. Global Theatre Reverb (Convolver)
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(3.5, 4.0, ctx);
  const reverbGain = ctx.createGain();
  reverbGain.gain.value = 0.08; // Slight reverb for the entire mix
  convolver.connect(reverbGain);
  reverbGain.connect(audioListener.getInput());
  
  // Feed only L and R into reverb so we don't muddy the center dialogue
  const reverbMix = ctx.createGain();
  audioSplitter.connect(reverbMix, 0);
  audioSplitter.connect(reverbMix, 1);
  reverbMix.connect(convolver);

  // Helper to create physical virtual speakers
  function createSpeaker(x, y, z, refDist = 12) {
    const speaker = new THREE.PositionalAudio(audioListener);
    speaker.setRefDistance(refDist);
    speaker.setRolloffFactor(1);
    speaker.setDistanceModel('exponential');
    speaker.position.set(x, y, z);
    scene.add(speaker);
    return speaker;
  }

  // 3. Front Left Speaker (Channel 0)
  const frontLeft = createSpeaker(-SCR_W/2 - 2, SCR_Y, SCR_Z);
  const flGain = ctx.createGain(); flGain.gain.value = 0.8;
  audioSplitter.connect(flGain, 0);
  frontLeft.setNodeSource(flGain);

  // 4. Front Right Speaker (Channel 1)
  const frontRight = createSpeaker(SCR_W/2 + 2, SCR_Y, SCR_Z);
  const frGain = ctx.createGain(); frGain.gain.value = 0.8;
  audioSplitter.connect(frGain, 1);
  frontRight.setNodeSource(frGain);

  // 5. Center Speaker (Channel 2 - DIALOGUE)
  const center = createSpeaker(0, SCR_Y, SCR_Z);
  const centerGain = ctx.createGain(); centerGain.gain.value = 1.2; 
  audioSplitter.connect(centerGain, 2);
  center.setNodeSource(centerGain);

  // 6. Subwoofer (Channel 3 LFE + Bass Management from L/R)
  const sub = createSpeaker(0, 0.5, SCR_Z + 2);
  const subFilter = ctx.createBiquadFilter();
  subFilter.type = 'lowpass';
  subFilter.frequency.value = 120;
  
  const subGain = ctx.createGain(); subGain.gain.value = 1.0;
  audioSplitter.connect(subGain, 3); // True LFE channel
  
  // Bass management for stereo tracks (mix L/R into sub)
  const bassMix = ctx.createGain(); bassMix.gain.value = 0.5;
  audioSplitter.connect(bassMix, 0);
  audioSplitter.connect(bassMix, 1);
  bassMix.connect(subFilter);
  subFilter.connect(subGain);
  
  sub.setNodeSource(subGain);

  // 7. Surround Left (Channel 4 True Surround + delayed bleed for stereo)
  const surrLeft = createSpeaker(-ROOM_W/2 + 1, ROOM_H * 0.7, 5, 8);
  const slGain = ctx.createGain(); slGain.gain.value = 0.7;
  audioSplitter.connect(slGain, 4); // True SL
  
  const slDelay = ctx.createDelay(); slDelay.delayTime.value = 0.045;
  const slBleed = ctx.createGain(); slBleed.gain.value = 0.15;
  audioSplitter.connect(slDelay, 0); slDelay.connect(slBleed); slBleed.connect(slGain);
  
  surrLeft.setNodeSource(slGain);

  // 8. Surround Right (Channel 5 True Surround + delayed bleed for stereo)
  const surrRight = createSpeaker(ROOM_W/2 - 1, ROOM_H * 0.7, 5, 8);
  const srGain = ctx.createGain(); srGain.gain.value = 0.7;
  audioSplitter.connect(srGain, 5); // True SR
  
  const srDelay = ctx.createDelay(); srDelay.delayTime.value = 0.045;
  const srBleed = ctx.createGain(); srBleed.gain.value = 0.15;
  audioSplitter.connect(srDelay, 1); srDelay.connect(srBleed); srBleed.connect(srGain);
  
  surrRight.setNodeSource(srGain);

  initialized = true;
}

export function resumeAudio() {
  if (audioListener && audioListener.context.state === 'suspended') {
    audioListener.context.resume();
  }
}

export function switchAudioTrack(url) {
  if (!url) {
    if (currentExternalAudio) {
      currentExternalAudio.pause();
      currentExternalAudio.removeAttribute('src');
      currentExternalAudio.load(); // Forces browser to abort the HTTP connection
    }
    // Unmute default video source smoothly
    videoGainNode.gain.value = 1.0;
    return;
  }

  currentExternalStartTime = mainVideo.currentTime;
  
  if (!currentExternalAudio) {
    currentExternalAudio = new Audio();
    currentExternalAudio.crossOrigin = 'anonymous';
    currentSourceNode = audioCtx.createMediaElementSource(currentExternalAudio);
    currentSourceNode.connect(audioSplitter);
  } else {
    currentExternalAudio.pause();
    currentExternalAudio.removeAttribute('src');
    currentExternalAudio.load(); // Abort the old connection instantly
  }
  
  // ALWAYS mute the native video track when using an external track!
  videoGainNode.gain.value = 0.0;
  
  currentExternalAudio.dataset.rawUrl = url;
  currentExternalAudio.src = `${url}?start=${currentExternalStartTime}`;
  currentExternalAudio.oncanplay = null;
  currentExternalAudio.onerror = (e) => {
    console.error("External audio failed to load!", e);
  };
  
  // If video is already playing, start audio right away.
  // The canplay event will naturally fire once FFmpeg has buffered enough.
  if (!mainVideo.paused) {
    currentExternalAudio.play().catch(err => console.error('Audio play failed:', err));
  }
}
