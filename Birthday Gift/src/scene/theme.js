/**
 * Bright, warm, celebratory birthday party theme.
 */

export const THEME = {
  // Walls: soft warm cream with peachy glow
  wallBase: 0xfff5e8,
  wallAccent: 0xffe4cc,

  // Bright gold & rose gold accents
  brass: 0xffa94d,
  brassHighlight: 0xffcc70,
  brassDark: 0xff8c1a,

  // Floor: warm light wood
  floorBase: 0xe8d4b8,
  floorHighlight: 0xf5e5d0,

  // Lighting: bright and warm
  //
  // The ambient term is what the room looks like with every lamp switched off,
  // so it has to sit well under the picture lights or those lamps stop reading
  // as lamps. It was 0.55, which on top of the hemisphere put the walls at
  // near-full brightness before a single fixture contributed anything.
  ambientColor: 0xfff8f0,
  ambientIntensity: 0.30,

  // Picture lights (warm and bright). Raised alongside the ambient cut so the
  // artwork is no dimmer than before — the change is in the ratio between lit
  // and unlit, which is the only thing that makes a pool of light look like one.
  pictureLightColor: 0xfff0d8,
  pictureLightIntensity: 6.6,

  // Cake area spotlight
  cakeSpotColor: 0xfffff0,

  // Fairy light bokeh: colorful
  bokehColor: 0xffd580,

  // ── Party palette ─────────────────────────────────────────────────────────
  // The room was a single warm hue from end to end, which reads as "tasteful
  // gallery" rather than "someone decorated this for a birthday". These are the
  // saturated party colours — used for objects: balloons, bunting, bokeh.
  partyPalette: [
    0xff6fae, // pink
    0x59c2ff, // blue
    0xffd23f, // yellow
    0x74dd8e, // green
    0xff6b6b, // red
    0xb98cff, // violet
  ],

  /**
   * The same hues as light rather than as paint.
   *
   * Deliberately far paler than partyPalette. These tint additive shafts, and an
   * additive surface at full saturation does not read as coloured light — it
   * reads as a coloured gel laid over the picture, because additive blending can
   * only ever push channels up. A pale tint raises its own channels hardest and
   * the others nearly as much, which is what real coloured lighting does to a
   * cream wall.
   */
  shaftTints: [
    0xffc3dd, // pink
    0xbfe4ff, // blue
    0xffeeb8, // yellow
    0xc6f2cf, // green
    0xffc7bd, // coral
    0xdcc9ff, // violet
  ],

  // ── Atmosphere ────────────────────────────────────────────────────────────
  // Airborne dust. Near-white with a warm bias: real motes are colourless and
  // only look golden because of what is lighting them, so anything more
  // saturated than this reads as glitter rather than dust.
  dustColor: 0xfff2dc,

  // Light shafts. Slightly warmer and more saturated than the light that casts
  // them — scattering through air is wavelength-dependent, and the beam being a
  // touch warmer than the pool it lands in is what makes it read as air.
  beamColor: 0xffe3b0,

  // Tint the floor reflection picks up from the sealed timber it bounces off.
  floorReflectTint: 0xfff0dc,

  // Confetti palette: vibrant and joyful
  confettiColors: [
    0xff69b4, // hot pink
    0xffd700, // gold
    0xff1493, // deep pink
    0xffa500, // orange
    0xff69b4, // hot pink
    0x87ceeb, // sky blue
    0xffffff, // white
  ],
};
