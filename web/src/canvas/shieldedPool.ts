/**
 * The descent from the transparent ledger into the shielded pool.
 *
 * At exposure 1 the field is a cold, grid-aligned ledger: every trade is a discrete,
 * legible mark. As exposure falls the marks leave their rows, warm toward gold, smear
 * into a turbulent field, and settle into the reserve rising from the bottom. The
 * visual argument is the product's argument — the ledger stays public, the value does not.
 */

type Trade = {
  /** Home position in the ledger grid, normalised 0..1. */
  gx: number;
  gy: number;
  /** Current drawn position in pixels. */
  x: number;
  y: number;
  /** Per-mark drift so the field doesn't move as one sheet. */
  phase: number;
  speed: number;
  /** Mark length, standing in for trade size. */
  size: number;
  /** 0..1, how far this particular mark lags the overall shielding. */
  lag: number;
};

const COLD = { r: 176, g: 206, b: 224 };
const GOLD = { r: 244, g: 183, b: 40 };

export class ShieldedPoolCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trades: Trade[] = [];
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private t = 0;
  private reducedMotion: boolean;

  /** Written by the scroll controller each frame. */
  public exposure = 1;
  public reserveFill = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.resize();
    this.seed();
  }

  /** Grid dimensions scale with viewport so the ledger stays legible on any screen. */
  private gridShape() {
    const cols = this.w < 640 ? 9 : this.w < 1100 ? 15 : 22;
    const rows = this.h < 700 ? 14 : 20;
    return { cols, rows };
  }

  private seed() {
    const { cols, rows } = this.gridShape();
    this.trades = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Jitter within the cell keeps the grid from looking mechanically perfect.
        const jx = (Math.random() - 0.5) * 0.4;
        const jy = (Math.random() - 0.5) * 0.3;
        this.trades.push({
          gx: (col + 0.5 + jx) / cols,
          gy: (row + 0.5 + jy) / rows,
          x: 0,
          y: 0,
          phase: Math.random() * Math.PI * 2,
          speed: 0.35 + Math.random() * 0.9,
          size: 0.35 + Math.random() ** 2 * 1.5,
          lag: Math.random(),
        });
      }
    }
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Grid density is viewport-dependent, so reseed rather than stretch.
    if (this.trades.length) this.seed();
  }

  start() {
    const loop = () => {
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  /** Smooth 0..1 ramp, used to stagger transitions per mark. */
  private static ease(x: number) {
    const c = Math.min(1, Math.max(0, x));
    return c * c * (3 - 2 * c);
  }

  private render() {
    const { ctx, w, h } = this;
    if (!this.reducedMotion) this.t += 0.0055;

    const exposure = Math.min(1, Math.max(0, this.exposure));
    const shielding = 1 - exposure;

    // Ground darkens and warms slightly as the pool closes over the page.
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, `rgba(14, 16, 22, ${0.5 + 0.3 * exposure})`);
    bg.addColorStop(1, `rgba(10, 7, 13, ${0.6 + 0.35 * shielding})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.drawLedgerRules(exposure);
    this.drawTrades(exposure, shielding);
    this.drawReserve();
  }

  /** Faint horizontal rules: the ledger's rows. They fade as records stop being legible. */
  private drawLedgerRules(exposure: number) {
    const { ctx, w, h } = this;
    const { rows } = this.gridShape();
    const alpha = 0.055 * exposure;
    if (alpha <= 0.002) return;

    ctx.strokeStyle = `rgba(${COLD.r}, ${COLD.g}, ${COLD.b}, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let row = 1; row < rows; row++) {
      const y = Math.round((row / rows) * h) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  private drawTrades(exposure: number, shielding: number) {
    const { ctx, w, h } = this;

    for (const trade of this.trades) {
      // Each mark shields at its own moment, so the field dissolves raggedly.
      const local = ShieldedPoolCanvas.ease((shielding - trade.lag * 0.45) / 0.55);

      // Drift grows as the mark leaves its row.
      const wobble = this.reducedMotion ? 0 : Math.sin(this.t * trade.speed + trade.phase);
      const driftX = wobble * 26 * local;
      const driftY = Math.cos(this.t * trade.speed * 0.7 + trade.phase) * 14 * local;

      // Shielded marks sink toward the reserve.
      const sink = local * 0.16 * h;

      trade.x = trade.gx * w + driftX;
      trade.y = trade.gy * h + driftY + sink;

      const r = Math.round(COLD.r + (GOLD.r - COLD.r) * local);
      const g = Math.round(COLD.g + (GOLD.g - COLD.g) * local);
      const b = Math.round(COLD.b + (GOLD.b - COLD.b) * local);

      // Exposed marks are crisp dashes; shielded marks bloom into soft points.
      const alpha = 0.1 + 0.5 * exposure + 0.28 * local;

      if (local < 0.5) {
        // Legible record: a short horizontal tick, like a line item.
        const len = 3 + trade.size * 7 * (1 - local);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(trade.x - len / 2, trade.y);
        ctx.lineTo(trade.x + len / 2, trade.y);
        ctx.stroke();
      } else {
        // Shielded: indistinguishable from its neighbours.
        const radius = 0.7 + trade.size * 1.5 * local;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(trade.x, trade.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** The reserve: a warm body of gold rising from the base as fees convert. */
  private drawReserve() {
    const { ctx, w, h } = this;
    const fill = Math.min(1, Math.max(0, this.reserveFill));
    if (fill <= 0.001) return;

    // Kept shallow so the reserve reads as rising underneath the copy rather than
    // flooding across it; body text has to stay legible at full fill.
    const surface = h * (1 - fill * 0.28);

    const body = ctx.createLinearGradient(0, surface, 0, h);
    body.addColorStop(0, `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${0.05 + 0.07 * fill})`);
    body.addColorStop(1, `rgba(160, 96, 20, ${0.05 + 0.12 * fill})`);
    ctx.fillStyle = body;
    ctx.fillRect(0, surface, w, h - surface);

    // A single travelling wave marks the surface without reading as decoration.
    ctx.strokeStyle = `rgba(${GOLD.r}, ${GOLD.g}, ${GOLD.b}, ${0.18 + 0.4 * fill})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const amp = this.reducedMotion ? 0 : 3 + 4 * fill;
    for (let x = 0; x <= w; x += 6) {
      const y = surface + Math.sin(x * 0.012 + this.t * 1.6) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
