import * as THREE from 'three';
import { createParticleTexture } from './utils';

export class CentralCore {
  public group: THREE.Group;
  private coreMesh: THREE.Mesh;
  private outerCoronaMesh: THREE.Mesh;
  private solarFlares: THREE.Points;
  private nameSprite: THREE.Sprite;
  private rotationSpeed: number = 0.2;

  constructor(radius: number = 3.5, luminosity: number = 1.5, username: string = "", isRival: boolean = false) {
    this.group = new THREE.Group();

    // 0. 3D Username Label
    const canvas = document.createElement('canvas');
    // Double resolution for crisp supersampled text
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Remove manual shadow because UnrealBloomPass will naturally bloom bright text
      // Manual shadow + Bloom = muddy blur
      ctx.font = 'bold 220px "Inter", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text
      ctx.fillStyle = isRival ? '#fb7185' : '#7dd3fc'; // slightly lighter/brighter colors for crispness
      ctx.fillText('@' + username, 1024, 256);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter; // Ensures crisp scaling
    
    const spriteMat = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: false 
    });
    this.nameSprite = new THREE.Sprite(spriteMat);
    // Position it hovering above the star and make it physically larger in the 3D scene
    this.nameSprite.position.set(0, radius * 3.5, 0);
    this.nameSprite.scale.set(36, 9, 1);
    this.group.add(this.nameSprite);

    // 1. Central Star Sphere (The Sun)
    const coreGeo = new THREE.SphereGeometry(radius, 64, 64);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff), // Pure white hot core
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.group.add(this.coreMesh);

    // 2. Solar Corona (Glowing Aura)
    const coronaGeo = new THREE.SphereGeometry(radius * 1.4, 64, 64); // Tighter corona
    
    // Custom shader for intense glowing corona fading to edges
    const coronaVertexShader = `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const coronaFragmentShader = `
      varying vec3 vNormal;
      void main() {
        // Fresnel glow effect (hollow in center, bright at edges)
        float intensity = pow(max(0.0, 0.65 - dot(vNormal, vec3(0, 0, 1.0))), 2.5);
        gl_FragColor = vec4(0.22, 0.74, 0.98, 1.0) * intensity * 0.7; // Toned down intensity significantly
      }
    `;

    const coronaMat = new THREE.ShaderMaterial({
      vertexShader: coronaVertexShader,
      fragmentShader: coronaFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });

    this.outerCoronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    this.group.add(this.outerCoronaMesh);

    // 3. Ambient Star Glow (Smooth volumetric light ball)
    const glowGeo = new THREE.SphereGeometry(radius * 2.2, 32, 32); // Smaller radius
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x38bdf8),
      transparent: true,
      opacity: 0.08, // Halved opacity to prevent whiteout
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(glowMesh);

    // 4. Solar Flares / Plasma Particles
    const flareCount = 1500;
    const flareGeo = new THREE.BufferGeometry();
    const flarePositions = new Float32Array(flareCount * 3);
    const flareColors = new Float32Array(flareCount * 3);
    
    const hotBlue = new THREE.Color(0xe0f2fe);
    const midBlue = new THREE.Color(0x38bdf8);

    for (let i = 0; i < flareCount; i++) {
      const i3 = i * 3;
      
      // Distribute particles in a spherical shell around the star
      const r = radius + (Math.random() * radius * 0.8);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      flarePositions[i3] = r * Math.sin(phi) * Math.cos(theta);
      flarePositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      flarePositions[i3 + 2] = r * Math.cos(phi);

      const color = Math.random() > 0.5 ? hotBlue : midBlue;
      flareColors[i3] = color.r;
      flareColors[i3 + 1] = color.g;
      flareColors[i3 + 2] = color.b;
    }

    flareGeo.setAttribute('position', new THREE.BufferAttribute(flarePositions, 3));
    flareGeo.setAttribute('color', new THREE.BufferAttribute(flareColors, 3));

    const flareMat = new THREE.PointsMaterial({
      size: 0.6,
      map: createParticleTexture(),
      alphaMap: createParticleTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.4, // Reduced from 0.8 to prevent blowout
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.solarFlares = new THREE.Points(flareGeo, flareMat);
    this.group.add(this.solarFlares);
  }

  public update(delta: number, elapsed: number) {
    if (this.solarFlares) {
      // Rotate the plasma particles to simulate swirling star surface
      this.solarFlares.rotation.y += delta * this.rotationSpeed;
      this.solarFlares.rotation.z += delta * (this.rotationSpeed * 0.3);
      
      // Pulse the scale slightly to make it feel alive
      const pulse = 1 + Math.sin(elapsed * 3) * 0.02;
      this.solarFlares.scale.set(pulse, pulse, pulse);
    }
    
    if (this.outerCoronaMesh) {
      const coronaPulse = 1 + Math.sin(elapsed * 1.5) * 0.05;
      this.outerCoronaMesh.scale.set(coronaPulse, coronaPulse, coronaPulse);
    }
  }

  public dispose() {
    this.coreMesh.geometry.dispose();
    (this.coreMesh.material as THREE.Material).dispose();
    this.outerCoronaMesh.geometry.dispose();
    (this.outerCoronaMesh.material as THREE.Material).dispose();
    this.solarFlares.geometry.dispose();
    (this.solarFlares.material as THREE.Material).dispose();
    
    if (this.nameSprite) {
      if ((this.nameSprite.material as THREE.SpriteMaterial).map) {
        (this.nameSprite.material as THREE.SpriteMaterial).map!.dispose();
      }
      (this.nameSprite.material as THREE.Material).dispose();
    }
  }
}
