import type { ReactNode } from "react";

/** Native disclosure keeps help available to keyboard and screen-reader users. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="info-tip">
      <summary aria-label={label}>
        <span aria-hidden="true">i</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}
