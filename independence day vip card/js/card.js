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
