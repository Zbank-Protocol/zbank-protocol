# Direct ZEC investing — activation runbook

The direct ZINVEST path is implemented as:

`zZEC → USDG → selected Stock Tokens`

The first hop uses a community- and protocol-funded Uniswap v3 zZEC/USDG pool. Each second hop uses the
existing liquid USDG/Stock Token pool selected in `web/src/config/protocol.ts`.

## Why this path

An external Uniswap v4 zZEC/ETH market already exists, so a future alternative is:

`zZEC → ETH/WETH (v4) → USDG (v3) → Stock Tokens (v3)`

That route is not enabled at launch. It crosses Uniswap versions, needs Universal Router
calldata and fork-tested quoting, and the available zZEC depth is currently too small for a
public portfolio product. Re-evaluate it as a fallback only after measured quotes at the
intended transaction limits pass the same slippage and atomicity gates below. The seeded
zZEC/USDG design remains the controlled route because its capital, initial oracle price, fee
tier, and launch limits can all be verified before users see it as Live.

## What is built

- `/liquidity` lets any connected user initialize the pool at the live oracle price, add
  full-range zZEC/USDG, and retain the resulting Uniswap LP NFT.
- `script/SeedZzecUsdgPool.s.sol` creates the zZEC/USDG pool at the live Chainlink
  ZEC/USD oracle price and mints the initial LP position to the protocol Safe.
- `PonsFeeRouter.sol` is the permanent Safe-controlled Pons `creatorFeeRecipient`. It can
  replace downstream manager implementations after a one-day notice or transfer the Pons
  recipient entirely in an emergency.
- `PonsFeeLiquidityManager.sol` receives routed USDG, places 50% into an oracle-guarded
  one-sided position below spot, and sends 50% to treasury allocation. The deployed pre-audit
  manager is `0x082B87D21A5F840De52F2c154aC4132E3C365295`; do not use the implementation
  directly as the immutable launch recipient.
- `src/adapters/UniswapV3Adapter.sol` executes only owner-approved direct and multi-hop
  Uniswap v3 paths.
- `script/DeployZecInvest.s.sol` refuses to deploy until the pool exists with both assets,
  configures every current ZINDEX route, transfers administration to the Safe, and deploys
  `InvestRouter`.
- ZINVEST accepts USDG or zZEC in the interface. zZEC execution remains visibly disabled
  until the funded pool and router addresses are recorded in the central config.
- `npm run check:zec-route` verifies pool depth, a real zZEC → USDG → SPY quote, and router
  bytecode.

## Capital requirement

Liquidity always requires real assets. Community LPs supply both zZEC and USDG directly and
keep their position NFTs. The Pons fee manager contributes USDG creator fees automatically;
its below-spot range supplies USDG to zZEC sellers and accumulates zZEC when trades cross it.

At the oracle price, the starting values should be approximately balanced:

`USDG value ≈ zZEC amount × current ZEC/USD price`

Choose the seed size from the maximum intended trade and acceptable price impact. Do not
advertise direct ZEC execution from a dust pool. The launch check below tests multiple sizes
before the web config is activated.

## 1. Prepare a local deployment environment

Never commit or paste the private key. Use a local ignored environment file or hardware-backed
deployment flow.

Required values use token base units:

- 1 zZEC = `100000000`
- 1 USDG = `1000000`

```bash
export DEPLOYER_PRIVATE_KEY=...
export LIQUIDITY_OWNER=0x31837999D9E463B2EB4327CEb4BD7CCa2a500480
export POOL_FEE=3000
export ZZEC_AMOUNT=...
export USDG_AMOUNT=...
export MIN_ZZEC_USED=...
export MIN_USDG_USED=...
```

`MIN_ZZEC_USED` and `MIN_USDG_USED` are mandatory. They prevent a badly balanced or
front-run initialization from consuming an unexpected asset amount. The script also:

- reads the live onchain Chainlink ZEC/USD oracle instead of accepting a typed price;
- reverts if the oracle is stale;
- reverts if an existing pool differs materially from the oracle price;
- reverts if the deployment wallet lacks either asset.

## 2. Create and fund the pool

The public path is `/liquidity`: connect a Robinhood Chain wallet, initialize at the live
oracle price if needed, then deposit both assets. The page blocks funding if pool spot differs
from the oracle by more than 2%.

For a protocol-owned seed, simulate the Foundry script first:

Run without `--broadcast` first:

```bash
forge script script/SeedZzecUsdgPool.s.sol --rpc-url robinhood
```

Review the pool price, amounts used, LP NFT recipient, and gas. Only then broadcast:

```bash
forge script script/SeedZzecUsdgPool.s.sol --rpc-url robinhood --broadcast
```

Record the pool address and LP NFT token ID. Confirm the NFT owner is the Safe.

## 3. Deploy the direct route

```bash
export OWNER=0x31837999D9E463B2EB4327CEb4BD7CCa2a500480
export FEE_RECIPIENT=...
export INVEST_FEE_BPS=...
export ZZEC_USDG_FEE=3000

forge script script/DeployZecInvest.s.sol --rpc-url robinhood
forge script script/DeployZecInvest.s.sol --rpc-url robinhood --broadcast
```

The first command is a simulation. The broadcast command deploys the adapter and
`InvestRouter` only if the pool has both zZEC and USDG.

## 4. Verify before activating the website

```bash
cd web
INVEST_ROUTER=0x... npm run check:zec-route -- --require-live
```

Also quote and execute small, medium, and launch-limit zZEC baskets. For each size verify:

- the first-hop price remains within the launch impact limit;
- every Stock Token output matches the quoted slippage floor;
- the entire basket reverts if one leg misses its minimum;
- output settles directly to the user;
- the router and adapter retain no funds;
- pause works through the Safe;
- the LP NFT is controlled by the Safe.

The newly authored adapter and router path are **not externally audited**. Keep the direct
route marked Coming soon until this review, a funded mainnet dry run, and monitoring are
complete.

## 5. Activate the central config

Set:

- `UNISWAP.zzecUsdgPool` to the created pool;
- `PROTOCOL_CONTRACTS.investRouter` to the deployed router;
- the finalized execution fee in `FEES`.

Run the web build and `npm run check:zec-route -- --require-live` again. The zZEC tab then
switches from Coming soon to Live without a component rewrite.
