import { useEffect, useRef, useState } from "react";
import type { LedgerField } from "../gl/LedgerField";

/**
 * Owns the WebGL ledger field behind the page.
 *
 * The field's story progress (0..4: lattice → stream → core → reserve → haze) is mapped onto
 * the full document scroll, so the particles travel through all five states as the reader moves
 * from the hero to the footer. Scroll velocity feeds turbulence; the pointer feeds a subtle
 * camera parallax and the decrypting lens.
 *
 * The module is imported dynamically so three.js stays out of the initial bundle — the site is
 * fully readable before (and without) the field.
 */
export function useField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const teardown: Array<() => void> = [];

    void (async () => {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let field: LedgerField | undefined;
      try {
        // The wordmark is rasterised from the display face at construction; if the font isn't
        // in yet the particles would spell fallback letterforms, so wait briefly for it.
        await Promise.race([
          document.fonts.load('700 232px "Archivo Variable"').catch(() => undefined),
          new Promise((r) => setTimeout(r, 2500)),
        ]);
        const mod = await import("../gl/LedgerField");
        if (disposed) return;
        field = new mod.LedgerField({ canvas, reducedMotion });
      } catch {
        // No WebGL (old hardware, some headless contexts): the page simply keeps its flat
        // ground. Everything is readable without the field.
        return;
      }
      if (!field) return;
      const live = field;

      live.start();
      teardown.push(() => live.destroy());
      setReady(true);

      const root = document.documentElement;

      const applyScroll = () => {
        const max = root.scrollHeight - window.innerHeight;
        const p = max > 0 ? window.scrollY / max : 0;
        live.setProgress(p * 4);
        // The field carries the opening frame, then recedes to atmosphere once the reader is
        // into the product sections — the panels take over as the foreground.
        const presence = 0.92 - Math.min(1, window.scrollY / window.innerHeight) * 0.38;
        root.style.setProperty("--field-presence", presence.toFixed(3));
      };

      // Velocity → turbulence. Sampled from scroll deltas, decays to rest after ~140ms of
      // stillness so the field settles when the reader does.
      let lastY = window.scrollY;
      let lastT = performance.now();
      let idle: ReturnType<typeof setTimeout> | undefined;

      const onScroll = () => {
        applyScroll();
        const now = performance.now();
        const dt = Math.max(16, now - lastT);
        const v = ((window.scrollY - lastY) / dt) * 16;
        lastY = window.scrollY;
        lastT = now;
        live.setScrollEnergy(Math.min(1, Math.abs(v) / 45));
        if (idle) clearTimeout(idle);
        idle = setTimeout(() => live.setScrollEnergy(0), 140);
      };

      const onPointer = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const nx = (e.clientX / window.innerWidth) * 2 - 1;
        const ny = -((e.clientY / window.innerHeight) * 2 - 1);
        live.setPointer(nx, ny);
        live.setLens(nx, ny, true);
      };
      const onPointerLeave = () => live.setLens(0, 0, false);

      const onResize = () => {
        live.resize();
        applyScroll();
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("resize", onResize);
      teardown.push(() => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("pointermove", onPointer);
        document.documentElement.removeEventListener("pointerleave", onPointerLeave);
        window.removeEventListener("resize", onResize);
        if (idle) clearTimeout(idle);
      });

      applyScroll();
    })();

    return () => {
      disposed = true;
      for (const fn of teardown) fn();
    };
  }, []);

  return { canvasRef, ready };
}
