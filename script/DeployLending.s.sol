// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {ZecUsdDataStreamFeed} from "../src/oracle/ZecUsdDataStreamFeed.sol";
import {ZCredit} from "../src/ZCredit.sol";

/// @title DeployLending — the ZCREDIT lending market on Robinhood Chain mainnet
/// @notice The lean launch: ZEC/USD Data Streams oracle + the credit market. Treasury and
///         invest router deploy separately once the token launch and venue adapter exist.
///
///         Ownership: OWNER env, defaulting to the deployer. Single-EOA ownership is a
///         documented launch-phase compromise (sole developer) — recorded in SECURITY.md,
///         to be migrated to a Safe (script/CreateSafe.s.sol) as soon as co-signers exist.
///         The owner's powers are bounded onchain either way: parameter rails, reserve-only
///         sweeps, pause that never blocks repay/withdraw.
///
///         Usage:
///           forge script script/DeployLending.s.sol --rpc-url robinhood --broadcast --verify
contract DeployLending is Script {
    // Verified Robinhood Chain mainnet addresses (2026-09-07). See SECURITY.md.
    address constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address constant STREAM_VERIFIER = 0xcE73c8ad08CBDEaCa6078BF0627C8fe0a9a536E7;
    bytes32 constant STREAM_FEED_ID =
        0x00039f8a144f4a62715ca60aec1cf848c4821375c57e2259c6c90b7fa49db693;

    function run() external {
        vm.startBroadcast();

        ZecUsdDataStreamFeed oracle = new ZecUsdDataStreamFeed(
            STREAM_VERIFIER,
            STREAM_FEED_ID,
            vm.envOr("ORACLE_MAX_AGE", uint256(30 minutes)),
            vm.envOr("SEQUENCER_FEED", address(0))
        );

        address owner = vm.envOr("OWNER", msg.sender);
        ZCredit market = new ZCredit(ZZEC, USDG, address(oracle), owner);

        vm.stopBroadcast();

        console2.log("ZecUsdDataStreamFeed:", address(oracle));
        console2.log("ZCredit:             ", address(market));
        console2.log("Owner:               ", owner);
        console2.log("Set web/src/config/protocol.ts -> PROTOCOL_CONTRACTS.creditMarket");
        console2.log("and ORACLES.zecUsd.address, then start the relayer (scripts/relayer).");
    }
}
