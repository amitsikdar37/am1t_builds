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
