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
    function initParticleBackground() {
        const canvas = document.getElementById("particleBg");
        const ctx = canvas.getContext("2d");
        let particles = [];
        const COUNT = 90;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener("resize", resize);

        for (let i = 0; i < COUNT; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.25,
                vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.5 + 0.3,
                color: ["#d4af37", "#1d1d1f", "#86868b"][Math.floor(Math.random() * 3)],
                alpha: Math.random() * 0.2 + 0.05
            });
        }

        (function loop() {
            requestAnimationFrame(loop);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        })();
    }

    // ─────────────────────────────────────────────────────
    // INPUT + PHOTO UPLOAD HANDLERS
    // ─────────────────────────────────────────────────────
    function initInputHandlers() {
        const input = document.getElementById("userInput");
        const btn = document.getElementById("generateBtn");
        const photoInput = document.getElementById("photoInput");
        const uploadArea = document.getElementById("uploadArea");

        input.addEventListener("input", () => {
            btn.disabled = input.value.trim().length < 2;
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !btn.disabled) btn.click();
        });

        // Photo upload
        uploadArea.addEventListener("click", () => photoInput.click());
        photoInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    userPhoto = img;
                    const preview = document.getElementById("photoPreview");
                    preview.src = ev.target.result;
                    preview.style.display = "block";
                    document.getElementById("uploadPlaceholder").style.display = "none";
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        btn.addEventListener("click", () => {
            const val = input.value.trim();
            const parts = val.split("|").map(s => s.trim());
            userName = parts[0] || "CITIZEN";
            userCity = parts[1] || "INDIA";
            serialNumber = generateSerial();
            startGeneration();
        });
    }

    function generateSerial() {
        return `#IND-2026-${String(Math.floor(10000 + Math.random() * 90000))}`;
    }

    // ─────────────────────────────────────────────────────
    // GENERATION FLOW
    // ─────────────────────────────────────────────────────
    function startGeneration() {
        document.getElementById("inputOverlay").classList.remove("active");
        const loadingOverlay = document.getElementById("loadingOverlay");
        loadingOverlay.classList.add("active");

        const fill = document.getElementById("loaderFill");
        let progress = 0;
        const iv = setInterval(() => {
            progress += Math.random() * 8 + 2;
            if (progress > 100) progress = 100;
            fill.style.width = progress + "%";
            if (progress >= 100) {
                clearInterval(iv);
                setTimeout(() => {
                    loadingOverlay.classList.remove("active");
                    document.getElementById("hudOverlay").style.display = "flex";
                    init3DScene();
                }, 400);
            }
        }, 120);
    }

    // ─────────────────────────────────────────────────────
    // THREE.JS SCENE
    // ─────────────────────────────────────────────────────
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

    // Initialize the background and input handlers immediately on script load
    initParticleBackground();
    initInputHandlers();

    // ─────────────────────────────────────────────────────
    // HOLOGRAPHIC CARD — Dark glass + sharp spectral peaks
    // ─────────────────────────────────────────────────────
    function buildHolographicCard() {
        const shape = createRoundedRectShape(CARD_W, CARD_H, 0.2);
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: CARD_DEPTH,
            bevelEnabled: true, bevelThickness: 0.012,
            bevelSize: 0.012, bevelSegments: 3
        });
        geometry.center();

        const holoMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uLightPos: { value: new THREE.Vector3(4, 6, 6) }
            },
            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying vec2 vUv;
                varying vec3 vViewDir;
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    vViewDir = normalize(cameraPosition - wp.xyz);
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,
            fragmentShader: /* glsl */`
                uniform float uTime;
                uniform vec3 uLightPos;
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                varying vec2 vUv;
                varying vec3 vViewDir;

                void main() {
                    vec3 N = normalize(vNormal);
                    vec3 V = normalize(vViewDir);
                    vec3 L = normalize(uLightPos - vWorldPos);
                    vec3 R = reflect(-V, N);
                    vec3 H = normalize(L + V);

                    float fresnel = pow(1.0 - max(dot(V, N), 0.0), 3.0);

                    // ── Sharp spectral peaks (pow 4 prevents muddy mixing) ──
                    float phase = dot(R, H) * 6.0 + uTime * 0.3
                                + vUv.y * 3.0 + vUv.x * 1.5;

                    vec3 saffron = vec3(1.0, 0.6, 0.2);
                    vec3 white   = vec3(1.0);
                    vec3 green   = vec3(0.2, 0.88, 0.35);
                    vec3 gold    = vec3(1.0, 0.84, 0.0);

                    float w1 = pow(max(0.0, sin(phase)),         4.0);
                    float w2 = pow(max(0.0, sin(phase + 2.094)), 4.0);
                    float w3 = pow(max(0.0, sin(phase + 4.189)), 4.0);
                    vec3 irid = saffron * w1 + white * w2 + green * w3;

                    // ── Deep Obsidian / Carbon Black base ──
                    vec3 color = vec3(0.039, 0.043, 0.063);

                    // Subtle broad sheen
                    float sheen = pow(max(dot(R, L), 0.0), 3.0);
                    color += irid * sheen * 0.12;

                    // Focused holographic reflection
                    float holoSpec = pow(max(dot(R, L), 0.0), 16.0);
                    color += irid * holoSpec * 0.55;

                    // Gold Fresnel edge
                    color += gold * fresnel * 0.45;

                    // Sharp white glint (glass)
                    float glint = pow(max(dot(R, L), 0.0), 120.0);
                    color += vec3(1.0) * glint * 1.5;

                    // Soft gold rim
                    float rim = pow(max(dot(R, L), 0.0), 6.0);
                    color += gold * rim * 0.06;

                    // Edge tricolor
                    float topE = smoothstep(0.85, 1.0, vUv.y);
                    float botE = smoothstep(0.15, 0.0, vUv.y);
                    color += saffron * topE * 0.08
                           * (0.5 + 0.5 * sin(uTime * 2.0 + vUv.x * 5.0));
                    color += green * botE * 0.08
                           * (0.5 + 0.5 * sin(uTime * 2.0 + vUv.x * 5.0 + 1.0));

                    float alpha = 0.32 + fresnel * 0.52;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        const card = new THREE.Mesh(geometry, holoMaterial);
        card.renderOrder = 1;
        cardGroup.add(card);

        // Gold borders
        const addBorder = (w, h, r, z, op) => {
            const pts = createRoundedRectShape(w, h, r).getPoints(80);
            const geo = new THREE.BufferGeometry().setFromPoints(
                pts.map(p => new THREE.Vector3(p.x, p.y, z))
            );
            const line = new THREE.LineLoop(geo, new THREE.LineBasicMaterial({
                color: 0xD4AF37, transparent: true, opacity: op
            }));
            line.renderOrder = 5;
            cardGroup.add(line);
        };
        const hz = CARD_DEPTH / 2 + 0.018;
        addBorder(CARD_W + 0.04, CARD_H + 0.04, 0.22, hz, 0.65);
        addBorder(CARD_W + 0.04, CARD_H + 0.04, 0.22, -hz, 0.65);
        addBorder(CARD_W - 0.3,  CARD_H - 0.3,  0.12, hz, 0.25);
    }

    function createRoundedRectShape(w, h, r) {
        const s = new THREE.Shape();
        const hw = w / 2, hh = h / 2;
        s.moveTo(-hw + r, -hh);
        s.lineTo(hw - r, -hh);
        s.quadraticCurveTo(hw, -hh, hw, -hh + r);
        s.lineTo(hw, hh - r);
        s.quadraticCurveTo(hw, hh, hw - r, hh);
        s.lineTo(-hw + r, hh);
        s.quadraticCurveTo(-hw, hh, -hw, hh - r);
        s.lineTo(-hw, -hh + r);
        s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
        return s;
    }

    // ─────────────────────────────────────────────────────
    // 3D FLAG — Fixed: no grey artefacts, opaque, proper depth
    // ─────────────────────────────────────────────────────
    function buildFlag() {
        const fw = 0.65, fh = 0.43;
        const geometry = new THREE.PlaneGeometry(fw, fh, 28, 18);

        const flagMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: /* glsl */`
                uniform float uTime;
                varying vec2 vUv;
                varying float vWave;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    float wave = sin(pos.x * 8.0 - uTime * 4.0) * 0.018 * uv.x
                               + sin(pos.x * 13.0 - uTime * 6.5 + 0.7) * 0.008 * uv.x;
                    pos.z += wave;
                    vWave = wave;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec2 vUv;
                varying float vWave;
                void main() {
                    vec3 saffron = vec3(1.0, 0.6, 0.2);
                    vec3 white   = vec3(1.0);
                    vec3 green   = vec3(0.075, 0.533, 0.031);
                    vec3 navy    = vec3(0.0, 0.0, 0.502);

                    // Bands via mix/step (no if-else)
                    vec3 color = green;
                    color = mix(color, white,   step(0.333, vUv.y));
                    color = mix(color, saffron, step(0.667, vUv.y));

                    // ── Ashoka Chakra (smoothstep only) ──
                    float inW = step(0.333, vUv.y) * step(vUv.y, 0.667);
                    vec2 c = vec2(0.5, 0.5);
                    float d = distance(vUv, c);

                    float ring = (smoothstep(0.08, 0.085, d)
                                - smoothstep(0.105, 0.11,  d));

                    float a = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float spk = step(0.88, abs(sin(a * 12.0)))
                              * smoothstep(0.02, 0.025, d)
                              * (1.0 - smoothstep(0.075, 0.08, d));

                    float dot = 1.0 - smoothstep(0.015, 0.022, d);

                    float ch = clamp(ring + spk + dot, 0.0, 1.0) * inW;
                    color = mix(color, navy, ch);

                    // Very gentle wave shading (no grey bands)
                    color *= 1.0 + vWave * 1.0;

                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        flagMesh = new THREE.Mesh(geometry, flagMat);
        flagMesh.renderOrder = 15;

        // If photo → skip the 3D flag entirely to avoid ghosting
        if (!userPhoto) {
            flagMesh.position.set(0.0, 0.15, CARD_DEPTH / 2 + 0.07);
            flagMesh.scale.set(1.35, 1.35, 1.35);
            cardGroup.add(flagMesh);

            // Pole
            const pole = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6),
                new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2 })
            );
            pole.renderOrder = 15;
            pole.position.set(0.0 - fw * 0.45 * 1.35, 0.15, CARD_DEPTH / 2 + 0.07);
            pole.scale.set(1.35, 1.35, 1.35);
            cardGroup.add(pole);
        }
    }

    // ─────────────────────────────────────────────────────
    // TEXT — Balanced layout, hero name, legible micro-text,
    //        centred circular photo, letter-spaced name
    // ─────────────────────────────────────────────────────
    function buildTextElements() {

        const CW = 1024, CH = 1620;
        const front = document.createElement("canvas");
        front.width = CW; front.height = CH;
        const ctx = front.getContext("2d");

        // 1. Matte Obsidian Texture
        const bgGrad = ctx.createRadialGradient(CW/2, CH/2, 0, CW/2, CH/2, 1200);
        bgGrad.addColorStop(0, "#1a1b22");
        bgGrad.addColorStop(1, "#050508");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.roundRect(14, 14, CW - 28, CH - 28, 26);
        ctx.fill();

        // 2. Giant Ashoka Chakra Watermark
        ctx.save();
        ctx.globalAlpha = 0.15; // Increased visibility!
        ctx.strokeStyle = "#D4AF37";
        ctx.lineWidth = 4;
        const wkX = CW * 0.5; // Centered
        const wkY = CH * 0.65; // Lower down to fill space
        const wkR = 550; // Much larger
        ctx.beginPath();
        ctx.arc(wkX, wkY, wkR, 0, Math.PI * 2);
        ctx.stroke();
        for(let i=0; i<24; i++) {
            const ang = (i/24) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(wkX + Math.cos(ang) * 40, wkY + Math.sin(ang) * 40);
            ctx.lineTo(wkX + Math.cos(ang) * wkR, wkY + Math.sin(ang) * wkR);
            ctx.stroke();
        }
        ctx.restore();

        // Helper: Foil Gradient
        function getFoilGrad(x, y, w) {
            const g = ctx.createLinearGradient(x, y, x + w, y);
            g.addColorStop(0, "#E8C44A");
            g.addColorStop(0.3, "#FFF8DC");
            g.addColorStop(0.6, "#D4AF37");
            g.addColorStop(1, "#B8941F");
            return g;
        }

        // 3. Header & EMV Chip
        ctx.fillStyle = getFoilGrad(60, 60, 300);
        ctx.font = "800 40px 'Inter', sans-serif";
        ctx.textAlign = "left";
        ctx.letterSpacing = "3px";
        ctx.fillText("TIRANGA PASS", 60, 95);
        ctx.letterSpacing = "0px";

        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "600 18px 'Inter', sans-serif";
        ctx.letterSpacing = "2px";
        ctx.fillText("REPUBLIC OF INDIA — INDEPENDENCE DAY 2026", 60, 130);
        ctx.letterSpacing = "0px";

        // EMV Chip
        const chipGrad = ctx.createLinearGradient(790, 48, 955, 156);
        chipGrad.addColorStop(0, "rgba(212,175,55,0.8)");
        chipGrad.addColorStop(0.5, "rgba(255,215,0,0.9)");
        chipGrad.addColorStop(1, "rgba(184,148,31,0.8)");
        ctx.fillStyle = chipGrad;
        ctx.beginPath();
        ctx.roundRect(790, 48, 165, 108, 16);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,215,0,0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.strokeStyle = "rgba(60,40,10,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(790, 102); ctx.lineTo(955, 102);
        ctx.moveTo(831, 48); ctx.lineTo(831, 156);
        ctx.moveTo(872, 48); ctx.lineTo(872, 156);
        ctx.moveTo(913, 48); ctx.lineTo(913, 156);
        ctx.stroke();

        // 4. Circular Photo (Left Aligned & Enriched)
        const photoCX = 260, photoCY = 480, photoR = 190; // Larger & Lower
        if (userPhoto) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(photoCX, photoCY, photoR, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            const imgA = userPhoto.width / userPhoto.height;
            let dw, dh, dx, dy;
            if (imgA > 1) {
                dh = photoR * 2; dw = dh * imgA;
                dx = photoCX - dw / 2; dy = photoCY - photoR;
            } else {
                dw = photoR * 2; dh = dw / imgA;
                dx = photoCX - photoR; dy = photoCY - dh / 2;
            }
            ctx.drawImage(userPhoto, dx, dy, dw, dh);
            ctx.restore();

            // Minimalist Silver & Gold border
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(photoCX, photoCY, photoR + 6, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = "#D4AF37";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(photoCX, photoCY, photoR + 12, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 5. User Metadata Grid (Right Side, larger and spaced out)
        const textX = 500;
        let ty = 360;

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 52px 'Inter', sans-serif";
        ctx.letterSpacing = "-1px";
        ctx.fillText(userName.toUpperCase(), textX, ty);
        ctx.letterSpacing = "0px";

        ty += 50;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.font = "500 28px 'Inter', sans-serif";
        ctx.letterSpacing = "1px";
        ctx.fillText(userCity.toUpperCase(), textX, ty);
        ctx.letterSpacing = "0px";

        ty += 110;
        ctx.fillStyle = getFoilGrad(textX, ty-30, 400);
        ctx.font = "700 38px 'Inter', sans-serif";
        ctx.letterSpacing = "2px";
        ctx.fillText(serialNumber, textX, ty);

        ty += 55;
        ctx.fillStyle = "rgba(212,175,55,0.7)";
        ctx.font = "600 22px 'Inter', sans-serif";
        ctx.letterSpacing = "1px";
        ctx.fillText("CLASSIFICATION: VIP EXCLUSIVE", textX, ty);
        ctx.letterSpacing = "0px";

        const now = new Date();
        const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
        const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        
        ty += 70;
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "500 22px 'Inter', sans-serif";
        ctx.fillText("ISSUED: " + dateStr + " " + timeStr + " IST", textX, ty);

        ty += 45;
        ctx.fillStyle = "rgba(40,220,80,0.85)";
        ctx.font = "700 24px 'Inter', sans-serif";
        ctx.fillText("✦ VALID: 15 AUG 2026 — ETERNAL ✦", textX, ty);

        // 6. The Preamble (Filling the vertical space)
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.font = "italic 400 22px 'Inter', sans-serif";
        ctx.textAlign = "left";
        ctx.letterSpacing = "1px";
        const preambleLines = [
            "WE, THE PEOPLE OF INDIA, having solemnly resolved to constitute",
            "India into a SOVEREIGN SOCIALIST SECULAR DEMOCRATIC REPUBLIC",
            "and to secure to all its citizens:",
            "JUSTICE, social, economic and political;",
            "LIBERTY of thought, expression, belief, faith and worship;",
            "EQUALITY of status and of opportunity;"
        ];
        let pY = 880; // Starts neatly below the valid date
        preambleLines.forEach(line => {
            ctx.fillText(line.toUpperCase(), 80, pY);
            pY += 38;
        });

        // 7. Barcode (Bigger and lower)
        const bcY = 1150;
        for (let i = 0; i < 74; i++) {
            const bw = 2 + Math.random() * 6;
            ctx.fillStyle = "rgba(212,175,55," + (0.15 + Math.random() * 0.4) + ")";
            ctx.fillRect(80 + i * 12, bcY, bw, 100);
        }

        // 8. Large Signature Logo
        ctx.fillStyle = getFoilGrad(CW - 400, 1380, 400);
        ctx.font = "800 100px 'Inter', sans-serif"; // Made it huge
        ctx.textAlign = "right";
        ctx.letterSpacing = "-2px";
        ctx.fillText("JAI HIND", CW - 80, 1450);
        ctx.letterSpacing = "0px";

        // ── Apply as texture ──
        const frontTex = new THREE.CanvasTexture(front);
        frontTex.anisotropy = 4;
        const textPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(CARD_W - 0.08, CARD_H - 0.08),
            new THREE.MeshBasicMaterial({
                map: frontTex, transparent: true,
                depthWrite: false,
                polygonOffset: true, polygonOffsetFactor: -1,
                toneMapped: false
            })
        );
        textPlane.position.z = CARD_DEPTH / 2 + 0.025;
        textPlane.renderOrder = 10;
        cardGroup.add(textPlane);

        // Back face
        const back = document.createElement("canvas");
        back.width = CW; back.height = CH;
        const bx = back.getContext("2d");
        for (let y = 0; y < CH; y += 4) {
            bx.fillStyle = `rgba(212,175,55,${0.015 + Math.sin(y * 0.08) * 0.008})`;
            bx.fillRect(0, y, CW, 2);
        }
        bx.fillStyle = "rgba(212,175,55,0.15)";
        bx.font = "700 24px 'Inter', sans-serif";
        bx.textAlign = "center";
        bx.letterSpacing = "2px";
        bx.fillText("GOVERNMENT OF INDIA", CW / 2, CH / 2 - 30);
        bx.fillText("DIGITAL COMMEMORATIVE PASS", CW / 2, CH / 2 + 10);
        bx.fillStyle = "rgba(212,175,55,0.1)";
        bx.font = "500 14px 'Inter', sans-serif";
        bx.letterSpacing = "4px";
        bx.fillText("SATYAMEVA JAYATE", CW / 2, CH / 2 + 80);

        const backTex = new THREE.CanvasTexture(back);
        const backPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(CARD_W - 0.08, CARD_H - 0.08),
            new THREE.MeshBasicMaterial({
                map: backTex, transparent: true,
                depthWrite: false,
                polygonOffset: true, polygonOffsetFactor: -1,
                toneMapped: false
            })
        );
        backPlane.position.z = -CARD_DEPTH / 2 - 0.005;
        backPlane.rotation.y = Math.PI;
        cardGroup.add(backPlane);
    }

    // ── Text helpers ──
    function drawSpacedText(ctx, text, x, y, spacing) {
        let cx = x;
        for (const ch of text) {
            ctx.fillText(ch, cx, y);
            cx += ctx.measureText(ch).width + spacing;
        }
    }

    function fitTextSpaced(ctx, text, maxW, startSz, family, spacing) {
        let sz = startSz;
        const extra = spacing * Math.max(0, text.length - 1);
        ctx.font = `bold ${sz}px ${family}`;
        while (ctx.measureText(text).width + extra > maxW && sz > 28) {
            sz -= 2;
            ctx.font = `bold ${sz}px ${family}`;
        }
        return sz;
    }

    // ─────────────────────────────────────────────────────
    // GOLD DUST
    // ─────────────────────────────────────────────────────
    function buildGoldDust() {
        const n = 250;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            pos[i * 3]     = (Math.random() - 0.5) * 5;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        goldDust = new THREE.Points(geo, new THREE.PointsMaterial({
            color: 0xFFD700, size: 0.018,
            transparent: true, opacity: 0.35,
            blending: THREE.AdditiveBlending, depthWrite: false
        }));
        scene.add(goldDust);
    }

    // ─────────────────────────────────────────────────────
    // DRAG CONTROLS
    // ─────────────────────────────────────────────────────
    function initDragControls() {
        const c = renderer.domElement;
        c.addEventListener("mousedown", (e) => {
            isDragging = true; dragPrevX = e.clientX; dragPrevY = e.clientY;
            c.style.cursor = "grabbing";
        });
        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            targetDragRotY += (e.clientX - dragPrevX) * 0.008;
            targetDragRotX += (e.clientY - dragPrevY) * 0.006;
            targetDragRotX = Math.max(-1.2, Math.min(1.2, targetDragRotX));
            dragPrevX = e.clientX; dragPrevY = e.clientY;
            lastDragTime = performance.now();
        });
        window.addEventListener("mouseup", () => {
            isDragging = false; c.style.cursor = "grab";
        });

        c.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                dragPrevX = e.touches[0].clientX;
                dragPrevY = e.touches[0].clientY;
            }
        }, { passive: true });
        c.addEventListener("touchmove", (e) => {
            if (!isDragging || e.touches.length !== 1) return;
            targetDragRotY += (e.touches[0].clientX - dragPrevX) * 0.008;
            targetDragRotX += (e.touches[0].clientY - dragPrevY) * 0.006;
            targetDragRotX = Math.max(-1.2, Math.min(1.2, targetDragRotX));
            dragPrevX = e.touches[0].clientX;
            dragPrevY = e.touches[0].clientY;
            lastDragTime = performance.now();
        }, { passive: true });
        c.addEventListener("touchend", () => { isDragging = false; });

        c.style.cursor = "grab";
    }

    // ─────────────────────────────────────────────────────
    // ANIMATION
    // ─────────────────────────────────────────────────────
    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        if (cardGroup) {
            dragRotX += (targetDragRotX - dragRotX) * 0.1;
            dragRotY += (targetDragRotY - dragRotY) * 0.1;

            const idle = (performance.now() - lastDragTime) / 1000;
            const auto = Math.min(1, Math.max(0, (idle - 1.0) / 1.5));

            cardGroup.rotation.y = dragRotY + (Math.sin(t * 0.35) * 0.45 + t * 0.08) * auto;
            cardGroup.rotation.x = dragRotX + Math.sin(t * 0.25) * 0.05 * auto;
            cardGroup.rotation.z = Math.sin(t * 0.2) * 0.018 * auto;
            
            cardGroup.position.y = Math.sin(t * 0.6) * 0.06;
        }

        cardGroup.traverse((ch) => {
            if (ch.material && ch.material.uniforms) {
                if (ch.material.uniforms.uTime) {
                    ch.material.uniforms.uTime.value = t;
                }
                if (ch.material.uniforms.uLightPos) {
                    // Dynamic light gleam sweeping across the card
                    ch.material.uniforms.uLightPos.value.set(
                        Math.sin(t * 1.5) * 6.0,
                        6.0 + Math.cos(t * 1.2) * 2.0,
                        6.0
                    );
                }
            }
        });

        if (goldDust) {
            goldDust.rotation.y = t * 0.04;
            goldDust.rotation.x = t * 0.015;
        }

        renderer.render(scene, camera);
    }
    // ─────────────────────────────────────────────────────
    // VIDEO RECORDING
    // ─────────────────────────────────────────────────────
    function initSnapshotButton() {
        document.getElementById("snapshotBtn").addEventListener("click", takeSnapshot);
    }

    function takeSnapshot() {
        const btn = document.getElementById("snapshotBtn");
        btn.disabled = true;
        btn.innerHTML = '<span>📸</span><span>SAVING...</span>';

        // 1. Set the background to solid pearl (for the story image)
        scene.background = new THREE.Color(0xf5f5f7);

        // 2. Set rotation to exactly 0 to look perfectly straight-on
        const oldY = cardGroup.rotation.y;
        const oldX = cardGroup.rotation.x;
        cardGroup.rotation.y = 0; 
        cardGroup.rotation.x = 0;

        // 3. Force render a single high-quality frame
        renderer.render(scene, camera);

        // 4. Capture the frame directly from canvas
        const canvas = renderer.domElement;
        
        // Use a slight timeout to let the UI update the "SAVING..." text
        setTimeout(() => {
            canvas.toBlob((blob) => {
                // Restore background and rotation
                scene.background = null;
                cardGroup.rotation.y = oldY;
                cardGroup.rotation.x = oldX;

                // Download the image
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Tiranga_Pass_${userName.replace(/\s+/g, "_")}_${serialNumber.replace("#", "")}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                // Restore button
                btn.disabled = false;
                btn.innerHTML = '<span style="font-size: 16px; margin-right: 4px;">📸</span><span>SAVE FOR STORY</span>';
            }, "image/png", 1.0);
        }, 50);
    }
