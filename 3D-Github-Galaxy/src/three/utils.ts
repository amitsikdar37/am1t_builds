import * as THREE from 'three';

export function createParticleTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function createPlanetaryRingTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture();
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  
  // Inner edge (transparent, touching planet atmosphere)
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  // Faint innermost crepe ring
  grad.addColorStop(0.1, 'rgba(255, 255, 255, 0.15)');
  grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.4)');
  // Inner gap
  grad.addColorStop(0.28, 'rgba(255, 255, 255, 0.05)');
  // Main thick bright ring
  grad.addColorStop(0.32, 'rgba(255, 255, 255, 0.7)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.8)');
  // Cassini Division (Gap)
  grad.addColorStop(0.75, 'rgba(255, 255, 255, 0.02)');
  grad.addColorStop(0.78, 'rgba(255, 255, 255, 0.0)');
  // Faint dusty outer ring
  grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.4)');
  grad.addColorStop(0.95, 'rgba(255, 255, 255, 0.1)');
  // Outer fade
  grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 2);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}