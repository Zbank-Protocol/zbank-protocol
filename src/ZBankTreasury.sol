// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZBankTreasury — the revenue engine behind "MORE ZEC. FEWER ZBNK."
/// @notice Every unit of protocol revenue that enters is split, onchain and immediately,
///         into three earmarked buckets per the configured basis points:
///           * treasury  — funds ZEC acquisition (the 1% mission)
///           * buyback   — funds ZBNK buyback; bought ZBNK is permanently retired
///           * reserve   — protocol operations
///         The split is enforced at entry, the buckets are tracked per asset, and every
///         movement out of a bucket names its bucket in an event — so the /treasury page
///         can be an indexer view of this contract rather than a spreadsheet.
/// @dev    `owner` must be the protocol multisig before mainnet. Spending is owner-gated
///         because acquisition (USDG → native ZEC) and buybacks execute against venues this
///         contract cannot reach; the accounting here is the auditable trail. NOT AUDITED.
contract ZBankTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error BadSplit();
    error BucketUnderflow(uint256 requested, uint256 available);
    error NothingIdle();
    error ZeroAmount();
    error UnsupportedTransferFee();
    error ZbnkIsRetirementOnly();

    /// @notice Pons-issued tokens do not expose holder burn. Transfers here are permanently
    ///         inaccessible and must be excluded from eligible-supply accounting.
    address public constant RETIREMENT_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    enum Bucket {
        Treasury,
        Buyback,
        Reserve
    }

    event RevenueAllocated(
        address indexed asset, uint256 amount, uint256 toTreasury, uint256 toBuyback, uint256 toReserve
    );
    event SplitSet(uint16 treasuryBps, uint16 buybackBps, uint16 reserveBps);
    event Spent(Bucket indexed bucket, address indexed asset, address indexed to, uint256 amount, string memo);
    event ZbnkRetired(uint256 amount, uint256 totalRetired, address indexed retirementAddress);

    /// @notice The canonical ZBNK token.
    IERC20 public immutable zbnk;

    uint16 public treasuryBps;
    uint16 public buybackBps;
    uint16 public reserveBps;

    /// @notice Earmarked balances: asset => bucket => amount.
    mapping(address => mapping(Bucket => uint256)) public bucketOf;
    /// @notice Sum of all buckets per asset — anything above it on the balance is idle.
    mapping(address => uint256) public totalBucketed;
    /// @notice Lifetime ZBNK permanently removed from eligible supply through this contract.
    uint256 public totalZbnkRetired;

    constructor(address zbnk_, address owner_, uint16 treasuryBps_, uint16 buybackBps_, uint16 reserveBps_)
        Ownable(owner_)
    {
        require(zbnk_ != address(0), "treasury: zero zbnk");
        zbnk = IERC20(zbnk_);
        _setSplit(treasuryBps_, buybackBps_, reserveBps_);
    }

    /// @notice Take `amount` of `asset` from the caller and split it across the buckets.
    ///         Called by revenue sources (fee sweeps, reserve sweeps, keepers).
    function allocateRevenue(address asset, uint256 amount) external nonReentrant {
        require(amount > 0, "treasury: zero amount");
        _credit(asset, amount);
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Bucket revenue that arrived as a plain transfer — invest-router fees and
    ///         ZCredit reserve sweeps land this way. Permissionless: splitting idle balance
    ///         per the configured bps is the only thing this can do.
    /// @dev    ZBNK is excluded: ZBNK held here is bought-back supply awaiting `retireZbnk`,
    ///         never spendable revenue.
    function bucketIdle(address asset) external nonReentrant {
        if (asset == address(zbnk)) revert ZbnkIsRetirementOnly();
        uint256 idle = IERC20(asset).balanceOf(address(this)) - totalBucketed[asset];
        if (idle == 0) revert NothingIdle();
        _credit(asset, idle);
    }

    function _credit(address asset, uint256 amount) private {
        uint256 toTreasury = (amount * treasuryBps) / 10_000;
        uint256 toBuyback = (amount * buybackBps) / 10_000;
        uint256 toReserve = amount - toTreasury - toBuyback; // remainder dust lands in reserve
        bucketOf[asset][Bucket.Treasury] += toTreasury;
        bucketOf[asset][Bucket.Buyback] += toBuyback;
        bucketOf[asset][Bucket.Reserve] += toReserve;
        totalBucketed[asset] += amount;
        emit RevenueAllocated(asset, amount, toTreasury, toBuyback, toReserve);
    }

    /// @notice Spend from a bucket. The memo lands in the event log — the public record of
    ///         what each outflow was for ("ZEC acquisition batch 7", "buyback via router").
    function spend(Bucket bucket, address asset, address to, uint256 amount, string calldata memo)
        external
        onlyOwner
        nonReentrant
    {
        uint256 held = bucketOf[asset][bucket];
        if (amount > held) revert BucketUnderflow(amount, held);
        bucketOf[asset][bucket] = held - amount;
        totalBucketed[asset] -= amount;
        IERC20(asset).safeTransfer(to, amount);
        emit Spent(bucket, asset, to, amount, memo);
    }

    /// @notice Permanently retire ZBNK held by this contract after a market buyback.
    ///         Permissionless: anyone may move bought-back ZBNK to the inaccessible retirement
    ///         address. This works with standard Pons ERC-20 tokens that expose no `burn`.
    function retireZbnk(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 balanceBefore = zbnk.balanceOf(RETIREMENT_ADDRESS);
        zbnk.safeTransfer(RETIREMENT_ADDRESS, amount);
        if (zbnk.balanceOf(RETIREMENT_ADDRESS) - balanceBefore != amount) {
            revert UnsupportedTransferFee();
        }
        totalZbnkRetired += amount;
        emit ZbnkRetired(amount, totalZbnkRetired, RETIREMENT_ADDRESS);
    }

    /// @notice Update the revenue split. Takes effect for future allocations only.
    function setSplit(uint16 treasuryBps_, uint16 buybackBps_, uint16 reserveBps_) external onlyOwner {
        _setSplit(treasuryBps_, buybackBps_, reserveBps_);
    }

    function _setSplit(uint16 treasuryBps_, uint16 buybackBps_, uint16 reserveBps_) private {
        if (uint256(treasuryBps_) + buybackBps_ + reserveBps_ != 10_000) revert BadSplit();
        (treasuryBps, buybackBps, reserveBps) = (treasuryBps_, buybackBps_, reserveBps_);
        emit SplitSet(treasuryBps_, buybackBps_, reserveBps_);
    }
}
