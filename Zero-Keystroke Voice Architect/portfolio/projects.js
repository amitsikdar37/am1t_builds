const PROJECTS = [
  {
    title: "AetherEngine",
    description: "High-performance WebGL rendering engine with custom GLSL shaders and physics computations running in Web Workers.",
    category: "creative",
    tech: ["Three.js", "WebGL", "GLSL", "TypeScript"],
    icon: "fa-solid fa-gamepad",
    gradient: "linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  },
  {
    title: "SynthSound AI",
    description: "Deep learning vocal synthesizer and real-time audio dashboard using Python/FastAPI backend and Web Audio API frontend.",
    category: "fullstack",
    tech: ["FastAPI", "Web Audio API", "Python", "React"],
    icon: "fa-solid fa-music",
    gradient: "linear-gradient(135deg, #f35588 0%, #7f00ff 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  },
  {
    title: "QuantumDB Orchestrator",
    description: "Visual administration console and query profiling tool for PostgreSQL databases with real-time SSE activity feed.",
    category: "system",
    tech: ["Node.js", "PostgreSQL", "SSE", "D3.js"],
    icon: "fa-solid fa-database",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #e11d48 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  },
  {
    title: "Chronos Cloud",
    description: "Real-time task synchronization dashboard backed by Docker, WebSockets, and high-performance server-side caching.",
    category: "fullstack",
    tech: ["TypeScript", "WebSockets", "Docker", "MongoDB"],
    icon: "fa-solid fa-cloud",
    gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  },
  {
    title: "Vortex Shader Labs",
    description: "An interactive laboratory environment for visual artists to write and test raymarching GLSL fragment shaders.",
    category: "creative",
    tech: ["GLSL", "WebGL", "Vanilla JS", "GSAP"],
    icon: "fa-solid fa-wand-magic-sparkles",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  },
  {
    title: "Valkyrie Network",
    description: "Distributed monitoring dashboard tracking server metrics and bandwidth across AWS nodes using Rust telemetry tools.",
    category: "system",
    tech: ["Rust", "FastAPI", "React", "Chart.js"],
    icon: "fa-solid fa-server",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    githubUrl: "https://github.com",
    demoUrl: "https://github.com"
  }
];

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("projects-container");
  if (!container) return;

  // Render project list
  function renderProjects(items) {
    container.innerHTML = "";
    items.forEach((project, idx) => {
      const card = document.createElement("div");
      card.className = `project-card glass animate-card-${idx}`;
      card.setAttribute("data-category", project.category);
      card.style.setProperty("--card-gradient", project.gradient);
      
      const techTags = project.tech.map(t => `<span class="card-tag">${t}</span>`).join("");
      
      card.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-visual" style="background: ${project.gradient}">
          <div class="card-icon"><i class="${project.icon}"></i></div>
        </div>
        <div class="card-details">
          <span class="card-category-label">${project.category.toUpperCase()}</span>
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <div class="card-tags">${techTags}</div>
          <div class="card-links">
            <a href="${project.githubUrl}" target="_blank" class="card-link-btn btn-magnetic" title="View Source Code">
              <i class="fa-brands fa-github"></i> Source
            </a>
            <a href="${project.demoUrl}" target="_blank" class="card-link-btn btn-magnetic" title="Live Preview">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Demo
            </a>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    // Animate the cards in using GSAP stagger
    gsap.fromTo(
      ".project-card",
      { opacity: 0, y: 30, scale: 0.95 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out"
      }
    );

    // Rebind magnetic actions on buttons
    bindMagneticButtons();
    // Rebind card tilt effect
    bindCardTilt();
  }

  // Initial render
  renderProjects(PROJECTS);

  // Filter Buttons
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      const filter = btn.getAttribute("data-filter");
      
      // Animate out, filter, and animate back in
      gsap.to(".project-card", {
        opacity: 0,
        y: -15,
        scale: 0.97,
        duration: 0.3,
        stagger: 0.05,
        onComplete: () => {
          if (filter === "all") {
            renderProjects(PROJECTS);
          } else {
            const filtered = PROJECTS.filter(p => p.category === filter);
            renderProjects(filtered);
          }
        }
      });
    });
  });
});
