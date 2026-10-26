export function Sparkline({ values }: { values: number[] }) {
  const low = Math.min(...values),
    range = Math.max(...values) - low || 1;
  const points = values
    .map(
      (v, i) =>
        `${4 + (i * 152) / Math.max(1, values.length - 1)},${36 - ((v - low) * 28) / range}`,
    )
    .join(" ");
  return (
    <svg
      className="sparkline"
      viewBox="0 0 160 44"
      role="img"
      aria-label={
        values.length
          ? `Puzzle ratings: ${values.map(Math.round).join(", ")}`
          : "No rated puzzles yet"
      }
    >
      <path d="M4 40H156" stroke="var(--border)" />
      {values.length > 1 ? (
        <polyline
          points={points}
          fill="none"
          stroke="var(--info)"
          strokeWidth="2"
        />
      ) : values.length === 1 ? (
        <circle cx="4" cy="36" r="3" fill="var(--info)" />
      ) : null}
    </svg>
  );
}

export function CoverageBar({
  total,
  discovered,
  mastered,
}: {
  total: number;
  discovered: number;
  mastered: number;
}) {
  return (
    <div
      className="coverage-bar"
      role="img"
      aria-label={`${mastered} mastered, ${discovered} discovered of ${total} positions`}
    >
      <span style={{ width: `${(100 * discovered) / (total || 1)}%` }} />
      <strong style={{ width: `${(100 * mastered) / (total || 1)}%` }} />
    </div>
  );
}

export function WeekDots({
  days,
}: {
  days: { label: string; count: number }[];
}) {
  return (
    <div
      className="week-dots"
      role="img"
      aria-label={days.map((d) => `${d.label}: ${d.count} sessions`).join(", ")}
    >
      {days.map((d) => (
        <span
          key={d.label}
          className={d.count ? "has-session" : undefined}
          title={`${d.label}: ${d.count} sessions`}
        />
      ))}
    </div>
  );
}
