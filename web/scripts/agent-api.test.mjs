import assert from "node:assert/strict";
import test from "node:test";
import earnHandler from "../api/v1/earn.mjs";
import protocolHandler from "../api/v1/protocol.mjs";
import marketHandler from "../api/v1/market.mjs";
import keeperHandler from "../api/internal/keeper.mjs";

async function invoke(handler, req = { method: "GET", headers: {} }) {
  let statusCode;
  let body;
  const headers = {};
  const res = {
    setHeader: (name, value) => {
      headers[name.toLowerCase()] = value;
    },
    status: (value) => {
      statusCode = value;
      return res;
    },
    json: (value) => {
      body = value;
      return res;
    },
    end: () => res,
  };
  await handler(req, res);
  return { statusCode, body, headers };
}

test("protocol manifest exposes canonical launch state", async () => {
  const { statusCode, body, headers } = await invoke(protocolHandler);
  assert.equal(statusCode, 200);
  assert.equal(body.schema, "zbank.protocol.v1");
  assert.equal(body.identity.network.chainId, 4663);
  assert.equal(body.contracts.creditMarket, "0x77ccb77d1fd337b7027b3482ca365db57d92151e");
  assert.equal(body.contracts.protocolSafe, "0x31837999D9E463B2EB4327CEb4BD7CCa2a500480");
  assert.equal(body.contracts.zbnk, null);
  assert.equal(body.contracts.redemption, null);
  assert.equal(body.contracts.payoutRegistry, null);
  assert.equal(
    body.contracts.ponsFeeLiquidityManager,
    "0x082B87D21A5F840De52F2c154aC4132E3C365295",
  );
  assert.equal(body.pons.factory, "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e");
  assert.equal(body.pons.quoteAsset, "USDG");
  assert.equal(body.pons.feeLiquidityBps, 5000);
  assert.equal(body.products[0].capabilities.usdgInput, "live");
  assert.equal(body.products[0].capabilities.zzecInput, "coming_soon_awaiting_funded_pool");
  assert.equal(body.execution.zzecUsdgPool, null);
  assert.equal(
    body.integrations.morpho.vault,
    "0xBeEff033F34C046626B8D0A041844C5d1A5409dd",
  );
  assert.equal(body.integrations.morpho.custody, "user_owned_vault_shares");
  assert.equal(body.endpoints.earn, "/api/v1/earn");
  assert.equal(headers["access-control-allow-origin"], "*");
});

test("earn endpoint reports live third-party vault metrics", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: {
        vaultV2ByAddress: {
          address: "0xBeEff033F34C046626B8D0A041844C5d1A5409dd",
          name: "Steakhouse USDG",
          symbol: "steakUSDG",
          totalAssets: "453220835210927",
          totalAssetsUsd: 453_204_997.27,
          liquidity: "30154807502501",
          liquidityUsd: 30_153_753.73,
          sharePrice: 1.0062,
          apy: 0.039,
          netApy: 0.039,
          avgNetApy: 0.037,
          performanceFee: 0,
          managementFee: 0,
          listed: true,
        },
      },
    }),
  });
  try {
    const { statusCode, body } = await invoke(earnHandler);
    assert.equal(statusCode, 200);
    assert.equal(body.schema, "zbank.earn.v1");
    assert.equal(body.vault.status, "live");
    assert.equal(body.vault.underlying, "USDG");
    assert.equal(body.vault.netApy, 0.039);
    assert.equal(body.vault.availableLiquidity, "30154807502501");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("live market endpoint returns explicit units and oracle state", async () => {
  const { statusCode, body } = await invoke(marketHandler);
  assert.equal(statusCode, 200);
  assert.equal(body.schema, "zbank.market.v1");
  assert.match(body.oracle.status, /^(live|stale)$/);
  assert.equal(typeof body.market.availableLiquidityUsdg, "string");
  assert.equal(body.market.collateralCapZec, "5000");
  assert.equal(body.units.utilizationBps, "basis_points");
});

test("keeper endpoint rejects requests without the cron bearer token", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    const { statusCode, body, headers } = await invoke(keeperHandler);
    assert.equal(statusCode, 401);
    assert.equal(body.error, "unauthorized");
    assert.equal(headers["cache-control"], "no-store");
  } finally {
    if (previous == null) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
