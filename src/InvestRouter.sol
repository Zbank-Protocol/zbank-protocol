// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice A swap venue the router can execute through (Uniswap v4 wrapper, aggregator, …).
///         Adapters are deployed per venue and hold no funds between calls.
interface ISwapAdapter {
    /// @dev Pulls `amountIn` of `tokenIn` from the caller (the router), swaps, and sends at
    ///      least `minOut` of `tokenOut` to `to`. Returns the amount actually delivered.
    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minOut, address to)
        external
        returns (uint256 out);
}

/// @title InvestRouter — the ZINVEST execution engine
/// @notice Executes one investment: take the input asset, take the protocol fee, and split
///         the remainder across a weighted basket of output tokens (a ZINDEX strategy or a
///         custom allocation), each leg with its own slippage floor. Output tokens go
///         directly to the investor — the router holds nothing between transactions.
/// @dev    `owner` (multisig before mainnet) selects the venue adapter and sets the fee
///         within a hard 2% cap. Fees flow to the treasury, where they become the revenue
///         that buys ZEC and burns ZBNK. NOT AUDITED.
contract InvestRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error BadBasket();
    error FeeTooHigh();
    error ZeroAmount();

    event AdapterSet(address adapter);
    event FeeSet(uint16 feeBps, address feeRecipient);
    event Invested(address indexed investor, address indexed tokenIn, uint256 amountIn, uint256 fee, uint256 legs);
    event Leg(address indexed investor, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    uint256 private constant BPS = 10_000;
    /// @notice Hard cap on the execution fee: 2%.
    uint16 public constant MAX_FEE_BPS = 200;

    ISwapAdapter public adapter;
    uint16 public feeBps;
    address public feeRecipient;

    constructor(address owner_, address adapter_, uint16 feeBps_, address feeRecipient_) Ownable(owner_) {
        _setAdapter(adapter_);
        _setFee(feeBps_, feeRecipient_);
    }

    /// @notice Execute an investment basket.
    /// @param tokenIn    Asset the investor pays with (ZEC representation or USDG).
    /// @param amountIn   Total input amount.
    /// @param tokensOut  Basket tokens, one per leg.
    /// @param weightsBps Basket weights; must sum to exactly 10000.
    /// @param minOuts    Per-leg slippage floors from the frontend quote.
    function invest(
        address tokenIn,
        uint256 amountIn,
        address[] calldata tokensOut,
        uint16[] calldata weightsBps,
        uint256[] calldata minOuts
    ) external nonReentrant whenNotPaused {
        if (amountIn == 0) revert ZeroAmount();
        uint256 n = tokensOut.length;
        if (n == 0 || n != weightsBps.length || n != minOuts.length) revert BadBasket();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        uint256 fee = (amountIn * feeBps) / BPS;
        if (fee > 0) IERC20(tokenIn).safeTransfer(feeRecipient, fee);
        uint256 investable = amountIn - fee;

        uint256 weightSum;
        uint256 spent;
        for (uint256 i = 0; i < n; i++) {
            weightSum += weightsBps[i];
            // Last leg takes the exact remainder so no dust is stranded in the router.
            uint256 legIn = i == n - 1 ? investable - spent : (investable * weightsBps[i]) / BPS;
            spent += legIn;
            _executeLeg(tokenIn, tokensOut[i], legIn, minOuts[i]);
        }
        if (weightSum != BPS) revert BadBasket();

        emit Invested(msg.sender, tokenIn, amountIn, fee, n);
    }

    function _executeLeg(address tokenIn, address tokenOut, uint256 legIn, uint256 minOut) private {
        IERC20(tokenIn).forceApprove(address(adapter), legIn);
        uint256 out = adapter.swap(tokenIn, tokenOut, legIn, minOut, msg.sender);
        emit Leg(msg.sender, tokenOut, legIn, out);
    }

    // ---------------------------------------------------------------- admin

    function setAdapter(address adapter_) external onlyOwner {
        _setAdapter(adapter_);
    }

    function setFee(uint16 feeBps_, address feeRecipient_) external onlyOwner {
        _setFee(feeBps_, feeRecipient_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _setAdapter(address adapter_) private {
        require(adapter_ != address(0), "router: zero adapter");
        adapter = ISwapAdapter(adapter_);
        emit AdapterSet(adapter_);
    }

    function _setFee(uint16 feeBps_, address feeRecipient_) private {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        require(feeRecipient_ != address(0), "router: zero recipient");
        (feeBps, feeRecipient) = (feeBps_, feeRecipient_);
        emit FeeSet(feeBps_, feeRecipient_);
    }
}
