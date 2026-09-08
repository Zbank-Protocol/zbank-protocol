import { EXECUTION_DEPENDENCIES, PRODUCT_STATUS } from "../../config/protocol";
import type { ProductKey } from "../../config/protocol";

/**
 * The honesty banner for Preview products only — the interface is real, execution is not,
 * and here is exactly what it waits on. Live and Beta products render nothing here; the
 * Beta risk disclosure (unaudited contracts, temporary solo Safe, collateral cap) lives as
 * fine print beside the deposit actions instead, per SECURITY.md.
 */
export function PreviewBanner({ product }: { product: ProductKey }) {
  const status = PRODUCT_STATUS[product];
  if (status !== "Preview" && status !== "Coming soon" && status !== "Proposed") return null;

  return (
    <div className="preview-banner" role="note">
      <span className="preview-banner__label">Preview build — execution disabled</span>
      <span className="preview-banner__deps">
        Waiting on: {EXECUTION_DEPENDENCIES[product].join(" · ")}
      </span>
    </div>
  );
}

/**
 * The Beta disclosure as a single muted line of fine print. Placed at the bottom of any
 * page whose actions move real funds through the unaudited market — quiet, but present.
 */
export function BetaNote() {
  return (
    <p className="t-note preaudit-note" role="note">
      Pre-audit mainnet beta: actions move real funds through unaudited contracts administered
      by a disclosed temporary 1-of-1 Safe. Collateral is capped onchain at 5,000 zZEC. Deposit
      only what you can afford to lose.{" "}
      <a
        href="https://github.com/Zbank-Protocol/zbank-protocol/issues/5"
        target="_blank"
        rel="noreferrer"
      >
        Review the public audit scope ↗
      </a>
    </p>
  );
}
