import { ZPAY } from "../data/site";

/** The ZPAY routing flow, vertical: customer in ZEC, merchant in the settlement asset. */
export function PayFlow() {
  return (
    <div className="payflow" role="img" aria-label="A customer pays in ZEC; the ZPAY router converts; the merchant settles in USDG or another supported asset">
      {ZPAY.flow.map((node, i) => (
        <div className="payflow__item" key={node.label}>
          {i > 0 ? (
            <span className="payflow__arrow" aria-hidden="true">
              ↓
            </span>
          ) : null}
          <div className="payflow__node" data-hub={i === 1}>
            <span className="payflow__label">{node.label}</span>
            <span className="payflow__detail">{node.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
