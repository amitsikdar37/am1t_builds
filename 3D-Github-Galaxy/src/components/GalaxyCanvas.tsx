'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import gsap from 'gsap';
import { GalaxySceneData, StarData } from '@/lib/types';
import { CentralCore } from '@/three/CentralCore';
import { CosmicDust } from '@/three/CosmicDust';
import { StarSystemManager } from '@/three/StarSystem';
import { ConstellationLines } from '@/three/ConstellationLines';
import { PostProcessingManager } from '@/three/PostProcessing';
import { spaceAudio } from '@/lib/audio-synthesizer';

interface GalaxyCanvasProps {
  galaxyData: GalaxySceneData;
  rivalGalaxyData?: GalaxySceneData | null;
  isMuted: boolean;
  isBloomEnabled: boolean;
  areConstellationsVisible: boolean;
  selectedStar: StarData | null;
  onSelectStar: (star: StarData | null) => void;
  onHoverStar: (star: StarData | null, screenPos: { x: number; y: number } | null) => void;
  onResetTrigger?: number;
}

export const GalaxyCanvas: React.FC<GalaxyCanvasProps> = ({
  galaxyData,
  rivalGalaxyData,
  isMuted,
  isBloomEnabled,
  areConstellationsVisible,
  selectedStar,
  onSelectStar,
  onHoverStar,
  onResetTrigger,
}) => {
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedStarPos, setSelectedStarPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // References to keep across renders
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const postProcessingRef = useRef<PostProcessingManager | null>(null);

  const centralCoreRef = useRef<CentralCore | null>(null);
  const cosmicDustRef = useRef<CosmicDust | null>(null);
  const starSystemRef = useRef<StarSystemManager | null>(null);
  const constellationRef = useRef<ConstellationLines | null>(null);

  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2(-1000, -1000));
  const isTransitioningRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Smoothly fly camera to a target position
  const flyCameraTo = useCallback((targetX: number, targetY: number, targetZ: number, lookX: number, lookY: number, lookZ: number, duration: number = 1.8) => {
    if (!cameraRef.current || !controlsRef.current) return;

    isTransitioningRef.current = true;
    controlsRef.current.enabled = false;

    // Trigger audio warp whoosh
    spaceAudio.triggerWarpWhoosh();

    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    const startTarget = { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z };

    gsap.killTweensOf(cam.position);
    gsap.killTweensOf(ctrl.target);

    // Animate target lookAt
    gsap.to(startTarget, {
      x: lookX,
      y: lookY,
      z: lookZ,
      duration: duration * 0.9,
      ease: 'power3.out',
      onUpdate: () => {
        ctrl.target.set(startTarget.x, startTarget.y, startTarget.z);
      },
    });

    // Animate camera position
    gsap.to(cam.position, {
      x: targetX,
      y: targetY,
      z: targetZ,
      duration: duration,
      ease: 'power3.inOut',
      onUpdate: () => {
        cam.lookAt(ctrl.target);
      },
      onComplete: () => {
        isTransitioningRef.current = false;
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      },
    });
  }, []);

  // Return to Overview
  const flyToOverview = useCallback(() => {
    if (rivalGalaxyData) {
      flyCameraTo(0, 140, 160, 0, 0, 0, 1.8);
    } else {
      flyCameraTo(0, 65, 65, 0, 0, 0, 1.8);
    }
    spaceAudio.resetToOverview();
    if (starSystemRef.current) {
      starSystemRef.current.setSelectedStar(null);
    }
  }, [flyCameraTo, rivalGalaxyData]);

  // Handle star selection from props or click
  useEffect(() => {
    if (selectedStar && starSystemRef.current) {
      // Find mesh in StarSystemManager to get accurate world position (since it might be orbiting)
      const mesh = starSystemRef.current.starMeshes.find(
        (m) => (m.userData.starData as StarData)?.id === selectedStar.id
      );

      if (mesh) {
        const targetPos = new THREE.Vector3();
        mesh.getWorldPosition(targetPos);

        const offsetDist = Math.max(selectedStar.radius * 2.8, 3.2);
        flyCameraTo(
          targetPos.x + offsetDist * 0.8,
          targetPos.y + offsetDist * 0.5,
          targetPos.z + offsetDist * 0.8,
          targetPos.x,
          targetPos.y,
          targetPos.z,
          1.7
        );

        starSystemRef.current.setSelectedStar(mesh);
      }


      spaceAudio.tuneToStarSystem(selectedStar.stars, selectedStar.distanceFromCore);
    }
  }, [selectedStar, flyCameraTo]);

  // React to Reset Trigger
  useEffect(() => {
    if (onResetTrigger && onResetTrigger > 0) {
      flyToOverview();
      onSelectStar(null);
    }
  }, [onResetTrigger, flyToOverview, onSelectStar]);

  // Update Bloom Setting
  useEffect(() => {
    if (postProcessingRef.current) {
      postProcessingRef.current.setBloomEnabled(isBloomEnabled);
    }
  }, [isBloomEnabled]);

  // Update Constellation Lines Setting
  useEffect(() => {
    if (constellationRef.current) {
      constellationRef.current.setVisible(areConstellationsVisible);
    }
  }, [areConstellationsVisible]);

  // Update Audio Mute Setting
  useEffect(() => {
    spaceAudio.setMuted(isMuted);
  }, [isMuted]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.0035);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    if (rivalGalaxyData) {
      camera.position.set(0, 140, 160); // Zoomed out for battle mode
    } else {
      camera.position.set(0, 65, 65); // Default single galaxy view
    }
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x030712, 1);

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 240;
    controls.minDistance = 2.0;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.35;
    controlsRef.current = controls;

    // 4. Post-Processing Bloom
    const postProcessing = new PostProcessingManager(renderer, scene, camera, width, height);
    postProcessing.setBloomEnabled(isBloomEnabled);
    postProcessingRef.current = postProcessing;

    // 5. Populate Galaxy Objects
    
    // Create a barycenter if a rival exists to make them orbit each other
    const barycenter = new THREE.Group();
    scene.add(barycenter);
    
    let rivalCoreInstance: CentralCore | null = null;
    let rivalSystemInstance: StarSystemManager | null = null;
    
    const primaryGalaxyGroup = new THREE.Group();
    barycenter.add(primaryGalaxyGroup);

    // Offset galaxies if battling
    if (rivalGalaxyData) {
      primaryGalaxyGroup.position.set(-60, 0, 0); // Move left
      
      const rivalGalaxyGroup = new THREE.Group();
      rivalGalaxyGroup.position.set(60, 0, 0); // Move right
      barycenter.add(rivalGalaxyGroup);
      
      // Rival Core
      rivalCoreInstance = new CentralCore(
        rivalGalaxyData.metrics.coreRadius, 
        rivalGalaxyData.metrics.coreLuminosity,
        rivalGalaxyData.user.login,
        true // isRival
      );
      rivalGalaxyGroup.add(rivalCoreInstance.group);
      
      // Rival Star Systems
      rivalSystemInstance = new StarSystemManager(rivalGalaxyData.stars, true);
      rivalGalaxyGroup.add(rivalSystemInstance.group);
    }

    // Central Core (Black Hole / Supermassive Star)
    const centralCore = new CentralCore(
      galaxyData.metrics.coreRadius,
      galaxyData.metrics.coreLuminosity,
      galaxyData.user.login,
      false // not rival
    );
    primaryGalaxyGroup.add(centralCore.group);
    centralCoreRef.current = centralCore;

    // Cosmic Background Dust (38,000 Points) - Centered on scene
    const cosmicDust = new CosmicDust(38000);
    scene.add(cosmicDust.points);
    cosmicDustRef.current = cosmicDust;

    // Star Systems (Repositories)
    const starSystemManager = new StarSystemManager(galaxyData.stars);
    primaryGalaxyGroup.add(starSystemManager.group);
    starSystemRef.current = starSystemManager;

    // Constellation Lines
    const constellationLines = new ConstellationLines(galaxyData.stars, starSystemManager.starMeshes);
    primaryGalaxyGroup.add(constellationLines.group);
    constellationLines.setVisible(areConstellationsVisible);
    constellationRef.current = constellationLines;

    // Subtle Ambient & Core Illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const corePointLight = new THREE.PointLight(0x38bdf8, 3.0, 300);
    primaryGalaxyGroup.add(corePointLight);

    if (rivalGalaxyData) {
       const rivalPointLight = new THREE.PointLight(0xf43f5e, 3.0, 300);
       barycenter.children[1].add(rivalPointLight); // add to rival group
    }

    // Initial audio initialize on user interaction
    const handleFirstInteraction = () => {
      spaceAudio.init();
      spaceAudio.resume();
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('pointerdown', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    // 6. Raycasting & Event Handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (!cameraRef.current || !starSystemRef.current) return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const targets = [...starSystemRef.current.starMeshes];
      if (rivalSystemInstance) targets.push(...rivalSystemInstance.starMeshes);
      
      const intersects = raycasterRef.current.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const star = hitMesh.userData.starData as StarData;

        // If it's a rival star, we can still hover it
        if (hitMesh.userData.isRival && rivalSystemInstance) {
          rivalSystemInstance.setHoveredStar(hitMesh);
          starSystemRef.current.setHoveredStar(null);
        } else {
          starSystemRef.current.setHoveredStar(hitMesh);
          if (rivalSystemInstance) rivalSystemInstance.setHoveredStar(null);
        }
        
        document.body.style.cursor = 'pointer';

        // Project 3D coordinate to 2D screen coordinate
        const screenPos = new THREE.Vector3();
        hitMesh.getWorldPosition(screenPos);
        screenPos.project(cameraRef.current);

        const x = (screenPos.x * 0.5 + 0.5) * rect.width;
        const y = -(screenPos.y * 0.5 - 0.5) * rect.height;

        onHoverStar(star, { x, y });
      } else {
        starSystemRef.current.setHoveredStar(null);
        if (rivalSystemInstance) rivalSystemInstance.setHoveredStar(null);
        document.body.style.cursor = 'default';
        onHoverStar(null, null);
      }
    };

    const handleClick = () => {
      if (!cameraRef.current || !starSystemRef.current) return;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      
      const targets = [...starSystemRef.current.starMeshes];
      if (rivalSystemInstance) targets.push(...rivalSystemInstance.starMeshes);
      
      const intersects = raycasterRef.current.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const star = hitMesh.userData.starData as StarData;
        spaceAudio.triggerStarChime();
        onSelectStar(star);
      }
    };

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current || !postProcessingRef.current) return;
      const w = containerRef.current.clientWidth || window.innerWidth;
      const h = containerRef.current.clientHeight || window.innerHeight;

      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(w, h);
      postProcessingRef.current.setSize(w, h);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);

    // 7. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Update 3D celestial components
      if (centralCoreRef.current) centralCoreRef.current.update(delta, elapsed);
      if (cosmicDustRef.current) cosmicDustRef.current.update(delta);
      if (starSystemRef.current) starSystemRef.current.update(delta, elapsed, !!selectedStar);
      if (constellationRef.current) constellationRef.current.update();

      // Animate barycenter (Orbiting galaxies)
      if (rivalGalaxyData) {
        barycenter.rotation.y += delta * 0.05; // Slow majestic orbit
        
        // Also update rival's celestial components
        if (rivalCoreInstance) rivalCoreInstance.update(delta, elapsed);
        if (rivalSystemInstance) rivalSystemInstance.update(delta, elapsed, false);
      }

      // Render with post-processing bloom
      if (postProcessingRef.current) {
        postProcessingRef.current.render();
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Update 2D position for the selected star label
      if (selectedStar && starSystemRef.current && cameraRef.current) {
        const mesh = starSystemRef.current.starMeshes.find(
          (m) => (m.userData.starData as StarData)?.id === selectedStar.id
        );
        if (mesh) {
          const screenPos = new THREE.Vector3();
          mesh.getWorldPosition(screenPos);
          screenPos.project(cameraRef.current);
          
          const px = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
          const py = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;
          setSelectedStarPos({ x: px, y: py });
        }
      } else if (!selectedStar && selectedStarPos) {
        setSelectedStarPos(null);
      }
    };

    animate();

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);

      if (centralCoreRef.current) centralCoreRef.current.dispose();
      if (cosmicDustRef.current) cosmicDustRef.current.dispose();
      if (starSystemRef.current) starSystemRef.current.dispose();
      if (constellationRef.current) constellationRef.current.dispose();
      if (postProcessingRef.current) postProcessingRef.current.dispose();
      
      if (rivalCoreInstance) rivalCoreInstance.dispose();
      if (rivalSystemInstance) rivalSystemInstance.dispose();

      if (rendererRef.current && rendererRef.current.domElement) {
        container.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [galaxyData, rivalGalaxyData]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden bg-space-950">
      {/* Selected Star Persistent Label */}
      {selectedStar && selectedStarPos && (
        <div
          className="pointer-events-none fixed z-20 transition-all duration-75 ease-out"
          style={{
            left: `${selectedStarPos.x}px`,
            top: `${selectedStarPos.y}px`,
            transform: 'translate(-50%, -200%)',
          }}
        >
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="px-2.5 py-1 rounded-md bg-space-950/80 backdrop-blur border border-cyan-500/50 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
              <span className="text-[10px] font-mono font-bold text-white tracking-wider whitespace-nowrap">
                {selectedStar.name}
              </span>
            </div>
            <div className="w-px h-6 bg-gradient-to-b from-cyan-500/50 to-transparent" />
          </div>
        </div>
      )}
    </div>
  );
};
