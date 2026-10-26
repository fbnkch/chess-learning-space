import { Game } from "../game/Game";
import type { Finding } from "../review/explain";
import { goldenRules } from "../rules/catalogue";
function legalLine(fen: string, line: string[]) {
  const game = new Game(fen);
  return line.map((uci) => game.play(uci).san);
}
export function buildFacts(
  classification: string,
  findings: Finding[],
  fen: string,
  best: string[],
) {
  const pv = legalLine(fen, best);
  return {
    classification,
    bestMove: pv[0] ?? null,
    pv,
    findings: findings.map((f) => ({
      motif: f.motif,
      text: f.text,
      squares: f.squares,
      line: legalLine(f.fen, f.line),
      rule: (() => {
        const rule = goldenRules.find((r) => r.id === f.ruleId);
        if (!rule) throw new Error("Unknown rule");
        return { id: rule.id, text: rule.shortForm, reason: rule.reason };
      })(),
    })),
  };
}
export type WordingFacts = ReturnType<typeof buildFacts>;
export function buildPrompt(facts: WordingFacts) {
  return (
    "Rephrase these verified engine facts in two short sentences of plain English for a chess learner. " +
    "Use ONLY supplied facts. Do not analyse, invent moves, squares, numbers, rule IDs, or advice. " +
    "Keep move notation exactly as supplied, including check and mate suffixes. " +
    'Return ONLY JSON with one field: {"text":"..."}. Facts:\n' +
    JSON.stringify(facts)
  );
}
// Longest forms first: do not mistake an unknown coordinate move for two allowed squares.
const moves =
  /(?<![A-Za-z0-9])(?:[a-h][1-8][a-h][1-8][qrbn]?|(?:O|0)-(?:O|0)(?:-(?:O|0))?[+#]?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?)(?![A-Za-z0-9])/g;
const numbers = /[+-]?\d+(?:\.\d+)?/g;
export function validateWording(
  raw: string,
  facts: WordingFacts,
): string | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).join() !== "text"
    )
      return null;
    const rawText = (value as { text: unknown }).text;
    if (
      typeof rawText !== "string" ||
      !rawText.trim() ||
      rawText.length > 1200 ||
      /[<>]/.test(rawText)
    )
      return null;
    // Fold full-width forms (Ｑｅ４ -> Qe4) before any check, and refuse chess
    // figurines and Cyrillic/Greek lookalike letters outright.
    const text = rawText.normalize("NFKC");
    if (/[♔-♟Ͱ-ϿЀ-ӿ]/.test(text)) return null;
    const source = JSON.stringify(facts);
    // Only replayed line moves are permitted; a move mentioned incidentally
    // in a golden-rule text must never become permission to suggest it.
    const allowed = new Set<string>(facts.findings.flatMap((f) => f.squares));
    // SAN destinations alone are evidence squares too; piece SAN must still match exactly.
    const sanMoves = [...facts.pv, ...facts.findings.flatMap((f) => f.line)];
    sanMoves.forEach((m) => {
      allowed.add(m);
      for (const square of m.match(/[a-h][1-8]/g) ?? []) allowed.add(square);
    });
    for (const move of text.match(moves) ?? [])
      if (!allowed.has(move)) return null;
    // A written-out piece next to a square ("move the queen to e4") is a move
    // reference too: it must correspond to a verified SAN move of that piece.
    const letters: Record<string, string> = {
      king: "K",
      queen: "Q",
      rook: "R",
      bishop: "B",
      knight: "N",
      pawn: "",
    };
    const verified = new Set(sanMoves.map((m) => m.replace(/[+#]$/, "")));
    for (const m of text.matchAll(
      /\b(king|queen|rook|bishop|knight|pawn)s?\b(?:\W+\w+){0,4}?\W+([a-h][1-8])\b/gi,
    )) {
      const letter = letters[m[1].toLowerCase()];
      const square = m[2].toLowerCase();
      const ok = [...verified].some((san) =>
        letter
          ? san.startsWith(letter) && san.replace(/=.*/, "").endsWith(square)
          : /^[a-h]/.test(san) && san.replace(/=.*/, "").endsWith(square),
      );
      if (!ok) return null;
    }
    // Castling in words needs verified castling on the same wing.
    if (/\bcastl(?:e|es|ed|ing)\b/i.test(text)) {
      const short = verified.has("O-O"),
        long = verified.has("O-O-O");
      if (!short && !long) return null;
      if (/\bkingside\b/i.test(text) && !short) return null;
      if (/\bqueenside\b/i.test(text) && !long) return null;
    }
    // Reject nonstandard/case-changed notation instead of letting an embedded
    // square evade the SAN parser (for example nf3, E4 or e2-e5).
    for (const token of text.match(
      /\b[A-Za-z0-9=+#-]*[a-hA-H][1-8][A-Za-z0-9=+#-]*/g,
    ) ?? []) {
      if (!allowed.has(token)) return null;
    }
    const numberWords =
      /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/gi;
    const allowedWords = new Set(
      (source.match(numberWords) ?? []).map((word) => word.toLowerCase()),
    );
    for (const word of text.match(numberWords) ?? []) {
      if (!allowedWords.has(word.toLowerCase())) return null;
    }
    const ruleIds = new Set(facts.findings.map((f) => f.rule.id));
    for (const id of text.match(/\b[a-z]+(?:-[a-z]+)+\b/g) ?? []) {
      if (!ruleIds.has(id) && !source.includes(id)) return null;
    }
    const withoutNotation = (s: string) =>
      s.replace(moves, "").replace(/\b[a-z]+(?:-[a-z]+)+\b/g, "");
    const allowedNumbers = new Set(
      withoutNotation(source).match(numbers) ?? [],
    );
    for (const n of withoutNotation(text).match(numbers) ?? [])
      if (!allowedNumbers.has(n)) return null;
    return text.trim();
  } catch {
    return null;
  }
}
