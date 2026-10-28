import type { ReactNode } from "react";

const paths = {
  home: (
    <>
      <path d="m4 10 8-6 8 6v10h-6v-6h-4v6H4Z" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
    </>
  ),
  openings: (
    <>
      <path d="M12 6c-3-2-5-2-8-1v14c3-1 5-1 8 1 3-2 5-2 8-1V5c-3-1-5-1-8 1Zm0 0v14" />
    </>
  ),
  rules: (
    <>
      <path d="M6 4h12v16l-6-3-6 3Z" />
      <path d="M9 8h6M9 11h4" />
    </>
  ),
  threats: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
    </>
  ),
  puzzles: (
    <>
      <path d="m12 3 9 9-9 9-9-9Z" />
      <path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none" />
    </>
  ),
  games: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 12h8M8 17h4" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-3-3-1-1-3Z" />
      <circle cx="12" cy="11" r="3" />
    </>
  ),
  knight: (
    <>
      <path d="M5 21h15l-1-5-3-4 3-1-2-6-6-3v4L5 11l2 3 5-2-2 4-5 2Z" />
      <path d="M14 7h.01" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
} satisfies Record<string, ReactNode>;

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
