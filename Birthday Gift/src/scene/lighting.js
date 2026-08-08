import * as THREE from 'three';
import { THEME } from './theme.js';
import { ROOM_W, ROOM_H } from './room.js';

/**
 * Light pooling.
 *
 * A 16-frame corridor with a picture light over each frame would need 16
 * dynamic lights. Every one of those multiplies the fragment shader cost across
 * every lit pixel — it is the single fastest way to make this unplayable on a
 * phone.
 *
 * Instead we keep a small fixed pool of PointLights and reposition them each
 * frame onto whichever frames are nearest the camera. Frames further away still
 * *look* lit, because each one has its own cheap emissive brass fixture quad
 * that needs no real light at all. Total lighting cost is constant no matter
 * how long the corridor gets.
 */

const POOL_SIZE = 4;

export function buildLighting(scene, tier, corridorLength) {
  // Global fill. Hemisphere rather than ambient so the floor and ceiling read
  // differently and the room doesn't look flat.
  //
  // Deliberately dim. Fill light is the enemy of atmosphere: it reaches into
  // every corner equally, so nothing is ever in shadow, and a light shaft can
  // only be seen against air that is darker than the shaft. At 0.6 hemi + 0.55
  // ambient the corridor was uniformly lit to near-white and the volumetrics
  // were mathematically present but invisible. What is left here is just enough
  // to keep the walls off pure black between the picture lights.
  const hemi = new THREE.HemisphereLight(0xfff5e8, 0xffd8b8, 0.36);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(THEME.ambientColor, THEME.ambientIntensity);
  scene.add(ambient);

  // The travelling pool.
  //
  // These are SpotLights, not PointLights. A PointLight radiates in every
  // direction from a position floating in front of the wall, which is why the
  // beam never looked like it came out of the fixture — it lit the wall above the
  // shade, behind the shade, and the ceiling equally. A SpotLight positioned at
  // the bulb and aimed at the artwork produces a cone that actually starts at the
  // hood and falls off across the frame.
  //
  // decay is 2.0 — physically correct inverse-square. The old 1.4 kept the light
  // unnaturally strong close in, which on the previous dark plum walls read as a
  // pleasant pool but on cream walls clips straight to white.
  //
  // penumbra 0.85 keeps the cone edge soft; a hard-edged ellipse on the wall
  // reads as a stage light, not a picture light.
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    const light = new THREE.SpotLight(
      THEME.pictureLightColor,
      0,
      9,            // distance
      0.85,         // angle — cone just wide enough to wash the frame plus a
                    //   little wall either side, at ~1.5m throw
      0.75,         // penumbra
      2.0           // decay
    );
    light.position.set(0, ROOM_H - 1, -100);
    // The target must be in the scene graph for three to read its world matrix.
    scene.add(light.target);
    scene.add(light);
    pool.push({ light, assignedTo: null });
  }

  // A single soft light travelling with the camera keeps the immediate
  // foreground from going flat between frames.
  //
  // With the fill cut back this light is now doing a second job: it sits on the
  // centre line at ceiling-fixture height, so it stands in for whichever
  // downlight the visitor is currently under. That is why it's brighter and
  // higher than it was — one moving light instead of a fixture-per-shaft, which
  // is the difference between a constant cost and one that grows with the room.
  const travelling = new THREE.PointLight(0xffe8cc, 3.4, 16, 2.0);
  scene.add(travelling);

  return {
    hemi,
    ambient,
    pool,
    travelling,

    /**
     * Reassign the pool to the nearest frames. Called every frame, but the work
     * is trivial: one distance comparison per frame object.
     */
    update(cameraZ, frames) {
      if (!frames || frames.length === 0) return;

      // Find the POOL_SIZE nearest frames by |z - cameraZ|.
      const sorted = frames
        .map((f, i) => ({ i, f, d: Math.abs(f.z - cameraZ) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, POOL_SIZE);

      for (let p = 0; p < POOL_SIZE; p++) {
        const slot = pool[p];
        const target = sorted[p];

        if (!target) {
          slot.light.intensity = 0;
          continue;
        }

        const { f, d } = target;
        // Fade in as the frame approaches so lights never pop on abruptly. The
        // range is wider than the frame spacing (5.5) so that at any camera
        // position at least two lights are near full brightness — otherwise the
        // corridor pulses dark between frames.
        const falloff = Math.max(0.25, 1 - d / 16);
        slot.light.intensity = THEME.pictureLightIntensity * falloff;

        // Sit the light at the bulb inside the hood and aim it at the artwork.
        // Both anchors come from the frame's own geometry, so the cone always
        // originates where the fixture visibly is.
        if (f.lightPos && f.lightTarget) {
          slot.light.position.copy(f.lightPos);
          slot.light.target.position.copy(f.lightTarget);
        } else {
          slot.light.position.set(
            f.wall === 'L' ? -ROOM_W / 2 + 0.35 : ROOM_W / 2 - 0.35,
            f.y + 1.1,
            f.z
          );
          slot.light.target.position.set(
            f.wall === 'L' ? -ROOM_W / 2 : ROOM_W / 2,
            f.y - 0.2,
            f.z
          );
        }
        slot.light.target.updateMatrixWorld();
      }

      travelling.position.set(0, ROOM_H - 0.6, cameraZ);
    },
  };
}
