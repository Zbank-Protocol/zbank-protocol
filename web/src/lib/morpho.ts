import { ASSETS, MORPHO } from "../config/protocol";
import {
  ensureAllowance,
  fromUsdg,
  getPublicClient,
  getWalletClient,
  toUsdg,
} from "./zcredit";

const VAULT_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ type: "address", name: "account" }],
    outputs: [{ type: "uint256", name: "shares" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "assets" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "shares" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "shares" }],
    outputs: [{ type: "uint256", name: "assets" }],
  },
  {
    type: "function",
    name: "previewDeposit",
    stateMutability: "view",
    inputs: [{ type: "uint256", name: "assets" }],
    outputs: [{ type: "uint256", name: "shares" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "assets" },
      { type: "address", name: "onBehalf" },
    ],
    outputs: [{ type: "uint256", name: "shares" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "assets" },
      { type: "address", name: "receiver" },
      { type: "address", name: "owner" },
    ],
    outputs: [{ type: "uint256", name: "shares" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { type: "uint256", name: "shares" },
      { type: "address", name: "receiver" },
      { type: "address", name: "owner" },
    ],
    outputs: [{ type: "uint256", name: "assets" }],
  },
] as const;

export type MorphoApiMetrics = {
  totalAssetsUsd: number | null;
  availableLiquidityUsd: number | null;
  sharePriceUsd: number | null;
  netApy: number | null;
  averageNetApy: number | null;
  performanceFee: number | null;
  managementFee: number | null;
};

export type MorphoVaultState = MorphoApiMetrics & {
  totalAssets: number | null;
  sharePrice: number | null;
  userShares: number | null;
  userAssets: number | null;
};

export const EMPTY_MORPHO_STATE: MorphoVaultState = {
  totalAssets: null,
  totalAssetsUsd: null,
  availableLiquidityUsd: null,
  sharePrice: null,
  sharePriceUsd: null,
  netApy: null,
  averageNetApy: null,
  performanceFee: null,
  managementFee: null,
  userShares: null,
  userAssets: null,
};

async function readApiMetrics(): Promise<MorphoApiMetrics> {
  try {
    const response = await fetch(MORPHO.apiUrl);
    if (!response.ok) throw new Error("Morpho metrics unavailable");
    const body = (await response.json()) as {
      vault?: {
        totalAssetsUsd?: number;
        availableLiquidityUsd?: number;
        sharePriceUsd?: number;
        netApy?: number;
        averageNetApy?: number;
        performanceFee?: number;
        managementFee?: number;
      };
    };
    return {
      totalAssetsUsd: body.vault?.totalAssetsUsd ?? null,
      availableLiquidityUsd: body.vault?.availableLiquidityUsd ?? null,
      sharePriceUsd: body.vault?.sharePriceUsd ?? null,
      netApy: body.vault?.netApy ?? null,
      averageNetApy: body.vault?.averageNetApy ?? null,
      performanceFee: body.vault?.performanceFee ?? null,
      managementFee: body.vault?.managementFee ?? null,
    };
  } catch {
    return {
      totalAssetsUsd: null,
      availableLiquidityUsd: null,
      sharePriceUsd: null,
      netApy: null,
      averageNetApy: null,
      performanceFee: null,
      managementFee: null,
    };
  }
}

export async function readMorphoVault(account: string | null): Promise<MorphoVaultState> {
  const client = await getPublicClient();
  const user = account as `0x${string}` | null;
  const [totalAssetsRaw, sharePriceRaw, userSharesRaw, metrics] = await Promise.all([
    client.readContract({
      address: MORPHO.steakhouseUsdgVault,
      abi: VAULT_ABI,
      functionName: "totalAssets",
    }) as Promise<bigint>,
    client.readContract({
      address: MORPHO.steakhouseUsdgVault,
      abi: VAULT_ABI,
      functionName: "convertToAssets",
      args: [10n ** BigInt(MORPHO.shareDecimals)],
    }) as Promise<bigint>,
    user
      ? (client.readContract({
          address: MORPHO.steakhouseUsdgVault,
          abi: VAULT_ABI,
          functionName: "balanceOf",
          args: [user],
        }) as Promise<bigint>)
      : Promise.resolve(0n),
    readApiMetrics(),
  ]);
  const userAssetsRaw =
    userSharesRaw > 0n
      ? ((await client.readContract({
          address: MORPHO.steakhouseUsdgVault,
          abi: VAULT_ABI,
          functionName: "convertToAssets",
          args: [userSharesRaw],
        })) as bigint)
      : 0n;

  return {
    ...metrics,
    totalAssets: toUsdg(totalAssetsRaw),
    sharePrice: toUsdg(sharePriceRaw),
    userShares: Number(userSharesRaw) / 10 ** MORPHO.shareDecimals,
    userAssets: toUsdg(userAssetsRaw),
  };
}

export async function previewMorphoDeposit(amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const client = await getPublicClient();
  const shares = (await client.readContract({
    address: MORPHO.steakhouseUsdgVault,
    abi: VAULT_ABI,
    functionName: "previewDeposit",
    args: [fromUsdg(amount)],
  })) as bigint;
  return Number(shares) / 10 ** MORPHO.shareDecimals;
}

export async function depositMorpho(
  account: `0x${string}`,
  amount: number,
): Promise<`0x${string}`> {
  const assets = fromUsdg(amount);
  if (assets <= 0n) throw new Error("Enter a USDG amount");
  await ensureAllowance(
    account,
    ASSETS.USDG.address as `0x${string}`,
    MORPHO.steakhouseUsdgVault,
    assets,
  );
  const client = await getPublicClient();
  const wallet = await getWalletClient(account);
  const hash = await wallet.writeContract({
    address: MORPHO.steakhouseUsdgVault,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [assets, account],
  });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

export async function withdrawMorpho(
  account: `0x${string}`,
  amount: number,
  allShares: bigint | null = null,
): Promise<`0x${string}`> {
  const client = await getPublicClient();
  const wallet = await getWalletClient(account);
  const hash =
    allShares != null
      ? await wallet.writeContract({
          address: MORPHO.steakhouseUsdgVault,
          abi: VAULT_ABI,
          functionName: "redeem",
          args: [allShares, account, account],
        })
      : await wallet.writeContract({
          address: MORPHO.steakhouseUsdgVault,
          abi: VAULT_ABI,
          functionName: "withdraw",
          args: [fromUsdg(amount), account, account],
        });
  await client.waitForTransactionReceipt({ hash });
  return hash;
}

export async function readMorphoShares(account: `0x${string}`): Promise<bigint> {
  const client = await getPublicClient();
  return (await client.readContract({
    address: MORPHO.steakhouseUsdgVault,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
}
