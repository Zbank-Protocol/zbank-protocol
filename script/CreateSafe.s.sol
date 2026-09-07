// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes memory initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafeSetup {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;
}

/// @title CreateSafe — the protocol multisig on Robinhood Chain
/// @notice Safe v1.4.1 is deployed on Robinhood Chain at its canonical addresses (verified
///         onchain 2026-09-07). This script creates the protocol Safe through the canonical
///         factory — no UI dependency, works on any chain the singletons exist on.
///
///         Required environment:
///           SAFE_OWNERS     comma-separated owner addresses (hardware keys, ≥3 recommended)
///           SAFE_THRESHOLD  signatures required (e.g. 2 for a 2-of-3)
///
///         Usage:
///           SAFE_OWNERS=0xA...,0xB...,0xC... SAFE_THRESHOLD=2 \
///           forge script script/CreateSafe.s.sol --rpc-url robinhood --broadcast
contract CreateSafe is Script {
    // Safe v1.4.1 canonical deployment (same addresses across chains).
    address constant PROXY_FACTORY = 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67;
    address constant SINGLETON_L2 = 0x29fcB43b46531BcA003ddC8FCB67FFE91900C762;
    address constant FALLBACK_HANDLER = 0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99;

    function run() external {
        address[] memory owners = vm.envAddress("SAFE_OWNERS", ",");
        uint256 threshold = vm.envUint("SAFE_THRESHOLD");
        require(owners.length >= 2, "safe: need at least 2 owners");
        require(threshold >= 2 && threshold <= owners.length, "safe: bad threshold");

        bytes memory initializer = abi.encodeCall(
            ISafeSetup.setup, (owners, threshold, address(0), "", FALLBACK_HANDLER, address(0), 0, payable(address(0)))
        );

        vm.startBroadcast();
        address safe = ISafeProxyFactory(PROXY_FACTORY)
            .createProxyWithNonce(SINGLETON_L2, initializer, uint256(keccak256("zbank.protocol.safe.v1")));
        vm.stopBroadcast();

        console2.log("Protocol Safe:", safe);
        console2.log("Owners:", owners.length, "Threshold:", threshold);
        console2.log("Use this address as MULTISIG for script/Deploy.s.sol");
    }
}
