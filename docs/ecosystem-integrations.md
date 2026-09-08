# Robinhood Chain integration roadmap

Verified 2026-09-08. An ecosystem listing is not enough to ship an integration: ZBANK also
requires a live contract or API on chain 4663, usable liquidity, explicit custody, and an honest
failure mode.

## Shipped

- **Morpho V2 / Steakhouse USDG** — direct USDG deposit and withdrawal in ZEARN. Users receive
  `steakUSDG` shares in their own wallets. Live vault rate and liquidity are exposed at
  `/api/v1/earn`. Vault: `0xBeEff033F34C046626B8D0A041844C5d1A5409dd`.
- **Across** — ZEARN links to the live USDG bridge entry point so users can bring USDG from
  Ethereum to Robinhood Chain without ZBANK taking custody.
- **Uniswap v3** — ZINVEST execution and zZEC/USDG community liquidity use public Uniswap
  contracts. Users keep portfolio assets and LP NFTs.
- **Chainlink Data Streams** — ZEC/USD is verified onchain before ZCREDIT uses it.
- **Safe** — protocol-owned contracts and LP positions point to the disclosed protocol Safe.

## Build next

### 1. Uniswap API and UniswapX route competition

Request live quotes across Uniswap v2, v3, v4, and UniswapX instead of assuming a configured v3
path is always best. This can improve Stock Token execution and give agents a read-only quote
endpoint. Keep the direct router fallback, validate calldata and token addresses, and display the
route, price impact, and all fees before signing.

Official reference: <https://blog.uniswap.org/robinhood-chain-is-live>

### 2. A Morpho zZEC/USDG market

Evaluate an isolated Morpho market using zZEC collateral and USDG debt after the zZEC/USDG pool
has durable liquidity and the ZEC/USD oracle has a longer operating record. This could reduce the
amount of custom lending code ZBANK maintains, but it must not fragment ZCREDIT liquidity or be
launched merely because market creation is permissionless. Oracle, LLTV, liquidation liquidity,
caps, curator, and bad-debt assumptions need independent review first.

Official reference: <https://docs.morpho.org/>

### 3. Deposit and withdrawal route chooser

Add a non-custodial funding drawer that compares only verified routes:

- Across for fast USDG transfer.
- Robinhood Chain's canonical Arbitrum bridge for trust-minimized L1/L2 transfer.
- Stargate for supported OFTs.
- Chainlink Transporter only when a supported token lane exists.

Never imply every bridge supports zZEC or USDG in both directions. Query route support before
showing an action.

Official reference: <https://docs.robinhood.com/chain/bridging/>

### 4. Protocol analytics

Publish indexed treasury, retirement, LP, and revenue-allocation history through an analytics
provider such as Allium and submit adapters to DefiLlama once the canonical ZBNK and treasury
contracts exist. The website and agent API should still retain direct onchain verification for
critical balances.

Official ecosystem: <https://robinhood.com/us/en/chain/ecosystem>

### 5. Aggregator fallback

Robinhood lists 0x and 1inch as trading infrastructure. Before adding either, confirm their public
quote and transaction APIs actually return executable chain-4663 routes for the exact USDG and
Stock Token addresses. Do not add decorative provider logos before that smoke test passes.

## Deliberately not added

- **Ethena x Steakhouse USDG** was live but unlisted and materially smaller than the listed
  Steakhouse USDG vault at review time.
- **Grove x Steakhouse USDG** was unlisted, had roughly $100k deposited, and reported zero APY at
  review time.
- **Lighter perpetuals** add leveraged speculation but do not strengthen ZEC investing, credit,
  earning, liquidity, or treasury primitives.
- **More yield cards** without distinct risk or utility would fragment liquidity and make ZEARN
  look like an affiliate directory.

The next external integration should therefore be better execution routing, not another vault.
