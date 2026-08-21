import * as THREE from 'three';
import { StarData } from '@/lib/types';

export class ConstellationLines {
  public group: THREE.Group;
  private lineSegments: THREE.LineSegments | null = null;
  private pairs: { m1: THREE.Mesh; m2: THREE.Mesh }[] = [];
  private isVisible: boolean = true;

  constructor(stars: StarData[], starMeshes: THREE.Mesh[]) {
    this.group = new THREE.Group();
    this.buildConstellations(stars, starMeshes);
  }

  private buildConstellations(stars: StarData[], starMeshes: THREE.Mesh[]) {
    if (stars.length < 2) return;

    const linePositions: number[] = [];
    const lineColors: number[] = [];

    // Create a map of star id to mesh for quick lookup
    const meshMap = new Map<string, THREE.Mesh>();
    starMeshes.forEach((mesh) => {
      const id = (mesh.userData.starData as StarData).id;
      meshMap.set(id, mesh);
    });

    const langMap: Record<string, StarData[]> = {};
    stars.forEach((s) => {
      if (!langMap[s.language]) langMap[s.language] = [];
      langMap[s.language].push(s);
    });

    Object.entries(langMap).forEach(([, langStars]) => {
      if (langStars.length < 2) return;
      const color = new THREE.Color(langStars[0].languageColor);

      for (let i = 0; i < langStars.length; i++) {
        for (let j = i + 1; j < langStars.length; j++) {
          const s1 = langStars[i];
          const s2 = langStars[j];

          const dx = s1.x - s2.x;
          const dy = s1.y - s2.y;
          const dz = s1.z - s2.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < 40) {
            linePositions.push(s1.x, s1.y, s1.z);
            linePositions.push(s2.x, s2.y, s2.z);
            lineColors.push(color.r * 0.45, color.g * 0.45, color.b * 0.45);
            lineColors.push(color.r * 0.45, color.g * 0.45, color.b * 0.45);
            
            const m1 = meshMap.get(s1.id);
            const m2 = meshMap.get(s2.id);
            if (m1 && m2) {
              this.pairs.push({ m1, m2 });
            }
          }
        }
      }
    });

    if (linePositions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(lineColors), 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.lineSegments = new THREE.LineSegments(geometry, material);
    this.group.add(this.lineSegments);
  }

  public update() {
    if (!this.lineSegments || !this.isVisible) return;
    
    const positions = this.lineSegments.geometry.attributes.position.array as Float32Array;
    const v = new THREE.Vector3();
    
    for (let i = 0; i < this.pairs.length; i++) {
      const { m1, m2 } = this.pairs[i];
      const idx = i * 6;
      
      m1.getWorldPosition(v);
      positions[idx] = v.x;
      positions[idx + 1] = v.y;
      positions[idx + 2] = v.z;
      
      m2.getWorldPosition(v);
      positions[idx + 3] = v.x;
      positions[idx + 4] = v.y;
      positions[idx + 5] = v.z;
    }
    
    this.lineSegments.geometry.attributes.position.needsUpdate = true;
  }

  public setVisible(visible: boolean) {
    this.isVisible = visible;
    this.group.visible = visible;
  }

  public getVisible(): boolean {
    return this.isVisible;
  }

  public dispose() {
    if (this.lineSegments) {
      this.lineSegments.geometry.dispose();
      (this.lineSegments.material as THREE.Material).dispose();
    }
  }
}
