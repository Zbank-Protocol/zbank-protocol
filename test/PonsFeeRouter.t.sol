// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PonsFeeRouter} from "../src/PonsFeeRouter.sol";

contract RouterToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RouterEscrow {
    RouterToken public immutable token;
    uint256 public claimAmount;

    constructor(RouterToken token_) {
        token = token_;
    }

    function setClaimAmount(uint256 amount) external {
        claimAmount = amount;
    }

    function claimToken(address token_) external {
        require(token_ == address(token), "wrong token");
        uint256 amount = claimAmount;
        claimAmount = 0;
        token.transfer(msg.sender, amount);
    }
}

contract RouterManager {
    bool public shouldRevert;
    uint256 public calls;
    uint256 public nextTokenId = 77;

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function fundAvailable() external returns (uint256 tokenId) {
        if (shouldRevert) revert("manager unavailable");
        calls++;
        return nextTokenId;
    }
}

contract RouterFactory {
    address public caller;
    address public token;
    address public recipient;
    bool public buybackEnabled;

    function transferCreatorFeeRecipient(address token_, address recipient_) external {
        caller = msg.sender;
        token = token_;
        recipient = recipient_;
    }

    function setBuybackEnabled(address token_, bool enabled) external {
        caller = msg.sender;
        token = token_;
        buybackEnabled = enabled;
    }
}

contract PonsFeeRouterTest is Test {
    RouterToken internal usdg;
    RouterToken internal other;
    RouterEscrow internal escrow;
    RouterFactory internal factory;
    RouterManager internal manager;
    PonsFeeRouter internal router;

    address internal alice = makeAddr("alice");
    address internal zbnk = makeAddr("zbnk");

    function setUp() external {
        usdg = new RouterToken("USDG", "USDG");
        other = new RouterToken("Other", "OTHER");
        escrow = new RouterEscrow(usdg);
        factory = new RouterFactory();
        manager = new RouterManager();
        router = new PonsFeeRouter(address(usdg), address(escrow), address(factory), address(this), address(manager));
    }

    function test_constructor_sets_permanent_rails() external view {
        assertEq(address(router.quoteAsset()), address(usdg));
        assertEq(address(router.feeEscrow()), address(escrow));
        assertEq(address(router.ponsFactory()), address(factory));
        assertEq(router.owner(), address(this));
        assertEq(router.manager(), address(manager));
        assertEq(router.MANAGER_CHANGE_DELAY(), 1 days);
    }

    function test_rejects_non_contract_manager() external {
        vm.expectRevert(PonsFeeRouter.InvalidConfiguration.selector);
        new PonsFeeRouter(address(usdg), address(escrow), address(factory), address(this), alice);

        vm.expectRevert(PonsFeeRouter.InvalidConfiguration.selector);
        router.proposeManager(alice);
    }

    function test_claim_and_route_is_atomic() external {
        usdg.mint(address(escrow), 100e6);
        escrow.setClaimAmount(100e6);

        (uint256 amount, uint256 tokenId) = router.claimAndRoute();

        assertEq(amount, 100e6);
        assertEq(tokenId, 77);
        assertEq(usdg.balanceOf(address(manager)), 100e6);
        assertEq(manager.calls(), 1);
        assertEq(router.totalRouted(), 100e6);
    }

    function test_routes_direct_donations() external {
        usdg.mint(address(router), 25e6);

        router.routeAvailable();

        assertEq(usdg.balanceOf(address(manager)), 25e6);
        assertEq(router.totalRouted(), 25e6);
    }

    function test_manager_failure_rolls_back_claim() external {
        usdg.mint(address(escrow), 10e6);
        escrow.setClaimAmount(10e6);
        manager.setShouldRevert(true);

        vm.expectRevert("manager unavailable");
        router.claimAndRoute();

        assertEq(usdg.balanceOf(address(escrow)), 10e6);
        assertEq(usdg.balanceOf(address(router)), 0);
        assertEq(usdg.balanceOf(address(manager)), 0);
        assertEq(escrow.claimAmount(), 10e6);
    }

    function test_manager_upgrade_has_notice_period() external {
        RouterManager next = new RouterManager();
        router.proposeManager(address(next));
        uint256 validAt = block.timestamp + 1 days;

        assertEq(router.pendingManager(), address(next));
        assertEq(router.pendingManagerValidAt(), validAt);
        vm.expectRevert(abi.encodeWithSelector(PonsFeeRouter.ManagerChangeNotReady.selector, validAt));
        router.executeManagerChange();

        vm.warp(validAt);
        vm.prank(alice);
        router.executeManagerChange();
        assertEq(router.manager(), address(next));
        assertEq(router.pendingManager(), address(0));
    }

    function test_manager_change_can_be_cancelled() external {
        RouterManager next = new RouterManager();
        router.proposeManager(address(next));
        router.cancelManagerChange();

        assertEq(router.pendingManager(), address(0));
        vm.expectRevert(PonsFeeRouter.NoManagerChangePending.selector);
        router.executeManagerChange();
    }

    function test_router_can_transfer_pons_recipient() external {
        address replacement = makeAddr("replacement");
        router.transferCreatorFeeRecipient(zbnk, replacement);

        assertEq(factory.caller(), address(router));
        assertEq(factory.token(), zbnk);
        assertEq(factory.recipient(), replacement);
    }

    function test_router_can_control_pons_buyback() external {
        router.setBuybackEnabled(zbnk, true);

        assertEq(factory.caller(), address(router));
        assertEq(factory.token(), zbnk);
        assertTrue(factory.buybackEnabled());
    }

    function test_only_owner_can_change_controls() external {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.proposeManager(makeAddr("next"));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.transferCreatorFeeRecipient(zbnk, makeAddr("recipient"));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.setBuybackEnabled(zbnk, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        router.pause();
        vm.stopPrank();
    }

    function test_pause_blocks_routing_but_not_upgrade_execution() external {
        RouterManager next = new RouterManager();
        router.proposeManager(address(next));
        router.pause();

        usdg.mint(address(router), 1e6);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.routeAvailable();

        vm.warp(block.timestamp + 1 days);
        router.executeManagerChange();
        assertEq(router.manager(), address(next));
    }

    function test_quote_asset_cannot_be_recovered_around_route() external {
        usdg.mint(address(router), 2e6);
        vm.expectRevert(PonsFeeRouter.QuoteAssetRecoveryDisabled.selector);
        router.recoverUnsupportedToken(usdg, alice, 2e6);

        other.mint(address(router), 3 ether);
        router.recoverUnsupportedToken(other, alice, 3 ether);
        assertEq(other.balanceOf(alice), 3 ether);
    }
}
