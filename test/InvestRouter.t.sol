// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {InvestRouter} from "../src/InvestRouter.sol";
import {MockERC20, MockSwapAdapter} from "./mocks/Mocks.sol";

contract InvestRouterTest is Test {
    InvestRouter router;
    MockSwapAdapter adapter;
    MockERC20 usdg; // input, 6 decimals
    MockERC20 tsla; // stock tokens, 18 decimals
    MockERC20 nvda;

    address admin = makeAddr("admin");
    address treasury = makeAddr("treasury");
    address investor = makeAddr("investor");

    function setUp() public {
        adapter = new MockSwapAdapter();
        router = new InvestRouter(admin, address(adapter), 50, treasury); // 0.5% fee
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        tsla = new MockERC20("Tesla Stock Token", "tTSLA", 18);
        nvda = new MockERC20("NVIDIA Stock Token", "tNVDA", 18);

        // Venue inventory + rates: 1 USDG (1e6 units) → 2 tTSLA / 1 tNVDA (1e18-unit tokens),
        // so the unit-level rate carries the 1e12 decimal conversion.
        tsla.mint(address(adapter), 1_000_000e18);
        nvda.mint(address(adapter), 1_000_000e18);
        adapter.setRate(address(usdg), address(tsla), 2e30);
        adapter.setRate(address(usdg), address(nvda), 1e30);

        usdg.mint(investor, 100_000e6);
        vm.prank(investor);
        usdg.approve(address(router), type(uint256).max);
    }

    function _basket() internal view returns (address[] memory t, uint16[] memory w, uint256[] memory m) {
        t = new address[](2);
        w = new uint16[](2);
        m = new uint256[](2);
        (t[0], t[1]) = (address(tsla), address(nvda));
        (w[0], w[1]) = (6_000, 4_000);
    }

    function test_invest_splits_fee_and_weights() public {
        (address[] memory t, uint16[] memory w, uint256[] memory m) = _basket();
        vm.prank(investor);
        router.invest(address(usdg), 10_000e6, t, w, m);

        assertEq(usdg.balanceOf(treasury), 50e6); // 0.5% fee
        // Investable 9950: 60% → tTSLA at 2x, 40% → tNVDA at 1x (rate scaled for decimals).
        assertApproxEqRel(tsla.balanceOf(investor), 11_940e18, 0.001e18);
        assertApproxEqRel(nvda.balanceOf(investor), 3_980e18, 0.001e18);
        // Router holds nothing after execution.
        assertEq(usdg.balanceOf(address(router)), 0);
    }

    function test_weights_must_sum_to_10000() public {
        (address[] memory t, uint16[] memory w, uint256[] memory m) = _basket();
        w[1] = 3_000; // sums to 9000
        vm.prank(investor);
        vm.expectRevert(InvestRouter.BadBasket.selector);
        router.invest(address(usdg), 1_000e6, t, w, m);
    }

    function test_slippage_floor_enforced() public {
        (address[] memory t, uint16[] memory w, uint256[] memory m) = _basket();
        m[0] = 20_000e18; // impossible floor
        vm.prank(investor);
        vm.expectRevert("adapter: slippage");
        router.invest(address(usdg), 10_000e6, t, w, m);
    }

    function test_fee_hard_cap() public {
        vm.prank(admin);
        vm.expectRevert(InvestRouter.FeeTooHigh.selector);
        router.setFee(201, treasury); // above the 2% cap
    }

    function test_pause_blocks_invest() public {
        vm.prank(admin);
        router.pause();
        (address[] memory t, uint16[] memory w, uint256[] memory m) = _basket();
        vm.prank(investor);
        vm.expectRevert();
        router.invest(address(usdg), 1_000e6, t, w, m);
    }
}
