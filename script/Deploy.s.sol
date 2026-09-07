// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ZBNK} from "../src/ZBNK.sol";
import {ZBankTreasury} from "../src/ZBankTreasury.sol";
import {ChainlinkOracleAdapter} from "../src/oracle/ChainlinkOracleAdapter.sol";
import {ZecUsdDataStreamFeed} from "../src/oracle/ZecUsdDataStreamFeed.sol";
import {ZCredit} from "../src/ZCredit.sol";
import {InvestRouter} from "../src/InvestRouter.sol";
import {PayoutRegistry} from "../src/PayoutRegistry.sol";

/// @title Deploy — the full ZBANK stack on Robinhood Chain
/// @notice Reads its blocking inputs from the environment on purpose: every one of them is a
///         Phase 0 decision from docs/launch-checklist.md, and this script refusing to run
///         without them is the enforcement mechanism.
///
///         Required environment:
///           MULTISIG          protocol multisig (create it with script/CreateSafe.s.sol)
///           SWAP_ADAPTER      venue adapter for the invest router (Phase 3)
///           INVEST_FEE_BPS    execution fee (decision 0.6, hard-capped at 200)
///           ZBNK_ADDRESS      optional: existing token (e.g. Pons launch). If unset, deploys ZBNK.
///
///         Optional overrides (defaults are the verified Robinhood Chain mainnet values):
///           WZEC              ZEC representation      (default: ZEAL zZEC)
///           USDG              USDG                    (default: official Robinhood Chain USDG)
///           STREAM_VERIFIER   Data Streams verifier   (default: per docs.robinhood.com)
///           STREAM_FEED_ID    ZEC/USD stream feed id  (default: RefPrice-DS-Premium-Global-003)
///           ORACLE_MAX_AGE    staleness bound seconds (default: 1800)
///           AGGREGATOR_FEED   set to use a push AggregatorV3 feed instead of Data Streams
///
///         Usage:
///           forge script script/Deploy.s.sol --rpc-url robinhood --broadcast
contract Deploy is Script {
    // Verified on Robinhood Chain mainnet, 2026-09-07. Sources: docs.robinhood.com/chain
    // (USDG, verifier), zealtoken.com + onchain reads (zZEC), Chainlink RDD (feed id).
    address constant DEFAULT_ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address constant DEFAULT_USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant DEFAULT_STREAM_VERIFIER = 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7;
    bytes32 constant DEFAULT_STREAM_FEED_ID = 0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693;

    function run() external {
        address multisig = vm.envAddress("MULTISIG");
        address wzec = vm.envOr("WZEC", DEFAULT_ZZEC);
        address usdg = vm.envOr("USDG", DEFAULT_USDG);
        uint256 maxAge = vm.envOr("ORACLE_MAX_AGE", uint256(30 minutes));
        address adapter = vm.envAddress("SWAP_ADAPTER");
        uint16 investFeeBps = uint16(vm.envUint("INVEST_FEE_BPS"));
        address zbnkAddr = vm.envOr("ZBNK_ADDRESS", address(0));

        vm.startBroadcast();

        // 1. Token — deployed here only if not already launched via Pons.
        if (zbnkAddr == address(0)) {
            zbnkAddr = address(new ZBNK(multisig));
        }

        // 2. Treasury engine. Launch split placeholder 50/30/20 — decision 0.5 finalizes it
        //    (owner can retune before any revenue flows).
        ZBankTreasury treasury = new ZBankTreasury(zbnkAddr, multisig, 5_000, 3_000, 2_000);

        // 3. Oracle with hard staleness rails. Default: Chainlink Data Streams ZEC/USD via the
        //    onchain verifier (no push feed for ZEC exists on this chain). Set AGGREGATOR_FEED
        //    to use a push AggregatorV3 feed instead, if Chainlink ever lists one.
        address aggregatorFeed = vm.envOr("AGGREGATOR_FEED", address(0));
        address sequencerFeed = vm.envOr("SEQUENCER_FEED", address(0));
        address oracle = aggregatorFeed != address(0)
            ? address(new ChainlinkOracleAdapter(aggregatorFeed, maxAge, sequencerFeed))
            : address(
                new ZecUsdDataStreamFeed(
                    vm.envOr("STREAM_VERIFIER", DEFAULT_STREAM_VERIFIER),
                    vm.envOr("STREAM_FEED_ID", DEFAULT_STREAM_FEED_ID),
                    maxAge,
                    sequencerFeed
                )
            );

        // 4. Credit market. Constructor sets development risk parameters — decision 0.4
        //    MUST retune via setRiskParams before the market is announced.
        ZCredit credit = new ZCredit(wzec, usdg, oracle, multisig);

        // 5. Invest router, fees to the treasury engine.
        InvestRouter router = new InvestRouter(multisig, adapter, investFeeBps, address(treasury));

        // 6. Zcash payout registry (t-address claims).
        PayoutRegistry registry = new PayoutRegistry();

        vm.stopBroadcast();

        // The values web/src/config/protocol.ts needs, in one block.
        console2.log("ZBNK:          ", zbnkAddr);
        console2.log("Treasury:      ", address(treasury));
        console2.log("Oracle:        ", address(oracle));
        console2.log("ZCredit:       ", address(credit));
        console2.log("InvestRouter:  ", address(router));
        console2.log("PayoutRegistry:", address(registry));
    }
}
