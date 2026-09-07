import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useField } from "../hooks/useField";

/**
 * The ledger field as the site's permanent ground: 150k particles behind every route, not
 * just the homepage. Mounted once at the app shell so the WebGL context survives navigation —
 * no re-init flash between pages, the atmosphere just continues.
 *
 * Each route's document height differs, so on navigation the scroll-driven story progress is
 * re-derived by nudging the same scroll pipeline the field already listens to.
 */
export function FieldBackdrop() {
  const { canvasRef, ready } = useField();
  const location = useLocation();

  useEffect(() => {
    // New page, new scroll geometry — let the field re-read it after layout settles.
    const id = window.setTimeout(() => window.dispatchEvent(new Event("scroll")), 60);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  return (
    <>
      <canvas ref={canvasRef} className="field" data-ready={ready} aria-hidden="true" />
      <div className="veil" aria-hidden="true" />
    </>
  );
}
