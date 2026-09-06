// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BaseHookFee} from "uniswap-hooks/fee/BaseHookFee.sol";
import {BaseHook} from "uniswap-hooks/base/BaseHook.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TradingFeeHook
 * @notice Takes a fee on each swap in the token's Uniswap v4 pool and forwards it to the treasury
 * that funds ZEC purchases.
 *
 * Why a v4 hook rather than a fee-on-transfer ("tax") token:
 *
 *  - It charges *trading*, which is what we actually want. A transfer tax also hits wallet-to-wallet
 *    sends, moving tokens to a hardware wallet, and depositing to a bridge.
 *  - Fee-on-transfer tokens break routers, aggregators and lending integrations that assume the
 *    amount sent equals the amount received. A hook is invisible to them.
 *  - The token itself stays a plain, unmodified ERC-20, so it can be listed and integrated anywhere
 *    without special handling.
 *
 * The fee is charged on the *unspecified* currency of the swap, which is the standard v4 pattern:
 * for an exact-input swap that is the output token, for exact-output it is the input token.
 * Accrued fees are held as ERC-6909 claims against the PoolManager, which is cheaper than moving
 * tokens on every swap, and are redeemed in a batch by {handleHookFees}.
 */
contract TradingFeeHook is BaseHookFee, Ownable {
    /// @dev Fee exceeds the hard cap set at deployment.
    error FeeAboveCap(uint24 requested, uint24 cap);
    /// @dev Treasury cannot be the zero address.
    error InvalidTreasury();

    /// @notice Emitted when the swap fee changes.
    event SwapFeeUpdated(uint24 previousFee, uint24 newFee);
    /// @notice Emitted when the treasury address changes.
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    /// @notice Emitted when accrued fees are redeemed and swept to the treasury.
    event FeesSwept(Currency indexed currency, uint256 amount, address indexed treasury);

    /**
     * @notice Hard ceiling on the swap fee, in hundredths of a bip (1e6 = 100%).
     *
     * Immutable and enforced in {setSwapFee}, so the owner can never raise the fee beyond what
     * holders agreed to at deployment. Without this, "adjustable fee" is indistinguishable from
     * "the owner can take 100% of every trade".
     */
    uint24 public immutable feeCap;

    /// @notice Current swap fee, in hundredths of a bip. 3000 = 0.30%.
    uint24 public swapFee;

    /// @notice Destination for swept fees; funds ZEC purchases.
    address public treasury;

    /**
     * @param poolManager_ The Uniswap v4 PoolManager (0x8366a39cc670b4001a1121b8f6a443a643e40951 on
     * Robinhood Chain mainnet).
     * @param owner_ Initial owner. Should be a timelock or multisig, not an EOA.
     * @param treasury_ Destination for swept fees.
     * @param initialFee_ Starting swap fee in hundredths of a bip.
     * @param feeCap_ Permanent ceiling on the swap fee.
     */
    constructor(
        IPoolManager poolManager_,
        address owner_,
        address treasury_,
        uint24 initialFee_,
        uint24 feeCap_
    ) BaseHook(poolManager_) Ownable(owner_) {
        if (treasury_ == address(0)) revert InvalidTreasury();
        if (feeCap_ > MAX_HOOK_FEE) revert FeeAboveCap(feeCap_, MAX_HOOK_FEE);
        if (initialFee_ > feeCap_) revert FeeAboveCap(initialFee_, feeCap_);

        feeCap = feeCap_;
        swapFee = initialFee_;
        treasury = treasury_;

        emit SwapFeeUpdated(0, initialFee_);
        emit TreasuryUpdated(address(0), treasury_);
    }

    /// @dev Flat fee for every swap in every pool using this hook.
    function _getHookFee(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        view
        override
        returns (uint24)
    {
        return swapFee;
    }

    /**
     * @notice Redeems accrued ERC-6909 claims and transfers the underlying tokens to the treasury.
     * @dev Permissionless by design: anyone may trigger a sweep, and funds can only ever go to
     * `treasury`, so there is nothing to gain by calling it and no reason to gate it. A keeper
     * calls this on a schedule.
     * @param currencies The currencies to sweep, normally both sides of the pool.
     */
    function handleHookFees(Currency[] memory currencies) public override {
        address destination = treasury;

        for (uint256 i = 0; i < currencies.length; ++i) {
            Currency currency = currencies[i];
            uint256 claims = poolManager.balanceOf(address(this), currency.toId());
            if (claims == 0) continue;

            // Burn the ERC-6909 claim to pull the real tokens out of the PoolManager, then forward.
            poolManager.burn(address(this), currency.toId(), claims);
            poolManager.take(currency, destination, claims);

            emit FeesSwept(currency, claims, destination);
        }
    }

    /// @notice Updates the swap fee, bounded by {feeCap}.
    function setSwapFee(uint24 newFee) external onlyOwner {
        if (newFee > feeCap) revert FeeAboveCap(newFee, feeCap);

        emit SwapFeeUpdated(swapFee, newFee);
        swapFee = newFee;
    }

    /// @notice Updates the treasury address.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();

        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
}
