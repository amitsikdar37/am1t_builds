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
