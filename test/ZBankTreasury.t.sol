// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ZBNK} from "../src/ZBNK.sol";
import {ZBankTreasury} from "../src/ZBankTreasury.sol";
import {MockERC20} from "./mocks/Mocks.sol";

contract ZBankTreasuryTest is Test {
    ZBNK zbnk;
    ZBankTreasury treasury;
    MockERC20 usdg;

    address admin = makeAddr("admin");
    address revenueSource = makeAddr("revenueSource");

    function setUp() public {
        zbnk = new ZBNK(admin);
        // Launch split: 50% ZEC acquisition, 30% buyback+burn, 20% reserve.
        treasury = new ZBankTreasury(address(zbnk), admin, 5_000, 3_000, 2_000);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        usdg.mint(revenueSource, 1_000_000e6);
        vm.prank(revenueSource);
        usdg.approve(address(treasury), type(uint256).max);
    }

    function test_token_supply_fixed_and_burnable() public {
        assertEq(zbnk.totalSupply(), 1_000_000_000e18);
        vm.prank(admin);
        zbnk.burn(1_000_000e18);
        assertEq(zbnk.totalSupply(), 999_000_000e18);
        // No mint function exists — supply only goes down.
    }

    function test_revenue_split_exact() public {
        vm.prank(revenueSource);
        treasury.allocateRevenue(address(usdg), 100_000e6);
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Treasury), 50_000e6);
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Buyback), 30_000e6);
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Reserve), 20_000e6);
        assertEq(usdg.balanceOf(address(treasury)), 100_000e6);
    }

    function test_split_dust_lands_in_reserve() public {
        vm.prank(revenueSource);
        treasury.allocateRevenue(address(usdg), 3); // 3 units: 1 + 0 + remainder 2
        uint256 sum = treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Treasury)
            + treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Buyback)
            + treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Reserve);
        assertEq(sum, 3); // nothing stranded, nothing double-counted
    }

    function test_spend_bounded_by_bucket() public {
        vm.prank(revenueSource);
        treasury.allocateRevenue(address(usdg), 100_000e6);
        vm.startPrank(admin);
        vm.expectRevert(abi.encodeWithSelector(ZBankTreasury.BucketUnderflow.selector, 60_000e6, 50_000e6));
        treasury.spend(ZBankTreasury.Bucket.Treasury, address(usdg), admin, 60_000e6, "over");
        treasury.spend(ZBankTreasury.Bucket.Treasury, address(usdg), admin, 50_000e6, "ZEC acquisition batch 1");
        vm.stopPrank();
        assertEq(usdg.balanceOf(admin), 50_000e6);
        // Buyback bucket untouched by the treasury spend.
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Buyback), 30_000e6);
    }

    function test_spend_is_owner_only() public {
        vm.prank(revenueSource);
        treasury.allocateRevenue(address(usdg), 1_000e6);
        vm.expectRevert();
        treasury.spend(ZBankTreasury.Bucket.Reserve, address(usdg), address(this), 1e6, "steal");
    }

    function test_burn_is_permissionless_and_tracked() public {
        vm.prank(admin);
        zbnk.transfer(address(treasury), 5_000_000e18); // bought-back ZBNK arrives
        treasury.burnZbnk(5_000_000e18); // anyone can finalize
        assertEq(treasury.totalZbnkBurned(), 5_000_000e18);
        assertEq(zbnk.totalSupply(), 995_000_000e18);
    }

    /// @notice Router fees and reserve sweeps arrive as plain transfers — they must be
    ///         bucketable, or revenue is stranded on the contract forever.
    function test_plain_transfers_bucketable_via_bucketIdle() public {
        vm.prank(revenueSource);
        usdg.transfer(address(treasury), 10_000e6); // e.g. an InvestRouter fee transfer

        treasury.bucketIdle(address(usdg)); // permissionless
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Treasury), 5_000e6);
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Buyback), 3_000e6);
        assertEq(treasury.bucketOf(address(usdg), ZBankTreasury.Bucket.Reserve), 2_000e6);

        // Now spendable through the normal, memo-logged path.
        vm.prank(admin);
        treasury.spend(ZBankTreasury.Bucket.Treasury, address(usdg), admin, 5_000e6, "ZEC acquisition");
        assertEq(usdg.balanceOf(admin), 5_000e6);

        // Nothing left idle; a second call reverts.
        vm.expectRevert(ZBankTreasury.NothingIdle.selector);
        treasury.bucketIdle(address(usdg));
    }

    function test_bucketIdle_rejects_zbnk() public {
        vm.prank(admin);
        zbnk.transfer(address(treasury), 1_000e18);
        vm.expectRevert(ZBankTreasury.ZbnkIsBurnOnly.selector);
        treasury.bucketIdle(address(zbnk)); // buyback ZBNK is for burning, never spending
    }

    function test_bad_split_rejected() public {
        vm.prank(admin);
        vm.expectRevert(ZBankTreasury.BadSplit.selector);
        treasury.setSplit(5_000, 3_000, 1_000); // sums to 9000
    }
}
