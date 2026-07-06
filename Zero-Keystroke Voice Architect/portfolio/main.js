// =========================================
// AETHERIS MAIN INTERACTION CONTROLLER
// =========================================

// Initialize GSAP plugins
gsap.registerPlugin(ScrollTrigger);

// Global State
let scene, camera, renderer;
let torusKnot, outerWireframe, particleSystem;
let ambientLight, pointLightCyan, pointLightMagenta, dirLight;
const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

// Document Ready
document.addEventListener("DOMContentLoaded", () => {
  initCursor();
  initThree();
  initScrollAnimations();
  bindGlobalEvents();
  initContactForm();
});

/* =========================================
   CUSTOM CINEMATIC CURSOR SYSTEM
   ========================================= */
function initCursor() {
  const cursor = document.getElementById("custom-cursor");
  const cursorDot = document.getElementById("custom-cursor-dot");
  
  let posX = 0, posY = 0;
  let mouseX = 0, mouseY = 0;
  
  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Tiny dot is instantly locked to cursor
    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;
  });
  
  // Outer circle follows with a fluid lerp lag
  gsap.ticker.add(() => {
    posX += (mouseX - posX) * 0.15;
    posY += (mouseY - posY) * 0.15;
    cursor.style.left = `${posX}px`;
    cursor.style.top = `${posY}px`;
  });
}

// Bind interactive hovers globally to scale the cursor
function bindHoverListeners() {
  const interactives = document.querySelectorAll("a, button, .filter-btn, .project-card, .channel-link, .form-input, .form-textarea");
  
  interactives.forEach(el => {
    el.addEventListener("mouseenter", () => {
      document.body.classList.add("hover-interactive");
    });
    el.addEventListener("mouseleave", () => {
      document.body.classList.remove("hover-interactive");
    });
  });
}

// Bind magnetic hover effects on buttons for premium weight feel
function bindMagneticButtons() {
  const magneticBtns = document.querySelectorAll(".btn-magnetic");
  
  magneticBtns.forEach(btn => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Pull button towards cursor slightly
      gsap.to(btn, {
        x: x * 0.35,
        y: y * 0.35,
        duration: 0.3,
        ease: "power2.out"
      });
      
      // If there is an inner element like an icon, pull it even further
      const icon = btn.querySelector("i");
      if (icon) {
        gsap.to(icon, {
          x: x * 0.15,
          y: y * 0.15,
          duration: 0.3,
          ease: "power2.out"
        });
      }
    });
    
    btn.addEventListener("mouseleave", () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.5,
        ease: "elastic.out(1, 0.3)"
      });
      
      const icon = btn.querySelector("i");
      if (icon) {
        gsap.to(icon, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "elastic.out(1, 0.3)"
        });
      }
    });
  });
  
  bindHoverListeners();
}

/* =========================================
   3D WEBGL GRAPHICS (THREE.JS)
   ========================================= */
function initThree() {
  const container = document.querySelector(".webgl-container");
  const canvas = document.getElementById("webgl-canvas");
  
  // Setup Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  
  // Setup Scene
  scene = new THREE.Scene();
  
  // Setup Camera
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0, 6.5);
  
  // Ambient Lighting (deep cyber tones)
  ambientLight = new THREE.AmbientLight(0x0a0518, 1.5);
  scene.add(ambientLight);
  
  // Bright Cyan Spotlight
  pointLightCyan = new THREE.PointLight(0x00f2fe, 8, 15);
  pointLightCyan.position.set(3, 3, 3);
  scene.add(pointLightCyan);
  
  // Bright Magenta Spotlight
  pointLightMagenta = new THREE.PointLight(0xf35588, 6, 15);
  pointLightMagenta.position.set(-3, -3, 3);
  scene.add(pointLightMagenta);
  
  // Soft Directional top fill light
  dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(0, 5, 2);
  scene.add(dirLight);

  // Generate 3D Glass Object (Morphing Torus Knot)
  const geom = new THREE.TorusKnotGeometry(1.2, 0.38, 180, 22, 3, 4);
  
  // Highly reflective & refractive glass material
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.05,
    transmission: 0.95, // Glass transparency
    ior: 1.6,           // Index of refraction
    thickness: 1.8,     // Refraction warp depth
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    reflectivity: 1.0,
    transparent: true
  });
  
  torusKnot = new THREE.Mesh(geom, glassMat);
  scene.add(torusKnot);

  // Outer techno wireframe ring
  const wireGeom = new THREE.TorusKnotGeometry(1.3, 0.39, 100, 12, 3, 4);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00f2fe,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  });
  outerWireframe = new THREE.Mesh(wireGeom, wireMat);
  scene.add(outerWireframe);

  // Generate Floating Particle Cloud
  initParticles();
  
  // Window Resize
  window.addEventListener("resize", onWindowResize);
  
  // Track Mouse movement relative to screen center
  window.addEventListener("mousemove", (e) => {
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  
  // Kick off Render Loop
  animateThree();
}

// Generate circular particles using programmatically created canvas texture (no file loads)
function createParticleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  
  // Radial alpha gradient
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  
  return new THREE.CanvasTexture(canvas);
}

function initParticles() {
  const count = 2500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  
  const colorCyan = new THREE.Color(0x00f2fe);
  const colorMagenta = new THREE.Color(0xf35588);
  const colorViolet = new THREE.Color(0x7f00ff);
  
  for (let i = 0; i < count; i++) {
    // Spherical random layout bounds
    const r = 2.0 + Math.random() * 8.0;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi) - 2;
    
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    
    // Multi-color blend mapping based on distance from origin
    let particleColor = colorCyan.clone();
    if (r > 4.5 && r < 7.0) {
      particleColor.lerp(colorMagenta, Math.random());
    } else if (r >= 7.0) {
      particleColor.lerp(colorViolet, Math.random());
    }
    
    colors[i * 3] = particleColor.r;
    colors[i * 3 + 1] = particleColor.g;
    colors[i * 3 + 2] = particleColor.b;
    
    sizes[i] = 0.5 + Math.random() * 1.5;
  }
  
  const particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particleGeom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  
  const particleTexture = createParticleTexture();
  const particleMat = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: particleTexture
  });
  
  particleSystem = new THREE.Points(particleGeom, particleMat);
  scene.add(particleSystem);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Three rendering frame tick
let timeClock = 0;
function animateThree() {
  requestAnimationFrame(animateThree);
  
  timeClock += 0.006;
  
  // Inertial mouse smoothing (lerping coordinates)
  mouse.x += (mouse.targetX - mouse.x) * 0.05;
  mouse.y += (mouse.targetY - mouse.y) * 0.05;
  
  // Smoothly rotate 3D geometries (reverse direction for wireframe counterplay)
  if (torusKnot) {
    torusKnot.rotation.y = timeClock * 0.5;
    torusKnot.rotation.x = timeClock * 0.25;
    
    // Parallax sway bound to mouse coords
    torusKnot.rotation.z = mouse.x * 0.3;
    torusKnot.position.x = mouse.x * 0.4;
    torusKnot.position.y = mouse.y * 0.4;
  }
  
  if (outerWireframe) {
    outerWireframe.rotation.y = -timeClock * 0.4;
    outerWireframe.rotation.x = -timeClock * 0.2;
    outerWireframe.position.x = mouse.x * 0.4;
    outerWireframe.position.y = mouse.y * 0.4;
  }
  
  if (particleSystem) {
    particleSystem.rotation.y = timeClock * 0.06;
    particleSystem.rotation.x = mouse.y * 0.05;
    particleSystem.rotation.z = mouse.x * 0.05;
  }

  // Animate light orbits to generate moving colored reflections on glass
  if (pointLightCyan && pointLightMagenta) {
    pointLightCyan.position.x = Math.sin(timeClock * 1.5) * 4;
    pointLightCyan.position.y = Math.cos(timeClock * 1.2) * 4;
    
    pointLightMagenta.position.x = -Math.sin(timeClock * 1.2) * 4;
    pointLightMagenta.position.y = -Math.cos(timeClock * 1.5) * 4;
  }
  
  renderer.render(scene, camera);
}

/* =========================================
   SCROLL-LINKED CAMERA MOVEMENTS (GSAP)
   ========================================= */
function initScrollAnimations() {
  // Title reveal animation on load
  const titleRows = document.querySelectorAll(".animate-title .title-row");
  gsap.fromTo(titleRows, 
    { y: "100%", opacity: 0 },
    { y: "0%", opacity: 1, duration: 1.2, stagger: 0.2, ease: "power4.out", delay: 0.4 }
  );

  gsap.fromTo(".animate-fade-in",
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 1.0, ease: "power3.out", delay: 0.2 }
  );

  gsap.fromTo(".animate-fade-in-delayed",
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 1.0, ease: "power3.out", delay: 0.8, onComplete: () => {
      bindMagneticButtons();
    }}
  );

  // Link navbar highlight state on scroll
  const sections = document.querySelectorAll("section");
  const navLinks = document.querySelectorAll(".nav-link");

  sections.forEach(section => {
    const id = section.getAttribute("id");
    
    ScrollTrigger.create({
      trigger: section,
      start: "top 60%",
      end: "bottom 40%",
      onEnter: () => activateNavLink(id),
      onEnterBack: () => activateNavLink(id)
    });
  });

  function activateNavLink(id) {
    navLinks.forEach(link => {
      link.classList.remove("active");
      if (link.getAttribute("href") === `#${id}`) {
        link.classList.add("active");
      }
    });
  }

  // 3D Camera ScrollTrigger Animations
  // Scroll Timeline 1: Hero to About (Shift 3D Torus right, zoom in slightly)
  gsap.timeline({
    scrollTrigger: {
      trigger: "#about",
      start: "top bottom",
      end: "top top",
      scrub: 1.2,
      invalidateOnRefresh: true
    }
  })
  .to(camera.position, { x: 1.8, y: -0.2, z: 5.5, ease: "power2.inOut" })
  .to(torusKnot.scale, { x: 0.85, y: 0.85, z: 0.85 }, 0)
  .to(outerWireframe.scale, { x: 0.85, y: 0.85, z: 0.85 }, 0);

  // Scroll Timeline 2: About to Projects (Shift camera deep, particles burst, hide torus)
  gsap.timeline({
    scrollTrigger: {
      trigger: "#projects",
      start: "top bottom",
      end: "top top",
      scrub: 1.2,
      invalidateOnRefresh: true
    }
  })
  .to(camera.position, { x: 0, y: -1.2, z: 7.2, ease: "power2.inOut" })
  .to(torusKnot.scale, { x: 0.25, y: 0.25, z: 0.25, opacity: 0 }, 0)
  .to(outerWireframe.scale, { x: 0.25, y: 0.25, z: 0.25, opacity: 0 }, 0)
  .to(particleSystem.scale, { x: 1.5, y: 1.5, z: 1.5 }, 0);

  // Scroll Timeline 3: Projects to Timeline (Rescale torus to the left, transition colors)
  gsap.timeline({
    scrollTrigger: {
      trigger: "#experience",
      start: "top bottom",
      end: "top top",
      scrub: 1.2,
      invalidateOnRefresh: true
    }
  })
  .to(camera.position, { x: -1.8, y: -0.5, z: 5.8, ease: "power2.inOut" })
  .to(torusKnot.scale, { x: 0.8, y: 0.8, z: 0.8, opacity: 1 }, 0)
  .to(outerWireframe.scale, { x: 0.8, y: 0.8, z: 0.8, opacity: 1 }, 0)
  .to(particleSystem.scale, { x: 1.0, y: 1.0, z: 1.0 }, 0);

  // Scroll Timeline 4: Timeline to Contact (Center torus at bottom, expand particles into glow background)
  gsap.timeline({
    scrollTrigger: {
      trigger: "#contact",
      start: "top bottom",
      end: "top top",
      scrub: 1.2,
      invalidateOnRefresh: true
    }
  })
  .to(camera.position, { x: 0, y: 0, z: 4.8, ease: "power2.inOut" })
  .to(torusKnot.scale, { x: 1.3, y: 1.3, z: 1.3 }, 0)
  .to(outerWireframe.scale, { x: 1.3, y: 1.3, z: 1.3 }, 0)
  .to(torusKnot.position, { y: -0.8 }, 0)
  .to(outerWireframe.position, { y: -0.8 }, 0);

  // Animate About Elements on Entrance
  gsap.from(".about-bio", {
    scrollTrigger: {
      trigger: "#about",
      start: "top 70%"
    },
    opacity: 0,
    x: -50,
    duration: 1.0,
    ease: "power3.out"
  });

  gsap.from(".skill-category", {
    scrollTrigger: {
      trigger: "#about",
      start: "top 70%"
    },
    opacity: 0,
    x: 50,
    duration: 0.8,
    stagger: 0.15,
    ease: "power3.out"
  });

  // Animate Timeline Items
  gsap.from(".timeline-item", {
    scrollTrigger: {
      trigger: "#experience",
      start: "top 70%"
    },
    opacity: 0,
    y: 50,
    duration: 0.8,
    stagger: 0.2,
    ease: "power3.out"
  });
}

/* =========================================
   3D CARD HOVER TILT CONTROLLER
   ========================================= */
function bindCardTilt() {
  const cards = document.querySelectorAll(".project-card");
  
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      
      // Calculate mouse pointer location relative to card coordinates
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Map coordinates to css variables for dynamic hover glow background
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
      
      // Map coordinates to angle bounds (-15deg to 15deg)
      const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -12;
      const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 12;
      
      gsap.to(card, {
        rotateX: rotateX,
        rotateY: rotateY,
        transformPerspective: 1000,
        z: 20,
        boxShadow: "0 25px 45px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 30px rgba(0, 242, 254, 0.15)",
        borderColor: "rgba(0, 242, 254, 0.3)",
        duration: 0.3,
        ease: "power2.out"
      });
    });
    
    card.addEventListener("mouseleave", () => {
      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        z: 0,
        boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
        borderColor: "rgba(255, 255, 255, 0.05)",
        duration: 0.6,
        ease: "power3.out"
      });
    });
  });
}

/* =========================================
   GLOBAL INTERACTIVE EVENTS
   ========================================= */
function bindGlobalEvents() {
  // Smooth scroll hijack for floating nav link clicks
  const navLinks = document.querySelectorAll(".nav-link, a[href^='#']");
  
  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = link.getAttribute("href");
      if (targetId === "#") return;
      
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        gsap.to(window, {
          scrollTo: {
            y: targetSection,
            autoKill: false
          },
          duration: 1.2,
          ease: "power3.inOut"
        });
      }
    });
  });
}

/* =========================================
   CONTACT FORM INTEGRATION & 3D FEEDBACK
   ========================================= */
function initContactForm() {
  const form = document.getElementById("portfolio-contact-form");
  const successOverlay = document.getElementById("form-success");
  const resetBtn = document.getElementById("reset-form-btn");
  
  if (!form) return;
  
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const submitBtn = form.querySelector(".btn-submit");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnIcon = submitBtn.querySelector(".btn-icon");
    
    // Animate to transmitting state
    btnText.innerText = "Transmitting...";
    btnIcon.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    submitBtn.style.pointerEvents = "none";
    
    // Simulate API signal transmitter delay
    setTimeout(() => {
      // Trigger WebGL feedback: Accelerate particle swirl speed and lights during transmit!
      triggerThreeSuccessFeedback();
      
      // Reveal success layout panel
      successOverlay.classList.add("visible");
      
      // Reset button visuals
      btnText.innerText = "Transmit Signal";
      btnIcon.innerHTML = '<i class="fa-regular fa-paper-plane"></i>';
      submitBtn.style.pointerEvents = "auto";
      form.reset();
    }, 1800);
  });
  
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      successOverlay.classList.remove("visible");
    });
  }
}

// Custom 3D particle explosion + strobe reflection flash for success confirmation
function triggerThreeSuccessFeedback() {
  const tl = gsap.timeline();
  
  // Flash light intensities
  tl.to(pointLightCyan, { intensity: 35, distance: 30, duration: 0.3 })
    .to(pointLightMagenta, { intensity: 30, distance: 30, duration: 0.3 }, 0)
    .to(torusKnot.scale, { x: 1.8, y: 1.8, z: 1.8, duration: 0.4, ease: "power4.out" }, 0)
    
    // Return lights and glass shape to standard parameters smoothly
    .to(pointLightCyan, { intensity: 8, distance: 15, duration: 1.5, ease: "power2.out" })
    .to(pointLightMagenta, { intensity: 6, distance: 15, duration: 1.5, ease: "power2.out" }, "-=1.5")
    .to(torusKnot.scale, { x: 1.3, y: 1.3, z: 1.3, duration: 1.2, ease: "elastic.out(1, 0.4)" }, "-=1.5");
    
  // Temporarily swirl particle cloud rapidly
  gsap.fromTo(particleSystem.rotation,
    { y: particleSystem.rotation.y },
    { y: particleSystem.rotation.y + Math.PI * 2, duration: 2.0, ease: "power3.out" }
  );
}
