/* ==========================================================
   FUTURISTIC HOLOGRAPHIC 3D TIRANGA PASS — V3
   Vertical 9:16 · Dark glass + sharp iridescence · Photo upload
   Fixed flag · Balanced layout · Legible micro-text
   ========================================================== */



    // ───── CONFIG ─────
    const CARD_W = 2.4;
    const CARD_H = 3.8;
    const CARD_DEPTH = 0.045;
    const RENDER_W = 1080;
    const RENDER_H = 1920;

    // ───── STATE ─────
    let scene, camera, renderer, cardGroup, flagMesh, goldDust;
    let clock = new THREE.Clock();
    let userName = "", userCity = "";
    let serialNumber = "";
    let userPhoto = null;          // Image object (or null)
                
    // Drag
    let isDragging = false;
    let dragPrevX = 0, dragPrevY = 0;
    let dragRotX = 0, dragRotY = 0;
    let targetDragRotX = 0, targetDragRotY = 0;
    let lastDragTime = 0;

    // PARTICLE BACKGROUND
    // ─────────────────────────────────────────────────────
