import { BRAND } from "../config";

type Props = {
  /** `bar` for the masthead, `stack` for the entry hold, where the lockup is the only object. */
  variant?: "bar" | "stack";
};

/**
 * The Zbank lockup: the plate mark and the wordmark.
 *
 * Inlined rather than loaded from `/mark.svg` so the identity paints with the first frame — a
 * masthead logo arriving one network round trip late is one of the tells that separates a real
 * product from a template.
 *
 * The mark's geometry is duplicated from `public/mark.svg`, which is unavoidable: that file has
 * to stand alone as a favicon. It is 8 numbers and it is commented in both places.
 */
export function Logo({ variant = "bar" }: Props) {
  return (
    <span className="logo" data-variant={variant}>
      <svg className="logo__mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M14 2H46V34L34 46H2V14Z" fill="#f4b728" />
        <path d="M13 13H35V17.4L21 30.2H35V35H13V30.2L27 17.4H13Z" fill="#050509" />
      </svg>
      <span className="logo__word">{BRAND.name}</span>
    </span>
  );
}
