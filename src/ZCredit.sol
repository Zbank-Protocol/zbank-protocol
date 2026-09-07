// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPriceOracle} from "./oracle/IPriceOracle.sol";

/// @title ZCredit — the ZBANK lending market
/// @notice One market, two sides, no surprises:
///         * Borrowers deposit ZEC (its ERC20 representation) and borrow USDG against it.
///         * Lenders supply USDG and earn the borrowers' interest, pro rata, via shares.
///         Interest follows a kinked utilization curve; positions carry an onchain health
///         factor; anyone may liquidate a position whose health factor drops below 1.
/// @dev    Trust model, stated plainly: `owner` (a multisig before mainnet) can pause the
///         market, tune rate/risk parameters within hard bounds, and sweep accrued reserves.
///         It can NOT touch user collateral or supplied funds. USDG is treated as $1 —
///         a documented, deliberate simplification (see SECURITY.md).
///
///         NOT AUDITED. This contract must not hold mainnet funds until it has been.
contract ZCredit is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- errors
    error ZeroAmount();
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error ExceedsMaxLtv(uint256 debtUsd, uint256 maxDebtUsd);
    error HealthyPosition(uint256 healthFactor);
    error UnhealthyPosition(uint256 healthFactor);
    error RepayExceedsCloseFactor(uint256 repay, uint256 maxRepay);
    error ParamOutOfBounds();
    error CollateralCapExceeded(uint256 total, uint256 cap);

    // ---------------------------------------------------------------- events
    event Supplied(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event Borrowed(address indexed borrower, uint256 amount);
    event Repaid(address indexed borrower, address indexed payer, uint256 amount);
    event Liquidated(address indexed borrower, address indexed liquidator, uint256 repaid, uint256 collateralSeized);
    event ReservesSwept(address indexed to, uint256 amount);
    event RiskParamsSet(uint16 maxLtvBps, uint16 liqThresholdBps, uint16 liqBonusBps, uint16 reserveFactorBps);
    event RateParamsSet(uint64 baseRate, uint64 slopeLow, uint64 slopeHigh, uint16 kinkBps);

    // ---------------------------------------------------------------- config
    IERC20 public immutable collateralToken; // ZEC representation
    IERC20 public immutable debtToken; // USDG
    IPriceOracle public immutable oracle; // collateral USD price, 1e18
    uint256 private immutable collateralUnit; // 10 ** collateral decimals
    uint256 private immutable debtUnit; // 10 ** debt decimals

    uint256 private constant WAD = 1e18;
    uint256 private constant BPS = 10_000;
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    /// @notice A liquidator may repay at most half the debt per call.
    uint256 public constant CLOSE_FACTOR_BPS = 5_000;
    /// @dev Virtual shares/assets (Morpho-style) neutralize first-depositor donation
    ///      inflation: donating to the pool can no longer round later suppliers to zero.
    uint256 private constant VIRTUAL_SHARES = 1e6;
    uint256 private constant VIRTUAL_ASSETS = 1;

    // Risk parameters (owner-tunable within hard bounds).
    uint16 public maxLtvBps; // max debt/collateral at borrow time
    uint16 public liqThresholdBps; // debt/collateral where liquidation opens
    uint16 public liqBonusBps; // liquidator's discount on seized collateral
    uint16 public reserveFactorBps; // share of interest kept as protocol reserves

    // Kinked interest model, all rates per-year in WAD (1e18 = 100% APR).
    uint64 public baseRatePerYear;
    uint64 public slopeLowPerYear; // below kink
    uint64 public slopeHighPerYear; // above kink
    uint16 public kinkBps; // utilization where the curve steepens

    // ---------------------------------------------------------------- state
    uint256 public totalSupplyShares; // lender shares outstanding
    mapping(address => uint256) public supplyShares;

    uint256 public totalBorrows; // debt-token units incl. accrued interest
    uint256 public totalReserves; // debt-token units owned by the protocol
    uint256 public borrowIndex = WAD; // cumulative interest index
    uint64 public lastAccrual; // timestamp of last accrual

    mapping(address => uint256) public collateralOf; // collateral-token units
    mapping(address => uint256) public debtSharesOf; // debt scaled by borrowIndex
    uint256 public totalDebtShares;

    /// @notice Total collateral held, and the cap that bounds the market's exposure to the
    ///         collateral asset. Directly limits zZEC wrapper/peg risk while it is accepted.
    uint256 public totalCollateral;
    uint256 public collateralCap;
    event CollateralCapSet(uint256 cap);

    constructor(address collateral_, address debt_, address oracle_, address owner_) Ownable(owner_) {
        collateralToken = IERC20(collateral_);
        debtToken = IERC20(debt_);
        oracle = IPriceOracle(oracle_);
        collateralUnit = 10 ** IERC20Metadata(collateral_).decimals();
        debtUnit = 10 ** IERC20Metadata(debt_).decimals();
        lastAccrual = uint64(block.timestamp);

        // Development defaults — TODO: FINAL RISK PARAMETERS REQUIRED BEFORE MAINNET.
        _setRiskParams(5_000, 7_000, 800, 1_000);
        _setRateParams(0, 0.04e18, 0.6e18, 8_000);
        // Conservative launch cap: 5,000 collateral units. Raised deliberately, by the
        // multisig, as zZEC custody risk is assessed (see SECURITY.md).
        collateralCap = 5_000 * (10 ** IERC20Metadata(collateral_).decimals());
        emit CollateralCapSet(collateralCap);
    }

    // ============================================================ lender side

    /// @notice Supply USDG; receive pro-rata shares of the lending pool.
    function supply(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrue();
        uint256 shares = (amount * (totalSupplyShares + VIRTUAL_SHARES)) / (_poolAssets() + VIRTUAL_ASSETS);
        totalSupplyShares += shares;
        supplyShares[msg.sender] += shares;
        debtToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, amount, shares);
    }

    /// @notice Withdraw supplied USDG. Bounded by pool cash — the frontend shows
    ///         AVAILABLE LIQUIDITY for exactly this reason.
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrue();
        uint256 cash = debtToken.balanceOf(address(this));
        if (amount > cash) revert InsufficientLiquidity(amount, cash);
        uint256 shares = _ceilDiv(amount * (totalSupplyShares + VIRTUAL_SHARES), _poolAssets() + VIRTUAL_ASSETS);
        supplyShares[msg.sender] -= shares; // reverts on underflow: can't overdraw
        totalSupplyShares -= shares;
        debtToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, shares);
    }

    /// @notice A lender's current claim on the pool, in debt-token units.
    function balanceOfSupplied(address lender) external view returns (uint256) {
        (uint256 borrows,,) = _accruedTotals();
        uint256 assets = debtToken.balanceOf(address(this)) + borrows - _accruedReserves(borrows);
        return (supplyShares[lender] * (assets + VIRTUAL_ASSETS)) / (totalSupplyShares + VIRTUAL_SHARES);
    }

    // ========================================================== borrower side

    /// @notice Deposit ZEC collateral, up to the market-wide cap.
    function depositCollateral(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        totalCollateral += amount;
        if (totalCollateral > collateralCap) revert CollateralCapExceeded(totalCollateral, collateralCap);
        collateralOf[msg.sender] += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Withdraw collateral, if the remaining position stays within max LTV.
    function withdrawCollateral(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        accrue();
        collateralOf[msg.sender] -= amount;
        totalCollateral -= amount;
        uint256 debt = debtOf(msg.sender);
        if (debt > 0) {
            uint256 maxDebt = (_collateralValueUsd(msg.sender) * maxLtvBps) / BPS;
            uint256 debtUsd = _debtValueUsd(debt);
            if (debtUsd > maxDebt) revert ExceedsMaxLtv(debtUsd, maxDebt);
        }
        collateralToken.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Borrow USDG against deposited collateral, up to max LTV.
    function borrow(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        accrue();
        uint256 cash = debtToken.balanceOf(address(this));
        if (amount > cash) revert InsufficientLiquidity(amount, cash);

        uint256 shares = _ceilDiv(amount * WAD, borrowIndex);
        debtSharesOf[msg.sender] += shares;
        totalDebtShares += shares;
        totalBorrows += amount;

        uint256 maxDebt = (_collateralValueUsd(msg.sender) * maxLtvBps) / BPS;
        uint256 debtUsd = _debtValueUsd(debtOf(msg.sender));
        if (debtUsd > maxDebt) revert ExceedsMaxLtv(debtUsd, maxDebt);

        debtToken.safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /// @notice Repay a borrower's debt (anyone may pay). `type(uint256).max` repays in full.
    function repay(address borrower, uint256 amount) external nonReentrant {
        accrue();
        uint256 debt = debtOf(borrower);
        if (debt == 0 || amount == 0) revert ZeroAmount();
        uint256 paying = amount > debt ? debt : amount;

        uint256 shares = (paying * WAD) / borrowIndex;
        uint256 held = debtSharesOf[borrower];
        if (shares > held || paying == debt) shares = held; // full repayment clears all shares
        debtSharesOf[borrower] = held - shares;
        totalDebtShares -= shares;
        totalBorrows = paying >= totalBorrows ? 0 : totalBorrows - paying;

        debtToken.safeTransferFrom(msg.sender, address(this), paying);
        emit Repaid(borrower, msg.sender, paying);
    }

    // ============================================================ liquidation

    /// @notice Repay up to half of an unhealthy position's debt; seize collateral at a bonus.
    function liquidate(address borrower, uint256 repayAmount) external nonReentrant {
        accrue();
        uint256 hf = healthFactor(borrower);
        if (hf >= WAD) revert HealthyPosition(hf);

        uint256 debt = debtOf(borrower);
        uint256 maxRepay = (debt * CLOSE_FACTOR_BPS) / BPS;
        if (repayAmount > maxRepay) revert RepayExceedsCloseFactor(repayAmount, maxRepay);
        if (repayAmount == 0) revert ZeroAmount();

        // Collateral seized = repaid USD value * (1 + bonus), converted at oracle price.
        uint256 price = oracle.priceUsd();
        uint256 repayUsd = _debtValueUsd(repayAmount);
        uint256 seize = (repayUsd * (BPS + liqBonusBps) * collateralUnit) / (BPS * price);
        uint256 held = collateralOf[borrower];
        if (seize > held) seize = held; // bad debt case: take what exists

        uint256 shares = (repayAmount * WAD) / borrowIndex;
        uint256 heldShares = debtSharesOf[borrower];
        if (shares > heldShares) shares = heldShares;
        debtSharesOf[borrower] = heldShares - shares;
        totalDebtShares -= shares;
        totalBorrows = repayAmount >= totalBorrows ? 0 : totalBorrows - repayAmount;
        collateralOf[borrower] = held - seize;
        totalCollateral -= seize;

        debtToken.safeTransferFrom(msg.sender, address(this), repayAmount);
        collateralToken.safeTransfer(msg.sender, seize);
        emit Liquidated(borrower, msg.sender, repayAmount, seize);
    }

    // =============================================================== interest

    /// @notice Accrue interest since the last interaction. Public and permissionless.
    function accrue() public {
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0) return;
        (uint256 borrows, uint256 interest, uint256 index) = _accruedTotals();
        if (interest > 0) {
            totalReserves += (interest * reserveFactorBps) / BPS;
            totalBorrows = borrows;
            borrowIndex = index;
        }
        lastAccrual = uint64(block.timestamp);
    }

    /// @notice Current borrow APR in WAD, from the kinked utilization curve.
    function borrowRatePerYear() public view returns (uint256) {
        uint256 u = utilizationBps();
        if (u <= kinkBps) {
            return baseRatePerYear + (uint256(slopeLowPerYear) * u) / kinkBps;
        }
        return baseRatePerYear + slopeLowPerYear + (uint256(slopeHighPerYear) * (u - kinkBps)) / (BPS - kinkBps);
    }

    /// @notice Lender APR in WAD: borrow rate * utilization * (1 - reserve factor).
    function supplyRatePerYear() external view returns (uint256) {
        return (borrowRatePerYear() * utilizationBps() * (BPS - reserveFactorBps)) / (BPS * BPS);
    }

    /// @notice Pool utilization in basis points.
    function utilizationBps() public view returns (uint256) {
        uint256 cash = debtToken.balanceOf(address(this));
        uint256 assets = cash + totalBorrows;
        return assets == 0 ? 0 : (totalBorrows * BPS) / assets;
    }

    // ================================================================== views

    /// @notice A borrower's current debt in debt-token units, interest included.
    function debtOf(address borrower) public view returns (uint256) {
        (,, uint256 index) = _accruedTotals();
        return _ceilDiv(debtSharesOf[borrower] * index, WAD);
    }

    /// @notice Health factor in WAD. Below 1e18 the position is liquidatable.
    ///         `type(uint256).max` when there is no debt.
    function healthFactor(address borrower) public view returns (uint256) {
        uint256 debt = debtOf(borrower);
        if (debt == 0) return type(uint256).max;
        uint256 threshold = (_collateralValueUsd(borrower) * liqThresholdBps) / BPS;
        return (threshold * WAD) / _debtValueUsd(debt);
    }

    /// @notice Cash available for borrows and lender withdrawals right now.
    function availableLiquidity() external view returns (uint256) {
        return debtToken.balanceOf(address(this));
    }

    // ================================================================== admin

    /// @notice Tune risk parameters, inside hard bounds no owner can escape.
    function setRiskParams(uint16 maxLtv_, uint16 liqThreshold_, uint16 liqBonus_, uint16 reserveFactor_)
        external
        onlyOwner
    {
        _setRiskParams(maxLtv_, liqThreshold_, liqBonus_, reserveFactor_);
    }

    function setRateParams(uint64 base_, uint64 slopeLow_, uint64 slopeHigh_, uint16 kink_) external onlyOwner {
        accrue(); // settle history at the old curve first
        _setRateParams(base_, slopeLow_, slopeHigh_, kink_);
    }

    /// @notice Move accrued protocol reserves to the treasury. Never touches user funds:
    ///         bounded by both `totalReserves` and pool cash.
    function sweepReserves(address to) external onlyOwner returns (uint256 amount) {
        accrue();
        amount = totalReserves;
        uint256 cash = debtToken.balanceOf(address(this));
        if (amount > cash) amount = cash;
        totalReserves -= amount;
        debtToken.safeTransfer(to, amount);
        emit ReservesSwept(to, amount);
    }

    /// @notice Bound the market's total collateral exposure (zZEC wrapper/peg risk control).
    function setCollateralCap(uint256 cap) external onlyOwner {
        if (cap == 0) revert ParamOutOfBounds();
        collateralCap = cap;
        emit CollateralCapSet(cap);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================================================== internal

    function _setRiskParams(uint16 maxLtv_, uint16 liqThreshold_, uint16 liqBonus_, uint16 reserveFactor_) private {
        // Hard bounds: LTV strictly below the liquidation threshold, threshold sane,
        // bonus and reserve factor capped. These are the rails, not the final parameters.
        if (
            maxLtv_ == 0 || maxLtv_ >= liqThreshold_ || liqThreshold_ > 9_000 || liqBonus_ > 2_000
                || reserveFactor_ > 5_000
        ) revert ParamOutOfBounds();
        (maxLtvBps, liqThresholdBps, liqBonusBps, reserveFactorBps) =
        (maxLtv_, liqThreshold_, liqBonus_, reserveFactor_);
        emit RiskParamsSet(maxLtv_, liqThreshold_, liqBonus_, reserveFactor_);
    }

    function _setRateParams(uint64 base_, uint64 slopeLow_, uint64 slopeHigh_, uint16 kink_) private {
        // Rails: max 10% base, 50% low slope, 500% jump slope, kink strictly inside (0, 100%).
        if (base_ > 0.1e18 || slopeLow_ > 0.5e18 || slopeHigh_ > 5e18 || kink_ == 0 || kink_ >= BPS) {
            revert ParamOutOfBounds();
        }
        (baseRatePerYear, slopeLowPerYear, slopeHighPerYear, kinkBps) = (base_, slopeLow_, slopeHigh_, kink_);
        emit RateParamsSet(base_, slopeLow_, slopeHigh_, kink_);
    }

    /// @dev Totals as if `accrue()` ran now: (totalBorrows', interest, borrowIndex').
    function _accruedTotals() private view returns (uint256 borrows, uint256 interest, uint256 index) {
        borrows = totalBorrows;
        index = borrowIndex;
        uint256 dt = block.timestamp - lastAccrual;
        if (dt == 0 || borrows == 0) return (borrows, 0, index);
        // Linear per-second accrual — standard for onchain rate models.
        uint256 factor = (borrowRatePerYear() * dt) / SECONDS_PER_YEAR;
        interest = (borrows * factor) / WAD;
        borrows += interest;
        index += (index * factor) / WAD;
    }

    function _accruedReserves(uint256 accruedBorrows) private view returns (uint256) {
        uint256 interest = accruedBorrows - totalBorrows;
        return totalReserves + (interest * reserveFactorBps) / BPS;
    }

    /// @dev Pool assets owned by lenders: cash + borrows − reserves. Post-accrual only.
    function _poolAssets() private view returns (uint256) {
        return debtToken.balanceOf(address(this)) + totalBorrows - totalReserves;
    }

    /// @dev USD value (1e18) of a borrower's collateral, at the live oracle price.
    function _collateralValueUsd(address borrower) private view returns (uint256) {
        return (collateralOf[borrower] * oracle.priceUsd()) / collateralUnit;
    }

    /// @dev USD value (1e18) of a debt amount. USDG is treated as $1 (documented risk).
    function _debtValueUsd(uint256 amount) private view returns (uint256) {
        return (amount * WAD) / debtUnit;
    }

    function _ceilDiv(uint256 a, uint256 b) private pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }
}
