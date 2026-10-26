import { useEffect, useState, type ReactNode } from "react";

/** Keep configuration available while giving the board the compact viewport. */
export function TrainingOptions({
  title,
  compactOpen = false,
  children,
}: {
  title: string;
  compactOpen?: boolean;
  children: ReactNode;
}) {
  const [wide, setWide] = useState(
    () => matchMedia("(min-width: 901px)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(min-width: 901px)");
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <details className="training-options" open={wide || compactOpen}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}
