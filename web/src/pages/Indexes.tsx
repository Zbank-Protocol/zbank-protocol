import { PageHead } from "../components/app/PageHead";
import { PreviewBanner } from "../components/app/PreviewBanner";
import { IndexStrategyCard } from "../components/app/IndexStrategyCard";
import { WalletButton } from "../components/app/WalletButton";
import { INDEX_STRATEGIES, PRODUCT_STATUS } from "../config/protocol";

/**
 * ZINDEX — the strategy layer. Six target-allocation strategies that execute through ZINVEST.
 * No performance figures, no active-management claims: no rebalance engine exists, and every
 * card says so.
 */
export default function Indexes() {
  return (
    <main className="page">
      <div className="container">
        <PageHead
          kicker="ZINDEX"
          status={PRODUCT_STATUS.zindex}
          title="One click. An entire market strategy."
          lede="Target-allocation strategies executed through ZINVEST with USDG today, or directly from zZEC once its funded onchain route activates."
          aside={<WalletButton />}
        />
        <PreviewBanner product="zindex" />

        <div className="indexes indexes--page">
          {INDEX_STRATEGIES.map((s) => (
            <IndexStrategyCard strategy={s} key={s.ticker} />
          ))}
        </div>

        <p className="t-note container__note">
          ZINDEX strategies are target allocations, not managed funds. No automated rebalancing
          exists; weights are targets applied at execution. No performance is shown because
          nothing has traded.
        </p>
      </div>
    </main>
  );
}
