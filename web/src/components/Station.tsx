/**
 * Station marker. Replaces the original's depth gauge with a shielding stage: the reading
 * runs from fully transparent to fully shielded rather than from surface to seabed.
 */
export function Station({ index, label }: { index: number; label: string }) {
  const shielding = Math.min(100, index * 16);

  return (
    <div className="station">
      <span className="station__no t-mono">{String(index).padStart(2, "0")}</span>
      <span className="t-label">{label}</span>
      <span className="station__rule" aria-hidden="true" />
      <span className="station__depth t-mono">{shielding}% shielded</span>
    </div>
  );
}
