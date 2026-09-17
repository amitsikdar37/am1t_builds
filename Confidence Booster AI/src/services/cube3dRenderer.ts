import { mobileDetector } from './mobileDetector';

export interface CubeFaceData {
  detected: boolean;
  pitch: number;
  yaw: number;
  roll: number;
  noseBridge: { x: number; y: number };
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
  box: { x: number; y: number; width: number; height: number };
}

export interface RenderTransform {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  vw: number;
  vh: number;
}

/**
 * Renders a true 3D wireframe target cube around the user's face with perspective projection
 * Accurately aligns when camera is mirrored or non-mirrored, across both mobile and desktop screens!
 */
export function draw3dTargetCube(
  ctx: CanvasRenderingContext2D,
  face: CubeFaceData,
  canvasWidth: number,
  canvasHeight: number,
  isMirrored = false,
  transform?: RenderTransform
) {
  if (!face.detected) {
    return;
  }

  const rawEyeX = (face.leftEye.x + face.rightEye.x) / 2;
  const rawEyeY = (face.leftEye.y + face.rightEye.y) / 2;
  const rawCenterY = rawEyeY * 0.75 + face.noseBridge.y * 0.25;

  let cx: number;
  let cy: number;
  let baseDimension: number;

  if (transform && transform.sw > 0 && transform.sh > 0) {
    const { sx, sy, sw, sh, dx, dy, dw, dh, vw, vh } = transform;
    const pixelX = rawEyeX * vw;
    const pixelY = rawCenterY * vh;

    const relX = (pixelX - sx) / sw;
    const relY = (pixelY - sy) / sh;

    const effectiveRelX = isMirrored ? (1 - relX) : relX;
    cx = dx + effectiveRelX * dw;
    cy = dy + relY * dh;
    baseDimension = dw * (vw / sw);
  } else {
    const eyeCenterX = isMirrored ? (1 - rawEyeX) : rawEyeX;
    cx = eyeCenterX * canvasWidth;
    cy = rawCenterY * canvasHeight;
    baseDimension = canvasWidth;
  }

  // Size of cube proportional to face
  const halfSize = Math.max(45, face.box.width * baseDimension * 0.42);
  const s = halfSize;
  const depth = halfSize * 0.95;

  // 3D Euler angles (pitch, yaw, roll) in radians (inverting yaw and roll if mirrored)
  const pitch = (face.pitch * Math.PI) / 180;
  const rawYaw = (face.yaw * Math.PI) / 180;
  const yaw = isMirrored ? -rawYaw : rawYaw;
  const rawRoll = (face.roll * Math.PI) / 180;
  const roll = isMirrored ? -rawRoll : rawRoll;

  // 3D Point rotation
  const rotatePoint = (vx: number, vy: number, vz: number): [number, number, number] => {
    // 1. Yaw around Y axis
    const x1 = vx * Math.cos(yaw) + vz * Math.sin(yaw);
    const y1 = vy;
    const z1 = -vx * Math.sin(yaw) + vz * Math.cos(yaw);

    // 2. Pitch around X axis
    const x2 = x1;
    const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

    // 3. Roll around Z axis
    const x3 = x2 * Math.cos(roll) - y2 * Math.sin(roll);
    const y3 = x2 * Math.sin(roll) + y2 * Math.cos(roll);
    const z3 = z2;

    return [x3, y3, z3];
  };

  // Perspective projection
  const fov = 650;
  const project = (vx: number, vy: number, vz: number): [number, number] => {
    const scale = fov / (fov + vz);
    return [cx + vx * scale, cy + vy * scale];
  };

  // 8 vertices of the 3D cube (Front face z = -depth, Back face z = +depth)
  const vertices3D = [
    [-s, -s, -depth], // 0: front top-left
    [ s, -s, -depth], // 1: front top-right
    [ s,  s, -depth], // 2: front bottom-right
    [-s,  s, -depth], // 3: front bottom-left
    [-s, -s,  depth], // 4: back top-left
    [ s, -s,  depth], // 5: back top-right
    [ s,  s,  depth], // 6: back bottom-right
    [-s,  s,  depth], // 7: back bottom-left
  ];

  const points2D = vertices3D.map(([x, y, z]) => {
    const [rx, ry, rz] = rotatePoint(x, y, z);
    return project(rx, ry, rz);
  });

  ctx.save();
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 2.0;

  const isMobile = mobileDetector.isMobile();
  if (!isMobile) {
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 6;
  }

  // Single batched path for all 12 cube edges + crosshair (1 draw call instead of 13!)
  ctx.beginPath();

  // Front face (4 edges)
  ctx.moveTo(points2D[0][0], points2D[0][1]);
  ctx.lineTo(points2D[1][0], points2D[1][1]);
  ctx.lineTo(points2D[2][0], points2D[2][1]);
  ctx.lineTo(points2D[3][0], points2D[3][1]);
  ctx.closePath();

  // Back face (4 edges)
  ctx.moveTo(points2D[4][0], points2D[4][1]);
  ctx.lineTo(points2D[5][0], points2D[5][1]);
  ctx.lineTo(points2D[6][0], points2D[6][1]);
  ctx.lineTo(points2D[7][0], points2D[7][1]);
  ctx.closePath();

  // 4 Depth connector edges
  ctx.moveTo(points2D[0][0], points2D[0][1]);
  ctx.lineTo(points2D[4][0], points2D[4][1]);

  ctx.moveTo(points2D[1][0], points2D[1][1]);
  ctx.lineTo(points2D[5][0], points2D[5][1]);

  ctx.moveTo(points2D[2][0], points2D[2][1]);
  ctx.lineTo(points2D[6][0], points2D[6][1]);

  ctx.moveTo(points2D[3][0], points2D[3][1]);
  ctx.lineTo(points2D[7][0], points2D[7][1]);

  // Center subtle crosshair
  ctx.moveTo(cx - 8, cy);
  ctx.lineTo(cx + 8, cy);
  ctx.moveTo(cx, cy - 8);
  ctx.lineTo(cx, cy + 8);

  ctx.stroke();

  // Find lowest projected point for text label
  const maxY = Math.max(...points2D.map(p => p[1]));

  // Text label: SUBJECT: [LOCKED]
  ctx.fillStyle = '#00ff66';
  ctx.font = 'bold 12px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SUBJECT: [LOCKED]', cx, maxY + 20);

  ctx.restore();
}
