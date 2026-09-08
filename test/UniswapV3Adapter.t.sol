// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UniswapV3Adapter, IUniswapV3SwapRouter} from "../src/adapters/UniswapV3Adapter.sol";
import {InvestRouter} from "../src/InvestRouter.sol";
import {MockERC20} from "./mocks/Mocks.sol";

contract MockV3SwapRouter is IUniswapV3SwapRouter {
    mapping(address => mapping(address => uint256)) public rate;

    function setRate(address tokenIn, address tokenOut, uint256 rate1e18) external {
        rate[tokenIn][tokenOut] = rate1e18;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut) {
        address tokenIn = _firstToken(params.path);
        address tokenOut = _lastToken(params.path);
        IERC20(tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * rate[tokenIn][tokenOut]) / 1e18;
        require(amountOut >= params.amountOutMinimum, "Too little received");
        IERC20(tokenOut).transfer(params.recipient, amountOut);
    }

    function _firstToken(bytes calldata path) private pure returns (address token) {
        assembly ("memory-safe") {
            token := shr(96, calldataload(path.offset))
        }
    }

    function _lastToken(bytes calldata path) private pure returns (address token) {
        assembly ("memory-safe") {
            token := shr(96, calldataload(add(path.offset, sub(path.length, 20))))
        }
    }
}

contract UniswapV3AdapterTest is Test {
    MockERC20 internal zzec;
    MockERC20 internal usdg;
    MockERC20 internal stock;
    MockV3SwapRouter internal swapRouter;
    UniswapV3Adapter internal adapter;

    address internal owner = makeAddr("owner");
    address internal caller = makeAddr("invest-router");
    address internal investor = makeAddr("investor");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        zzec = new MockERC20("Wrapped ZEC", "zZEC", 8);
        usdg = new MockERC20("Global Dollar", "USDG", 6);
        stock = new MockERC20("Stock Token", "STOCK", 18);
        swapRouter = new MockV3SwapRouter();
        adapter = new UniswapV3Adapter(owner, address(swapRouter));

        stock.mint(address(swapRouter), 1_000_000e18);
        swapRouter.setRate(address(zzec), address(stock), 2e28);
        zzec.mint(caller, 100e8);
        vm.prank(caller);
        zzec.approve(address(adapter), type(uint256).max);
    }

    function test_multiHopRouteSettlesDirectlyToInvestor() public {
        bytes memory path = abi.encodePacked(address(zzec), uint24(3000), address(usdg), uint24(500), address(stock));
        vm.prank(owner);
        adapter.setRoute(address(zzec), address(stock), path);

        vm.prank(caller);
        uint256 out = adapter.swap(address(zzec), address(stock), 2e8, 3e18, investor);

        assertEq(out, 4e18);
        assertEq(stock.balanceOf(investor), 4e18);
        assertEq(zzec.balanceOf(address(adapter)), 0);
        assertEq(stock.balanceOf(address(adapter)), 0);
    }

    function test_rejectsPathWithWrongEndpoints() public {
        bytes memory path = abi.encodePacked(address(usdg), uint24(500), address(stock));
        vm.prank(owner);
        vm.expectRevert(UniswapV3Adapter.InvalidPath.selector);
        adapter.setRoute(address(zzec), address(stock), path);
    }

    function test_routeMustBeConfigured() public {
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(UniswapV3Adapter.RouteNotSet.selector, address(zzec), address(stock)));
        adapter.swap(address(zzec), address(stock), 1e8, 0, investor);
    }

    function test_onlyOwnerCanConfigureRoute() public {
        bytes memory path = abi.encodePacked(address(zzec), uint24(3000), address(usdg), uint24(500), address(stock));
        vm.prank(investor);
        vm.expectRevert();
        adapter.setRoute(address(zzec), address(stock), path);
    }

    function test_pauseBlocksExecution() public {
        bytes memory path = abi.encodePacked(address(zzec), uint24(3000), address(usdg), uint24(500), address(stock));
        vm.startPrank(owner);
        adapter.setRoute(address(zzec), address(stock), path);
        adapter.pause();
        vm.stopPrank();

        vm.prank(caller);
        vm.expectRevert();
        adapter.swap(address(zzec), address(stock), 1e8, 0, investor);
    }

    function test_investRouterExecutesDirectZecBasketThroughAdapter() public {
        bytes memory path = abi.encodePacked(address(zzec), uint24(3000), address(usdg), uint24(500), address(stock));
        vm.prank(owner);
        adapter.setRoute(address(zzec), address(stock), path);
        InvestRouter investRouter = new InvestRouter(owner, address(adapter), 50, treasury);

        zzec.mint(investor, 2e8);
        vm.startPrank(investor);
        zzec.approve(address(investRouter), type(uint256).max);
        address[] memory tokensOut = new address[](1);
        tokensOut[0] = address(stock);
        uint16[] memory weights = new uint16[](1);
        weights[0] = 10_000;
        uint256[] memory minimums = new uint256[](1);
        minimums[0] = 3.9e18;
        investRouter.invest(address(zzec), 2e8, tokensOut, weights, minimums);
        vm.stopPrank();

        assertEq(zzec.balanceOf(treasury), 1e6);
        assertEq(stock.balanceOf(investor), 3.98e18);
        assertEq(zzec.balanceOf(address(investRouter)), 0);
        assertEq(zzec.balanceOf(address(adapter)), 0);
    }
}
