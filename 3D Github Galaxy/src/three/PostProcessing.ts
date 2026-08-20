import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface BloomSettings {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

export class PostProcessingManager {
  public composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private isBloomEnabled: boolean = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    this.composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // UnrealBloomPass: Creates glowing sci-fi emissive halos
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.4, // Strength
      0.45, // Radius
      0.35  // Threshold (ensures stars and core glow brightly)
    );

    this.composer.addPass(this.bloomPass);
  }

  public setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public setBloomStrength(strength: number) {
    this.bloomPass.strength = strength;
  }

  public setBloomEnabled(enabled: boolean) {
    this.isBloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
  }

  public getBloomEnabled(): boolean {
    return this.isBloomEnabled;
  }

  public render() {
    this.composer.render();
  }

  public dispose() {
    this.composer.dispose();
  }
}
