type Props = {
  label: string;
  value: string;
  /** Unit rendered after the value, dimmer — "ZEC", "%". */
  unit?: string;
  /** Optional secondary line under the value. */
  hint?: string;
};

/**
 * One metric cell: label above, tabular figure below.
 *
 * Values are strings on purpose — formatting decisions (and the honest "—" for numbers that do
 * not exist yet) belong to the data layer, not to a display component.
 */
export function MetricCard({ label, value, unit, hint }: Props) {
  return (
    <div className="metric">
      <span className="metric__label">{label}</span>
      <span className="metric__value">
        {value}
        {unit ? <span className="metric__unit"> {unit}</span> : null}
      </span>
      {hint ? <span className="metric__hint">{hint}</span> : null}
    </div>
  );
}
