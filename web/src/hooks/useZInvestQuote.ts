import { useEffect, useRef, useState } from "react";
import { ASSETS, PROTOCOL_CONTRACTS, UNISWAP } from "../config/protocol";
import { quoteBasket, type BasketQuote, type InvestInput } from "../lib/zinvest";

/**
 * A live ZINVEST quote: debounced QuoterV2 pricing for every leg of the requested basket.
 * Quotes come from Uniswap v3 pools onchain — never from a frontend price table.
 */

export type ZInvestQuote = {
  executable: boolean;
  blockedBy: string | null;
  route: string[];
  estimatedReceived: { symbol: string; amount: number | null }[];
  /** Symbols requested but not in the investable universe. */
  unsupported: string[];
  quoting: boolean;
  /** The raw quote object handed to executeBasket. */
  basket: BasketQuote | null;
};

export function useZInvestQuote(
  amountInput: number | null,
  allocation: { symbol: string; weight: number }[],
  inputSymbol: InvestInput = "USDG",
): ZInvestQuote {
  const [basket, setBasket] = useState<BasketQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const allocationKey = allocation.map((a) => `${a.symbol}:${a.weight}`).join(",");

  useEffect(() => {
    if (inputSymbol === "zZEC" && (!UNISWAP.zzecUsdgPool || !PROTOCOL_CONTRACTS.investRouter)) {
      setBasket(null);
      setError(
        "Coming soon — the direct ZEC route is built and activates after the zZEC/USDG market is funded.",
      );
      setQuoting(false);
      return;
    }
    if (amountInput == null || amountInput <= 0 || allocation.length === 0) {
      setBasket(null);
      setError(null);
      return;
    }
    const id = ++seq.current;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      try {
        const q = await quoteBasket(amountInput, allocation, inputSymbol);
        if (seq.current !== id) return;
        setBasket(q);
        setError(null);
      } catch {
        if (seq.current !== id) return;
        setBasket(null);
        setError("Quoting failed — pools unreachable. Retry in a moment.");
      } finally {
        if (seq.current === id) setQuoting(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountInput, allocationKey, inputSymbol]);

  const hasLegs = basket != null && basket.legs.length > 0;
  const blockedBy =
    error ??
    (basket && basket.unsupported.length > 0
      ? `Unsupported symbols: ${basket.unsupported.join(", ")}`
      : null);

  return {
    executable: hasLegs && blockedBy == null,
    blockedBy,
    route:
      inputSymbol === "zZEC"
        ? [ASSETS.ZEC.symbol, ASSETS.USDG.symbol, "Stock Tokens"]
        : [ASSETS.USDG.symbol, "Stock Tokens"],
    estimatedReceived:
      basket?.legs.map((l) => ({ symbol: l.symbol, amount: l.quotedOut })) ??
      allocation.map((a) => ({ symbol: a.symbol.toUpperCase(), amount: null })),
    unsupported: basket?.unsupported ?? [],
    quoting,
    basket,
  };
}
