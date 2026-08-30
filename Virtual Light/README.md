# Virtual Light

A draggable point light that lives *inside* your camera feed. A monocular depth
model estimates how far away every pixel is, and a WebGL2 shader relights the
frame from that height field — so the light falls off with real distance, casts
shadows, and passes in front of or behind you depending on where you put it.

Everything runs locally in the browser. No frames leave the machine.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL, then pick **Use camera** or **Open a file** (video or still
image). The first run downloads ~50 MB of model weights; the browser caches them
afterwards.

Camera capture needs a secure context — `localhost` or `https`.

## Controls

| Action | Input |
| --- | --- |
| Move the light | drag on the canvas |
| Push it nearer / farther | scroll (shift = fine) |
| Falloff radius | alt + scroll |
| Nudge depth / position | arrow keys |
| Intensity | `[` and `]` |
| Select light 1-4 | `1`-`4` |
| Add a light | `n` |
| Cycle output view | `v` |
| Mirror | `m` |
| Save a PNG | `s` |
| Show / hide the panel | `Tab` |

The **Output** control switches between Composite, Depth, Normals, Shadow and
Source. Depth and Normals show exactly what the model handed over, which is the
fastest way to tell a shading problem from a depth problem.

## How it works

```
camera / file ──► depth worker ──► R16F depth texture ─┐
      │          (transformers.js)                     │
      └────────────────────► SRGB8 source texture ─────┤
                                                       ▼
                              pass 1: temporal blend + cross-bilateral refine
                                                       ▼
                              pass 2: unproject → shade → shadow → tonemap
```

**Depth.** [Depth Anything V2 Small](https://huggingface.co/onnx-community/depth-anything-v2-small-ONNX)
runs in a Web Worker via transformers.js. The backend ladder is WebGPU + fp16
(only when the adapter reports `shader-f16`) → WebGPU + fp32 → WASM + q8, and
each rung that fails reports itself to the loader. `AutoModel` + `AutoProcessor`
are used directly rather than the `depth-estimation` pipeline, so the model's
native low-resolution output is never upsampled on the CPU. The processor's own
resize and pad are disabled and the main thread picks the input size instead —
DINOv2 has a patch size of 14, so every dimension is snapped to a multiple of 14.

Raw model output is relative and unbounded, so it is normalised against its 1st
and 99th percentiles (512-bin histogram) with the lo/hi window smoothed by an EMA
across frames. Without that smoothing, a hand entering the frame would shift the
whole scene's brightness.

Exactly one inference is in flight at a time; newer frames replace queued ones.
Results upload as `R16F` — half floats are core-filterable in WebGL2 where
`R32F` is not, so the GPU can interpolate depth for free.

**Refine (pass 1).** The model's output is much smaller than the frame, so a
cross-bilateral filter guided by source luma pulls depth edges back onto image
edges. Two details decide whether this helps or hurts. The tap spacing is
measured in *model* samples, not in refine pixels — a kernel narrower than one
model texel only ever differences the interior of a bilinear ramp, whose
derivative is constant, so each model texel becomes a flat facet with its own
normal and a flat wall comes out as a grid of them. And the guide term is a
gaussian in the luma difference rather than an exponential in its magnitude:
the exponential form weighted a 5% texture variation at 0.64 against a real
silhouette at 0.07, barely selective enough to tell them apart, so wall texture
printed itself into the depth field and from there into the shading. The same
pass cross-fades between the two most recent depth maps, timed against the
measured arrival interval, so lighting glides instead of stepping at the model's
frame rate.

**Relight (pass 2).** Each pixel unprojects to a view-space point through a
blendable orthographic↔perspective factor (`Perspective` in the panel), normals
come from a Sobel of depth, and each light contributes wrapped diffuse plus
Blinn-Phong specular with a windowed inverse-square falloff — the window pulls
the tail to exactly zero at three radii, so the light makes a pool with an edge
instead of lifting the whole frame. The bulb is drawn only where the shaded surface
is farther from the lens than the light, which is what makes it disappear behind
the subject; the halo around it uses the same test but softened across a slab as
wide as the depth map's own uncertainty, because a hard compare over a whole
frame's worth of glow traces every wobble in the model output as a scalloped
edge.

**Occlusion boundaries.** A height field cannot represent occlusion, and that
single fact produces the worst artefact in the whole pipeline. Where a silhouette
meets the wall behind it, depth steps by everything separating the two, and a
Sobel reads that step as a near-vertical face joining them — a face that is not
there. Shading it draws a dark outline around every silhouette, worst on hands and
hair, because an invented vertical face is edge-on to almost any light. The same
invented face is what let the shadow march find an occluder one texel from its own
receiver and print a hard line along the boundary.

Detecting it is harder than it sounds, because the obvious tests do not work. The
depth gradient is first converted to a dimensionless slope, where 1.0 is a surface
at 45 degrees to the sensor, so the number does not shift with resolution, depth or
aspect. A subject standing well clear of the wall then grades past 20 and is easy
to catch — but a subject standing *close* to the wall grades under 6, and a
vigorously curved real surface reaches 4. That leaves a narrow window and no room
for a threshold picked by eye. Widening the measurement baseline does not help: it
inflates real curvature by exactly the same factor, and measured directly, a dome's
wide reading came out *higher* than a shallow step's.

Two things make the window usable. The first is that the artefact is not confined
to the texels straddling the step — the refine pass smears every edge across about
three depth texels, so a pixel two texels clear of the boundary still has a
contaminated footprint while its own slope has fallen back to around 1.3, which is
indistinguishable from ordinary curvature. What separates them is *where* the
steepness sits rather than how much of it there is: a step has one steep narrow
window at its edge and flat ground either side, while a dome reads much the same
wherever the window is placed. So the same narrow window is re-measured a little to
each side and the steepest reading wins, for four extra taps. The second is that
the knee is then set from measurement rather than intuition — a dome swinging a
sixth of the depth range tops out at 4.1, a subject a fourteenth of the range off
the wall bottoms out at 5.8, and the knee sits in that gap.

Where the flag fires, the normal is turned to face straight back at the lens: at an
occlusion boundary the honest normal is the one that invents no shading of its own.
The shadow march withdraws its claim there too, which costs a couple of pixels of
contact shadow and removes the hard line that used to trace every edge. Real
curvature is untouched — the flag reads exactly zero across a curved subject, whose
own shading is what `Relief` controls.

**The relief normal's baseline.** The occlusion flag above answers the hard outline
around a whole silhouette. A subtler version of the same artefact survives it: a
torn dark fringe along thin, dark features — a glasses temple, a strand of hair,
a hairline — that never rises to a full boundary. Its cause is the refine pass
doing its job too well. The bilateral is edge-aware, so a feature with a strong
luma edge of its own makes it *preserve* the depth raggedness there rather than
smooth it, and a Sobel of that ragged depth reverses the normal every texel. That
noise never shifts the mean — which is why it hides from any check that measures
brightness, and why turning shadows off changes nothing — but it wobbles the
diffuse term, and on dark albedo, where the added light is already small against
the ambient floor, the wobble rivals the floor and reads as a torn black edge. A
curvature flag folded into the boundary test made it worse: it clears the knee at
some texels of a ragged feature and not their neighbours, so the flat-normal patch
it forces is itself ragged. What works is quieter: the normal that lights the
surface is built from the same ±3-texel taps the boundary test already samples,
not the ±1 Sobel. A real slope is coherent across that span, so relief on a curved
subject is untouched; per-texel noise is uncorrelated across it and averages down.
It costs nothing — the taps are already in hand — and the narrow gradient still
feeds the slope, the flag and the shadow tangent, so only the lighting normal
changes.

**Shadows.** A ray marches in screen space from the shaded surface toward the
light, asking at each step whether it has passed behind whatever the depth map
records there. Four things decide whether the answer is believable, and the
first is settled before the march's own tests get a vote: a convex body cannot
shadow itself, and neither can a flat wall. On both, the only unlit part is the
part turned away from the light, which the diffuse term already handles — but
the march does not know that. It leaves the surface, and because the surface
curves or recedes underneath it, the ray passes behind the very geometry it
started on, and every test afterwards fires. That is how a face prints its own
nose, brow and cheek onto itself as dark patches, worst exactly when the light
sits inside or just behind the subject's own depth span, where the rays fan out
across the surface instead of leaving it. What settles it is the receiver's own
tangent plane, extrapolated to wherever the ray is looking: a convex surface
always falls *behind* that plane and a flat one lies exactly on it, so neither
can rise in front of it, while a hand held in front of a face clears it by a
large margin. So the occlusion claim is gated on how far the occluder rises
above the plane rather than above a single depth, and self-shadowing stops
being representable instead of being thresholded away. The extrapolation is
clamped, because the gradient at a silhouette is near-vertical and would
otherwise throw the plane out of the scene.

The second is how much solid matter to assume sits behind a visible surface.
Depth here is disparity and the remap to view space is affine in it, so equal
steps in z are not equal steps in metres: a fixed real thickness behind a
surface at disparity `p` spans `t·p² / (1 + t·p)` of the range, quadratic in the
surface's own disparity. One global slab therefore means something different for
every object in the frame — a person half a metre from the lens and the wall
behind them were credited with the same depth of matter — so the slab is scaled
by disparity squared instead.

The third is separation, and it is the one the march cannot discover on its
own. A ray from a distant receiver to a nearby light sweeps through every depth
in between, so it is *always* momentarily just behind any silhouette standing
between the two on screen; the slab test fires whether the occluder is touching
the receiver or three metres clear of it. That is how a subject in an open
kitchen used to print a wall-shaped shadow onto shelving well behind them.
Separation exists only in the occluder's depth relative to the receiver's, never
in the ray's, so it is measured there and the occlusion claim fades out across
it. Beyond a short range the claim has nothing to stand on anyway: a depth map
is a shell, and it records where surfaces are while saying nothing about the
volume behind them. That range is a fraction of the depth range, which the
worker renormalises to the scene's own 1st-99th percentile spread every frame,
so one setting means "a large share of the depth actually visible here" in a
cupboard and across a room alike.

The fourth is the penumbra. A hit at fraction `f` along the path from surface to
light sits `f·d` in front of the receiver and `(1-f)·d` short of the light, so a
source of radius `R` throws a penumbra of `R·f / (1-f)`; that radius is sampled
as a lateral filter, centre tap plus a triangle rotated per pixel. A bottle
standing against a wall keeps a hard edge while a subject with metres of air
behind them spreads until the umbra is gone. The centre tap also loses its
privilege as the disc widens, from 0.4 of the weight down to 0.25, which is what
makes a long throw dissolve rather than merely blur — a lone hit in the middle
of an open penumbra is a quarter of the light, not all of it. The dither driving
both the step offset and that rotation is interleaved gradient noise rather than
a hash: a hash gives every pixel an independent value, which is what fringed
every silhouette with grain, whereas the lattice guarantees neighbours take
different offsets and the same sample count resolves a gradient.

The fourth is the bias, scaled by the tangent of the incidence angle. Under
the plane test it is a safety net rather than the primary mechanism — where the
depth gradient is itself unreliable the plane is too, and at grazing incidence
the ray runs nearly parallel to the surface it started on, so `gap` sits either
side of the threshold and crosses it wherever depth noise happens to land.
Without some inflation a flat wall lit from the side self-shadows into mottled
acne; with too much, real contact shadows vanish along with it.

The camera frame is the base and the light is *added* to it, never substituted
for it. The compositing knee is the unlit pixel itself, so a pixel the light does
not reach leaves the shader byte-for-byte as the sensor recorded it. Added light
then climbs through the remaining headroom with unit slope at that knee — dim
light behaves like a plain add, so midtones are untouched — and eases into a
clean white clip once it reaches twice the headroom, so a strong light actually
blows to white where it is bright, the way a real one does. An earlier build let
the added light approach white only asymptotically; it never quite arrived, so
the brightest pixels topped out around 220–235, nothing clipped, and the lit
subject sat in a flat, compressed band — punch-less, and itself a kind of plastic
sheen. A global tonemap (`1 - exp(-c)`) fails the other way: it compresses the
entire picture to make room for one bright corner of it, and that uniform loss of
contrast and saturation is the classic plastic film over a webcam image. Keeping
the operator per-pixel in headroom units clips the highlight that should clip
while leaving every darker pixel exactly where it was. Shadows are therefore
light withheld rather than darkness painted on — nothing can drive a pixel below
its captured value.

The source texture is `SRGB8_ALPHA8`, so the GPU linearises on sample, all
shading is linear, and the result is encoded back to sRGB once at the end. That
encode is the exact inverse of the decode, so the round trip is lossless.

**Dimming to clean black.** Dimming the room is a plain multiply on the base —
`albedo · ambient` — so already-dark content goes cleanly toward black: hair at
0.01 linear times a 0.16 room is 0.0016, about 5 of 255. That is deliberate. The
look this chases is a real light in a dark room — a large field of clean black
with the lit subject riding on top — and letting unlit darks fall to black is
what produces it. An earlier build lifted a floor under the dim, tapered by
`1 - albedo`, to "keep a dark subject's shadow detail visible." Measured against
the target that was a mistake: it parked every dark pixel around 26–41 of 255 — a
flat milky grey band across the whole frame, which is precisely the plastic-film
/ dark-patch look this project was trying to remove. So there is no floor; unlit
content is `albedo · ambient` and is meant to fall away off the light. One honest
limit follows: a brightly-lit room cannot be dimmed to a black background, because
a pale wall at albedo 0.55 still prints around 84 of 255 at ambient 0.16. That
floor is a property of the room the camera sees, not something the shader can
remove without darkening the subject along with it — the reference clip's black
background comes from a genuinely dark room, not from post-processing.

## Tuning notes

- **Room light** ships at 0.16, which dims the room hard so the virtual light
  carries the scene and unlit content falls to clean black — the cinematic,
  dark-room look, at the cost of the original exposure. Take it to 1.0 and the
  frame passes through byte-for-byte, with the light added on top. There is no
  floor under the dim (see "Dimming to clean black"): lowering this deepens the
  mood and lets dark hair and clothing go genuinely black off the light, rather
  than sitting in the grey band an earlier build held them in.
- **Relief** is the single biggest lever on artefacts. It exaggerates the depth
  gradient, and depth error is mostly *gradient* error: on a texture-poor wall
  the model returns a smoothly wrong surface, and amplifying that turns it into
  soft light-and-dark blobs. It ships at 0.30 for that reason. Past ~1.5 you are
  amplifying model noise rather than real geometry. It no longer applies at
  silhouettes, where the normal is held facing the lens regardless — so raising it
  adds relief to the subject without re-drawing the dark outline around them.
- **Smoothing** is measured in model samples, so 1.0 is one real depth pixel.
  Below ~0.8 the filter is narrower than the data it is filtering and the
  model's own facets start showing through as shading blobs. Raise it when the
  depth view looks lumpy.
- **Specular** ships at 0.04. Depth-derived normals are coarse, and a
  Blinn-Phong highlight spread across a whole photograph is the fastest way to
  make skin look like plastic, so it is kept low by default. A little, with
  `Tightness` high, is worth it on a close light.
- **Wrap** softens the terminator, which flatters noisy depth normals. Low
  values hard-clamp the diffuse term at zero, so any wobble in the normals
  becomes a hard-edged patch.
- **Reach** ships at 0.15 and is the control for shadows that stretch too far.
  It is how much of the scene's own depth a shadow survives behind whatever
  casts it, so low values keep shadows tight to their source and a subject
  standing clear of the back wall stops printing themselves onto it. High values
  restore the old behaviour of shadowing everything behind a silhouette.
- **Source size** is how big the light is, not how bright. It sets the penumbra
  at a given separation, so it decides how fast a shadow loses its edge as the
  surface catching it recedes. Past ~0.12 the four taps are spread too thin and
  the penumbra starts to speckle.
- **Bias** is the safety net when surfaces still shadow themselves; the primary
  guard is the receiver-plane test, which is not tuneable because it is a
  property of geometry, not a setting. **Occluder depth** is how deep an object
  is assumed to be behind its visible surface, scaled by how near it is so that
  one setting holds across a scene.
- **Model resolution** trades silhouette precision against depth updates per
  second. Fast (224) keeps motion fluid; Sharp (392) resolves fingers.
- **Temporal blend** at 0 will visibly step. It exists to hide the gap between
  render rate and model rate, not to blur — and it is motion-adaptive: where two
  model frames disagree by more than sensor jitter the subject has moved there, so
  the blend fades toward the newest frame at those pixels. That keeps the denoise
  on still regions while stopping a moving silhouette from smearing the ghost edge
  that a flat average of two positions would invent.
- **Vignette** and **Grain** ship at 0 because both alter pixels the light never
  touched. They are there for stills, not for a clean feed.

## Layout

```
src/
  main.js           app entry, render loop, chrome
  state.js          the single mutable store
  source.js         camera / file frames, new-frame detection
  depth-worker.js   model load, inference, normalisation
  depth-engine.js   worker lifecycle, one-in-flight scheduling
  gl/renderer.js    WebGL2 passes, texture and uniform plumbing
  gl/shaders.js     GLSL
  ui/controls.js    the panel
  ui/pointer.js     drag, scroll and keyboard light control
```

## Requirements

WebGL2 is required. WebGPU is strongly recommended — the WASM fallback works but
runs at a few frames per second. Chrome or Edge 121+ has the fastest path today.

`npm audit` reports issues in `adm-zip` and `sharp`. Both are Node-only optional
dependencies of transformers.js, pulled in for server-side use; neither is part
of the browser bundle this app ships.
