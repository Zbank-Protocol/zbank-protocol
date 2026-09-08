// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "./mocks/Mocks.sol";
import {PonsFeeLiquidityManager, ILiquidityPositionManager} from "../src/PonsFeeLiquidityManager.sol";

contract MockLiquidityOracle {
    uint256 public price = 50e18;

    function setPrice(uint256 price_) external {
        price = price_;
    }

    function priceUsd() external view returns (uint256) {
        return price;
    }
}

contract MockLiquidityPool {
    uint160 public sqrtPriceX96;
    int24 public tick;

    function set(uint160 sqrtPriceX96_, int24 tick_) external {
        sqrtPriceX96 = sqrtPriceX96_;
        tick = tick_;
    }

    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool) {
        return (sqrtPriceX96, tick, 0, 0, 0, 0, true);
    }
}

contract MockLiquidityFactory {
    address public pool;
    int24 public spacing = 60;

    function setPool(address pool_) external {
        pool = pool_;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }

    function feeAmountTickSpacing(uint24) external view returns (int24) {
        return spacing;
    }
}

contract MockPonsFeeEscrow {
    mapping(address recipient => uint256 amount) public credit;
    IERC20 public immutable usdg;

    constructor(address usdg_) {
        usdg = IERC20(usdg_);
    }

    function addCredit(address recipient, uint256 amount) external {
        credit[recipient] += amount;
    }

    function claimToken(address token) external {
        require(token == address(usdg), "wrong token");
        uint256 amount = credit[msg.sender];
        credit[msg.sender] = 0;
        usdg.transfer(msg.sender, amount);
    }
}

contract MockRevenueTreasury {
    address public lastBucketedAsset;
    uint256 public bucketCalls;

    function bucketIdle(address asset) external {
        lastBucketedAsset = asset;
        ++bucketCalls;
    }
}

contract MockLiquidityPositionManager {
    uint256 public nextTokenId = 1;
    address public lastRecipient;
    int24 public lastTickLower;
    int24 public lastTickUpper;
    uint256 public lastAmount0;
    uint256 public lastAmount1;

    function mint(ILiquidityPositionManager.MintParams calldata params)
        external
        payable
        returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)
    {
        if (params.amount0Desired > 0) {
            IERC20(params.token0).transferFrom(msg.sender, address(this), params.amount0Desired);
        }
        if (params.amount1Desired > 0) {
            IERC20(params.token1).transferFrom(msg.sender, address(this), params.amount1Desired);
        }
        tokenId = nextTokenId++;
        liquidity = uint128(params.amount0Desired + params.amount1Desired);
        amount0 = params.amount0Desired;
        amount1 = params.amount1Desired;
        lastRecipient = params.recipient;
        lastTickLower = params.tickLower;
        lastTickUpper = params.tickUpper;
        lastAmount0 = amount0;
        lastAmount1 = amount1;
    }
}

contract PonsFeeLiquidityManagerTest is Test {
    MockERC20 internal zzec;
    MockERC20 internal usdg;
    MockLiquidityOracle internal oracle;
    MockLiquidityPool internal pool;
    MockLiquidityFactory internal factory;
    MockPonsFeeEscrow internal escrow;
    MockRevenueTreasury internal treasury;
    MockLiquidityPositionManager internal positionManager;
    PonsFeeLiquidityManager internal manager;

    address internal owner = makeAddr("owner");
    address internal safe = makeAddr("safe");

    function setUp() public {
        zzec = new MockERC20("Wrapped ZEC", "zZEC", 8);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        oracle = new MockLiquidityOracle();
        pool = new MockLiquidityPool();
        factory = new MockLiquidityFactory();
        escrow = new MockPonsFeeEscrow(address(usdg));
        treasury = new MockRevenueTreasury();
        positionManager = new MockLiquidityPositionManager();
        manager = _deployManager();

        factory.setPool(address(pool));
        pool.set(manager.expectedSqrtPriceX96(), -7000);
        vm.prank(owner);
        manager.setTreasury(address(treasury));
    }

    function test_claimsPonsFeesAndSplitsIntoLiquidityAndTreasury() public {
        _creditFees(1_000e6);

        uint256 tokenId = manager.harvestAndFund();

        assertEq(tokenId, 1);
        assertEq(usdg.balanceOf(address(treasury)), 500e6);
        assertEq(usdg.balanceOf(address(positionManager)), 500e6);
        assertEq(manager.totalFeesClaimed(), 1_000e6);
        assertEq(manager.totalUsdgFunded(), 500e6);
        assertEq(manager.totalUsdgToTreasury(), 500e6);
        assertEq(positionManager.lastRecipient(), safe);
        assertEq(positionManager.lastAmount0() + positionManager.lastAmount1(), 500e6);
        assertTrue(positionManager.lastTickLower() < positionManager.lastTickUpper());
        assertEq(treasury.lastBucketedAsset(), address(usdg));
    }

    function test_directDonationsCanFundPool() public {
        usdg.mint(address(manager), 200e6);

        manager.fundAvailable();

        assertEq(usdg.balanceOf(address(treasury)), 100e6);
        assertEq(usdg.balanceOf(address(positionManager)), 100e6);
        assertEq(manager.totalFeesClaimed(), 0);
    }

    function test_revertsUntilTreasuryIsSet() public {
        PonsFeeLiquidityManager unconfigured = _deployManager();
        usdg.mint(address(unconfigured), 100e6);

        vm.expectRevert(PonsFeeLiquidityManager.TreasuryNotSet.selector);
        unconfigured.fundAvailable();
    }

    function test_rejectsPoolPriceOutsideOracleGuard() public {
        uint160 expected = manager.expectedSqrtPriceX96();
        pool.set(uint160((uint256(expected) * 101) / 100), -7000);
        _creditFees(100e6);

        vm.expectRevert();
        manager.harvestAndFund();
    }

    function test_pauseStopsFundingWithoutStrandingEscrowCredit() public {
        _creditFees(100e6);
        vm.prank(owner);
        manager.pause();

        vm.expectRevert();
        manager.harvestAndFund();
        assertEq(escrow.credit(address(manager)), 100e6);
    }

    function test_configIsOwnerGatedAndBounded() public {
        vm.expectRevert();
        manager.setFundingConfig(6000, 600, 50, 9500);

        vm.startPrank(owner);
        vm.expectRevert(PonsFeeLiquidityManager.InvalidConfiguration.selector);
        manager.setFundingConfig(9500, 600, 50, 9500);
        manager.setFundingConfig(6000, 1200, 75, 9900);
        vm.stopPrank();

        assertEq(manager.liquidityBps(), 6000);
        assertEq(manager.rangeWidth(), 1200);
    }

    function _creditFees(uint256 amount) private {
        usdg.mint(address(escrow), amount);
        escrow.addCredit(address(manager), amount);
    }

    function _deployManager() private returns (PonsFeeLiquidityManager deployed) {
        deployed = new PonsFeeLiquidityManager(
            PonsFeeLiquidityManager.Infrastructure({
                zzec: address(zzec),
                usdg: address(usdg),
                feeEscrow: address(escrow),
                factory: address(factory),
                positionManager: address(positionManager),
                oracle: address(oracle)
            }),
            owner,
            safe,
            PonsFeeLiquidityManager.FundingConfig({
                poolFee: 3000, liquidityBps: 5000, rangeWidth: 600, maxSqrtDeviationBps: 50, minUseBps: 9500
            })
        );
    }
}
