import * as THREE from 'three';
import gsap from 'gsap';
import { StarData } from '@/lib/types';
import { createParticleTexture, createPlanetaryRingTexture } from './utils';

const particleTexture = createParticleTexture();
const planetaryRingTexture = createPlanetaryRingTexture();

// Procedural Planet Texture Generator (Ultra High Quality Gas Giant / Terrestrial)
function createPlanetTexture(baseColorHex: string): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  // 4K Textures for extreme planet detail
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const color = new THREE.Color(baseColorHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, `#${new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, hsl.l - 0.25)).getHexString()}`);
  grad.addColorStop(0.5, baseColorHex);
  grad.addColorStop(1, `#${new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0, hsl.l - 0.35)).getHexString()}`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 1024);

  // Add highly detailed gas giant bands and ridges
  for (let y = 0; y < 1024; y++) {
    const noise = Math.sin(y * 0.05) * 0.5 + Math.sin(y * 0.012) * 0.5 + Math.sin(y * 0.1) * 0.2 + Math.sin(y * 0.5) * 0.05;
    if (Math.abs(noise) > 0.15) {
      const lightnessOffset = noise * 0.2;
      const bandColor = new THREE.Color().setHSL(hsl.h, hsl.s * 0.85, Math.max(0, Math.min(1, hsl.l + lightnessOffset)));
      ctx.fillStyle = `#${bandColor.getHexString()}`;
      ctx.fillRect(0, y, 2048, Math.random() * 3 + 1); // Varied band thickness
    }
  }

  // Add micro-storms, craters, and atmospheric turbulence (fine noise)
  for (let i = 0; i < 8000; i++) {
    const sx = Math.random() * 2048;
    const sy = Math.random() * 1024;
    const radius = Math.random() * 4;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16; // Max anisotropic filtering for crisp rendering
  return texture;
}

// Custom Fresnel Atmosphere Shader for a premium glowing rim
const atmosphereVertexShader = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  uniform vec3 color;
  void main() {
    // Calculate Fresnel effect (more intense at grazing angles)
    float intensity = pow(max(0.0, 0.65 - dot(vNormal, vec3(0, 0, 1.0))), 3.5);
    gl_FragColor = vec4(color, intensity * 0.5); // Drastically reduced opacity so it doesn't blow out
  }
`;

export class StarSystemManager {
  public group: THREE.Group;
  public starMeshes: THREE.Mesh[] = [];
  public orbitingBodies: THREE.Group[] = []; // Stores bodies for dynamic elliptical animation
  private orbitalBelts: THREE.Mesh[] = [];
  private atmosphereMeshes: THREE.Mesh[] = [];
  private hoveredMesh: THREE.Mesh | null = null;
  private selectedMesh: THREE.Mesh | null = null;
  private selectionReticle: THREE.Group | null = null;
  private timeTravelListener: EventListener;
  public isRival: boolean = false;

  constructor(stars: StarData[], isRival: boolean = false) {
    this.isRival = isRival;
    this.group = new THREE.Group();
    this.createStarSystems(stars, isRival);
    this.createSelectionReticle(isRival);

    this.timeTravelListener = (e: Event) => {
      const customEvent = e as CustomEvent;
      this.updateTimeTravel(customEvent.detail);
    };
    window.addEventListener('time-travel-scrub', this.timeTravelListener);
  }

  public dispose() {
    window.removeEventListener('time-travel-scrub', this.timeTravelListener);
    
    this.starMeshes.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.atmosphereMeshes.forEach((m) => {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    });
    this.orbitalBelts.forEach((b) => {
      b.geometry.dispose();
      (b.material as THREE.Material).dispose();
    });
  }

  private updateTimeTravel(targetYear: number) {
    this.orbitingBodies.forEach((starGroup) => {
      // Find the starMesh inside this group
      const starMesh = starGroup.children.find(child => child.userData && child.userData.isStar);
      if (starMesh) {
        const starData = starMesh.userData.starData as StarData;
        const creationYear = new Date(starData.createdAt).getFullYear();
        
        // GSAP animate scale
        if (creationYear > targetYear) {
          // This repo didn't exist yet! Shrink it away to dust.
          gsap.to(starGroup.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.8, ease: "power2.out" });
        } else {
          // It existed. Bring it back to full size.
          gsap.to(starGroup.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: "back.out(1.7)" });
        }
      }
    });
  }

  private createStarSystems(stars: StarData[], isRival: boolean) {
    const sphereGeo = new THREE.SphereGeometry(1, 48, 48); // High poly sphere for premium look

    stars.forEach((star, idx) => {
      const pivot = new THREE.Group();
      // Orbit speed: inner planets fast, outer planets slow (Kepler approximation)
      pivot.userData = { orbitSpeed: 0.15 / Math.sqrt(Math.max(1, star.distanceFromCore)) };
      
      const starGroup = new THREE.Group();
      starGroup.position.set(star.x, star.y, star.z);

      const color = new THREE.Color(star.languageColor);
      const planetTexture = createPlanetTexture(star.languageColor);

      // 1. Premium Solid Planet Mesh
      const starMat = new THREE.MeshStandardMaterial({
        map: planetTexture,
        bumpMap: planetTexture, // Self-bump mapping using the procedural canvas!
        bumpScale: star.radius * 0.08, // Gives actual 3D physical depth to the gas bands and craters
        roughness: 0.8,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: 0.02, // Lowered back down so we can see the procedural textures!
      });
      const starMesh = new THREE.Mesh(sphereGeo, starMat);
      starMesh.scale.set(star.radius, star.radius, star.radius);
      
      // Tilt the planet on its axis randomly for realism
      starMesh.rotation.z = (Math.random() - 0.5) * 0.4;
      starMesh.rotation.x = (Math.random() - 0.5) * 0.4;
      
      starMesh.userData = { starData: star, isStar: true, baseRadius: star.radius, index: idx, isRival };
      
      this.starMeshes.push(starMesh);
      starGroup.add(starMesh);

      // 2. Premium Atmospheric Fresnel Rim (Applied to ALL planets but tighter)
      const atmosphereColor = isRival ? color.clone().lerp(new THREE.Color(0xf43f5e), 0.6) : color;
      const atmosphereMat = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: atmosphereColor }
        },
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      });
      const atmosphereMesh = new THREE.Mesh(sphereGeo, atmosphereMat);
      
      // Tightened the atmosphere scale significantly
      const atmosphereScale = star.hasHaloAndRings ? star.radius * 1.18 : star.radius * 1.12;
      atmosphereMesh.scale.set(atmosphereScale, atmosphereScale, atmosphereScale);
      atmosphereMesh.userData = { baseScale: atmosphereScale, index: idx };
      
      this.atmosphereMeshes.push(atmosphereMesh);
      starGroup.add(atmosphereMesh);

      // 4. Solid Planetary Disc Rings (Saturn style)
      if (star.hasHaloAndRings && star.particleBeltCount > 0) {
        const ringInnerRadius = star.radius * 1.35;
        const ringOuterRadius = star.radius * (1.8 + star.particleBeltCount * 0.15);

        const ringGeo = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 64);
        
        // Use custom UV mapping so the 1D gradient texture wraps radially from inner to outer edge
        const pos = ringGeo.attributes.position;
        const uvs = ringGeo.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          const vertex = new THREE.Vector3().fromBufferAttribute(pos, i);
          // Distance from center determines the UV X coordinate
          const dist = vertex.length();
          const normalizedDist = (dist - ringInnerRadius) / (ringOuterRadius - ringInnerRadius);
          uvs.setXY(i, normalizedDist, 0.5);
        }

        const ringMat = new THREE.MeshBasicMaterial({
          map: planetaryRingTexture,
          color: new THREE.Color(color.r, color.g, color.b),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.8,
          blending: THREE.NormalBlending,
          depthWrite: false,
          depthTest: true,
        });

        const beltMesh = new THREE.Mesh(ringGeo, ringMat);
        
        // Tilt the rings naturally
        beltMesh.rotation.x = THREE.MathUtils.degToRad(75 + (star.stars % 30) - 15);
        beltMesh.rotation.y = THREE.MathUtils.degToRad((star.stars % 40) - 20);
        
        // Speed controls rotation of the textured disc
        beltMesh.userData = { speed: star.particleBeltSpeed * 0.5 };

        this.orbitalBelts.push(beltMesh);
        starGroup.add(beltMesh);
      }

      // Orbital Mechanics: 
      // 1. Create a plane rotated by periapsis and inclination
      const orbitPlane = new THREE.Group();
      orbitPlane.rotation.y = star.periapsis;
      orbitPlane.rotation.x = star.inclination;
      
      // 2. Draw faint visible orbital tracks
      const trackGeo = new THREE.BufferGeometry();
      const trackPoints = [];
      for (let i = 0; i <= 128; i++) {
        const theta = (i / 128) * Math.PI * 2;
        trackPoints.push(new THREE.Vector3(star.a * Math.cos(theta), 0, star.b * Math.sin(theta)));
      }
      trackGeo.setFromPoints(trackPoints);
      const trackMat = new THREE.LineBasicMaterial({
        color: isRival ? 0xf43f5e : 0x38bdf8,
        transparent: true,
        opacity: isRival ? 0.25 : 0.15,
        blending: THREE.AdditiveBlending,
      });
      const trackMesh = new THREE.Line(trackGeo, trackMat);
      orbitPlane.add(trackMesh);

      // 3. Store dynamic animation state in the starGroup
      starGroup.userData = { 
        a: star.a, 
        b: star.b, 
        speed: star.orbitSpeed, 
        angle: star.anomaly 
      };

      // Set initial position on the ellipse
      starGroup.position.set(
        star.a * Math.cos(star.anomaly),
        0,
        star.b * Math.sin(star.anomaly)
      );

      orbitPlane.add(starGroup);
      this.group.add(orbitPlane);
      this.orbitingBodies.push(starGroup);
    });
  }

  private createSelectionReticle(isRival: boolean) {
    this.selectionReticle = new THREE.Group();
    this.selectionReticle.visible = false;

    // Glowing target ring around selected star
    const ringGeo = new THREE.RingGeometry(1.4, 1.55, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isRival ? 0xf43f5e : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    this.selectionReticle.add(ringMesh);

    // Target crosshair brackets
    const bracketGeo = new THREE.BufferGeometry();
    const bracketPositions = new Float32Array([
      -2, 0, 0,  -1.6, 0, 0,
       2, 0, 0,   1.6, 0, 0,
       0, 0, -2,  0, 0, -1.6,
       0, 0,  2,  0, 0,  1.6
    ]);
    bracketGeo.setAttribute('position', new THREE.BufferAttribute(bracketPositions, 3));
    const bracketMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bracketLines = new THREE.LineSegments(bracketGeo, bracketMat);
    this.selectionReticle.add(bracketLines);

    this.group.add(this.selectionReticle);
  }

  public setHoveredStar(mesh: THREE.Mesh | null) {
    if (this.hoveredMesh && this.hoveredMesh !== this.selectedMesh) {
      const star = this.hoveredMesh.userData.starData as StarData;
      this.hoveredMesh.scale.set(star.radius, star.radius, star.radius);
    }

    this.hoveredMesh = mesh;

    if (this.hoveredMesh) {
      const star = this.hoveredMesh.userData.starData as StarData;
      const hoverScale = star.radius * 1.35;
      this.hoveredMesh.scale.set(hoverScale, hoverScale, hoverScale);
    }
  }

  public setSelectedStar(mesh: THREE.Mesh | null) {
    this.selectedMesh = mesh;

    if (!mesh || !this.selectionReticle) {
      if (this.selectionReticle) {
        this.selectionReticle.visible = false;
        // Move back to root group when hidden
        this.group.add(this.selectionReticle);
      }
      return;
    }

    const star = mesh.userData.starData as StarData;
    this.selectionReticle.visible = true;
    
    // Add reticle to the starGroup so it follows the orbiting planet
    if (mesh.parent) {
      mesh.parent.add(this.selectionReticle);
      this.selectionReticle.position.set(0, 0, 0); // Local to starGroup
    }
      const scale = star.radius * 1.6;
    this.selectionReticle.scale.set(scale, scale, scale);
  }

  public update(delta: number, elapsed: number, isPaused: boolean = false) {
    if (delta > 0.1) delta = 0.1; // Cap delta to prevent massive jumps when tab is inactive

    // 0. Spin elliptical orbits dynamically
    if (!isPaused) {
      this.orbitingBodies.forEach((body) => {
        const data = body.userData;
        data.angle -= delta * data.speed;
        body.position.x = data.a * Math.cos(data.angle);
        // z is used here because the orbit plane is laid flat
        body.position.z = data.b * Math.sin(data.angle);
      });
    }

    // 1. Spin orbital solid rings along their local Z-axis
    this.orbitalBelts.forEach((belt) => {
      const speed = belt.userData.speed || 0.5;
      if (!isPaused) {
        belt.rotation.z -= delta * speed;
      }
    });

    // 2. Pulse star scales organically (creates active cosmic life!)
    this.starMeshes.forEach((mesh) => {
      if (mesh !== this.hoveredMesh) {
        const baseRadius = mesh.userData.baseRadius || 1;
        const idx = mesh.userData.index || 0;
        const pulse = 1 + Math.sin(elapsed * 2.4 + idx * 0.8) * 0.04;
        const s = baseRadius * pulse;
        mesh.scale.set(s, s, s);
      }
    });

    // 3. Pulse atmosphere halos
    this.atmosphereMeshes.forEach((atmosphere) => {
      const baseScale = atmosphere.userData.baseScale || 1;
      const idx = atmosphere.userData.index || 0;
      const pulse = baseScale * (1 + Math.sin(elapsed * 2.0 + idx * 0.8) * 0.05);
      atmosphere.scale.set(pulse, pulse, pulse);
    });

    // 4. Spin selection reticle
    if (this.selectionReticle && this.selectionReticle.visible) {
      this.selectionReticle.rotation.y += delta * 0.8;
    }
  }


}
