import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(body.products[0].capabilities.usdgInput, "live");
  assert.equal(body.products[0].capabilities.zzecInput, "coming_soon_awaiting_funded_pool");
  assert.equal(body.execution.zzecUsdgPool, null);
  assert.equal(headers["access-control-allow-origin"], "*");
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
