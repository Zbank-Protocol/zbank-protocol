import type { ReactNode } from "react";
import { Rise } from "./Rise";

type Props = {
  /** Two-digit section number, printed in the kicker. */
  no: string;
  /** Short kicker label, e.g. "The Mission". */
  kicker: string;
  /** Anchor id for the nav. */
  id?: string;
  /** Headline lines; each renders as its own line. */
  title?: string[];
  /** Optional lede paragraph under the headline. */
  lede?: string;
  children?: ReactNode;
  /** Extra class on the section, for per-section layout. */
  className?: string;
};

/**
 * The section shell every numbered part of the page shares: a hairline top rule, a numbered
 * kicker, a left-aligned headline, and the content. Consistency here is what makes the page
 * read as one document rather than a stack of landing-page blocks.
 */
export function Section({ no, kicker, id, title, lede, children, className }: Props) {
  return (
    <section className={`section${className ? ` ${className}` : ""}`} id={id} data-sec={no}>
      <div className="container">
        <Rise>
          <div className="section__kicker">
            <span className="section__no">{no}</span>
            <span className="section__label">{kicker}</span>
          </div>
          {title ? (
            <h2 className="section__title">
              {title.map((line) => (
                <span className="section__line" key={line}>
                  {line}
                </span>
              ))}
            </h2>
          ) : null}
          {lede ? <p className="section__lede">{lede}</p> : null}
        </Rise>
        {children}
      </div>
    </section>
  );
}
