import { useEffect, useRef, useState } from "react";

/**
 * The boot screen: the ledger field's opening move, in miniature.
 *
 * Two thousand gold particles fly in from beyond the edges and assemble the ZBANK wordmark,
 * hold one shimmering beat, then the whole veil lifts. Canvas 2D rather than WebGL — the point
 * of a loading screen is to cost nothing while the heavy things load behind it.
 *
 * Plays once per tab session (sessionStorage), skips entirely under reduced motion, and never
 * holds the app hostage: the overlay is gone in ~2.2s regardless of what's still loading.
 */

const KEY = "zbank.booted";
const GOLD = [244, 183, 40] as const;

type P = {
  x0: number;
  y0: number;
  tx: number;
  ty: number;
  delay: number;
  r: number;
  tw: number; // twinkle phase
};

function sampleWordmark(w: number, h: number): { x: number; y: number }[] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return [];
  const size = Math.min(w * 0.16, h * 0.3);
  ctx.font = `900 ${size}px 'Archivo Variable', Archivo, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.fillText("ZBANK", w / 2, h / 2);

  const data = ctx.getImageData(0, 0, w, h).data;
  const pts: { x: number; y: number }[] = [];
  const step = 4;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 128) pts.push({ x, y });
    }
  }
  // Cap the count so the mark is dense but the frame stays cheap; shuffle so thinning is even.
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts.slice(0, 3200);
}

export function Boot() {
  const [phase, setPhase] = useState<"run" | "fade" | "gone">(() => {
    try {
      if (sessionStorage.getItem(KEY)) return "gone";
    } catch {
      /* private mode — just play it */
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "gone";
    return "run";
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (phase !== "run") return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* fine */
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      setPhase("gone");
      return;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let cancelled = false;

    // Assemble after the display face is available so the sampled mark is the real one.
    const ready = document.fonts?.load("900 100px 'Archivo Variable'") ?? Promise.resolve();

    void Promise.race([ready, new Promise((r) => setTimeout(r, 600))]).then(() => {
      if (cancelled) return;

      const targets = sampleWordmark(w, h);
      const particles: P[] = targets.map(({ x, y }) => {
        // Fly in from a ring outside the viewport, staggered left-to-right across the mark.
        const a = Math.random() * Math.PI * 2;
        const rad = Math.max(w, h) * (0.55 + Math.random() * 0.25);
        return {
          x0: w / 2 + Math.cos(a) * rad,
          y0: h / 2 + Math.sin(a) * rad,
          tx: x,
          ty: y,
          delay: ((x / w) * 0.3 + Math.random() * 0.15) * 0.7,
          r: 1.1 + Math.random() * 1.4,
          tw: Math.random() * Math.PI * 2,
        };
      });

      const T_FLY = 1.15; // seconds of flight
      const T_HOLD = 1.35; // shimmer at rest, mark fully resolved
      const start = performance.now();

      const frame = (now: number) => {
        const t = (now - start) / 1000;
        ctx.clearRect(0, 0, w, h);

        for (const p of particles) {
          const local = Math.min(1, Math.max(0, (t - p.delay) / T_FLY));
          const e = 1 - Math.pow(1 - local, 5); // outQuint — snaps to the letterform early
          const x = p.x0 + (p.tx - p.x0) * e;
          const y = p.y0 + (p.ty - p.y0) * e;
          // Dim in flight, bright at rest, twinkling once settled.
          const settled = local >= 1;
          const alpha = settled
            ? 0.75 + 0.25 * Math.sin(t * 6 + p.tw)
            : 0.35 + 0.55 * e;
          ctx.fillStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},${Math.min(1, alpha)})`;
          ctx.fillRect(x, y, p.r, p.r);
        }

        // The progress hairline under the mark.
        const total = Math.min(1, t / (T_FLY + 0.5));
        const bw = Math.min(w * 0.2, 280);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(w / 2 - bw / 2, h * 0.62, bw, 1);
        ctx.fillStyle = `rgba(${GOLD[0]},${GOLD[1]},${GOLD[2]},0.9)`;
        ctx.fillRect(w / 2 - bw / 2, h * 0.62, bw * total, 1);

        if (t < T_FLY + 0.5 + T_HOLD) {
          raf = requestAnimationFrame(frame);
        } else {
          setPhase("fade");
        }
      };
      raf = requestAnimationFrame(frame);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  // After the CSS fade completes, leave the DOM entirely.
  useEffect(() => {
    if (phase !== "fade") return;
    const id = window.setTimeout(() => setPhase("gone"), 650);
    return () => window.clearTimeout(id);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div className="boot" data-phase={phase} aria-hidden="true">
      <canvas ref={canvasRef} className="boot__canvas" />
    </div>
  );
}
