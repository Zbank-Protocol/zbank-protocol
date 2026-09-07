import type { ReactNode } from "react";
import type { LaunchStatus } from "../../config/protocol";

type Props = {
  /** Product ticker or kicker, e.g. "ZINVEST". */
  kicker: string;
  title: string;
  lede?: string;
  status?: LaunchStatus;
  /** Right-aligned slot — wallet summary, oracle status, etc. */
  aside?: ReactNode;
};

/** The standard product-page header: ticker, status, headline, one-line purpose. */
export function PageHead({ kicker, title, lede, status, aside }: Props) {
  return (
    <header className="page-head">
      <div className="page-head__row">
        <span className="page-head__kicker">
          {kicker}
          {status ? <span className="chip chip--proposed">{status}</span> : null}
        </span>
        {aside}
      </div>
      <h1 className="page-head__title">{title}</h1>
      {lede ? <p className="page-head__lede">{lede}</p> : null}
    </header>
  );
}
