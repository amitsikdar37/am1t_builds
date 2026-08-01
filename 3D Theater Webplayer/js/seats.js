import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function makeSeatTexture(size=256) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  // Deep velvet red
  const g = ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
  g.addColorStop(0,'#5a0e0e'); g.addColorStop(1,'#2a0505');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  // Velvet microfiber noise
  for(let i=0;i<5000;i++){
    const x=Math.random()*size,y=Math.random()*size;
    const v=Math.floor(Math.random()*20+40);
    ctx.fillStyle=`rgba(${v},${Math.floor(v*0.12)},${Math.floor(v*0.12)},0.4)`;
    ctx.fillRect(x,y,1,2);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function makeLeatherBumpMap(size=256) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0,0,size,size);
  // Leather micro-crevices
  for(let i=0;i<6000;i++){
    const x=Math.random()*size,y=Math.random()*size;
    const v = Math.random() > 0.5 ? 255 : 0; // high contrast for sharp bumps
    ctx.fillStyle=`rgba(${v},${v},${v},0.15)`;
    // stretch slightly to simulate grain
    ctx.fillRect(x,y, Math.random()*2+1, Math.random()*1+1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

export function buildSeats(scene) {
  const g = new THREE.Group();

  const seatTex = makeSeatTexture();
  const bumpTex = makeLeatherBumpMap();
  
  // High-end luxury leather material
  const sm = new THREE.MeshPhysicalMaterial({ 
    map: seatTex, 
    bumpMap: bumpTex,
    bumpScale: 0.008,
    color: 0x400808, 
    roughness: 0.85,
    metalness: 0.05,
    clearcoat: 0.2,
    clearcoatRoughness: 0.35
  });
  
  const am = new THREE.MeshPhysicalMaterial({ 
    color: 0x080608, 
    roughness: 0.7, 
    metalness: 0.1,
    clearcoat: 0.3,
    clearcoatRoughness: 0.5
  });
  
  const legMat = new THREE.MeshStandardMaterial({ color:0x1a1218, roughness:0.6, metalness:0.3 });
  const stm = new THREE.MeshStandardMaterial({ color:0x100810, roughness:0.98 });
  const stepLight = new THREE.MeshBasicMaterial({ color:0xff6600 });

  const ROWS=16, SPR=26, SS=0.92, RD=1.08, SR=0.24, SZ=-3.0;
  const count = ROWS * SPR;
  const sideCount = ROWS * (SPR + 4);

  // Seat cushion — Rounded, plush cushions
  const cushGeo = new RoundedBoxGeometry(0.74, 0.16, 0.58, 4, 0.06);
  const backGeo = new RoundedBoxGeometry(0.74, 0.70, 0.14, 4, 0.05);
  const headGeo = new RoundedBoxGeometry(0.68, 0.20, 0.20, 5, 0.08);
  
  // Armrests (thick base with slightly softer top)
  const panelGeo = new RoundedBoxGeometry(0.16, 0.75, 0.70, 3, 0.02);
  const armTopGeo = new RoundedBoxGeometry(0.18, 0.08, 0.72, 4, 0.03);
  
  // Cupholder inner
  const cupGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16);
  const cupMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  
  // Thin metal legs
  const legGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8);

  const cIM = new THREE.InstancedMesh(cushGeo, sm, count);
  const bIM = new THREE.InstancedMesh(backGeo, sm, count);
  const hIM = new THREE.InstancedMesh(headGeo, sm, count);
  const pIM = new THREE.InstancedMesh(panelGeo, am, sideCount);
  const aIM = new THREE.InstancedMesh(armTopGeo, am, sideCount);
  const cupIM = new THREE.InstancedMesh(cupGeo, cupMat, sideCount);
  const lIM = new THREE.InstancedMesh(legGeo, legMat, count*2);

  const stGeo = new THREE.BoxGeometry(SPR*SS+2.0, SR+0.05, RD+0.1);
  const stepLightGeo = new THREE.BoxGeometry(0.08, 0.04, 0.12);

  let idx=0, pIdx=0, lIdx=0;
  const d = new THREE.Object3D();

  for(let r=0; r<ROWS; r++) {
    const z = SZ + r*RD, y = -0.35 + r*SR;
    
    // Stepped platform
    const step = new THREE.Mesh(stGeo, stm);
    step.position.set(0, y - SR/2 - 0.02, z); g.add(step);

    // Aisle step lights at right edge every row
    const sl = new THREE.Mesh(stepLightGeo, stepLight);
    sl.position.set(SPR*SS/2 + 0.1, y + 0.08, z);
    g.add(sl);
    const slLight = new THREE.PointLight(0xff6600, 0.6, 2.5);
    slLight.position.set(SPR*SS/2 + 0.3, y + 0.15, z);
    g.add(slLight);

    let lastX = -999;
    for(let s=0; s<=SPR; s++) {
      const isSeat = s < SPR;
      const x = (s - SPR/2 + 0.5) * SS;
      if(Math.abs(x) < 0.25) {
        if(!isSeat && lastX !== -999) {
          d.position.set(lastX+SS/2, y+0.34, z+0.06); d.rotation.set(0,0,0); d.updateMatrix(); pIM.setMatrixAt(pIdx, d.matrix);
          d.position.set(lastX+SS/2, y+0.71, z); d.updateMatrix(); aIM.setMatrixAt(pIdx, d.matrix);
          d.position.set(lastX+SS/2, y+0.751, z-0.25); d.updateMatrix(); cupIM.setMatrixAt(pIdx, d.matrix);
          pIdx++;
        }
        continue;
      }
      if(isSeat) {
        // Cushion
        d.position.set(x, y+0.38, z); d.rotation.set(0,0,0); d.updateMatrix(); cIM.setMatrixAt(idx, d.matrix);
        // Backrest (angled)
        d.position.set(x, y+0.80, z+0.24); d.rotation.set(-0.18,0,0); d.updateMatrix(); bIM.setMatrixAt(idx, d.matrix);
        // Headrest
        d.position.set(x, y+1.20, z+0.30); d.rotation.set(-0.1,0,0); d.updateMatrix(); hIM.setMatrixAt(idx, d.matrix);
        // Legs
        d.position.set(x-0.22, y+0.12, z-0.08); d.rotation.set(0,0,0); d.updateMatrix(); lIM.setMatrixAt(lIdx++, d.matrix);
        d.position.set(x+0.22, y+0.12, z-0.08); d.updateMatrix(); lIM.setMatrixAt(lIdx++, d.matrix);
        idx++;
      }

      const isLeftEdge = s===0 || (Math.abs((s-1 - SPR/2+0.5)*SS) < 0.25);
      if(isSeat || isLeftEdge) {
        const px = isSeat ? x-SS/2 : lastX+SS/2;
        d.position.set(px, y+0.34, z+0.06); d.rotation.set(0,0,0); d.updateMatrix(); pIM.setMatrixAt(pIdx, d.matrix);
        d.position.set(px, y+0.71, z); d.updateMatrix(); aIM.setMatrixAt(pIdx, d.matrix);
        d.position.set(px, y+0.751, z-0.25); d.updateMatrix(); cupIM.setMatrixAt(pIdx, d.matrix);
        pIdx++;
      }
      if(isSeat) lastX = x;
    }
  }

  cIM.count=idx; bIM.count=idx; hIM.count=idx;
  pIM.count=pIdx; aIM.count=pIdx; cupIM.count=pIdx;
  lIM.count=lIdx;
  [cIM, bIM, hIM, pIM, aIM, cupIM, lIM].forEach(m => { m.instanceMatrix.needsUpdate=true; g.add(m); });
  scene.add(g);
}
