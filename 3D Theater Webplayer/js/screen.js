import * as THREE from 'three';
import { ROOM_W, ROOM_H, SCR_W, SCR_H, SCR_Z, SCR_Y } from './config.js';

let screenMesh, bt, bb, bl, br, curtL, curtR;
let subtitleCtx, subtitleCanvas, subtitleTexture, subtitleMesh;

export function buildScreen(scene, videoTexture) {
  const geo = new THREE.PlaneGeometry(SCR_W, SCR_H, 48, 1);
  const pos = geo.attributes.position;
  for(let i=0; i<pos.count; i++) {
    const nx = pos.getX(i)/(SCR_W/2);
    pos.setZ(i, -1.8*nx*nx);
  }
  pos.needsUpdate=true; geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({ 
    map: videoTexture, 
    toneMapped: false,
    color: new THREE.Color(1.6, 1.6, 1.6) // Boost screen brightness multiplier
  });
  screenMesh = new THREE.Mesh(geo, mat);
  screenMesh.position.set(0, SCR_Y, SCR_Z);

  // Bezel
  const bm = new THREE.MeshStandardMaterial({ color:0x030203, roughness:1.0 });
  bt = new THREE.Mesh(new THREE.BoxGeometry(SCR_W+0.5, 0.25, 0.15), bm);
  bt.position.set(0, SCR_Y+SCR_H/2+0.12, SCR_Z-0.02);
  bb = bt.clone(); bb.position.y = SCR_Y-SCR_H/2-0.12;
  bl = new THREE.Mesh(new THREE.BoxGeometry(0.25, SCR_H+0.5, 0.15), bm);
  bl.position.set(-SCR_W/2-0.12, SCR_Y, SCR_Z-0.02);
  br = bl.clone(); br.position.x = SCR_W/2+0.12;

  // Deep black screen surround to frame the picture
  const surroundMat = new THREE.MeshBasicMaterial({ color:0x000000 });
  const surroundGeo = new THREE.PlaneGeometry(ROOM_W+2, ROOM_H*0.85);
  const surround = new THREE.Mesh(surroundGeo, surroundMat);
  surround.position.set(0, SCR_Y, SCR_Z - 2.0); // Pushed back behind max curve depth (-1.8)
  
  // 3D Subtitles Mesh (same geometry as screen, just slightly in front)
  subtitleCanvas = document.createElement('canvas');
  subtitleCanvas.width = 2048;
  subtitleCanvas.height = 1170; // 28:16 Aspect ratio prevents horizontal stretching
  subtitleCtx = subtitleCanvas.getContext('2d');
  subtitleTexture = new THREE.CanvasTexture(subtitleCanvas);
  subtitleTexture.minFilter = THREE.LinearFilter;

  const subGeo = new THREE.PlaneGeometry(SCR_W, SCR_H, 48, 1);
  const subPos = subGeo.attributes.position;
  for(let i=0; i<subPos.count; i++) {
    const nx = subPos.getX(i)/(SCR_W/2);
    subPos.setZ(i, -1.8*nx*nx + 0.05); // 0.05 units in front of screen
  }
  subGeo.computeVertexNormals();

  const subMat = new THREE.MeshBasicMaterial({ map: subtitleTexture, transparent: true, depthWrite: false });
  subtitleMesh = new THREE.Mesh(subGeo, subMat);
  subtitleMesh.position.set(0, SCR_Y, SCR_Z);

  const grp = new THREE.Group();
  grp.add(surround, screenMesh, subtitleMesh, bt, bb, bl, br);
  scene.add(grp);
}

let lastSubText = null;
export function updateSubtitles(text) {
  if (!subtitleCtx || text === lastSubText) return;
  lastSubText = text;
  
  subtitleCtx.clearRect(0, 0, subtitleCanvas.width, subtitleCanvas.height);
  if (text) {
    subtitleCtx.font = 'bold 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
    subtitleCtx.fillStyle = '#f5f5f5';
    subtitleCtx.textAlign = 'center';
    subtitleCtx.textBaseline = 'top'; // Top baseline prevents multi-line overlaps
    
    // Soft shadow for cinematic look
    subtitleCtx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    subtitleCtx.shadowBlur = 8;
    subtitleCtx.shadowOffsetX = 3;
    subtitleCtx.shadowOffsetY = 3;
    
    // Outline stroke for legibility over bright scenes
    subtitleCtx.lineWidth = 4;
    subtitleCtx.strokeStyle = 'rgba(0,0,0,0.8)';
    
    const lines = text.trim().split('\n');
    const lineHeight = 65;
    const blockHeight = lines.length * lineHeight;
    // Place perfectly at the bottom above the bezel (increased padding from 140 to 220 to avoid cropping)
    const yStart = subtitleCanvas.height - 220 - blockHeight;
    
    lines.forEach((line, i) => {
      const y = yStart + i * lineHeight;
      subtitleCtx.strokeText(line, subtitleCanvas.width/2, y);
      subtitleCtx.fillText(line, subtitleCanvas.width/2, y);
    });
  }
  subtitleTexture.needsUpdate = true;
}

export function buildCurtains(scene) {
  const g = new THREE.Group();
  const cm = new THREE.MeshStandardMaterial({ color:0x200606, roughness:0.98, side:THREE.DoubleSide });
  const tm = new THREE.MeshStandardMaterial({ color:0x8b6914, roughness:0.4, metalness:0.5 });

  const mkCurt = (xPos) => {
    const geo = new THREE.PlaneGeometry(16, ROOM_H, 48, 1);
    const p = geo.attributes.position;
    for(let i=0; i<p.count; i++) {
      const nx = p.getX(i);
      p.setZ(i, Math.sin(nx*0.5)*0.35 + Math.sin(nx*1.3)*0.12);
    }
    p.needsUpdate=true; geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, cm);
    m.position.set(xPos, ROOM_H/2, SCR_Z-0.25);
    g.add(m); return m;
  };
  curtL = mkCurt(-SCR_W/2-8);
  curtR = mkCurt( SCR_W/2+8);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, ROOM_W+6, 12), tm);
  rod.rotation.z = Math.PI/2;
  rod.position.set(0, ROOM_H-0.22, SCR_Z-0.18);
  g.add(rod);
  scene.add(g);
}

export function updateScreenMasking(videoAspect, videoTexture) {
  if(!screenMesh) return;
  const maxAspect = SCR_W / SCR_H;
  let targetW = SCR_W, targetH = SCR_H;
  
  // Reset texture UVs
  if(videoTexture) {
    videoTexture.repeat.set(1, 1);
    videoTexture.offset.set(0, 0);
  }

  if(videoAspect > maxAspect) {
    // Video is wider than IMAX (e.g. CinemaScope 2.39:1). 
    // Top and bottom masking curtains physically drop down.
    targetW = SCR_W;
    targetH = SCR_W / videoAspect;
  } else {
    // Video is narrower than IMAX (e.g. vertical 9:16 or standard 4:3).
    // The physical screen stays fully open at IMAX dimensions.
    targetW = SCR_W;
    targetH = SCR_H;
    
    // We must pillarbox the texture so it doesn't stretch horizontally on the wide screen.
    if(videoTexture && videoAspect > 0.1) {
      const meshAspect = targetW / targetH;
      const repeatX = meshAspect / videoAspect;
      videoTexture.repeat.set(repeatX, 1);
      videoTexture.offset.set((1 - repeatX) / 2, 0);
    }
  }

  screenMesh.geometry.dispose();
  const newGeo = new THREE.PlaneGeometry(targetW, targetH, 48, 1);
  const newPos = newGeo.attributes.position;
  for(let i=0; i<newPos.count; i++) {
    const nx = newPos.getX(i)/(targetW/2);
    newPos.setZ(i, -1.8*nx*nx);
  }
  newPos.needsUpdate=true; newGeo.computeVertexNormals();
  screenMesh.geometry = newGeo;

  bt.position.y = SCR_Y + targetH/2 + 0.12;
  bb.position.y = SCR_Y - targetH/2 - 0.12;
  bl.position.x = -targetW/2 - 0.12;
  br.position.x =  targetW/2 + 0.12;
  bt.scale.x = (targetW+0.5)/(SCR_W+0.5);
  bb.scale.x = (targetW+0.5)/(SCR_W+0.5);
  bl.scale.y = (targetH+0.5)/(SCR_H+0.5);
  br.scale.y = (targetH+0.5)/(SCR_H+0.5);
  if(curtL) curtL.position.x = -targetW/2 - 8;
  if(curtR) curtR.position.x =  targetW/2 + 8;
}
