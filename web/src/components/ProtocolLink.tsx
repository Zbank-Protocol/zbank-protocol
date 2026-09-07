import type { ProtocolItem } from "../data/site";

/**
 * One transparency card. A null value renders as "Pending launch" — the explicit contract of
 * this page is that nothing on it is ever a fabricated address or document.
 */
export function ProtocolLink({ item }: { item: ProtocolItem }) {
  const pending = item.value === null;

  const body = (
    <>
      <span className="protocol__label">{item.label}</span>
      <span className="protocol__value" data-pending={pending}>
        {pending ? "Pending launch" : item.value}
      </span>
      {!pending && item.href ? (
        <span className="product__arrow" aria-hidden="true">
          →
        </span>
      ) : null}
    </>
  );

  return !pending && item.href ? (
    <a className="protocol" href={item.href} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <div className="protocol">{body}</div>
  );
}
