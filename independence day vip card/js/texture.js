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
