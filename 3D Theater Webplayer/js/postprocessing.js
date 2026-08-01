import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass }      from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';




export let composer, bloomPass;

export function initPost(renderer, scene, camera) {
  const sz=new THREE.Vector2(window.innerWidth,window.innerHeight);
  const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, {
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace
  });
  composer=new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene,camera));
  bloomPass=new UnrealBloomPass(sz, 0.22, 0.5, 0.88); composer.addPass(bloomPass);
  const outputPass = new OutputPass(); composer.addPass(outputPass);
  return { composer, bloomPass };
}

export function updatePost(t) {
}

export function resizePost(w, h) {
  if (composer) composer.setSize(w, h);
  if (bloomPass) bloomPass.resolution.set(w, h);
}
