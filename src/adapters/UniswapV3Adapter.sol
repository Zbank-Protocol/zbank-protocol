// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISwapAdapter} from "../InvestRouter.sol";

interface IUniswapV3SwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/// @title UniswapV3Adapter
/// @notice Stateless InvestRouter venue adapter with owner-approved Uniswap v3 paths.
///         A route may be direct (USDG -> Stock Token) or multi-hop
///         (zZEC -> USDG -> Stock Token). Swap output settles directly to the investor.
/// @dev The canonical SwapRouter02 address is immutable. The owner can only configure paths,
///      pause execution, and rescue tokens accidentally sent outside a swap.
contract UniswapV3Adapter is ISwapAdapter, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidPath();
    error RouteNotSet(address tokenIn, address tokenOut);
    error Slippage(uint256 received, uint256 minimum);

    event RouteSet(address indexed tokenIn, address indexed tokenOut, bytes path);
    event RouteRemoved(address indexed tokenIn, address indexed tokenOut);

    IUniswapV3SwapRouter public immutable swapRouter;
    mapping(bytes32 routeKey => bytes path) private _routes;

    constructor(address owner_, address swapRouter_) Ownable(owner_) {
        require(swapRouter_ != address(0), "adapter: zero router");
        swapRouter = IUniswapV3SwapRouter(swapRouter_);
    }

    function route(address tokenIn, address tokenOut) external view returns (bytes memory) {
        return _routes[_key(tokenIn, tokenOut)];
    }

    /// @notice Approve an exact-input route. The packed path must begin at tokenIn and end
    ///         at tokenOut: token(20) + [fee(3) + token(20)] one or more times.
    function setRoute(address tokenIn, address tokenOut, bytes calldata path) external onlyOwner {
        if (
            tokenIn == address(0) || tokenOut == address(0) || tokenIn == tokenOut || path.length < 43
                || (path.length - 20) % 23 != 0 || _firstToken(path) != tokenIn || _lastToken(path) != tokenOut
        ) revert InvalidPath();
        _routes[_key(tokenIn, tokenOut)] = path;
        emit RouteSet(tokenIn, tokenOut, path);
    }

    function removeRoute(address tokenIn, address tokenOut) external onlyOwner {
        delete _routes[_key(tokenIn, tokenOut)];
        emit RouteRemoved(tokenIn, tokenOut);
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, address to)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 out)
    {
        bytes memory path = _routes[_key(tokenIn, tokenOut)];
        if (path.length == 0) revert RouteNotSet(tokenIn, tokenOut);
        require(amountIn > 0 && to != address(0), "adapter: bad swap");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);
        out = swapRouter.exactInput(
            IUniswapV3SwapRouter.ExactInputParams({
                path: path, recipient: to, amountIn: amountIn, amountOutMinimum: minOut
            })
        );
        IERC20(tokenIn).forceApprove(address(swapRouter), 0);
        if (out < minOut) revert Slippage(out, minOut);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescue(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "adapter: zero recipient");
        IERC20(token).safeTransfer(to, amount);
    }

    function _key(address tokenIn, address tokenOut) private pure returns (bytes32) {
        return keccak256(abi.encode(tokenIn, tokenOut));
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
