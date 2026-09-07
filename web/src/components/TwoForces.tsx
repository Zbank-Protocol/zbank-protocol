import { TOKENOMICS } from "../data/site";

/**
 * The two-forces diagram: 01 Accumulate on the left, 02 Reduce on the right, converging into
 * one result row. Pure grid and hairlines — a financial diagram, not an illustration.
 */
export function TwoForces() {
  return (
    <div
      className="forces"
      role="img"
      aria-label="Protocol revenue accumulates ZEC and reduces ZBNK supply; the result is more ZEC per eligible ZBNK"
    >
      <div className="forces__cols">
        {TOKENOMICS.forces.map((force) => (
          <div className="forces__col" key={force.no}>
            <div className="forces__head">
              <span className="forces__no">{force.no}</span>
              <span className="forces__name">{force.name}</span>
            </div>
            <ol className="forces__steps">
              {force.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <span className="forces__outcome">{force.result}</span>
          </div>
        ))}
      </div>

      <div className="forces__merge" aria-hidden="true" />

      <div className="forces__result">
        <span className="metric__label">{TOKENOMICS.result.label}</span>
        <span className="forces__result-value">{TOKENOMICS.result.value}</span>
      </div>
    </div>
  );
}
