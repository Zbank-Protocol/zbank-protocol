export type PreviewRow = { label: string; value: string; emphasis?: boolean };

type Props = {
  title?: string;
  rows: PreviewRow[];
  note?: string;
};

/**
 * The standard pre-execution summary: label/value rows, emphasised totals, one honesty note.
 * Every product's review step renders through this, so previews look identical suite-wide.
 */
export function TransactionPreview({ title = "Review", rows, note }: Props) {
  return (
    <div className="txpreview">
      <span className="metric__label">{title}</span>
      <div className="txpreview__rows">
        {rows.map((row) => (
          <div className="txpreview__row" data-emphasis={row.emphasis} key={row.label}>
            <span className="txpreview__label">{row.label}</span>
            <span className="txpreview__value">{row.value}</span>
          </div>
        ))}
      </div>
      {note ? <p className="t-note">{note}</p> : null}
    </div>
  );
}
