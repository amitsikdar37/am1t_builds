import * as THREE from 'three';
import { THEME } from '../scene/theme.js';

/**
 * Audio-reactive whole-room party lighting with a fixed rendering cost.
 *
 * No lights or meshes are created here. The effect retints the room's existing
 * pooled lights and global fill, so its GPU cost is the same whether there are
 * four photographs or sixteen. Low-end devices only analyse audio less often;
 * interpolation remains smooth at the display refresh rate.
 */
export function createPartyLights(scene, lighting, tier) {
  const tints = THEME.shaftTints.map((hex) => new THREE.Color(hex));
  const warmPicture = new THREE.Color(THEME.pictureLightColor);
  const warmHemiSky = new THREE.Color(0xfff5e8);
  const warmHemiGround = new THREE.Color(0xffd8b8);
  const warmAmbient = new THREE.Color(THEME.ambientColor);
  const warmTravel = new THREE.Color(0xffe8cc);
  const warmBackground = scene.background.clone();
  const warmFog = scene.fog?.color.clone() || warmBackground.clone();

  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  const target = new THREE.Color();
  let amount = 0;
  let paletteIndex = 0;
  let lastBeatId = 0;
  let rhythm = 0;
  let travellingBaseY = lighting.travelling.position.y;

  function tinted(base, party, mix, out) {
    return out.copy(base).lerp(party, THREE.MathUtils.clamp(mix, 0, 1));
  }

  return {
    update(dt, now, audio) {
      // lighting.update() restores this moving fill to its camera-relative base
      // immediately before us. Capture that base so beat lift never accumulates.
      travellingBaseY = lighting.travelling.position.y;
      const activeTarget = audio.active ? 1 : 0;
      amount += (activeTarget - amount) * (1 - Math.exp(-dt * (activeTarget ? 3.8 : 2.2)));

      if (audio.beatId !== lastBeatId) {
        lastBeatId = audio.beatId;
        // Skip by one or two colours according to mid-band energy. This avoids a
        // predictable rainbow loop while keeping adjacent beats harmonious.
        paletteIndex = (paletteIndex + 1 + (audio.mid > 0.48 ? 1 : 0)) % tints.length;
        rhythm = (rhythm + 1) % 4;
      }

      const seconds = now * 0.001;
      const drift = Math.floor(seconds * (0.22 + audio.mid * 0.55));
      const primary = tints[(paletteIndex + drift) % tints.length];
      const secondary = tints[(paletteIndex + drift + 2 + rhythm) % tints.length];
      const pulse = audio.pulse;
      const energy = THREE.MathUtils.clamp(audio.energy * 1.45, 0, 1);
      // ── Why the wash is now small ───────────────────────────────────────────
      //
      // Hemisphere, ambient, background and fog are the four things in the scene
      // with NO position. Tinting them cannot produce a highlight, a falloff or a
      // shadow — every surface in the room shifts hue by the same amount at the
      // same instant, which is precisely the "wall colours are changing thats
      // all" this looked like. The wash was carrying the whole effect at up to
      // 0.56 mix; it now carries a fifth of that and only does the one job it is
      // physically right for: putting a hint of the gel into the hazy air so the
      // far end of the corridor glows instead of staying neutral.
      //
      // The effect itself moved onto things that have a position — the picture
      // lights below, and the fixtures/shafts/pools in fx/beams.js. That is the
      // difference between a room lit by coloured lamps and a room that has been
      // repainted.
      const roomMix = amount * (0.05 + energy * 0.09 + pulse * 0.07);

      colorA.copy(primary).lerp(secondary, 0.28 + audio.treble * 0.35);
      tinted(warmHemiSky, colorA, roomMix * 0.55, target);
      lighting.hemi.color.lerp(target, 1 - Math.exp(-dt * 5));
      tinted(warmHemiGround, secondary, roomMix * 0.45, target);
      lighting.hemi.groundColor.lerp(target, 1 - Math.exp(-dt * 5));
      // Barely modulated. A room whose overall brightness pumps on the beat reads
      // as a fading screen, not as lights — the pumping belongs on the fixtures.
      lighting.hemi.intensity = 0.36 + amount * (energy * 0.06 + pulse * 0.05);

      // Ambient is the flattest contributor of the four: it hits every face of
      // every object equally regardless of orientation. Kept almost neutral.
      tinted(warmAmbient, primary, roomMix * 0.20, target);
      lighting.ambient.color.lerp(target, 1 - Math.exp(-dt * 4));
      lighting.ambient.intensity = THEME.ambientIntensity + amount * (energy * 0.03 + pulse * 0.015);

      // Haze and distance keep a larger share than the fills do: coloured light
      // genuinely scatters in air, so a tinted far end reads as depth rather than
      // as repainted plaster, and it is what sells the gels from across the room.
      tinted(warmBackground, secondary, roomMix * 0.50, target);
      scene.background.lerp(target, 1 - Math.exp(-dt * 2.5));
      if (scene.fog) {
        tinted(warmFog, primary, roomMix * 0.45, target);
        scene.fog.color.lerp(target, 1 - Math.exp(-dt * 2.5));
      }

      // ── The picture lights now carry the effect ──────────────────────────────
      //
      // These are the only real, positioned, falling-off lights in the corridor,
      // so they are what can actually look like lighting. Two changes:
      //
      // 1. A CHASE, not a unison fade. Every fixture used to brighten on every
      //    beat by the same factor, which is the signature of a global filter
      //    rather than of lamps. Now each beat kicks one group of three while the
      //    others sit dim, so the accent runs down the corridor the way a real
      //    lighting desk steps through its channels. The dim/lit ratio is the
      //    whole illusion — an evenly lit row cannot chase.
      // 2. Deeper modulation. Because the wash above no longer competes, these can
      //    swing much harder without the room turning neon, and a light that
      //    swings hard against a stable room reads as a source.
      //
      // Cost is unchanged: same lights, same count, a colour and a scalar each.
      for (let i = 0; i < lighting.pool.length; i++) {
        const slot = lighting.pool[i];
        const alternate = (i + rhythm) % 2;
        const party = alternate ? secondary : primary;
        const sparkle = 0.5 + 0.5 * Math.sin(seconds * (4.5 + audio.treble * 8) + i * 1.7);
        // One third of the row accents per beat; the rest hold their base level.
        const onBeat = (i + rhythm) % 3 === 0 ? pulse : 0;
        const mix = Math.min(1, amount * (0.55 + energy * 0.34 + sparkle * audio.treble * 0.20));
        tinted(warmPicture, party, mix, target);
        slot.light.color.lerp(target, 1 - Math.exp(-dt * 9));
        slot.light.intensity *= 1 + amount * (
          audio.bass * 0.30 + onBeat * 0.85 + pulse * 0.10 + sparkle * audio.treble * 0.10
        );
      }

      colorB.copy(primary).lerp(secondary, 0.5 + 0.25 * Math.sin(seconds * 0.7));
      tinted(warmTravel, colorB, amount * (0.42 + energy * 0.38), target);
      lighting.travelling.color.lerp(target, 1 - Math.exp(-dt * 8));
      lighting.travelling.intensity = 3.4 + amount * (audio.bass * 1.45 + pulse * 1.15);

      // Movement costs only two scalar writes and makes bass feel spatial. Keep
      // the low tier's displacement smaller to minimise rapidly changing pixels.
      const travelScale = tier.name === 'low' ? 0.45 : 1;
      lighting.travelling.position.x = amount * travelScale *
        Math.sin(seconds * (0.8 + audio.mid * 1.4)) * (0.35 + audio.bass * 0.75);
      lighting.travelling.position.y = travellingBaseY + amount * travelScale * pulse * 0.22;
    },
  };
}