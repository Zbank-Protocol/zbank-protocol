import { FLYWHEEL } from "../data/site";

/**
 * The revenue flywheel, as structure rather than illustration: products feed one revenue node,
 * which splits into the treasury path and the proposed token path. Pure HTML/CSS — the flow
 * reads top-to-bottom on every screen size and costs nothing to render.
 */
export function FlywheelDiagram() {
  return (
    <div className="flywheel" role="img" aria-label="Product revenue flows to the ZBANK treasury and, as proposed, to ZBNK buybacks">
      <div className="flywheel__products">
        {FLYWHEEL.products.map((p) => (
          <span className="flywheel__product" key={p}>
            {p}
          </span>
        ))}
      </div>

      <div className="flywheel__stem" aria-hidden="true">
        <span className="flywheel__stem-label">Fees / protocol revenue</span>
      </div>

      <div className="flywheel__hub">{FLYWHEEL.hub}</div>

      <div className="flywheel__split" aria-hidden="true" />

      <div className="flywheel__branches">
        {FLYWHEEL.branches.map((branch) => (
          <div className="flywheel__branch" key={branch.title}>
            <div className="flywheel__branch-head">
              <span className="flywheel__branch-title">{branch.title}</span>
              <span className="t-demo">{branch.note}</span>
            </div>
            <ol className="flywheel__steps">
              {branch.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* The branches converge: the core ratio rises, the ecosystem strengthens, usage grows,
          and the loop repeats. Mirrors the split above, so the diagram closes. */}
      <div className="flywheel__merge" aria-hidden="true" />

      <div className="flywheel__chain">
        {FLYWHEEL.converge.map((step, i) => (
          <span className="flywheel__chain-part" key={step}>
            {i > 0 ? (
              <span className="flywheel__chain-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
            <span className={`flywheel__chain-node${i === 0 ? " flywheel__chain-node--gold" : ""}`}>
              {step}
            </span>
          </span>
        ))}
        <span className="flywheel__chain-part">
          <span className="flywheel__chain-arrow" aria-hidden="true">
            →
          </span>
          <span className="flywheel__chain-node flywheel__chain-node--loop">Repeat</span>
        </span>
      </div>

      <p className="t-note flywheel__note">{FLYWHEEL.convergeNote}</p>
    </div>
  );
}
