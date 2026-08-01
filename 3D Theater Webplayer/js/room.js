import * as THREE from 'three';
import { ROOM_W, ROOM_H, ROOM_D, SCR_Z, SCR_Y, SCR_H } from './config.js';

function makeCarpetTexture(size=512) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#100404'; ctx.fillRect(0,0,size,size);
  for(let i=0;i<12000;i++){
    const x=Math.random()*size, y=Math.random()*size;
    const r=Math.floor(Math.random()*30+10), g=Math.floor(Math.random()*4), b=Math.floor(Math.random()*4);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.fillRect(x,y,1+Math.random()*1.5, 1+Math.random()*1.5);
  }
  // Diamond pattern
  ctx.strokeStyle='rgba(80,8,8,0.18)'; ctx.lineWidth=1;
  for(let x=0;x<size;x+=28){
    for(let y=0;y<size;y+=28){
      ctx.beginPath(); ctx.moveTo(x+14,y); ctx.lineTo(x+28,y+14); ctx.lineTo(x+14,y+28); ctx.lineTo(x,y+14); ctx.closePath(); ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12,18);
  return t;
}

function makeWallTexture(size=512) {
  const c = document.createElement('canvas'); c.width=size; c.height=size;
  const ctx = c.getContext('2d');
  // Dark charcoal base
  const g = ctx.createLinearGradient(0,0,size,size);
  g.addColorStop(0,'#0e080e'); g.addColorStop(0.5,'#0a060a'); g.addColorStop(1,'#0e080e');
  ctx.fillStyle=g; ctx.fillRect(0,0,size,size);
  // Subtle vertical fabric weave
  ctx.strokeStyle='rgba(40,20,40,0.3)'; ctx.lineWidth=1;
  for(let x=0;x<size;x+=3){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke(); }
  // Horizontal ribbing
  ctx.strokeStyle='rgba(60,30,60,0.15)'; ctx.lineWidth=2;
  for(let y=0;y<size;y+=8){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6,8);
  return t;
}

function makeCeilingTexture(size=512) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#050305'; ctx.fillRect(0,0,size,size);
  // Acoustic tile grid
  ctx.strokeStyle='rgba(30,20,30,0.6)'; ctx.lineWidth=2;
  const tile=48;
  for(let x=0;x<size;x+=tile){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke(); }
  for(let y=0;y<size;y+=tile){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke(); }
  // Dot pattern on tiles
  ctx.fillStyle='rgba(25,15,25,0.8)';
  for(let x=0;x<size;x+=tile){
    for(let y=0;y<size;y+=tile){
      for(let d=0;d<6;d++){
        const dx=Math.random()*tile*0.8+tile*0.1, dy=Math.random()*tile*0.8+tile*0.1;
        ctx.beginPath(); ctx.arc(x+dx,y+dy,1.5,0,Math.PI*2); ctx.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8,6);
  return t;
}

function makeFloorTexture(size=512) {
  const c = document.createElement('canvas'); c.width=c.height=size;
  const ctx = c.getContext('2d');
  ctx.fillStyle='#0a0608'; ctx.fillRect(0,0,size,size);
  // Concrete-like texture with subtle variation
  for(let i=0;i<8000;i++){
    const x=Math.random()*size, y=Math.random()*size;
    const v=Math.floor(Math.random()*15+8);
    ctx.fillStyle=`rgba(${v},${Math.floor(v*0.6)},${v},0.5)`;
    ctx.fillRect(x,y,2,2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10,14);
  return t;
}

export function buildRoom(scene) {
  const g = new THREE.Group();

  const carpetTex = makeCarpetTexture();
  const wallTex   = makeWallTexture();
  const ceilTex   = makeCeilingTexture();
  const floorTex  = makeFloorTexture();

  const fm = new THREE.MeshStandardMaterial({ map:carpetTex, roughness:0.98, color:0x220808 });
  const wm = new THREE.MeshStandardMaterial({ map:wallTex,   roughness:0.92, color:0x150a15 });
  const cm = new THREE.MeshStandardMaterial({ map:ceilTex,   roughness:1.0,  color:0x100810 });
  const stageFloorMat = new THREE.MeshStandardMaterial({ map:floorTex, roughness:0.85, color:0x111111 });

  // Floor (carpeted auditorium)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), fm);
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.01; g.add(floor);

  // Stage floor (bare dark concrete in front of screen)
  const sFloor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W+6, 10), stageFloorMat);
  sFloor.rotation.x = -Math.PI/2; sFloor.position.set(0, -0.005, SCR_Z+4); g.add(sFloor);

  // Ceiling
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), cm);
  ceil.rotation.x = Math.PI/2; ceil.position.y = ROOM_H; g.add(ceil);

  // Walls
  const cy = ROOM_H/2;
  const mkWall = (w,h,x,y,z,ry) => { const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),wm); m.position.set(x,y,z); m.rotation.y=ry; g.add(m); };
  mkWall(ROOM_D, ROOM_H, -ROOM_W/2, cy, 0,  Math.PI/2);
  mkWall(ROOM_D, ROOM_H,  ROOM_W/2, cy, 0, -Math.PI/2);
  mkWall(ROOM_W, ROOM_H, 0, cy,  ROOM_D/2, Math.PI);
  mkWall(ROOM_W, ROOM_H, 0, cy, -ROOM_D/2, 0);

  // Front face above screen (black masking)
  const fh = ROOM_H - SCR_H - 1.5;
  const tf = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, fh), new THREE.MeshStandardMaterial({color:0x020102, roughness:1}));
  tf.position.set(0, SCR_Y+SCR_H/2+fh/2+0.08, SCR_Z+0.01); g.add(tf);

  // ── Decorative wall panels on side walls ──────────────────────────────────
  const panelMat = new THREE.MeshStandardMaterial({ color:0x1a0a1a, roughness:0.85 });
  const panelFrameMat = new THREE.MeshStandardMaterial({ color:0x8b6914, roughness:0.4, metalness:0.5 });
  const panelGeo = new THREE.PlaneGeometry(2.4, ROOM_H * 0.55);
  const panelFrameGeo = new THREE.BoxGeometry(2.5, ROOM_H * 0.55 + 0.15, 0.05);
  
  for(let side of [-1, 1]) {
    const wx = side * (ROOM_W/2 - 0.02);
    const ry = side === -1 ? Math.PI/2 : -Math.PI/2;
    // 4 vertical fabric panels per side
    for(let i = 0; i < 4; i++) {
      const z = -ROOM_D/2 + 5 + i * (ROOM_D * 0.18);
      const panel = new THREE.Mesh(panelGeo, panelMat);
      panel.position.set(wx, cy*0.7, z); panel.rotation.y = ry; g.add(panel);
      
      const frame = new THREE.Mesh(panelFrameGeo, panelFrameMat);
      const fz = z + (side === -1 ? 0.03 : -0.03);
      frame.position.set(wx, cy*0.7, fz); frame.rotation.y = ry; g.add(frame);
    }
  }

  // ── Acoustic ceiling panels ───────────────────────────────────────────────
  const acMat = new THREE.MeshStandardMaterial({ color:0x060408, roughness:1.0 });
  const acGeo = new THREE.BoxGeometry(2.0, 0.12, 2.0);
  const acIM  = new THREE.InstancedMesh(acGeo, acMat, 500);
  let ai = 0; const da = new THREE.Object3D();
  for(let x = -ROOM_W/2 + 2; x < ROOM_W/2 - 1; x += 2.4) {
    for(let z = -ROOM_D/2 + 2; z < ROOM_D/2 - 1; z += 2.4) {
      da.position.set(x, ROOM_H - 0.1, z); da.updateMatrix(); acIM.setMatrixAt(ai++, da.matrix);
    }
  }
  acIM.count = ai; acIM.instanceMatrix.needsUpdate = true; g.add(acIM);

  // ── Ceiling edge crown moulding ───────────────────────────────────────────
  const crownMat = new THREE.MeshStandardMaterial({ color:0x8b6914, roughness:0.4, metalness:0.4 });
  const cr = (w,d,x,y,z,ry) => { const m=new THREE.Mesh(new THREE.BoxGeometry(w,0.12,d),crownMat); m.position.set(x,y,z); m.rotation.y=ry; g.add(m); };
  cr(ROOM_W, 0.3, 0, ROOM_H-0.06, -ROOM_D/2+0.15, 0);
  cr(ROOM_W, 0.3, 0, ROOM_H-0.06,  ROOM_D/2-0.15, 0);
  cr(ROOM_D, 0.3, -ROOM_W/2+0.15, ROOM_H-0.06, 0, Math.PI/2);
  cr(ROOM_D, 0.3,  ROOM_W/2-0.15, ROOM_H-0.06, 0, Math.PI/2);

  // ── Baseboard on side walls ───────────────────────────────────────────────
  const baseMat = new THREE.MeshStandardMaterial({ color:0x111011, roughness:0.7 });
  const bsGeo = new THREE.BoxGeometry(ROOM_D, 0.25, 0.08);
  const bL = new THREE.Mesh(bsGeo, baseMat); bL.position.set(-ROOM_W/2+0.04, 0.12, 0); bL.rotation.y=Math.PI/2; g.add(bL);
  const bR = bL.clone(); bR.position.x = ROOM_W/2-0.04; g.add(bR);

  scene.add(g);
}
