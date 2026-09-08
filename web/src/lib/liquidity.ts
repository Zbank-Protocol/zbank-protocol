import { ASSETS, ORACLES, UNISWAP } from "../config/protocol";
import { ensureAllowance, fromUsdg, fromZec, getPublicClient, getWalletClient } from "./zcredit";

const ZZEC = ASSETS.ZEC.address as `0x${string}`;
const USDG = ASSETS.USDG.address as `0x${string}`;
const ORACLE = ORACLES.zecUsd.address as `0x${string}`;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const Q96 = 2n ** 96n;
const Q192 = 2n ** 192n;
const MIN_TICK = -887272;
const MAX_TICK = 887272;

const FACTORY_ABI = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { type: "address", name: "tokenA" },
      { type: "address", name: "tokenB" },
      { type: "uint24", name: "fee" },
    ],
    outputs: [{ type: "address", name: "pool" }],
  },
  {
    type: "function",
    name: "feeAmountTickSpacing",
    stateMutability: "view",
    inputs: [{ type: "uint24", name: "fee" }],
    outputs: [{ type: "int24", name: "spacing" }],
  },
] as const;

const POOL_ABI = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { type: "uint160", name: "sqrtPriceX96" },
      { type: "int24", name: "tick" },
      { type: "uint16", name: "observationIndex" },
      { type: "uint16", name: "observationCardinality" },
      { type: "uint16", name: "observationCardinalityNext" },
      { type: "uint8", name: "feeProtocol" },
      { type: "bool", name: "unlocked" },
    ],
  },
] as const;

const ORACLE_ABI = [
  {
    type: "function",
    name: "priceUsd",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "price" }],
  },
] as const;

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "uint256", name: "balance" }],
  },
] as const;

const POSITION_MANAGER_ABI = [
  {
    type: "function",
    name: "createAndInitializePoolIfNecessary",
    stateMutability: "payable",
    inputs: [
      { type: "address", name: "token0" },
      { type: "address", name: "token1" },
      { type: "uint24", name: "fee" },
      { type: "uint160", name: "sqrtPriceX96" },
    ],
    outputs: [{ type: "address", name: "pool" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      {
        type: "tuple",
        name: "params",
        components: [
          { type: "address", name: "token0" },
          { type: "address", name: "token1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickLower" },
          { type: "int24", name: "tickUpper" },
          { type: "uint256", name: "amount0Desired" },
          { type: "uint256", name: "amount1Desired" },
          { type: "uint256", name: "amount0Min" },
          { type: "uint256", name: "amount1Min" },
          { type: "address", name: "recipient" },
          { type: "uint256", name: "deadline" },
        ],
      },
    ],
    outputs: [
      { type: "uint256", name: "tokenId" },
      { type: "uint128", name: "liquidity" },
      { type: "uint256", name: "amount0" },
      { type: "uint256", name: "amount1" },
    ],
  },
] as const;

export type LiquiditySnapshot = {
  pool: `0x${string}` | null;
  initialized: boolean;
  oraclePrice: number | null;
  poolPrice: number | null;
  deviationPct: number | null;
  poolZzec: number | null;
  poolUsdg: number | null;
};

function sqrt(value: bigint): bigint {
  if (value < 0n) throw new Error("Cannot square-root a negative value");
  if (value < 2n) return value;
  let x0 = value;
  let x1 = (x0 + value / x0) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) >> 1n;
  }
  return x0;
}

function sortedTokens() {
  return ZZEC.toLowerCase() < USDG.toLowerCase()
    ? ([ZZEC, USDG] as const)
    : ([USDG, ZZEC] as const);
}

function oracleSqrtPriceX96(priceWad: bigint): bigint {
  const [token0] = sortedTokens();
  const ratioX192 =
    token0 === ZZEC ? (priceWad * Q192) / 10n ** 20n : (10n ** 20n * Q192) / priceWad;
  return sqrt(ratioX192);
}

function humanPoolPrice(sqrtPriceX96: bigint): number {
  const rawSqrt = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = rawSqrt * rawSqrt;
  const [token0] = sortedTokens();
  return token0 === ZZEC
    ? rawPrice * 10 ** (ASSETS.ZEC.decimals - ASSETS.USDG.decimals)
    : (1 / rawPrice) * 10 ** (ASSETS.ZEC.decimals - ASSETS.USDG.decimals);
}

export async function readLiquiditySnapshot(): Promise<LiquiditySnapshot> {
  const client = await getPublicClient();
  let oraclePrice: number | null = null;
  try {
    const oracleRaw = (await client.readContract({
      address: ORACLE,
      abi: ORACLE_ABI,
      functionName: "priceUsd",
    })) as bigint;
    oraclePrice = Number(oracleRaw) / 1e18;
  } catch {
    // A stale oracle deliberately reverts. Keep pool state visible while blocking writes.
  }
  const poolAddress = (await client.readContract({
    address: UNISWAP.v3Factory,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [ZZEC, USDG, UNISWAP.zzecUsdgFee],
  })) as `0x${string}`;
  if (poolAddress === ZERO) {
    return {
      pool: null,
      initialized: false,
      oraclePrice,
      poolPrice: null,
      deviationPct: null,
      poolZzec: null,
      poolUsdg: null,
    };
  }

  const [slot0, zzecRaw, usdgRaw] = await Promise.all([
    client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "slot0" }),
    client.readContract({
      address: ZZEC,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [poolAddress],
    }),
    client.readContract({
      address: USDG,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [poolAddress],
    }),
  ]);
  const sqrtPriceX96 = (slot0 as readonly [bigint, number, number, number, number, number, boolean])[0];
  const poolPrice = sqrtPriceX96 === 0n ? null : humanPoolPrice(sqrtPriceX96);
  return {
    pool: poolAddress,
    initialized: sqrtPriceX96 !== 0n,
    oraclePrice,
    poolPrice,
    deviationPct:
      poolPrice == null || oraclePrice == null || oraclePrice === 0
        ? null
        : Math.abs(poolPrice / oraclePrice - 1) * 100,
    poolZzec: Number(zzecRaw) / 10 ** ASSETS.ZEC.decimals,
    poolUsdg: Number(usdgRaw) / 10 ** ASSETS.USDG.decimals,
  };
}

export async function initializeLiquidityPool(account: `0x${string}`): Promise<`0x${string}`> {
  const client = await getPublicClient();
  const wallet = await getWalletClient(account);
  const priceWad = (await client.readContract({
    address: ORACLE,
    abi: ORACLE_ABI,
    functionName: "priceUsd",
  })) as bigint;
  const [token0, token1] = sortedTokens();
  const hash = await wallet.writeContract({
    address: UNISWAP.nonfungiblePositionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "createAndInitializePoolIfNecessary",
    args: [token0, token1, UNISWAP.zzecUsdgFee, oracleSqrtPriceX96(priceWad)],
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

export async function addFullRangeLiquidity(
  account: `0x${string}`,
  zzecAmount: number,
  usdgAmount: number,
  slippageBps = 500,
): Promise<`0x${string}`> {
  if (zzecAmount <= 0 || usdgAmount <= 0) throw new Error("Both zZEC and USDG are required");
  const snapshot = await readLiquiditySnapshot();
  if (!snapshot.pool || !snapshot.initialized) throw new Error("Initialize the pool first");
  if (snapshot.deviationPct == null || snapshot.deviationPct > 2) {
    throw new Error("Pool price is more than 2% from the ZEC/USD oracle");
  }

  const zzecRaw = fromZec(zzecAmount);
  const usdgRaw = fromUsdg(usdgAmount);
  await ensureAllowance(account, ZZEC, UNISWAP.nonfungiblePositionManager, zzecRaw);
  await ensureAllowance(account, USDG, UNISWAP.nonfungiblePositionManager, usdgRaw);
  const beforeMint = await readLiquiditySnapshot();
  if (beforeMint.deviationPct == null || beforeMint.deviationPct > 2) {
    throw new Error("Pool price moved more than 2% from the ZEC/USD oracle");
  }

  const client = await getPublicClient();
  const wallet = await getWalletClient(account);
  const spacing = Number(
    await client.readContract({
      address: UNISWAP.v3Factory,
      abi: FACTORY_ABI,
      functionName: "feeAmountTickSpacing",
      args: [UNISWAP.zzecUsdgFee],
    }),
  );
  const tickLower = Math.ceil(MIN_TICK / spacing) * spacing;
  const tickUpper = Math.floor(MAX_TICK / spacing) * spacing;
  const [token0] = sortedTokens();
  const amount0Desired = token0 === ZZEC ? zzecRaw : usdgRaw;
  const amount1Desired = token0 === ZZEC ? usdgRaw : zzecRaw;
  const minimumMultiplier = BigInt(10_000 - slippageBps);
  const hash = await wallet.writeContract({
    address: UNISWAP.nonfungiblePositionManager,
    abi: POSITION_MANAGER_ABI,
    functionName: "mint",
    args: [
      {
        token0,
        token1: token0 === ZZEC ? USDG : ZZEC,
        fee: UNISWAP.zzecUsdgFee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min: (amount0Desired * minimumMultiplier) / 10_000n,
        amount1Min: (amount1Desired * minimumMultiplier) / 10_000n,
        recipient: account,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
      },
    ],
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}
