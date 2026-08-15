    function init3DScene() {
        const canvas = document.getElementById("threeCanvas");

        renderer = new THREE.WebGLRenderer({
            canvas, antialias: true, alpha: true, preserveDrawingBuffer: true
        });
        renderer.setSize(RENDER_W, RENDER_H, false);
        renderer.setPixelRatio(1);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.4;

        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(50, RENDER_W / RENDER_H, 0.1, 100);
        camera.position.set(0, 0, 5.5);

        // Lights
        scene.add(new THREE.AmbientLight(0x334466, 0.5));

        const key = new THREE.DirectionalLight(0xfff0dd, 1.1);
        key.position.set(4, 6, 6);
        scene.add(key);

        const fill = new THREE.DirectionalLight(0x7788cc, 0.35);
        fill.position.set(-5, 2, -4);
        scene.add(fill);

        const saffronPt = new THREE.PointLight(0xFF9933, 0.7, 18);
        saffronPt.position.set(3, 4, 5);
        scene.add(saffronPt);

        const greenPt = new THREE.PointLight(0x138808, 0.5, 18);
        greenPt.position.set(-3, -4, 5);
        scene.add(greenPt);

        const goldPt = new THREE.PointLight(0xFFD700, 0.6, 12);
        goldPt.position.set(0, 0, -4);
        scene.add(goldPt);

        cardGroup = new THREE.Group();
        scene.add(cardGroup);

        buildHolographicCard();
        buildFlag();
        buildTextElements();
        buildGoldDust();
        initSnapshotButton();
        initDragControls();

        fitCanvasToViewport();
        window.addEventListener("resize", fitCanvasToViewport);
        document.getElementById("resetBtn").addEventListener("click", () => location.reload());

        animate();
    }
    function fitCanvasToViewport() {
        const c = renderer.domElement;
        const vw = window.innerWidth, vh = window.innerHeight;
        const ar = RENDER_W / RENDER_H; // 9:16

        // Reserve space at top for badge and bottom for buttons so they never overlap the card.
        const TOP_RESERVE = 56;   // px  badge height + gap
        const BTM_RESERVE = 100;  // px  buttons bar height + gap
        const availH = vh - TOP_RESERVE - BTM_RESERVE;
        const availW = vw;

        let dw, dh;
        if (availW / availH > ar) { dh = availH; dw = availH * ar; }
        else { dw = availW; dh = availW / ar; }

        c.style.position = "fixed";
        c.style.width = dw + "px";
        c.style.height = dh + "px";
        // Centre horizontally, place just below the top badge
        c.style.top = (TOP_RESERVE + (availH - dh) / 2) + "px";
        c.style.left = ((vw - dw) / 2) + "px";
    }
