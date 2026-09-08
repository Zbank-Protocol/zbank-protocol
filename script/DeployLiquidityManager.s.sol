// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PonsFeeLiquidityManager} from "../src/PonsFeeLiquidityManager.sol";

/// @title DeployLiquidityManager
/// @notice Deploys the PRE-AUDIT ALPHA creator-fee recipient before the Pons ZBNK launch.
///         Use the resulting address as `TokenParams.creatorFeeRecipient`.
contract DeployLiquidityManager is Script {
    address internal constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address internal constant PONS_FEE_ESCROW = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address internal constant UNISWAP_V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address internal constant POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;
    address internal constant ZEC_USD_ORACLE = 0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address owner = vm.envAddress("OWNER");
        address liquidityOwner = vm.envOr("LIQUIDITY_OWNER", owner);

        PonsFeeLiquidityManager.Infrastructure memory infrastructure = PonsFeeLiquidityManager.Infrastructure({
            zzec: ZZEC,
            usdg: USDG,
            feeEscrow: PONS_FEE_ESCROW,
            factory: UNISWAP_V3_FACTORY,
            positionManager: POSITION_MANAGER,
            oracle: ZEC_USD_ORACLE
        });
        PonsFeeLiquidityManager.FundingConfig memory config = PonsFeeLiquidityManager.FundingConfig({
            poolFee: uint24(vm.envOr("POOL_FEE", uint256(3000))),
            liquidityBps: uint16(vm.envOr("LIQUIDITY_BPS", uint256(5000))),
            rangeWidth: int24(int256(vm.envOr("RANGE_WIDTH_TICKS", uint256(1800)))),
            maxSqrtDeviationBps: uint16(vm.envOr("MAX_SQRT_DEVIATION_BPS", uint256(50))),
            minUseBps: uint16(vm.envOr("MIN_USE_BPS", uint256(9950)))
        });

        vm.startBroadcast(deployerKey);
        PonsFeeLiquidityManager manager = new PonsFeeLiquidityManager(infrastructure, owner, liquidityOwner, config);
        vm.stopBroadcast();

        console2.log("PRE-AUDIT ALPHA Pons creator-fee recipient:", address(manager));
        console2.log("Owner / LP NFT owner:", owner);
        console2.log("Creator fees routed to liquidity:", config.liquidityBps);
        console2.log("Treasury: NOT SET until canonical ZBNK economics deploy");
    }
}
