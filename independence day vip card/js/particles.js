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
