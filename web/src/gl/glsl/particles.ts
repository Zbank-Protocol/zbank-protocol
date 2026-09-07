import { NOISE_CHUNK } from "./noise";

/**
 * The ledger field.
 *
 * Every particle carries five positions — its cell in the ledger lattice, its place in the
 * diverted stream, in the compressed core, in the settled reserve, and in the dispersed haze —
 * and the vertex shader blends between them from a single `uProgress` uniform driven by scroll.
 * A third of the particles additionally carry a position inside the ZBANK wordmark, which they
 * spell on the opening frame and let go of as the page begins to move.
 *
 * Keeping the morph entirely on the GPU is what makes 150k points affordable; nothing is
 * uploaded per frame except a handful of floats.
 */
export const PARTICLE_VERT = /* glsl */ `
attribute vec3 aStream;
attribute vec3 aCore;
attribute vec3 aReserve;
attribute vec3 aHaze;
attribute float aSeed;
attribute float aRow;
/** 1 at the core disc's bulge, 0 at its rim. Lets the heat vary across the mass. */
attribute float aCoreHeat;
/** Position inside the wordmark's letterforms, held only by the particles that spell it. */
attribute vec3 aBrand;
/** 1 for a particle that is part of the wordmark, 0 otherwise. */
attribute float aBrandMix;

uniform float uTime;
uniform float uProgress;
uniform float uSize;
uniform float uPixelRatio;
uniform float uTurbulence;
uniform float uAspect;
/** Lens centre in NDC (xy) and its radius (z). */
uniform vec3 uLens;
uniform float uLensActive;
/** Centre of the reserve mass, so it can be turned about itself rather than about the origin. */
uniform vec3 uReserveCentre;
/** Exposure compensation for the wordmark: 1 at full width, lower where the word packs small. */
uniform float uBrandDim;

varying float vShield;
varying float vFlare;
varying float vAlpha;
varying float vLens;
varying float vBrand;

${NOISE_CHUNK}

/**
 * Eased weight for one transition, offset per particle.
 *
 * Each transition is given 0.6 of progress and up to 0.4 of stagger, so a particle always
 * reaches its target before the next transition opens. Overlapping them would compound the
 * mixes and drag points toward the average of two states, which reads as mush.
 */
float stageWeight(float progress, float from, float stagger) {
  float s = stagger * 0.4;
  return smoothstep(from + s, from + 0.6 + s, progress);
}

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  float stagger = clamp(aRow * 0.7 + aSeed * 0.3, 0.0, 1.0);

  float w1 = stageWeight(uProgress, 0.0, stagger);
  float w2 = stageWeight(uProgress, 1.0, stagger);
  float w3 = stageWeight(uProgress, 2.0, stagger);
  float w4 = stageWeight(uProgress, 3.0, stagger);

  /*
   * The reserve turns slowly, about its own centre — rotating the absolute position would spin
   * it about the world origin, which for an off-centre mass is an orbit, not a turn.
   */
  vec3 reserve = rotateY(aReserve - uReserveCentre, uTime * 0.08) + uReserveCentre;

  vec3 pos = mix(position, aStream, w1);
  pos = mix(pos, aCore, w2);
  pos = mix(pos, reserve, w3);
  pos = mix(pos, aHaze, w4);

  // Turbulence is near zero on the lattice (records are exact), strongest while the fee is in
  // flight, and returns in the haze where nothing is meant to be legible.
  float amp = uTurbulence * (0.02 + 1.1 * w1 * (1.0 - w2) + 0.35 * w3 + 1.4 * w4);
  vec3 flow = curlNoise(pos * 0.17 + vec3(0.0, uTime * 0.05, uTime * 0.03));
  pos += flow * amp;

  /*
   * The wordmark. A third of the particles open the page spelling the brand above the ledger
   * floor, then rain down into their own lattice cells as the scroll begins.
   *
   * The erosion is staggered per particle rather than swept: each point lets go at its own
   * moment, so the word crumbles from within instead of sliding away as a rigid sign. Applied
   * after the turbulence so the letterforms hold exact — only a faint shimmer of the flow field
   * is let through.
   */
  float brandW = aBrandMix * (1.0 - smoothstep(0.03 + aSeed * 0.32, 0.42 + aSeed * 0.38, uProgress));
  pos = mix(pos, aBrand + flow * 0.05, brandW);

  float shield = clamp(w1 * 0.4 + w2 * 0.6, 0.0, 1.0);
  /*
   * The conversion flare: present through the core stage, gone once the reserve settles.
   * Weighted by where the point sits in the disc — the bulge blazes toward white while the
   * arms stay gold, which is what gives the mass an inside.
   */
  float coreStage = w2 * (1.0 - w3);
  float flare = coreStage * (0.22 + 0.78 * aCoreHeat);

  // The lens mask has to be sampled where the particle currently *appears*, so project the
  // current position first, then recompute with the lens applied.
  vec4 probe = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  vec2 ndc = probe.xy / max(probe.w, 0.0001);
  float dist = length((ndc - uLens.xy) * vec2(uAspect, 1.0));
  float lens = (1.0 - smoothstep(uLens.z * 0.5, uLens.z, dist)) * uLensActive;
  // The wordmark is immune to the lens: at any strength the pointer visibly shredded the
  // lettering, and the brand holding its shape while the field reacts around it is the
  // stronger read anyway.
  lens *= 1.0 - brandW;

  // Inside the lens the field decrypts: points fall back toward their exact ledger cell and
  // lose their gold, so the reader can see the structure underneath.
  pos = mix(pos, position, lens * 0.8);
  shield *= 1.0 - lens * 0.85;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Per-point brightness. The haze spreads over far more volume, so each of its points has to
  // dim or the dispersed state blows out; the core does the opposite and blazes.
  float dispersal = 1.0 - 0.42 * w4;
  /*
   * The reserve and the core pack the same points into a fraction of the volume, so both come
   * down or additive blending drives them to white and the gold is lost.
   */
  float density = 1.0 - 0.42 * w3 * (1.0 - w4) - 0.44 * coreStage;
  float hot = 1.0 + 1.1 * flare;
  vAlpha = clamp(0.62 * dispersal * density * hot + 0.3 * lens, 0.0, 1.0);
  // The word packs its points into letter-sized areas; additive blending has to be held down
  // there or the lettering blows out to a white slab and stops reading as particles. uBrandDim
  // compensates further where the word is drawn small (phones).
  vAlpha = mix(vAlpha, 0.85 * uBrandDim, brandW);

  vShield = shield;
  vFlare = max(flare, brandW * uBrandDim * (0.3 + 0.62 * aSeed * aSeed));
  vLens = lens;
  vBrand = brandW;

  float size = uSize * (0.55 + 0.95 * aSeed) * (1.0 + 1.0 * flare);
  // Slightly finer grain inside the letterforms keeps their edges crisp.
  size *= 1.0 - brandW * 0.12;
  gl_PointSize = size * uPixelRatio * (12.0 / max(-mvPosition.z, 0.6));
}
`;

export const PARTICLE_FRAG = /* glsl */ `
precision highp float;

uniform vec3 uCold;
uniform vec3 uGold;
uniform vec3 uHot;

varying float vShield;
varying float vFlare;
varying float vAlpha;
varying float vLens;
varying float vBrand;

void main() {
  // Soft round sprite. A hard disc aliases badly at these sizes and kills the bloom.
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.0, d);
  alpha = pow(alpha, 1.7);
  if (alpha < 0.004) discard;

  vec3 col = mix(uCold, uGold, vShield);
  // The wordmark is gold — the one thing on the opening frame allowed the brand colour.
  col = mix(col, uGold, vBrand * 0.9);
  col = mix(col, uHot, vFlare * 0.85);
  // The lens edge glows, so it reads as an instrument rather than a hole.
  col += uHot * vLens * 0.2;

  gl_FragColor = vec4(col, alpha * vAlpha);
}
`;
