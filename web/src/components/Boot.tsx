import { useEffect, useState } from "react";
import { TOKEN } from "../config";

/** Brief hold so the canvas has a frame to become ready before it's revealed. */
export function Boot() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDone(true), 900);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="boot" data-done={done} aria-hidden="true">
      <div className="boot__inner">
        <span className="boot__mark">{TOKEN.name}</span>
        <span className="boot__bar">
          <span />
        </span>
      </div>
    </div>
  );
}
