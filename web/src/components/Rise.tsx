import type { ElementType, ReactNode } from "react";
import { createElement } from "react";
import { useInView } from "../hooks/useInView";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Seconds of delay before the rise, for light staggering inside a group. */
  delay?: number;
};

/**
 * The page's one entrance: a short fade-and-rise on first view.
 *
 * Deliberately the only scroll-triggered motion in the system. It exists so content settles
 * into place rather than popping, and nothing more — reduced motion turns it off entirely via
 * the global media rule in the stylesheet.
 */
export function Rise({ children, as: Tag = "div", className, delay = 0 }: Props) {
  const { ref, inView } = useInView<HTMLElement>(0.12);

  return createElement(
    Tag,
    {
      ref,
      className: `rise${className ? ` ${className}` : ""}`,
      "data-in": inView,
      style: delay ? { transitionDelay: `${delay}s` } : undefined,
    },
    children,
  );
}
