import { useEffect, useRef, useState } from "react";

/**
 * Drives the descent from a single scroll listener.
 *
 * Exposure and shielding are published as CSS custom properties on `:root` so the whole
 * page shares one source of atmosphere — components style themselves against
 * `--exposure` instead of each subscribing to scroll. The numeric stage is returned for
 * the few places that need discrete logic rather than interpolation.
 */
export type Descent = {
  /** 1 at the top (fully transparent ledger) down to 0 (fully shielded). */
  exposure: number;
  /** Discrete station index, for switching telemetry blocks. */
  stage: number;
};

const STAGES = 7;

export function useDescent(canvasRef: React.RefObject<{ exposure: number; reserveFill: number } | null>) {
  const [descent, setDescent] = useState<Descent>({ exposure: 1, stage: 0 });
  const frame = useRef(0);

  useEffect(() => {
    const root = document.documentElement;

    const update = () => {
      frame.current = 0;

      const scrollable = document.body.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;

      // Exposure falls off early and holds near zero through the final sections, so the
      // shielded state is a place you arrive at rather than a single instant.
      const exposure = Math.max(0, 1 - progress * 1.45);
      const shielding = 1 - exposure;

      // The reserve only starts accreting once fees are actually being shielded.
      const reserveFill = Math.min(1, Math.max(0, (progress - 0.35) / 0.5));

      root.style.setProperty("--depth-t", progress.toFixed(4));
      root.style.setProperty("--exposure", exposure.toFixed(4));
      root.style.setProperty("--shielding", shielding.toFixed(4));
      root.style.setProperty("--reserve-fill", reserveFill.toFixed(4));

      if (canvasRef.current) {
        canvasRef.current.exposure = exposure;
        canvasRef.current.reserveFill = reserveFill;
      }

      const stage = Math.min(STAGES, Math.floor(progress * STAGES));
      setDescent((prev) =>
        // Only re-render when the discrete stage changes; the continuous values live in CSS.
        prev.stage === stage && Math.abs(prev.exposure - exposure) < 0.01
          ? prev
          : { exposure, stage },
      );
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [canvasRef]);

  return descent;
}
