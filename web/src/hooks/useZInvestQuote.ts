import { ASSETS, FEES, PROTOCOL_CONTRACTS } from "../config/protocol";

/**
 * A ZINVEST execution quote for a given input amount and allocation.
 *
 * Pre-launch there is no router and no pricing, so every estimated figure is null and
 * `executable` is false with the reason attached. The interface stays fully functional in
 * preview mode; the quote becomes real when the router address lands in config.
 */

export type ZInvestQuote = {
  executable: boolean;
  blockedBy: string | null;
  route: string[];
  estimatedReceived: { symbol: string; amount: number | null }[];
  priceImpact: number | null; // fraction
  networkFeeEth: number | null;
  protocolFeeBps: number | null;
  /** Slippage tolerance is user-set; default shown in the panel. */
  defaultSlippageBps: number;
};

export function useZInvestQuote(
  amountZec: number | null,
  allocation: { symbol: string; weight: number }[],
): ZInvestQuote {
  const routerReady = PROTOCOL_CONTRACTS.investRouter != null;

  return {
    executable: routerReady && amountZec != null && amountZec > 0 && allocation.length > 0,
    blockedBy: routerReady ? null : "Execution router not deployed",
    route: [ASSETS.ZEC.symbol, ASSETS.USDG.symbol, "Stock Tokens"],
    estimatedReceived: allocation.map((a) => ({ symbol: a.symbol, amount: null })),
    priceImpact: null,
    networkFeeEth: null,
    protocolFeeBps: FEES.zinvestExecutionBps,
    defaultSlippageBps: 50,
  };
}
