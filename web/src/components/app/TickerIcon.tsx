import { STOCK_TOKENS } from "../../config/protocol";

/**
 * A branded monogram badge for a ticker: a ring-lit disc with the symbol's first letters
 * and a per-company accent hue. Deliberately not logo artwork — monograms stay premium at
 * 20px, never pixelate, and carry no trademark baggage.
 */

const ACCENT: Record<string, string> = {
  NVDA: "#76b900",
  AAPL: "#a2aaad",
  MSFT: "#4cc2ff",
  META: "#0866ff",
  GOOGL: "#4285f4",
  AMZN: "#ff9900",
  TSLA: "#e82127",
  SPY: "#2ecc71",
  QQQ: "#8e6fff",
  SGOV: "#35c4b5",
  GME: "#ff4747",
  HIMS: "#f0587e",
  USDG: "#22b573",
  ZEC: "#f4b728",
  ZBNK: "#e7b348",
};

/** Deterministic fallback hue so unknown symbols still get a stable color. */
function fallbackAccent(symbol: string): string {
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 60%)`;
}

export function TickerIcon({ symbol, size = 22 }: { symbol: string; size?: number }) {
  const s = symbol.toUpperCase();
  const accent = ACCENT[s] ?? fallbackAccent(s);
  const mono = s.length <= 2 ? s : s.slice(0, 2);
  return (
    <span
      className="tick-icon"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        color: accent,
        borderColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
      }}
    >
      {mono}
    </span>
  );
}

/** Full display name for a ticker when we know it; the symbol otherwise. */
export function tickerName(symbol: string): string {
  return STOCK_TOKENS[symbol.toUpperCase()]?.name ?? symbol.toUpperCase();
}
