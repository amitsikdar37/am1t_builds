import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Optional bloom.
 *
 * Bloom is what makes the candle flames and brass fixtures glow rather than just
 * being bright pixels — a real quality difference. It is also the most expensive
 * thing in this scene, because it means extra full-screen passes every frame.
 *
 * So: LOW tier skips it entirely and renders direct (the flames already use
 * additive blending, so they still read as hot without it). MID and HIGH get it,
 * but the composer runs at a reduced internal resolution — bloom is a blur, so
 * resolving it at half res is very nearly indistinguishable and roughly quarters
 * the cost.
 */

export function createPost(renderer, scene, camera, tier) {
  // LOW tier: no composer at all. Direct render, zero overhead.
  if (!tier.bloom) {
    return {
      enabled: false,
      render() {
        renderer.render(scene, camera);
      },
      resize() {},
      // Already direct-rendering; the governor may still call these.
      disable() {},
      setStrength() {},
    };
  }

  const scale = 0.5;
  const w = Math.max(1, Math.floor(window.innerWidth * scale));
  const h = Math.max(1, Math.floor(window.innerHeight * scale));

  const composer = new EffectComposer(renderer);
  composer.setSize(window.innerWidth, window.innerHeight);

  composer.addPass(new RenderPass(scene, camera));

  // Threshold high enough that only explicitly emissive materials bloom — not
  // lit surfaces, not the walls, not the photos. At 1.05, a surface must be
  // brighter than a perfect white diffuse under neutral illumination before it
  // triggers bloom at all, which confines the effect to the candle flames, the
  // additive glow quads, and specular highlights on brass.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(w, h),
    0.58,  // strength
    0.85,  // radius
    1.05   // threshold
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  // Flipped by disable() when the FPS governor decides the composer is what the
  // device cannot afford. Checked in render() rather than by swapping the function
  // out, so `post.enabled` and the actual behaviour cannot disagree.
  let bypass = false;

  const api = {
    enabled: true,
    composer,
    bloom,
    render() {
      if (bypass) {
        renderer.render(scene, camera);
        return;
      }
      composer.render();
    },

    /**
     * Drop to direct rendering. This is the first rung on the governor's ladder
     * because bloom is two full-screen passes whose absence reads as slightly less
     * glow, where the alternative — lowering resolution — reads as blur across the
     * entire image.
     *
     * The composer is kept alive rather than disposed. Re-entering the finale still
     * calls setStrength, and a disposed composer would throw; keeping it costs one
     * idle render target on a device that has already proven it needs the memory
     * back, which is a worse trade than it sounds but a far better one than a crash.
     */
    disable() {
      bypass = true;
      api.enabled = false;
    },
    resize(width, height) {
      composer.setSize(width, height);
      bloom.setSize(
        Math.max(1, Math.floor(width * scale)),
        Math.max(1, Math.floor(height * scale))
      );
    },
    /** Let the finale push the glow up for a moment. */
    setStrength(v) {
      bloom.strength = v;
    },
  };

  return api;
}
