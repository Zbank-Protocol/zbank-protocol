import { CHAIN, TOKEN } from "../config";
import { tokenExplorerUrl } from "../lib/chain";

/**
 * The wordmark narrows as the page shields, so the mark itself compresses on the way down.
 * Variable-font width is animated rather than scale, which keeps the strokes optically even.
 */
export function Topbar({ stage }: { stage: number }) {
  const enter = stage > 0 ? 1 : 0;
  const width = 118 - Math.min(stage, 6) * 4;
  const explorer = tokenExplorerUrl();

  return (
    <header className="topbar" style={{ "--enter": enter } as React.CSSProperties}>
      <div className="topbar__left">
        <span className="wordmark" style={{ "--wm-wdth": width } as React.CSSProperties}>
          {TOKEN.name}
        </span>
        <span className="topbar__rule" />
        <span className="t-label topbar__tag">Trading fees become Zcash</span>
      </div>

      <div className="topbar__right">
        <span className="topbar__status">
          <span className="dot" />
          {CHAIN.name}
        </span>
        {explorer ? (
          <a className="btn btn--ghost" href={explorer} target="_blank" rel="noreferrer">
            Contract
          </a>
        ) : (
          <span className="btn btn--quiet" aria-disabled="true">
            Pre-launch
          </span>
        )}
      </div>
    </header>
  );
}
