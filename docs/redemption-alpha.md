# ZBANK redemption — pre-audit alpha

`ZBankRedemption.sol` is implemented and tested but cannot be deployed until the canonical
Pons-issued ZBNK address exists. Deployment does not imply an audit, production status, or a
guarantee that native ZEC claims will be settled.

## Two redemption paths

### Atomic zZEC

1. The holder approves ZBNK.
2. The contract quotes its proportional share of unreserved zZEC.
3. ZBNK is permanently locked outside eligible supply.
4. zZEC transfers to the holder in the same transaction.

The holder supplies a minimum output so a backing change cannot silently worsen execution.

### Operator-settled native ZEC

1. The holder registers a transparent Zcash address in `PayoutRegistry`.
2. The holder requests native redemption and permanently locks ZBNK.
3. The contract snapshots the registered payout payload and reserves the quoted zZEC.
4. The operator pays native ZEC to the snapshotted address.
5. The operator records a nonzero settlement proof and receives the reserved zZEC.

This path is explicitly trusted and asynchronous. If the operator does not settle by the
claim's fixed deadline, the holder can cancel and recover the locked ZBNK. Cancellation remains
available while new redemptions are paused.

## Eligible supply

Pons-issued tokens expose a standard ERC-20 interface but no holder burn function. The alpha
contracts therefore use permanent retirement:

`eligible supply = ERC-20 total supply − redemption-locked ZBNK − retirement-address ZBNK`

Treasury buybacks move purchased ZBNK to the inaccessible canonical retirement address.
Redemption locks ZBNK in a contract with no ZBNK rescue function. Both leave eligible supply
permanently unless an unsettled native claim is cancelled.

## Deployment

`script/DeployTokenEconomics.s.sol` requires:

- `DEPLOYER_PRIVATE_KEY`
- `ZBNK_ADDRESS` — canonical Pons token, verified onchain
- `OWNER` — protocol Safe
- `NATIVE_OPERATOR`

Optional configuration includes the settlement recipient, 1–30 day claim timeout, and the
treasury/retirement/reserve allocation. The alpha defaults are 50/30/20 and seven days.

The script deploys `PayoutRegistry`, `ZBankTreasury`, and `ZBankRedemption`. Both redemption
modes start disabled.

## Activation gates

Before either mode is enabled:

1. Verify the Pons token address, symbol, decimals, supply, and transfer behavior.
2. Verify owner, operator, settlement recipient, claim timeout, and revenue allocation.
3. Fund the redemption contract with real zZEC.
4. Reproduce all unit tests and a mainnet-fork lifecycle test.
5. Publish every address and mark the interface **Pre-audit alpha**.
6. Run one small direct redemption and one native claim/cancellation drill.
7. Keep the public vulnerability-reporting channel and emergency pause path monitored.
