// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {InvestRouter} from "../src/InvestRouter.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";

interface IV3FactoryPoolLookup {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/// @title DeployZecInvest
/// @notice Deploys the direct zZEC -> USDG -> Stock Token execution path only after the
///         zZEC/USDG pool exists and has both assets. Configures all current ZINDEX routes,
///         transfers adapter ownership to the protocol Safe, and deploys InvestRouter.
contract DeployZecInvest is Script {
    address internal constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address internal constant V3_FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address internal constant SWAP_ROUTER_02 = 0xCaf681a66D020601342297493863E78C959E5cb2;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address owner = vm.envAddress("OWNER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint16 protocolFeeBps = uint16(vm.envOr("INVEST_FEE_BPS", uint256(0)));
        uint24 zzecUsdgFee = uint24(vm.envOr("ZZEC_USDG_FEE", uint256(3000)));

        require(owner != address(0) && feeRecipient != address(0), "deploy: zero address");
        address pool = IV3FactoryPoolLookup(V3_FACTORY).getPool(ZZEC, USDG, zzecUsdgFee);
        require(pool != address(0), "deploy: zZEC/USDG pool missing");
        require(
            IERC20(ZZEC).balanceOf(pool) > 0 && IERC20(USDG).balanceOf(pool) > 0, "deploy: zZEC/USDG pool not funded"
        );

        (address[12] memory tokens, uint24[12] memory fees) = _stockUniverse();

        vm.startBroadcast(deployerKey);
        UniswapV3Adapter adapter = new UniswapV3Adapter(deployer, SWAP_ROUTER_02);
        for (uint256 i = 0; i < tokens.length; i++) {
            adapter.setRoute(USDG, tokens[i], abi.encodePacked(USDG, fees[i], tokens[i]));
            adapter.setRoute(ZZEC, tokens[i], abi.encodePacked(ZZEC, zzecUsdgFee, USDG, fees[i], tokens[i]));
        }
        adapter.transferOwnership(owner);
        InvestRouter router = new InvestRouter(owner, address(adapter), protocolFeeBps, feeRecipient);
        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("zZEC/USDG pool:", pool);
        console2.log("UniswapV3Adapter:", address(adapter));
        console2.log("InvestRouter:", address(router));
        console2.log("Owner:", owner);
        console2.log("Fee recipient:", feeRecipient);
        console2.log("Set PROTOCOL_CONTRACTS.investRouter and UNISWAP.zzecUsdgPool in the web config.");
    }

    function _stockUniverse() internal pure returns (address[12] memory tokens, uint24[12] memory fees) {
        tokens = [
            0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, // NVDA
            0x117cc2133c37B721F49dE2A7a74833232B3B4C0C, // SPY
            0xD5f3879160bc7c32ebb4dC785F8a4F505888de68, // QQQ
            0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3, // GOOGL
            0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9, // AAPL
            0x92FD66527192E3e61d4DDd13322Aa222DE86F9B5, // SGOV
            0xe93237C50D904957Cf27E7B1133b510C669c2e74, // MSFT
            0x322F0929c4625eD5bAd873c95208D54E1c003b2d, // TSLA
            0x12f190a9F9d7D37a250758b26824B97CE941bF54, // AMZN
            0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35, // META
            0x1b0E319c6A659F002271B69dB8A7df2F911c153E, // GME
            0xCceE82fE024c36fA15E1005edE3E9e4787e23D09 // HIMS
        ];
        fees = [uint24(500), 3000, 500, 500, 500, 3000, 3000, 3000, 3000, 3000, 500, 3000];
    }
}
