import { EXECUTION_DEPENDENCIES, PRODUCT_STATUS } from "../../config/protocol";
import type { ProductKey } from "../../config/protocol";

/**
 * The honesty banner every non-Live product carries.
 *
 * Preview: the interface is real, execution is not, and here is exactly what it waits on.
 * Beta: execution is real, and the risks are stated where the deposit button lives —
 * unaudited contracts, single-key admin, and the onchain collateral cap. (SECURITY.md
 * requires this disclosure verbatim wherever users are asked to deposit.)
 */
export function PreviewBanner({ product }: { product: ProductKey }) {
  const status = PRODUCT_STATUS[product];
  if (status === "Live") return null;

  if (status === "Beta") {
    return (
      <div className="preview-banner" role="note">
        <span className="preview-banner__label">Beta — live contracts, real funds</span>
        <span className="preview-banner__deps">
          Unaudited smart contracts · single-key admin (multisig migration pending) · market
          capped at 5,000 zZEC collateral · deposit only what you can afford to lose
        </span>
      </div>
    );
  }

  return (
    <div className="preview-banner" role="note">
      <span className="preview-banner__label">Preview build — execution disabled</span>
      <span className="preview-banner__deps">
        Waiting on: {EXECUTION_DEPENDENCIES[product].join(" · ")}
      </span>
    </div>
  );
}
