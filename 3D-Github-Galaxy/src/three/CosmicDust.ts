import * as THREE from 'three';
import { createParticleTexture } from './utils';

export class CosmicDust {
  public points: THREE.Points;
  private rotationSpeed: number = 0.005; // Very slow majestic rotation

  constructor(particleCount: number = 15000) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Realistic star colors: White, Blue-White, Yellow, Orange, Red Dwarfs
    const starColors = [
      new THREE.Color(0xffffff), // White
      new THREE.Color(0xe0f2fe), // Blue-White
      new THREE.Color(0xfef08a), // Yellow
      new THREE.Color(0xfed7aa), // Orange
      new THREE.Color(0xfca5a5), // Red
    ];

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;

      // Deep space spherical distribution (radius between 100 and 400)
      const r = 100 + Math.pow(Math.random(), 1.5) * 300; 
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);

      // Pick a random star color
      const color = starColors[Math.floor(Math.random() * starColors.length)];
      // Randomize brightness/dimness
      const brightness = 0.4 + Math.random() * 0.6;

      colors[i3] = color.r * brightness;
      colors[i3 + 1] = color.g * brightness;
      colors[i3 + 2] = color.b * brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.8,
      map: createParticleTexture(),
      alphaMap: createParticleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
  }

  public update(delta: number) {
    if (this.points) {
      this.points.rotation.y += delta * this.rotationSpeed;
      this.points.rotation.x += delta * (this.rotationSpeed * 0.5); // Slight tilt drift
    }
  }

  public dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
