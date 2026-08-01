import * as THREE from 'three';
import { videoTexture, updateVideo, updateScreenGlow } from './videoManager.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildRoom, buildScreen, buildCurtains, buildSeats, buildStage, buildBeam, buildLighting, updateBeam } from './sceneBuilder.js';
import { initPost, updatePost, resizePost } from './postprocessing.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('theatre-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.016);
const camera = new THREE.PerspectiveCamera(58, window.innerWidth/window.innerHeight, 0.1, 120);
camera.position.set(0, 2.43, 4.66);

buildRoom(scene);
buildScreen(scene, videoTexture);
buildCurtains(scene);
buildSeats(scene);
buildStage(scene);

RectAreaLightUniformsLib.init();
const lights = buildLighting(scene);

const post = initPost(renderer, scene, camera);

const uiDeps = { camera, renderer, lights, scene };
initUI(uiDeps);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  resizePost(window.innerWidth, window.innerHeight);
});

let fpsF=0, fpsL=0, pxR=renderer.getPixelRatio();
const fpsEl=document.getElementById('fps-counter');

function animate(t) {
  fpsF++;
  if (t - fpsL > 1000) {
    const fps = fpsF; fpsEl.textContent = fps + ' fps'; fpsF = 0; fpsL = t;
    if (fps < 40 && pxR > 0.75) { pxR = Math.max(0.75, pxR - 0.25); renderer.setPixelRatio(pxR); resizePost(window.innerWidth, window.innerHeight); }
    else if (fps > 56 && pxR < Math.min(window.devicePixelRatio, 2)) { pxR = Math.min(Math.min(window.devicePixelRatio, 2), pxR + 0.25); renderer.setPixelRatio(pxR); resizePost(window.innerWidth, window.innerHeight); }
  }

  updatePost(t);
  updateVideo();
  updateScreenGlow(lights.screenGlow);
  updateBeam(t);
  
  if (uiDeps.updateCamera) uiDeps.updateCamera();
  post.composer.render();
}

renderer.setAnimationLoop(animate);
document.addEventListener('visibilitychange', () => { 
  if (document.hidden) renderer.setAnimationLoop(null); 
  else renderer.setAnimationLoop(animate); 
});
