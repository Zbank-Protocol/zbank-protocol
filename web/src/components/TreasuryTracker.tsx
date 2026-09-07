import { MISSION } from "../data/site";
import { useInView } from "../hooks/useInView";

/**
 * The mission tracker: target, owned, progress and remainder over one clean horizontal bar.
 *
 * The bar fills on first view — the single place the page spends motion on a number, because
 * this is the number the whole protocol is oriented around.
 */
export function TreasuryTracker() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);

  return (
    <div className="tracker" ref={ref}>
      <div className="tracker__grid">
        <div className="metric">
          <span className="metric__label">ZEC owned</span>
          <span className="metric__value metric__value--sm">{MISSION.owned}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Target</span>
          <span className="metric__value metric__value--sm">{MISSION.target}</span>
        </div>
        <div className="metric">
          <span className="metric__label">Progress</span>
          <span className="metric__value metric__value--sm metric__value--gold">
            {MISSION.progressPct}%
          </span>
        </div>
        <div className="metric">
          <span className="metric__label">ZEC remaining</span>
          <span className="metric__value metric__value--sm">{MISSION.remaining}</span>
        </div>
      </div>

      <div
        className="tracker__bar"
        role="progressbar"
        aria-valuenow={MISSION.progressPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of the 1% mission completed"
      >
        <span
          className="tracker__fill"
          style={{ width: inView ? `${MISSION.progressPct}%` : "0%" }}
        />
        {/* Demo figure, stated as such right where the number is. */}
      </div>

      <div className="tracker__foot">
        <span className="t-note">{MISSION.footnote}</span>
        <span className="t-demo">Illustrative pre-launch figures</span>
      </div>
    </div>
  );
}
