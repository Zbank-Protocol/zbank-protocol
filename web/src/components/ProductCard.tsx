import { Link } from "react-router-dom";
import type { Product } from "../data/site";

/** Minimal geometric marks, one per product. Line icons, never illustration. */
export function ProductIcon({ name }: { name: string }) {
  const stroke = "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.5 } as const;

  switch (name) {
    case "ZINVEST": // rising steps: an allocation being built
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M3 20h4v-6H3zM10 20h4V9h-4zM17 20h4V4h-4z" />
        </svg>
      );
    case "ZINDEX": // grid: a basket of names
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
        </svg>
      );
    case "ZCREDIT": // scale beam: collateral against credit
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M12 4v16M4 8h16M6 8l-2.5 5h5zM18 8l-2.5 5h5z" />
        </svg>
      );
    case "ZEARN": // coin stack: dollars at work
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse {...common} cx="12" cy="6" rx="7" ry="3" />
          <path {...common} d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case "ZLOOP": // loop: borrow and reinvest
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path {...common} d="M20 12a8 8 0 10-2.3 5.7M20 12v-5M20 12h-5" />
        </svg>
      );
    default: // ZTREASURY — vault block
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect {...common} x="4" y="5" width="16" height="14" />
          <circle {...common} cx="12" cy="12" r="3.5" />
          <path {...common} d="M12 8.5v-2M12 17.5v-2M8.5 12h-2M17.5 12h-2" />
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
