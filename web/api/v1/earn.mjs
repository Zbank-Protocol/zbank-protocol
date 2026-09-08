const MORPHO_API = "https://blue-api.morpho.org/graphql";
const VAULT = "0xBeEff033F34C046626B8D0A041844C5d1A5409dd";
const CHAIN_ID = 4663;

const query = `
  query ZbankEarnVault($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      totalAssets
      totalAssetsUsd
      liquidity
      liquidityUsd
      sharePrice
      apy
      netApy
      avgNetApy
      performanceFee
      managementFee
      listed
    }
  }
`;

async function readVault() {
  const response = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { address: VAULT, chainId: CHAIN_ID },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Morpho API returned ${response.status}`);
  const body = await response.json();
  if (body.errors?.length || !body.data?.vaultV2ByAddress) {
    throw new Error(body.errors?.[0]?.message ?? "Morpho vault unavailable");
  }
  return body.data.vaultV2ByAddress;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const vault = await readVault();
    return res.status(200).json({
      schema: "zbank.earn.v1",
      updatedAt: new Date().toISOString(),
      source: "morpho-blue-api",
      network: { name: "Robinhood Chain", chainId: CHAIN_ID },
      vault: {
        address: vault.address,
        name: vault.name,
        symbol: vault.symbol,
        underlying: "USDG",
        status: vault.listed ? "live" : "unlisted",
        totalAssets: String(vault.totalAssets),
        totalAssetsUsd: vault.totalAssetsUsd,
        availableLiquidity: String(vault.liquidity),
        availableLiquidityUsd: vault.liquidityUsd,
        sharePriceUsd: vault.sharePrice,
        apy: vault.apy,
        netApy: vault.netApy,
        averageNetApy: vault.avgNetApy,
        performanceFee: vault.performanceFee,
        managementFee: vault.managementFee,
      },
      warnings: [
        "APY is variable and is not guaranteed.",
        "This is a third-party Morpho vault curated by Steakhouse Financial.",
        "Withdrawals depend on vault and underlying-market liquidity.",
        "Morpho Vault V2 maxDeposit/maxWithdraw methods intentionally return zero and are not availability signals.",
      ],
    });
  } catch (error) {
    return res.status(502).json({
      error: "morpho_unavailable",
      message: error instanceof Error ? error.message : "Morpho vault unavailable",
    });
  }
}
