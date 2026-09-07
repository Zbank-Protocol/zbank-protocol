import type { IndexCardData } from "../data/site";

/** One ZINDEX strategy card. Composition only — never a performance figure. */
export function IndexCard({ index }: { index: IndexCardData }) {
  return (
    <div className="index-card">
      <div className="index-card__head">
        <h3 className="index-card__name">{index.name}</h3>
        <span className="index-card__category">{index.category}</span>
      </div>
      <dl className="index-card__rows">
        <div>
          <dt>Assets</dt>
          <dd>{index.assets}</dd>
        </div>
        <div>
          <dt>Target allocation</dt>
          <dd>{index.target}</dd>
        </div>
        <div>
          <dt>Example components</dt>
          <dd>{index.components}</dd>
        </div>
      </dl>
    </div>
  );
}
