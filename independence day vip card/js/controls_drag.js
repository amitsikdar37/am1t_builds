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
