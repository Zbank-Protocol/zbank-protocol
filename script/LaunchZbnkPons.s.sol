// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";

interface IPonsV2LaunchFactory {
    struct Socials {
        string twitter;
        string telegram;
        string discord;
        string website;
        string farcaster;
    }

    struct TokenParams {
        string name;
        string symbol;
        string logo;
        string description;
        Socials socials;
        address creatorFeeRecipient;
        uint16 creatorTaxBps;
        bool buybackEnabled;
        bytes32 expectedEconomics;
        bytes32 salt;
    }

    struct LaunchConfig {
        uint256 supply;
        uint256 curveFeeBps;
        uint256 phantomQuote;
        uint256 graduationThreshold;
        uint24 poolFee;
        int24 tickSpacing;
        bool enabled;
    }

    function launchEnabled() external view returns (bool);
    function canLaunch(address account) external view returns (bool);
    function launchFee() external view returns (uint256);
    function maxCreatorTaxBps() external view returns (uint256);
    function approvedPairTokens(address pairToken) external view returns (bool);
    function getLaunchConfig(uint256 id) external view returns (LaunchConfig memory);
    function previewLaunchEconomics(uint256 launchConfigId, address pairToken) external view returns (bytes32);
    function launchToken(TokenParams calldata params, uint256 launchConfigId, address pairToken)
        external
        payable
        returns (address token, address curve);
}

interface IPonsFeeRouterConfig {
    function quoteAsset() external view returns (address);
    function feeEscrow() external view returns (address);
    function ponsFactory() external view returns (address);
    function owner() external view returns (address);
    function manager() external view returns (address);
}

/// @title LaunchZbnkPons
/// @notice Launches ZBNK only if the deployed Pons terms still match the reviewed 3%-total-fee
///         configuration. Run without --broadcast first; broadcast only after checking the
///         simulation receipt and predicted addresses.
contract LaunchZbnkPons is Script {
    address internal constant PONS_FACTORY = 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
    address internal constant PONS_FEE_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address internal constant PROTOCOL_SAFE = 0x31837999D9E463B2EB4327CEb4BD7CCa2a500480;
    address internal constant DEPLOYED_MANAGER = 0x082B87D21A5F840De52F2c154aC4132E3C365295;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    IPonsV2LaunchFactory internal constant PONS = IPonsV2LaunchFactory(PONS_FACTORY);

    uint256 internal constant LAUNCH_CONFIG_ID = 0;
    uint256 internal constant EXPECTED_LAUNCH_FEE = 0.0005 ether;
    uint256 internal constant EXPECTED_PONS_BASE_FEE_BPS = 100;
    uint16 internal constant ZBANK_CREATOR_TAX_BPS = 200;
    uint256 internal constant TOTAL_TRADER_FEE_BPS = EXPECTED_PONS_BASE_FEE_BPS + ZBANK_CREATOR_TAX_BPS;
    bool internal constant PONS_BUYBACK_ENABLED = false;
    bytes32 internal constant EXPECTED_ECONOMICS = 0x7909a028ec0fee3564b05d53b74cd91d79786f17ac5aa90be360c0b78201e86a;

    error LaunchTermsChanged();
    error LauncherNotAllowed();
    error InvalidFeeRouter();

    function run() external returns (address token, address curve) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address launcher = vm.addr(deployerKey);
        address feeRouter = vm.envAddress("PONS_FEE_ROUTER");
        bytes32 salt = vm.envBytes32("PONS_LAUNCH_SALT");
        if (feeRouter == address(0) || feeRouter.code.length == 0) revert InvalidFeeRouter();
        IPonsFeeRouterConfig router = IPonsFeeRouterConfig(feeRouter);
        if (
            router.quoteAsset() != USDG || router.feeEscrow() != PONS_FEE_ESCROW || router.ponsFactory() != PONS_FACTORY
                || router.owner() != PROTOCOL_SAFE || router.manager() != DEPLOYED_MANAGER
        ) revert InvalidFeeRouter();

        IPonsV2LaunchFactory.LaunchConfig memory config = PONS.getLaunchConfig(LAUNCH_CONFIG_ID);
        bytes32 currentEconomics = PONS.previewLaunchEconomics(LAUNCH_CONFIG_ID, USDG);
        if (
            !PONS.launchEnabled() || !PONS.approvedPairTokens(USDG) || !config.enabled
                || PONS.launchFee() != EXPECTED_LAUNCH_FEE || config.curveFeeBps != EXPECTED_PONS_BASE_FEE_BPS
                || PONS.maxCreatorTaxBps() < ZBANK_CREATOR_TAX_BPS || TOTAL_TRADER_FEE_BPS != 300
                || currentEconomics != EXPECTED_ECONOMICS
        ) revert LaunchTermsChanged();
        if (!PONS.canLaunch(launcher)) revert LauncherNotAllowed();

        IPonsV2LaunchFactory.TokenParams memory params = IPonsV2LaunchFactory.TokenParams({
            name: "ZBANK",
            symbol: "ZBNK",
            logo: vm.envString("PONS_LOGO_URL"),
            description: "Capital markets for Zcash on Robinhood Chain.",
            socials: IPonsV2LaunchFactory.Socials({
                twitter: "https://x.com/zbankworld",
                telegram: vm.envOr("PONS_TELEGRAM_URL", string("")),
                discord: vm.envOr("PONS_DISCORD_URL", string("")),
                website: "https://zbank.world",
                farcaster: vm.envOr("PONS_FARCASTER_URL", string(""))
            }),
            creatorFeeRecipient: feeRouter,
            creatorTaxBps: ZBANK_CREATOR_TAX_BPS,
            buybackEnabled: PONS_BUYBACK_ENABLED,
            expectedEconomics: EXPECTED_ECONOMICS,
            salt: salt
        });

        console2.log("Launcher:", launcher);
        console2.log("Creator fee router:", feeRouter);
        console2.log("Pons base fee (bps):", EXPECTED_PONS_BASE_FEE_BPS);
        console2.log("ZBANK creator tax (bps):", ZBANK_CREATOR_TAX_BPS);
        console2.log("Total trader fee (bps):", TOTAL_TRADER_FEE_BPS);
        console2.log("Pons buyback enabled:", PONS_BUYBACK_ENABLED);
        console2.logBytes32(EXPECTED_ECONOMICS);

        vm.startBroadcast(deployerKey);
        (token, curve) = PONS.launchToken{value: EXPECTED_LAUNCH_FEE}(params, LAUNCH_CONFIG_ID, USDG);
        vm.stopBroadcast();

        console2.log("Canonical ZBNK:", token);
        console2.log("Pons bonding curve:", curve);
    }
}
