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

// Initialize app after all scripts are loaded
initParticleBackground();
initInputHandlers();
