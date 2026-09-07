import { Link } from "react-router-dom";
import type { Product } from "../data/site";

/**
 * The ZBANK glyph system — one bespoke mark per product, drawn on a shared 24px grid.
 *
 * The grammar: every mark carries the brand's Z-diagonal (upper-right → lower-left) and one
 * solid gold "node" — the same particle that builds the wordmark. Thin rounded strokes,
 * consistent optical weight. Drawn by hand for this system; not from any stock set.
 */
export function ProductIcon({ name }: { name: string }) {
  const line = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  const node = { fill: "currentColor", stroke: "none" } as const;

  switch (name) {
    case "ZINVEST": // the ascent: capital rising along the Z-diagonal, ticks marking entries
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M4 20.5h16" />
          <path {...line} d="M6 17.5 17.5 6" />
          <path {...line} d="M12.5 6h5v5" />
          <path {...line} d="M8 20.5v-2.4M12.5 20.5v-2.4M17 20.5v-2.4" />
          <circle {...node} cx="6" cy="17.5" r="1.5" />
        </svg>
      );
    case "ZINDEX": // the strata: allocation layers stepped along the diagonal
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M8.5 5.5H19" />
          <path {...line} d="M19 5.5 5 18.5" />
          <path {...line} d="M5 18.5h10.5" />
          <circle {...node} cx="14.3" cy="9.9" r="1.35" />
          <circle {...node} cx="9.7" cy="14.1" r="1.35" />
        </svg>
      );
    case "ZCREDIT": // the vault: a dial whose keyway is the diagonal
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...line} x="3.5" y="3.5" width="17" height="17" rx="3.4" />
          <circle {...line} cx="12" cy="12" r="4.4" />
          <path {...line} d="M14.4 9.6 9.6 14.4" />
          <circle {...node} cx="14.4" cy="9.6" r="1.3" />
        </svg>
      );
    case "ZEARN": // the rate: a percent sign rebuilt from the diagonal and two nodes
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M17 6 7 18" />
          <circle {...line} cx="7.6" cy="7.6" r="2.7" />
          <circle {...node} cx="16.4" cy="16.4" r="2.7" />
        </svg>
      );
    case "ZLOOP": // the cycle: borrow → invest → repeat, the node riding the loop
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M19.5 12a7.5 7.5 0 1 1-2.7-5.77" />
          <path {...line} d="M17.2 3.2l-.4 3.3 3.3.5" />
          <path {...line} d="M14.4 9.6 9.6 14.4" />
          <circle {...node} cx="19.5" cy="12" r="1.5" />
        </svg>
      );
    case "START": // the ignition: a compass needle set on the diagonal
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle {...line} cx="12" cy="12" r="8.5" />
          <path {...node} d="M15.8 8.2l-2.3 5.6-5.3 2 2.3-5.6z" />
        </svg>
      );
    case "DOCS": // the ledger: a page whose fold is the diagonal
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M6 3.5h8.5L19 8v12.5H6z" />
          <path {...line} d="M14.5 3.5V8H19" />
          <path {...line} d="M9 12.5h7M9 16h7" />
          <circle {...node} cx="9" cy="9" r="1.3" />
        </svg>
      );
    default: // ZTREASURY — the reserve: pediment and columns, the node as the keystone
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...line} d="M4 20.5h16" />
          <path {...line} d="M4.5 9.5 12 4l7.5 5.5" />
          <path {...line} d="M7 20.5v-7.5M12 20.5v-7.5M17 20.5v-7.5" />
          <circle {...node} cx="12" cy="8.4" r="1.5" />
        </svg>
      );
  }
}

/**
 * One product in the grid. Routes to the product's application page when it has one;
 * otherwise a static card — no dead links, no fake functionality.
 */
export function ProductCard({ product }: { product: Product }) {
  const body = (
    <>
      <div className="product__head">
        <span className="product__icon">
          <ProductIcon name={product.name} />
        </span>
        <span className="chip chip--proposed">{product.status}</span>
      </div>
      <h3 className="product__name">{product.name}</h3>
      <p className="product__tagline">{product.tagline}</p>
      <p className="product__copy">{product.copy}</p>
      <span className="product__arrow" aria-hidden="true">
        →
      </span>
    </>
  );

  return product.href ? (
    <Link className="product" to={product.href}>
      {body}
    </Link>
  ) : (
    <div className="product">{body}</div>
  );
}
