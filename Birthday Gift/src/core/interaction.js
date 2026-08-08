import * as THREE from 'three';

/** Pointer interaction for scene objects tagged with `userData.interactive`. */
export function createInteraction({ canvas, camera, scene, onHover, onActivate }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let press = null;

  function objectAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find((item) => item.object.userData?.interactive);
    return hit?.object.userData.interactive || null;
  }

  function setHovered(next) {
    if (next === hovered) return;
    hovered = next;
    onHover?.(next);
  }

  function move(e) {
    if (e.pointerType === 'touch') return;
    setHovered(objectAt(e.clientX, e.clientY));
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  function activate(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // A swipe finishing over an object should keep scrolling, not activate it.
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) return;
    const target = objectAt(e.clientX, e.clientY);
    if (target) onActivate?.(target);
  }

  const start = (e) => { press = { x: e.clientX, y: e.clientY }; };
  const leave = () => setHovered(null);
  canvas.addEventListener('pointerdown', start, { passive: true });
  canvas.addEventListener('pointermove', move, { passive: true });
  canvas.addEventListener('pointerleave', leave, { passive: true });
  canvas.addEventListener('pointerup', activate, { passive: true });

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', start);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('pointerup', activate);
      canvas.style.cursor = '';
    },
  };
}