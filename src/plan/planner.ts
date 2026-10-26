import { dayStart, ordered, type Review } from "../scheduler/Scheduler";
import type { ScanAttempt } from "../threats/scan";
import type { Settings } from "../settings";

export const weeklyTemplate = [
  {
    id: "play",
    title: "Play on Chess.com",
    target: 2,
    minutes: 30,
    focus: "15+10 rapid. Check both sides' threats before each move.",
    href: "https://www.chess.com/play/online",
    external: true,
  },
  {
    id: "tactics",
    title: "Tactics",
    target: 3,
    minutes: 5,
    focus: "Repeat missed patterns, then solve slowly without guessing.",
    href: "#puzzles",
    external: false,
  },
  {
    id: "analysis",
    title: "Game analysis",
    target: 1,
    minutes: 10,
    focus: "Review one game and explain one turning point.",
    href: "#games",
    external: false,
  },
  {
    id: "openings",
    title: "Openings",
    target: 2,
    minutes: 5,
    focus: "Recall familiar lines; understand just one new line per week.",
    href: "#openings",
    external: false,
  },
  {
    id: "threats",
    title: "Threat awareness",
    target: 3,
    minutes: 3,
    focus: "Scan checks, captures and hanging pieces for both sides.",
    href: "#threats",
    external: false,
  },
  {
    id: "endgame",
    title: "Endgame study",
    target: 1,
    minutes: 10,
    focus: "Study one basic technique: king and rook mate or opposition.",
    href: "https://lichess.org/practice",
    external: true,
  },
] as const;
export type Area = (typeof weeklyTemplate)[number]["id"];
export function weeklyProgress(
  log: readonly Review[],
  scans: readonly ScanAttempt[],
  settings: Pick<Settings, "planStartedAt" | "planExternal">,
  clock: () => number,
) {
  const now = clock();
  const start = settings.planStartedAt ?? 0;
  const reviews = log.filter((r) => r.at >= start && r.at <= now);
  const sessions = (contexts: Review["context"][]) =>
    new Set(
      reviews
        .filter((r) => contexts.includes(r.context) && !r.lineUnlocked)
        .map((r) => r.sessionId),
    ).size;
  return {
    todaySessions: new Set(
      [...log.filter((r) => !r.lineUnlocked), ...scans]
        .filter((r) => r.at >= dayStart(now) && r.at <= now)
        .map((r) => r.sessionId),
    ).size,
    play: settings.planExternal?.play ?? 0,
    endgame: settings.planExternal?.endgame ?? 0,
    openings: sessions(["learn", "practice", "repertoire"]),
    tactics: sessions(["puzzle", "woodpecker", "mistake"]),
    threats: new Set(
      scans.filter((r) => r.at >= start && r.at <= now).map((r) => r.sessionId),
    ).size,
  };
}
export interface SessionStep {
  id: string;
  title: string;
  minutes: number;
  href: string;
}
export function planSession(due: {
  openings: number;
  puzzles: number;
  mistakes: number;
}): SessionStep[] {
  return [
    ...(due.openings
      ? [
          {
            id: "openings",
            title: `Recall due openings (${due.openings})`,
            minutes: 5,
            href: "#openings",
          },
        ]
      : []),
    ...(due.puzzles + due.mistakes
      ? [
          {
            id: "tactics",
            title: `Review puzzles (${due.puzzles}) and mistakes (${due.mistakes})`,
            minutes: 5,
            href: due.mistakes ? "#games?mistakes=1" : "#puzzles?mode=due",
          },
        ]
      : [
          {
            id: "tactics",
            title: "Solve puzzles",
            minutes: 5,
            href: "#puzzles",
          },
        ]),
    {
      id: "threats",
      title: "Scan three positions",
      minutes: 3,
      href: "#threats",
    },
    {
      id: "lesson",
      title: "Learn a line",
      minutes: 5,
      href: "#openings",
    },
  ];
}
export function lastOpening(log: readonly Review[]) {
  return ordered(log)
    .reverse()
    .find((r) => r.lineId && !r.lineUnlocked);
}
