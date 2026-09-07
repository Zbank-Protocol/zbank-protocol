type Props = {
  label: string;
  symbol: string;
  value: string;
  onChange: (value: string) => void;
  /** Wallet balance, when known. null renders "—" and disables Max. */
  balance?: number | null;
  disabled?: boolean;
};

/** The standard amount field: label, numeric input, asset tag, balance line with Max. */
export function AssetAmountInput({ label, symbol, value, onChange, balance, disabled }: Props) {
  return (
    <div className="amount">
      <div className="amount__row">
        <label className="metric__label" htmlFor={`amt-${label}`}>
          {label}
        </label>
        <span className="amount__balance">
          Balance: {balance == null ? "—" : balance.toLocaleString("en-US")}
          {balance != null ? (
            <button
              type="button"
              className="amount__max"
              onClick={() => onChange(String(balance))}
              disabled={disabled}
            >
              Max
            </button>
          ) : null}
        </span>
      </div>
      <div className="amount__field">
        <input
          id={`amt-${label}`}
          className="calc__input"
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
        <span className="amount__symbol">{symbol}</span>
      </div>
    </div>
  );
}
