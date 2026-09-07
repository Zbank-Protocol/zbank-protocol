import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { BloomEffect, EffectComposer, EffectPass, RenderPass, VignetteEffect } from "postprocessing";
import { PARTICLE_FRAG, PARTICLE_VERT } from "./glsl/particles";
import { MASS_X } from "./focus";

/**
 * One story, five states.
 *
 * The particles are the ledger. They open as a vast exact lattice of records spelling the
 * ZBANK wordmark above the floor; a stream of them peels off (the fee leaving each trade),
 * compresses through a hot core (the conversion), settles into a slow-turning reserve (the
 * treasury), and finally disperses into an illegible haze (what an observer sees of what
 * cannot be read).
 *
 * All five positions live on the GPU as vertex attributes; scroll only moves one float.
 */

const COUNT = 150_000;
/** Fraction of particles that belong to the diverted stream. */
const STREAM_SHARE = 0.36;
/** Fraction of particles that spell the wordmark on the opening frame. */
const BRAND_SHARE = 0.34;

const LATTICE = { cols: 500, rows: 300, width: 15, height: 8.4 } as const;

const [, STREAM_X, CORE_X, , HAZE_X] = MASS_X;
const RESERVE_CENTRE = new Vector3(MASS_X[3], -0.1, 0.2);

/** Camera keyframes per act. A slow descent with the mass, never a cut. */
const RIG = [
  { pos: new Vector3(0, 0.4, 9.4), look: new Vector3(0, 0.25, 0) },
  { pos: new Vector3(1.1, 0.1, 8.6), look: new Vector3(1.4, -0.1, 0) },
  { pos: new Vector3(-1.0, -0.2, 8.2), look: new Vector3(-1.6, -0.25, 0) },
  { pos: new Vector3(0.9, -0.35, 8.8), look: new Vector3(1.2, -0.2, 0) },
  { pos: new Vector3(0, -0.15, 9.8), look: new Vector3(0, -0.1, 0) },
] as const;

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Rasterise the wordmark and return sample points inside its letterforms, in world units.
 *
 * Sampling a 2D canvas beats font-to-geometry triangulation here: no extra dependency, no
 * glyph parsing, and the output is exactly what particles want — a point cloud weighted by
 * ink coverage.
 */
function sampleBrandPixels(count: number, aspect: number): Float32Array {
  const out = new Float32Array(count * 3);

  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 320;
  const ctx = c.getContext("2d", { willReadFrequently: true });

  // Headless or blocked canvas: park the brand points at the lattice origin; aBrandMix still
  // fades them in and out but they simply thicken the field instead of spelling.
  if (!ctx) return out;

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 232px "Archivo Variable", Archivo, system-ui, sans-serif';
  ctx.fillText("ZBANK", c.width / 2, c.height / 2 + 12);

  const data = ctx.getImageData(0, 0, c.width, c.height).data;

  // The word's world width: most of the frame on desktop, clamped so phones still fit it.
  const worldW = Math.min(7.8, 7.4 * Math.min(1.6, aspect) * 0.72);
  const worldH = worldW * (c.height / c.width);
  const cx = 0;
  // High in the frame: the hero is a full-viewport cover with its content at the bottom, and
  // the word owns the open dark above it.
  const cy = 2.2;

  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 400) {
    guard++;
    const px = Math.floor(Math.random() * c.width);
    const py = Math.floor(Math.random() * c.height);
    if (data[(py * c.width + px) * 4 + 3] < 128) continue;

    const i3 = placed * 3;
    out[i3] = cx + (px / c.width - 0.5) * worldW;
    out[i3 + 1] = cy - (py / c.height - 0.5) * worldH;
    out[i3 + 2] = 1.6 + (Math.random() - 0.5) * 0.22;
    placed++;
  }

  return out;
}

function buildGeometry(aspect: number): BufferGeometry {
  const geo = new BufferGeometry();

  const lattice = new Float32Array(COUNT * 3);
  const stream = new Float32Array(COUNT * 3);
  const core = new Float32Array(COUNT * 3);
  const reserve = new Float32Array(COUNT * 3);
  const haze = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const row = new Float32Array(COUNT);
  const coreHeat = new Float32Array(COUNT);
  const brandMix = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;

    // ── Lattice: the ledger. Exact rows and columns with a whisper of depth.
    const col = i % LATTICE.cols;
    const r = Math.floor(i / LATTICE.cols) % LATTICE.rows;
    lattice[i3] = (col / (LATTICE.cols - 1) - 0.5) * LATTICE.width;
    lattice[i3 + 1] = (r / (LATTICE.rows - 1) - 0.5) * LATTICE.height;
    lattice[i3 + 2] = (Math.random() - 0.5) * 0.35;

    row[i] = r / (LATTICE.rows - 1);
    seed[i] = Math.random();

    const inStream = Math.random() < STREAM_SHARE;

    // ── Stream: a ribbon that peels toward the right and dives.
    if (inStream) {
      const t = Math.random();
      const swirl = t * Math.PI * 2.4;
      const rad = 0.5 + t * 1.9;
      stream[i3] = STREAM_X * 0.55 + Math.cos(swirl) * rad * 0.55 + t * (STREAM_X * 0.45);
      stream[i3 + 1] = 1.6 - t * 4.4 + Math.sin(swirl) * 0.4;
      stream[i3 + 2] = Math.sin(swirl) * rad * 0.5;
    } else {
      // The rest of the ledger stays put, thinned and dimmed by the shader.
      stream[i3] = lattice[i3];
      stream[i3 + 1] = lattice[i3 + 1];
      stream[i3 + 2] = lattice[i3 + 2];
    }

    // ── Core: everything that streamed now packs into a hot disc, hard left.
    const coreAngle = Math.random() * Math.PI * 2;
    const coreR = Math.pow(Math.random(), 1.6) * 1.5;
    const bulge = Math.max(0, 1 - coreR / 1.5);
    core[i3] = CORE_X + Math.cos(coreAngle) * coreR;
    core[i3 + 1] = -0.2 + Math.sin(coreAngle) * coreR * 0.62;
    core[i3 + 2] = (Math.random() - 0.5) * (0.3 + bulge * 0.9);
    coreHeat[i] = bulge;

    // ── Reserve: a dense settled sphere, right of centre. The treasury.
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = Math.acos(2 * v - 1);
    const rr = 1.35 * Math.cbrt(Math.random());
    reserve[i3] = RESERVE_CENTRE.x + rr * Math.sin(phi) * Math.cos(theta);
    reserve[i3 + 1] = RESERVE_CENTRE.y + rr * Math.cos(phi) * 0.82;
    reserve[i3 + 2] = RESERVE_CENTRE.z + rr * Math.sin(phi) * Math.sin(theta);

    // ── Haze: the unreadable outside view. Vast, thin, centred.
    haze[i3] = HAZE_X + (Math.random() - 0.5) * 16;
    haze[i3 + 1] = (Math.random() - 0.5) * 9;
    haze[i3 + 2] = (Math.random() - 0.5) * 6;
  }

  // ── Wordmark: a third of the particles get a second home inside the letterforms.
  const brandCount = Math.floor(COUNT * BRAND_SHARE);
  const brandPts = sampleBrandPixels(brandCount, aspect);
  const brand = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    if (i < brandCount) {
      brand[i3] = brandPts[i3];
      brand[i3 + 1] = brandPts[i3 + 1];
      brand[i3 + 2] = brandPts[i3 + 2];
      brandMix[i] = 1;
    } else {
      brand[i3] = lattice[i3];
      brand[i3 + 1] = lattice[i3 + 1];
      brand[i3 + 2] = lattice[i3 + 2];
    }
  }

  geo.setAttribute("position", new BufferAttribute(lattice, 3));
  geo.setAttribute("aStream", new BufferAttribute(stream, 3));
  geo.setAttribute("aCore", new BufferAttribute(core, 3));
  geo.setAttribute("aReserve", new BufferAttribute(reserve, 3));
  geo.setAttribute("aHaze", new BufferAttribute(haze, 3));
  geo.setAttribute("aSeed", new BufferAttribute(seed, 1));
  geo.setAttribute("aRow", new BufferAttribute(row, 1));
  geo.setAttribute("aCoreHeat", new BufferAttribute(coreHeat, 1));
  geo.setAttribute("aBrand", new BufferAttribute(brand, 3));
  geo.setAttribute("aBrandMix", new BufferAttribute(brandMix, 1));
  return geo;
}

export class LedgerField {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private material: ShaderMaterial;
  private geometry: BufferGeometry;
  private composer: EffectComposer;

  private raf = 0;
  private clockStart = performance.now();

  /** Scroll progress across the whole story, 0..4. Sprung, never snapped. */
  private progress = 0;
  private progressTarget = 0;

  /** Scroll velocity mapped to turbulence, decays when the reader rests. */
  private energy = 0;
  private energyTarget = 0;

  private lens = { x: 0, y: 0, active: 0, activeTarget: 0 };
  private pointer = { x: 0, y: 0 };

  private reducedMotion: boolean;

  constructor(opts: { canvas: HTMLCanvasElement; reducedMotion: boolean }) {
    this.reducedMotion = opts.reducedMotion;

    this.renderer = new WebGLRenderer({
      canvas: opts.canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);

    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.camera = new PerspectiveCamera(46, aspect, 0.1, 60);
    this.camera.position.copy(RIG[0].pos);
    this.camera.lookAt(RIG[0].look);

    this.geometry = buildGeometry(aspect);

    this.material = new ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uSize: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uTurbulence: { value: 0 },
        uAspect: { value: aspect },
        uLens: { value: new Vector3(0, 0, 0.34) },
        uLensActive: { value: 0 },
        uReserveCentre: { value: RESERVE_CENTRE.clone() },
        uBrandDim: { value: Math.min(1, Math.max(0.55, aspect * 0.62)) },
        uCold: { value: new Color("#20242e") },
        uGold: { value: new Color("#f4b728") },
        uHot: { value: new Color("#ffe9b0") },
      },
    });

    this.scene.add(new Points(this.geometry, this.material));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new EffectPass(
        this.camera,
        new BloomEffect({ intensity: 0.9, luminanceThreshold: 0.18, mipmapBlur: true }),
        new VignetteEffect({ darkness: 0.52, offset: 0.28 }),
      ),
    );

    this.resize();
  }

  setProgress(p: number) {
    this.progressTarget = Math.min(4, Math.max(0, p));
  }

  setScrollEnergy(e: number) {
    this.energyTarget = Math.min(1, Math.max(0, e));
  }

  setPointer(x: number, y: number) {
    this.pointer.x = x;
    this.pointer.y = y;
  }

  setLens(x: number, y: number, active: boolean) {
    this.lens.x = x;
    this.lens.y = y;
    this.lens.activeTarget = active ? 1 : 0;
  }

  resize() {
    // clientWidth, not innerWidth: if some element ever overflows on mobile, the layout
    // viewport inflates and innerWidth reports the inflated value — sizing the canvas to it
    // would then lock the inflation in permanently. clientWidth stays honest.
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // The third argument stops three.js from writing inline width/height styles that would
    // override the stylesheet's `width: 100%` and widen the page on phones.
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const u = this.material.uniforms;
    u.uAspect.value = aspect;
    u.uBrandDim.value = Math.min(1, Math.max(0.55, aspect * 0.62));
  }

  start() {
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.update();
    };
    tick();
  }

  private update() {
    const u = this.material.uniforms;
    const t = (performance.now() - this.clockStart) / 1000;
    u.uTime.value = this.reducedMotion ? 0 : t;

    // Springs. The field must trail the scroll slightly — instant response reads as UI, a
    // slight lag reads as mass.
    this.progress += (this.progressTarget - this.progress) * 0.065;
    this.energy += (this.energyTarget - this.energy) * 0.08;
    this.lens.active += (this.lens.activeTarget - this.lens.active) * 0.1;

    u.uProgress.value = this.progress;
    u.uTurbulence.value = this.reducedMotion ? 0 : 0.16 + this.energy * 1.35;
    u.uLensActive.value = this.lens.active;
    (u.uLens.value as Vector3).set(this.lens.x, this.lens.y, 0.34);

    // Camera: interpolate along the rig with the same progress, plus a whisper of pointer
    // parallax so the frame never feels printed.
    const seg = Math.min(RIG.length - 2, Math.floor(this.progress));
    const f = smoothstep(0, 1, this.progress - seg);
    const a = RIG[seg];
    const b = RIG[Math.min(RIG.length - 1, seg + 1)];

    const px = this.reducedMotion ? 0 : this.pointer.x * 0.22;
    const py = this.reducedMotion ? 0 : this.pointer.y * 0.14;

    this.camera.position.set(
      a.pos.x + (b.pos.x - a.pos.x) * f + px,
      a.pos.y + (b.pos.y - a.pos.y) * f - py,
      a.pos.z + (b.pos.z - a.pos.z) * f,
    );
    this.camera.lookAt(
      a.look.x + (b.look.x - a.look.x) * f,
      a.look.y + (b.look.y - a.look.y) * f,
      a.look.z + (b.look.z - a.look.z) * f,
    );

    this.composer.render();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.geometry.dispose();
    this.material.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
