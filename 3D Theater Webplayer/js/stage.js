import * as THREE from 'three';
import { ROOM_W, ROOM_D, SCR_Z, SCR_W } from './config.js';

export function buildStage(scene) {
  const g = new THREE.Group();

  // Stage platform (raised dark floor directly under screen)
  const stageMat = new THREE.MeshStandardMaterial({ color:0x0a0404, roughness:0.95 });
  const stage = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W+2, 0.35, 8), stageMat);
  stage.position.set(0, -0.2, SCR_Z+3); g.add(stage);

  // Large subwoofer towers either side of screen
  const subMat = new THREE.MeshStandardMaterial({ color:0x060606, roughness:0.75, metalness:0.1 });
  const subGeo = new THREE.BoxGeometry(1.8, 2.6, 1.4);
  const subL = new THREE.Mesh(subGeo, subMat); subL.position.set(-SCR_W/2-1.2, 0.9, SCR_Z+1.2); g.add(subL);
  const subR = subL.clone(); subR.position.x = SCR_W/2+1.2; g.add(subR);

  // Speaker grille texture on subs (horizontal strips)
  const grilleMat = new THREE.MeshStandardMaterial({ color:0x111111, roughness:0.8 });
  for(let i=0; i<8; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.04, 0.05), grilleMat);
    stripe.position.set(-SCR_W/2-1.2, 0.2+i*0.27, SCR_Z+0.57); g.add(stripe);
    const stripeR = stripe.clone(); stripeR.position.x = SCR_W/2+1.2; g.add(stripeR);
  }

  // ── Aisle walkway carpet between stage and first row ──────────────────────
  // The aisle sits from stage edge (SCR_Z+7) to just before first seat row (-3.0)
  const aisleLength = (-3.0) - (SCR_Z + 7); // dynamic gap fill
  const aisleMat = new THREE.MeshStandardMaterial({ color:0x1a0808, roughness:0.98 });
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W+2, aisleLength), aisleMat);
  aisle.rotation.x = -Math.PI/2;
  aisle.position.set(0, 0.0, SCR_Z + 7 + aisleLength/2);
  g.add(aisle);

  // LED floor safety strips along both aisle sides (like real IMAX theatres)
  const ledMat = new THREE.MeshBasicMaterial({ color:0xff4400 });
  const ledGeo = new THREE.BoxGeometry(0.06, 0.02, aisleLength);
  const ledL = new THREE.Mesh(ledGeo, ledMat);
  ledL.position.set(-ROOM_W/2 + 1.2, 0.03, SCR_Z + 7 + aisleLength/2); g.add(ledL);
  const ledR = ledL.clone(); ledR.position.x = ROOM_W/2 - 1.2; g.add(ledR);
  // Soft warm glow from the LED strips (very dim, just kissing the floor)
  const ledGlowL = new THREE.PointLight(0xff3300, 0.3, 4);
  ledGlowL.position.set(-ROOM_W/2+1.5, 0.3, SCR_Z+7+aisleLength/2); g.add(ledGlowL);
  const ledGlowR = new THREE.PointLight(0xff3300, 0.3, 4);
  ledGlowR.position.set(ROOM_W/2-1.5, 0.3, SCR_Z+7+aisleLength/2); g.add(ledGlowR);

  // Stanchion barrier right at the edge of the stage, keeping audience back
  const STANCHION_Z = SCR_Z + 7.2; // Right at stage edge
  const postMat = new THREE.MeshStandardMaterial({ color:0x555555, metalness:0.9, roughness:0.1 });
  const ropeMat = new THREE.MeshStandardMaterial({ color:0x5a0808, roughness:0.92 });
  const postGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.95, 16);
  const topGeo  = new THREE.SphereGeometry(0.06, 12, 8);
  
  const ST_CNT = 14;
  for(let i=-ST_CNT; i<=ST_CNT; i++) {
    const x = i * 1.35;
    const z = STANCHION_Z + Math.abs(i)*0.04;
    if(x > -ROOM_W/2+1 && x < ROOM_W/2-1) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(x, -0.07, z); g.add(post);
      const top = new THREE.Mesh(topGeo, postMat);
      top.position.set(x, 0.44, z); g.add(top);

      if(i < ST_CNT) {
        const nx = (i+1)*1.35, nz = STANCHION_Z+Math.abs(i+1)*0.04;
        if(nx < ROOM_W/2-1) {
          const curve = new THREE.QuadraticBezierCurve3(
            new THREE.Vector3(x, 0.28, z),
            new THREE.Vector3((x+nx)/2, 0.10, (z+nz)/2),
            new THREE.Vector3(nx, 0.28, nz)
          );
          g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.028, 8, false), ropeMat));
        }
      }
    }
  }

  // EXIT signs with glow – placed at aisle ends
  const exitBg  = new THREE.MeshBasicMaterial({ color:0x003300 });
  const exitGeo = new THREE.BoxGeometry(0.9, 0.32, 0.04);
  const makeExit = (x, z, ry) => {
    const sign = new THREE.Mesh(exitGeo, exitBg);
    sign.position.set(x, 3.1, z); sign.rotation.y = ry; g.add(sign);
    const glow = new THREE.PointLight(0xff2200, 0.15, 2.5);
    glow.position.set(x+(ry===Math.PI/2?0.15:-0.15), 3.1, z); g.add(glow);
  };
  makeExit(-ROOM_W/2+0.1, STANCHION_Z, Math.PI/2);
  makeExit( ROOM_W/2-0.1, STANCHION_Z, -Math.PI/2);

  scene.add(g);
}
