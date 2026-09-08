// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPriceOracle} from "../src/oracle/IPriceOracle.sol";

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24 spacing);
}

interface IUniswapV3PoolState {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96)
        external
        payable
        returns (address pool);

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

/// @title SeedZzecUsdgPool
/// @notice Creates the missing zZEC/USDG Uniswap v3 market at the live Chainlink oracle
///         price and mints an initial full-range position owned by the protocol Safe.
/// @dev This script cannot manufacture market depth: the broadcaster must hold and approve
///      real zZEC and USDG. Explicit minimum-used amounts prevent accidental one-sided or
///      badly-priced initialization.
contract SeedZzecUsdgPool is Script {
    struct SeedConfig {
        uint24 fee;
        uint256 zzecDesired;
        uint256 usdgDesired;
        uint256 zzecMin;
        uint256 usdgMin;
        address liquidityOwner;
        address token0;
        address token1;
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
    }

    address internal constant ZZEC = 0x0b151Ff7a7c5250130EC16C275790961d558E402;
    address internal constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    address internal constant ORACLE = 0x931F6295bf6aB9Dc02997a03b4ba85Aca9373AF5;
    address internal constant FACTORY = 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA;
    address internal constant POSITION_MANAGER = 0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3;

    uint256 internal constant Q192 = 1 << 192;
    int24 internal constant MIN_TICK = -887272;
    int24 internal constant MAX_TICK = 887272;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        SeedConfig memory config;
        config.fee = uint24(vm.envOr("POOL_FEE", uint256(3000)));
        config.zzecDesired = vm.envUint("ZZEC_AMOUNT");
        config.usdgDesired = vm.envUint("USDG_AMOUNT");
        config.zzecMin = vm.envUint("MIN_ZZEC_USED");
        config.usdgMin = vm.envUint("MIN_USDG_USED");
        config.liquidityOwner = vm.envAddress("LIQUIDITY_OWNER");

        require(config.zzecDesired > 0 && config.usdgDesired > 0, "seed: both assets required");
        require(config.zzecMin > 0 && config.usdgMin > 0, "seed: explicit minimums required");
        require(
            config.zzecMin <= config.zzecDesired && config.usdgMin <= config.usdgDesired,
            "seed: minimum exceeds desired"
        );
        require(config.liquidityOwner != address(0), "seed: zero owner");
        require(IERC20(ZZEC).balanceOf(deployer) >= config.zzecDesired, "seed: insufficient zZEC");
        require(IERC20(USDG).balanceOf(deployer) >= config.usdgDesired, "seed: insufficient USDG");

        int24 spacing = IUniswapV3Factory(FACTORY).feeAmountTickSpacing(config.fee);
        require(spacing > 0, "seed: unsupported fee");

        // The oracle reverts if its report is missing or stale. Never initialize from a
        // manually typed price.
        uint256 zecPriceWad = IPriceOracle(ORACLE).priceUsd();
        (config.token0, config.token1) = ZZEC < USDG ? (ZZEC, USDG) : (USDG, ZZEC);
        config.sqrtPriceX96 = _sqrtPriceX96(config.token0, zecPriceWad);
        config.tickLower = (MIN_TICK / spacing) * spacing;
        config.tickUpper = (MAX_TICK / spacing) * spacing;

        // If someone initialized the pool first, refuse to add liquidity unless its square-root
        // price remains close to the oracle-derived value. 50 bps in sqrt space is roughly 1%
        // in price space.
        address existingPool = IUniswapV3Factory(FACTORY).getPool(ZZEC, USDG, config.fee);
        if (existingPool != address(0)) {
            (uint160 currentSqrtPriceX96,,,,,,) = IUniswapV3PoolState(existingPool).slot0();
            uint256 deviationBps = currentSqrtPriceX96 > config.sqrtPriceX96
                ? Math.mulDiv(currentSqrtPriceX96 - config.sqrtPriceX96, 10_000, config.sqrtPriceX96)
                : Math.mulDiv(config.sqrtPriceX96 - currentSqrtPriceX96, 10_000, config.sqrtPriceX96);
            require(
                deviationBps <= vm.envOr("MAX_SQRT_DEVIATION_BPS", uint256(50)),
                "seed: existing pool price diverges from oracle"
            );
        }

        vm.startBroadcast(deployerKey);
        (address pool, uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = _seed(config);
        IERC20(ZZEC).approve(POSITION_MANAGER, 0);
        IERC20(USDG).approve(POSITION_MANAGER, 0);
        vm.stopBroadcast();

        console2.log("zZEC/USDG pool:", pool);
        console2.log("LP NFT token id:", tokenId);
        console2.log("Liquidity:", uint256(liquidity));
        console2.log("Token0 used:", amount0);
        console2.log("Token1 used:", amount1);
        console2.log("Oracle ZEC/USD (1e18):", zecPriceWad);
        console2.log("LP owner:", config.liquidityOwner);
    }

    function _seed(SeedConfig memory config)
        internal
        returns (address pool, uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        pool = INonfungiblePositionManager(POSITION_MANAGER)
            .createAndInitializePoolIfNecessary(config.token0, config.token1, config.fee, config.sqrtPriceX96);
        IERC20(ZZEC).approve(POSITION_MANAGER, config.zzecDesired);
        IERC20(USDG).approve(POSITION_MANAGER, config.usdgDesired);
        (tokenId, liquidity, amount0, amount1) = INonfungiblePositionManager(POSITION_MANAGER)
            .mint(
                INonfungiblePositionManager.MintParams({
                token0: config.token0,
                token1: config.token1,
                fee: config.fee,
                tickLower: config.tickLower,
                tickUpper: config.tickUpper,
                amount0Desired: config.token0 == ZZEC ? config.zzecDesired : config.usdgDesired,
                amount1Desired: config.token0 == ZZEC ? config.usdgDesired : config.zzecDesired,
                amount0Min: config.token0 == ZZEC ? config.zzecMin : config.usdgMin,
                amount1Min: config.token0 == ZZEC ? config.usdgMin : config.zzecMin,
                recipient: config.liquidityOwner,
                deadline: block.timestamp + 10 minutes
            })
            );
    }

    function _sqrtPriceX96(address token0, uint256 zecPriceWad) internal pure returns (uint160) {
        // zZEC has 8 decimals and USDG has 6. Uniswap encodes raw token1/token0.
        uint256 ratioX192 = token0 == ZZEC ? Math.mulDiv(zecPriceWad, Q192, 1e20) : Math.mulDiv(1e20, Q192, zecPriceWad);
        uint256 result = Math.sqrt(ratioX192);
        require(result > 0 && result <= type(uint160).max, "seed: invalid sqrt price");
        return uint160(result);
    }
}
