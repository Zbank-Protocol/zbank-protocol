import { ASSETS, STOCK_TOKENS, UNISWAP } from "../config/protocol";
import { ensureAllowance, getPublicClient, getWalletClient } from "./zcredit";

/**
 * The ZINVEST execution engine: quote and execute Stock Token baskets against Uniswap v3
 * on Robinhood Chain. Deliberately contract-free on our side — approvals go to Uniswap's
 * audited SwapRouter02, every leg settles straight to the user's wallet, and a basket is
 * one atomic multicall. If any leg's minimum-out fails, the whole transaction reverts.
 */

const USDG = ASSETS.USDG.address as `0x${string}`;
const USDG_UNIT = 10 ** ASSETS.USDG.decimals;
const TOKEN_UNIT = 1e18; // every Stock Token is 18 decimals (verified onchain)

/** quoteExactInputSingle is declared view here so it can run as a plain eth_call. */
const QUOTER_ABI = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const ROUTER_ABI = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ type: "bytes[]" }],
  },
] as const;

export type BasketLeg = {
  symbol: string;
  /** USDG spent on this leg (human units). */
  usdgIn: number;
  /** Quoted tokens out (human units). */
  quotedOut: number;
};

export type BasketQuote = {
  legs: BasketLeg[];
  totalUsdgIn: number;
  /** Symbols in the requested allocation that are not in the investable universe. */
  unsupported: string[];
};

export const supportedSymbols = () => Object.keys(STOCK_TOKENS);
export const isSupported = (symbol: string) => symbol.toUpperCase() in STOCK_TOKENS;

/**
 * Quote a basket: split `amountUsdg` by weight and quote each leg through QuoterV2
 * against the token's deepest USDG pool. Unsupported symbols are reported, not guessed.
 */
export async function quoteBasket(
  amountUsdg: number,
  allocation: { symbol: string; weight: number }[],
): Promise<BasketQuote> {
  const unsupported = allocation
    .map((a) => a.symbol.toUpperCase())
    .filter((s) => !(s in STOCK_TOKENS));
  const valid = allocation.filter((a) => a.symbol.toUpperCase() in STOCK_TOKENS);
  const totalWeight = valid.reduce((s, a) => s + a.weight, 0);
  if (amountUsdg <= 0 || totalWeight <= 0) {
    return { legs: [], totalUsdgIn: 0, unsupported };
  }

  const client = await getPublicClient();
  const legs = await Promise.all(
    valid.map(async (a) => {
      const token = STOCK_TOKENS[a.symbol.toUpperCase()];
      const usdgIn = (amountUsdg * a.weight) / totalWeight;
      const amountIn = BigInt(Math.round(usdgIn * USDG_UNIT));
      const [amountOut] = (await client.readContract({
        address: UNISWAP.quoterV2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [
          {
            tokenIn: USDG,
            tokenOut: token.address,
            amountIn,
            fee: token.fee,
            sqrtPriceLimitX96: 0n,
          },
        ],
      })) as [bigint, bigint, number, bigint];
      return { symbol: token.symbol, usdgIn, quotedOut: Number(amountOut) / TOKEN_UNIT };
    }),
  );

  return { legs, totalUsdgIn: amountUsdg, unsupported };
}

/**
 * Execute a quoted basket atomically. Approves SwapRouter02 for the total USDG, then sends
 * one multicall of exactInputSingle legs, each guarded by (quote × (1 − slippage)) as its
 * onchain minimum. Returns the transaction hash after the receipt lands.
 */
export async function executeBasket(
  account: `0x${string}`,
  quote: BasketQuote,
  slippageBps: number,
): Promise<`0x${string}`> {
  if (quote.legs.length === 0) throw new Error("Nothing to execute");
  const { encodeFunctionData } = await import("viem");

  const totalIn = BigInt(Math.round(quote.totalUsdgIn * USDG_UNIT));
  await ensureAllowance(account, USDG, UNISWAP.swapRouter02, totalIn);

  const calls = quote.legs.map((leg) => {
    const token = STOCK_TOKENS[leg.symbol];
    const amountIn = BigInt(Math.round(leg.usdgIn * USDG_UNIT));
    const minOut = BigInt(
      Math.floor(leg.quotedOut * TOKEN_UNIT * (1 - slippageBps / 10_000)),
    );
    return encodeFunctionData({
      abi: ROUTER_ABI,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: USDG,
          tokenOut: token.address,
          fee: token.fee,
          recipient: account,
          amountIn,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const wallet = await getWalletClient(account);
  const client = await getPublicClient();
  const hash = await wallet.writeContract({
    address: UNISWAP.swapRouter02,
    abi: ROUTER_ABI,
    functionName: "multicall",
    args: [deadline, calls],
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("Swap reverted");
  return hash;
}

/** Read the user's USDG balance (human units). */
export async function usdgBalance(account: `0x${string}`): Promise<number> {
  const client = await getPublicClient();
  const { ERC20_ABI } = await import("./zcredit");
  const raw = (await client.readContract({
    address: USDG,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  return Number(raw) / USDG_UNIT;
}
