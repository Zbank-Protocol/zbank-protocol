// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPriceOracle} from "./oracle/IPriceOracle.sol";

interface IPonsFeeEscrow {
    function claimToken(address token) external;
}

interface ILiquidityFactory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function feeAmountTickSpacing(uint24 fee) external view returns (int24 spacing);
}

interface ILiquidityPool {
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

interface ILiquidityPositionManager {
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

    function mint(MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

interface IRevenueTreasury {
    function bucketIdle(address asset) external;
}

/// @title PonsFeeLiquidityManager
/// @notice PRE-AUDIT ALPHA. Claims ZBNK creator fees paid in USDG and routes a configured share
///         into one-sided zZEC/USDG liquidity. The remainder enters ZBankTreasury.
/// @dev The one-sided position sits immediately below spot when zZEC is token0. It supplies USDG
///      to zZEC sellers and acquires zZEC as the market trades downward. Every LP NFT is minted
///      directly to the protocol Safe; this contract never owns user or protocol LP positions.
contract PonsFeeLiquidityManager is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Infrastructure {
        address zzec;
        address usdg;
        address feeEscrow;
        address factory;
        address positionManager;
        address oracle;
    }

    struct FundingConfig {
        uint24 poolFee;
        uint16 liquidityBps;
        int24 rangeWidth;
        uint16 maxSqrtDeviationBps;
        uint16 minUseBps;
    }

    uint256 private constant Q192 = 1 << 192;
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = 887272;

    error InvalidConfiguration();
    error TreasuryNotSet();
    error PoolNotInitialized();
    error NoFeesAvailable();
    error PoolPriceDiverged(uint256 deviationBps, uint256 maximumBps);
    error RangeOutsideTickBounds();

    event TreasurySet(address indexed treasury);
    event FundingConfigSet(uint16 liquidityBps, int24 rangeWidth, uint16 maxSqrtDeviationBps, uint16 minUseBps);
    event FeesFunded(
        address indexed caller,
        uint256 feesClaimed,
        uint256 usdgToLiquidity,
        uint256 usdgToTreasury,
        uint256 indexed tokenId,
        uint128 liquidity,
        int24 tickLower,
        int24 tickUpper
    );

    IERC20 public immutable zzec;
    IERC20 public immutable usdg;
    IPonsFeeEscrow public immutable feeEscrow;
    ILiquidityFactory public immutable factory;
    ILiquidityPositionManager public immutable positionManager;
    IPriceOracle public immutable oracle;
    address public immutable liquidityOwner;
    uint24 public immutable poolFee;
    int24 public immutable tickSpacing;

    address public treasury;
    uint16 public liquidityBps;
    int24 public rangeWidth;
    uint16 public maxSqrtDeviationBps;
    uint16 public minUseBps;
    uint256 public totalFeesClaimed;
    uint256 public totalUsdgFunded;
    uint256 public totalUsdgToTreasury;

    constructor(
        Infrastructure memory infrastructure,
        address owner_,
        address liquidityOwner_,
        FundingConfig memory config
    ) Ownable(owner_) {
        if (
            infrastructure.zzec == address(0) || infrastructure.usdg == address(0)
                || infrastructure.feeEscrow == address(0) || infrastructure.factory == address(0)
                || infrastructure.positionManager == address(0) || infrastructure.oracle == address(0)
                || liquidityOwner_ == address(0)
        ) revert InvalidConfiguration();
        int24 spacing = ILiquidityFactory(infrastructure.factory).feeAmountTickSpacing(config.poolFee);
        if (spacing <= 0) revert InvalidConfiguration();

        zzec = IERC20(infrastructure.zzec);
        usdg = IERC20(infrastructure.usdg);
        feeEscrow = IPonsFeeEscrow(infrastructure.feeEscrow);
        factory = ILiquidityFactory(infrastructure.factory);
        positionManager = ILiquidityPositionManager(infrastructure.positionManager);
        oracle = IPriceOracle(infrastructure.oracle);
        liquidityOwner = liquidityOwner_;
        poolFee = config.poolFee;
        tickSpacing = spacing;
        _setFundingConfig(config.liquidityBps, config.rangeWidth, config.maxSqrtDeviationBps, config.minUseBps);
    }

    /// @notice Claims USDG creator fees credited to this contract by the Pons fee escrow and
    ///         atomically processes them. Permissionless so no keeper is a liveness dependency.
    function harvestAndFund() external nonReentrant whenNotPaused returns (uint256 tokenId) {
        uint256 balanceBefore = usdg.balanceOf(address(this));
        feeEscrow.claimToken(address(usdg));
        uint256 claimed = usdg.balanceOf(address(this)) - balanceBefore;
        if (claimed == 0) revert NoFeesAvailable();
        totalFeesClaimed += claimed;
        return _fund(balanceBefore + claimed, claimed);
    }

    /// @notice Processes USDG donated directly or left after a previous operation.
    function fundAvailable() external nonReentrant whenNotPaused returns (uint256 tokenId) {
        uint256 available = usdg.balanceOf(address(this));
        if (available == 0) revert NoFeesAvailable();
        return _fund(available, 0);
    }

    function currentPool() public view returns (address) {
        return factory.getPool(address(zzec), address(usdg), poolFee);
    }

    function expectedSqrtPriceX96() public view returns (uint160) {
        return _sqrtPriceX96(address(zzec) < address(usdg), oracle.priceUsd());
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidConfiguration();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setFundingConfig(uint16 liquidityBps_, int24 rangeWidth_, uint16 maxSqrtDeviationBps_, uint16 minUseBps_)
        external
        onlyOwner
    {
        _setFundingConfig(liquidityBps_, rangeWidth_, maxSqrtDeviationBps_, minUseBps_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _fund(uint256 available, uint256 claimed) private returns (uint256 tokenId) {
        address treasury_ = treasury;
        if (treasury_ == address(0)) revert TreasuryNotSet();
        int24 currentTick = _validatedPool();

        uint256 toLiquidity = Math.mulDiv(available, liquidityBps, 10_000);
        if (toLiquidity == 0) revert NoFeesAvailable();
        uint256 toTreasury = available - toLiquidity;
        if (toTreasury > 0) {
            usdg.safeTransfer(treasury_, toTreasury);
            IRevenueTreasury(treasury_).bucketIdle(address(usdg));
            totalUsdgToTreasury += toTreasury;
        }

        uint128 liquidity;
        uint256 used;
        int24 tickLower;
        int24 tickUpper;
        (tokenId, liquidity, used, tickLower, tickUpper) = _mintLiquidity(toLiquidity, currentTick);
        totalUsdgFunded += used;

        emit FeesFunded(msg.sender, claimed, used, toTreasury, tokenId, liquidity, tickLower, tickUpper);
    }

    function _mintLiquidity(uint256 amount, int24 currentTick)
        private
        returns (uint256 tokenId, uint128 liquidity, uint256 used, int24 tickLower, int24 tickUpper)
    {
        (tickLower, tickUpper) = _oneSidedRange(currentTick);
        address token0 = address(zzec) < address(usdg) ? address(zzec) : address(usdg);
        bool usdgIsToken0 = token0 == address(usdg);
        uint256 minimumUsed = Math.mulDiv(amount, minUseBps, 10_000);
        ILiquidityPositionManager.MintParams memory params;
        params.token0 = token0;
        params.token1 = token0 == address(zzec) ? address(usdg) : address(zzec);
        params.fee = poolFee;
        params.tickLower = tickLower;
        params.tickUpper = tickUpper;
        params.amount0Desired = usdgIsToken0 ? amount : 0;
        params.amount1Desired = usdgIsToken0 ? 0 : amount;
        params.amount0Min = usdgIsToken0 ? minimumUsed : 0;
        params.amount1Min = usdgIsToken0 ? 0 : minimumUsed;
        params.recipient = liquidityOwner;
        params.deadline = block.timestamp;

        usdg.forceApprove(address(positionManager), amount);
        uint256 amount0;
        uint256 amount1;
        (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);
        usdg.forceApprove(address(positionManager), 0);
        used = usdgIsToken0 ? amount0 : amount1;
    }

    function _validatedPool() private view returns (int24 currentTick) {
        address pool = currentPool();
        if (pool == address(0)) revert PoolNotInitialized();
        (uint160 currentSqrtPriceX96, int24 tick,,,,,) = ILiquidityPool(pool).slot0();
        if (currentSqrtPriceX96 == 0) revert PoolNotInitialized();
        uint160 expected = expectedSqrtPriceX96();
        uint256 deviationBps = currentSqrtPriceX96 > expected
            ? Math.mulDiv(currentSqrtPriceX96 - expected, 10_000, expected)
            : Math.mulDiv(expected - currentSqrtPriceX96, 10_000, expected);
        if (deviationBps > maxSqrtDeviationBps) {
            revert PoolPriceDiverged(deviationBps, maxSqrtDeviationBps);
        }
        currentTick = tick;
    }

    function _oneSidedRange(int24 currentTick) private view returns (int24 tickLower, int24 tickUpper) {
        int24 floor = _floorTick(currentTick);
        if (address(usdg) > address(zzec)) {
            // USDG is token1: a range below spot contains only token1.
            tickUpper = floor >= currentTick ? floor - tickSpacing : floor;
            tickLower = tickUpper - rangeWidth;
            if (tickLower < _minUsableTick()) revert RangeOutsideTickBounds();
        } else {
            // USDG is token0: a range above spot contains only token0.
            tickLower = floor <= currentTick ? floor + tickSpacing : floor;
            tickUpper = tickLower + rangeWidth;
            if (tickUpper > _maxUsableTick()) revert RangeOutsideTickBounds();
        }
    }

    function _floorTick(int24 tick) private view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) --compressed;
        return compressed * tickSpacing;
    }

    function _minUsableTick() private view returns (int24) {
        return (MIN_TICK / tickSpacing) * tickSpacing;
    }

    function _maxUsableTick() private view returns (int24) {
        return (MAX_TICK / tickSpacing) * tickSpacing;
    }

    function _setFundingConfig(uint16 liquidityBps_, int24 rangeWidth_, uint16 maxSqrtDeviationBps_, uint16 minUseBps_)
        private
    {
        if (
            liquidityBps_ < 1_000 || liquidityBps_ > 9_000 || rangeWidth_ < tickSpacing * 10
                || rangeWidth_ > tickSpacing * 200 || rangeWidth_ % tickSpacing != 0 || maxSqrtDeviationBps_ == 0
                || maxSqrtDeviationBps_ > 500 || minUseBps_ < 9_500 || minUseBps_ > 10_000
        ) revert InvalidConfiguration();
        liquidityBps = liquidityBps_;
        rangeWidth = rangeWidth_;
        maxSqrtDeviationBps = maxSqrtDeviationBps_;
        minUseBps = minUseBps_;
        emit FundingConfigSet(liquidityBps_, rangeWidth_, maxSqrtDeviationBps_, minUseBps_);
    }

    function _sqrtPriceX96(bool zzecIsToken0, uint256 zecPriceWad) private pure returns (uint160) {
        uint256 ratioX192 = zzecIsToken0 ? Math.mulDiv(zecPriceWad, Q192, 1e20) : Math.mulDiv(1e20, Q192, zecPriceWad);
        uint256 result = Math.sqrt(ratioX192);
        if (result == 0 || result > type(uint160).max) revert InvalidConfiguration();
        return uint160(result);
    }
}
