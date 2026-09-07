import { EQUATION } from "../data/site";

/**
 * The ZBANK motif: MORE ZEC ÷ FEWER ZBNK = MORE ZEC PER ZBNK.
 *
 * Rendered from one shared constant so the wording is identical everywhere it appears — the
 * point of a motif is repetition without drift.
 */
export function Equation() {
  return (
    <div
      className="equation"
      role="img"
      aria-label="More ZEC divided by fewer ZBNK equals more ZEC per eligible ZBNK"
    >
      {EQUATION.map((part, i) => (
        <span
          key={part}
          className={
            i % 2 === 1
              ? "equation__op"
              : `equation__term${i === EQUATION.length - 1 ? " equation__term--gold" : ""}`
          }
        >
          {part}
        </span>
      ))}
    </div>
  );
}
