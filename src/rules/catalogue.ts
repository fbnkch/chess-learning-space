/**
 * The Golden Rules catalogue. Facts come from docs/research/04 Part A; a rule
 * without a verified source keeps `sourceUrl: null` and is shown as unsourced.
 */
export type RulePhase =
  | "opening"
  | "middlegame"
  | "endgame"
  | "thinking"
  | "time";

export interface RuleArrow {
  kind: "move" | "plan" | "ray";
  label?: string;
  from: string;
  to: string;
  color?: "green" | "red" | "blue" | "yellow";
}

export interface GoldenRule {
  /** Stable kebab-case identity. Repertoire content references it. */
  id: string;
  phase: RulePhase;
  shortForm: string;
  reason: string;
  exception: string;
  creators: string[];
  sourceUrl: string | null;
  exampleFen: string;
  arrows?: RuleArrow[];
  circles?: { square: string; color: "green" | "red" | "blue" | "yellow" }[];
  exampleText?: string;
  /** 1–10 for the Top 10 at 1000 Elo (research §A.0), null otherwise. */
  priority: number | null;
}

export const phases: { id: RulePhase; label: string }[] = [
  { id: "opening", label: "Opening" },
  { id: "middlegame", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
  { id: "thinking", label: "Thinking process" },
  { id: "time", label: "Time management" },
];

const heismanOpening = "https://www.danheisman.com/opening-principles.html";
const heismanMiddlegame =
  "https://www.danheisman.com/middlegame-principles.html";
const heismanEndgame = "https://www.danheisman.com/endgame-principles.html";
const heismanThought =
  "https://www.danheisman.com/thought-process-principles.html";
const chessCom = "https://www.chess.com/article/view/principles-of-chess";
const naroditsky =
  "https://chess.stasdeep.com/blog/naroditsky-speedrun-learnings/back-to-3000/elo-700-1000";
const naroditskyList =
  "https://listudy.org/en/blog/daniel-naroditsky-speedrun-principles";

export const goldenRules: GoldenRule[] = [
  // Opening (research §A.1)
  {
    id: "one-move-per-piece",
    phase: "opening",
    shortForm: "Develop every piece before moving one twice",
    reason:
      "Repeated piece moves can lose time while the opponent develops.",
    exception:
      "An attacked piece or concrete tactic requires action; closed centers permit rerouting.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6",
    priority: 4,
  },
  {
    id: "knights-before-bishops",
    phase: "opening",
    shortForm: "Usually develop the knight before the bishop on the same side",
    reason:
      "Knights have fewer good squares; bishops can choose their diagonals later.",
    exception:
      "The bishop must move first to pin, or to take its London square on f4.",
    creators: ["Dan Heisman", "Chess.com"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3",
    priority: null,
  },
  {
    id: "castle-early",
    phase: "opening",
    shortForm: "Castle early",
    reason:
      "Only castling develops two pieces at once and moves the king out of the center.",
    exception:
      "With an open center, castling can be too slow; close the center first.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6",
    arrows: [
      { kind: "move", from: "e1", to: "g1" },
      {
        kind: "plan",
        from: "h1",
        to: "f1",
        label: "Rook relocation as part of O-O",
        color: "blue",
      },
    ],
    priority: 5,
  },
  {
    id: "queen-out-late",
    phase: "opening",
    shortForm: "Don't bring your queen out early",
    reason:
      "Knights and bishops can attack an early queen with tempo.",
    exception: "The queen wins material or creates a direct mate threat.",
    creators: ["Chess.com", "GothamChess"],
    sourceUrl: chessCom,
    exampleFen: "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2",
    priority: null,
  },
  {
    id: "develop-castling-side-first",
    phase: "opening",
    shortForm: "Develop the castling side first",
    reason:
      "The pieces guarding the king need to be ready before the position opens.",
    exception:
      "When you castle the other way, mirror the development to that side.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6",
    priority: null,
  },
  {
    id: "avoid-lesser-piece-hits",
    phase: "opening",
    shortForm: "Don't develop to a square a lesser piece can hit",
    reason:
      "A pawn attack on a piece gains two tempi and forces defense.",
    exception:
      "If the attacker weakens their own position, the square can still be good.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
    arrows: [
      {
        kind: "ray",
        from: "a6",
        to: "b5",
        label: "Pawn attack: a6 controls b5",
        color: "red",
      },
    ],
    priority: null,
  },
  {
    id: "pawn-moves-two-to-six",
    phase: "opening",
    shortForm: "Two pawn moves are too few; six are too many",
    reason:
      "The structure determines pawn moves: too few cramp pieces; too many delay development and create weaknesses.",
    exception:
      "Closed systems such as King's Indian setups need more pawn moves.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6",
    priority: null,
  },
  {
    id: "king-safe-before-attack",
    phase: "opening",
    shortForm: "Don't start a fight until your king is safe",
    reason:
      "Attacking with an uncastled king invites counter-checks through an open center.",
    exception:
      "When the opponent is still uncastled and the initiative is worth everything.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6",
    priority: null,
  },
  {
    id: "opening-goal-rooks",
    phase: "opening",
    shortForm: "Develop the rooks to complete the opening",
    reason:
      "Developed minor pieces, a safe king and a queen off the back rank connect rooks for open files.",
    exception: "",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p1B1/2B1P3/2NP1N2/PPP1QPPP/R4RK1 w - - 4 8",
    priority: null,
  },
  {
    id: "follow-principles-unknown-opening",
    phase: "opening",
    shortForm:
      "Follow opening principles in unfamiliar lines",
    reason:
      "Central control, development and king safety guide candidate moves in unfamiliar lines, but concrete threats still need checking.",
    exception:
      "Learn traps such as the Fried Liver and London ...Qb6xb2.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "rn1qkbnr/pbpp1ppp/1p2p3/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 0 4",
    priority: null,
  },
  {
    id: "develop-with-tempo",
    phase: "opening",
    shortForm: "Develop with tempo",
    reason:
      "Developing with a threat does the work of two ordinary moves.",
    exception: "Don't chase threats the opponent can simply answer.",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditsky,
    exampleFen: "rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
    arrows: [{ kind: "move", from: "b1", to: "c3" }],
    priority: null,
    exampleText:
      "Nc3 develops with an attack on the queen, forcing Black to respond.",
  },
  {
    id: "dont-block-breaks",
    phase: "opening",
    shortForm: "Don't block your break moves with pieces",
    reason:
      "A piece blocking a pawn break prevents the structure’s intended advance.",
    exception: "When the blockading move carries the position on its own.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanOpening,
    exampleFen:
      "rnbqkb1r/ppp2ppp/4pn2/3p4/3P4/2N2N2/PPP1PPPP/R1BQKB1R w KQkq - 0 4",
    arrows: [
      {
        kind: "plan",
        from: "c2",
        to: "c4",
        label: "Blocked plan: c2-c4",
        color: "blue",
      },
    ],
    priority: null,
    circles: [{ square: "c3", color: "red" }],
    exampleText:
      "Nc3 blocks the planned c2-c4 pawn break, which is illegal here.",
  },

  // Middlegame (research §A.2)
  {
    id: "cct-scan",
    phase: "middlegame",
    shortForm: "Scan checks, captures and threats for both sides",
    reason:
      "Forcing moves shorten calculation and reveal the opponent’s options.",
    exception:
      "In a quiet, static position, make a plan before hunting for tactics.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    arrows: [
      { kind: "move", from: "f3", to: "e5" },
      { kind: "move", from: "c4", to: "f7", color: "yellow" },
    ],
    priority: 1,
  },
  {
    id: "assume-best-move",
    phase: "middlegame",
    shortForm: "Assume your opponent's move is their best move",
    reason:
      "Expecting the best reply avoids relying on the opponent’s mistakes.",
    exception: "Against a clearly weaker opponent, still respect every threat.",
    creators: ["Chess.com", "Dan Heisman"],
    sourceUrl: chessCom,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 4 7",
    priority: 3,
  },
  {
    id: "rooks-open-files",
    phase: "middlegame",
    shortForm: "Rooks need open and semi-open files",
    reason: "A rook needs a file to become active.",
    exception: "In a closed position, put the rook behind your own pawn break.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen: "3r2k1/pp3ppp/8/8/8/8/PP3PPP/3R2K1 w - - 0 1",
    arrows: [{ kind: "move", from: "d1", to: "d8", color: "yellow" }],
    priority: 8,
  },
  {
    id: "knight-on-rim",
    phase: "middlegame",
    shortForm: "Keep knights off the rim",
    reason:
      "A knight on the rim loses half its squares and controls little of the center.",
    exception:
      "Endgames or control of important central squares can justify a rim knight.",
    creators: ["Chess.com"],
    sourceUrl: chessCom,
    exampleFen: "rnbqkbnr/pppppppp/8/8/8/7N/PPPPPPPP/RNBQKB1R b KQkq - 1 1",
    priority: null,
  },
  {
    id: "trade-when-ahead",
    phase: "middlegame",
    shortForm: "Trade pieces rather than pawns when ahead in material",
    reason:
      "Piece trades ease conversion of extra material; pawn trades create drawing chances.",
    exception:
      "A fortress, or an endgame you cannot convert, can make trades less useful.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen: "r2q1rk1/ppp2ppp/8/3p4/8/2N5/PPP2PPP/R2Q1RK1 w - - 0 1",
    priority: 7,
  },
  {
    id: "bishops-open-knights-closed",
    phase: "middlegame",
    shortForm: "Bishops want open positions, knights want closed ones",
    reason:
      "Bishops need long diagonals; knights need protected squares in a blocked center.",
    exception:
      "Tactics and outposts take precedence; a bad bishop can still defend important pawns.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    priority: null,
  },
  {
    id: "flank-attack-centre-counter",
    phase: "middlegame",
    shortForm: "Counter a flank attack in the center",
    reason:
      "A central counterattack opens lines and diverts pieces from a flank attack.",
    exception:
      "A fixed or closed center can favor a flank attack.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P1P1/2NP1N2/PPP2P1P/R1BQ1RK1 b - - 0 8",
    arrows: [{ kind: "move", from: "d7", to: "d5" }],
    priority: null,
    exampleText:
      "Meet White’s g4 advance with the central break ...d5.",
  },
  {
    id: "defend-when-winning",
    phase: "middlegame",
    shortForm: "Defend first when ahead by a piece or more",
    reason:
      "Continuing to attack as though behind is the most common way to lose a won game.",
    exception: "Defence means meeting threats, not retreating into passivity.",
    creators: ["Dan Heisman"],
    sourceUrl: null,
    exampleFen: "6k1/5ppp/3b4/8/7q/8/5PPP/R2Q1RK1 w - - 0 1",
    priority: null,
    arrows: [{ kind: "move", from: "g2", to: "g3" }],
    exampleText:
      "White is far ahead, but ...Qxh2 would be mate. g3 attacks the queen and blocks the bishop's attack on h2.",
  },
  {
    id: "attack-pinned-cheaply",
    phase: "middlegame",
    shortForm: "Attack a pinned piece with a cheaper piece, and don't take it",
    reason:
      "A cheaper attacker pressures a pinned piece without releasing the pin, but relative pins can break.",
    exception: "When the exchange itself forces material gain or mate.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen:
      "rn1qkb1r/ppp2ppp/3ppn2/6B1/4P3/8/PPPP1PPP/RN1QKBNR w KQkq - 0 1",
    arrows: [{ kind: "move", from: "e4", to: "e5" }],
    priority: null,
    exampleText:
      "With Bg5 pinning Nf6 to Qd8, e5 adds a pawn attack, but Black can break this relative pin.",
  },
  {
    id: "count-attackers-defenders",
    phase: "middlegame",
    shortForm: "Count attackers and defenders before you trade",
    reason:
      "Attacker counts alone prove nothing; exchange order, piece values and pins determine whether a capture wins.",
    exception:
      "A defender that is overloaded or can be deflected does not count.",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditsky,
    exampleFen:
      "rn1qkb1r/ppp2ppp/3ppn2/4P1B1/8/8/PPPP1PPP/RN1QKBNR w KQkq - 0 1",
    arrows: [
      { kind: "move", from: "e5", to: "f6" },
      { kind: "move", from: "g5", to: "f6" },
      {
        kind: "ray",
        from: "d8",
        to: "f6",
        label: "Defender ray: Qd8 protects Nf6",
        color: "blue",
      },
    ],
    priority: null,
  },
  {
    id: "least-valuable-piece",
    phase: "middlegame",
    shortForm: "Let the least valuable piece do the job",
    reason:
      "A pawn doing the same job leaves pieces free for other tasks.",
    exception: "When only the piece can reach the square.",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditskyList,
    exampleFen:
      "r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
    arrows: [{ kind: "move", from: "a2", to: "a3" }],
    priority: null,
  },
  {
    id: "capture-when-sharp",
    phase: "middlegame",
    shortForm: "When the position gets sharp, take the capture",
    reason:
      "A quiet move gives the opponent the initiative in a forcing position.",
    exception:
      "If the capture loses material, calculate instead of following a principle.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanMiddlegame,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    arrows: [{ kind: "move", from: "f3", to: "e5" }],
    priority: null,
  },
  {
    id: "no-weaknesses-near-king",
    phase: "middlegame",
    shortForm: "Don't create weaknesses in front of your king",
    reason:
      "Pawn moves are irreversible; gaps near the king become targets.",
    exception:
      "Only when necessary for a concrete attack; rarely while queens remain.",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditsky,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    priority: null,
  },

  // Endgame (research §A.3)
  {
    id: "push-passed-pawns",
    phase: "endgame",
    shortForm: "Push passed pawns",
    reason:
      "A passed pawn ties down pieces and grows stronger as it approaches promotion.",
    exception:
      "Never push it beyond the zone where your own pieces can protect it.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "8/8/8/4P3/8/8/4K3/7k w - - 0 1",
    arrows: [{ kind: "move", from: "e5", to: "e6" }],
    priority: 9,
  },
  {
    id: "passed-pawn-zone",
    phase: "endgame",
    shortForm: "Never push a passed pawn past its zone of protection",
    reason:
      "A protected passed pawn threatens promotion; an unprotected one invites capture.",
    exception: "When the push forces promotion immediately.",
    creators: ["Dan Heisman"],
    sourceUrl: null,
    exampleFen: "8/4k3/8/4P3/4K3/8/8/8 w - - 0 1",
    priority: null,
    arrows: [{ kind: "move", from: "e5", to: "e6", color: "red" }],
    exampleText:
      "After e6? the pawn leaves its king's protection, then Kxe6 wins it.",
  },
  {
    id: "king-active-endgame",
    phase: "endgame",
    shortForm:
      "Bring the king toward the action in the endgame",
    reason:
      "An active king fights like a minor piece and decides most endgames.",
    exception:
      "With heavy pieces, especially queens, on the board, keep the king back.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "8/8/8/3k4/8/4P3/8/4K3 w - - 0 1",
    arrows: [{ kind: "move", from: "e1", to: "d2" }],
    priority: null,
  },
  {
    id: "king-first-pawn-endings",
    phase: "endgame",
    shortForm: "In king-and-pawn endgames the king comes first",
    reason: "Pawn moves can wait; opposition between kings cannot.",
    exception: "When a breakthrough decides immediately.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "8/8/8/3k4/8/3K4/3P4/8 w - - 0 1",
    priority: null,
  },
  {
    id: "connected-passers-together",
    phase: "endgame",
    shortForm: "Advance connected passed pawns together",
    reason:
      "Connected passers alternate protection (c5 guards b6, then b6 guards c7 after c6); side-by-side pawns do not defend each other.",
    exception: "When one pawn must be sacrificed as a decoy or blockader.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "r6k/8/8/1PP5/8/8/8/4K3 w - - 0 1",
    arrows: [
      { kind: "move", from: "b5", to: "b6" },
      { kind: "move", from: "c5", to: "c6" },
    ],
    priority: null,
    exampleText:
      "Advance b6 then c6 when safe; sixth-rank connected passers can beat a rook depending on king and rook placement.",
  },
  {
    id: "opposite-bishops-draw",
    phase: "endgame",
    shortForm: "Opposite-colored bishops offer the easiest draws",
    reason:
      "Opposite-colored bishops permit blockades beyond the attacking bishop’s reach, so even one or two extra pawns may not win.",
    exception:
      "An active king, widely separated passers or a decisive attack can still win.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "8/5b2/3k4/4p3/4P3/3K4/8/2B5 w - - 0 1",
    priority: null,
  },
  {
    id: "rook-endings-activity",
    phase: "endgame",
    shortForm: "In rook endings the active king and rook matter most",
    reason:
      "King and rook activity can outweigh a pawn deficit.",
    exception: "With protected passed pawns, put the rook behind the pawn.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "7r/pp3pkp/6p1/8/8/3K4/PP3PPP/4R3 w - - 0 1",
    priority: null,
    arrows: [{ kind: "move", from: "e1", to: "e7" }],
    exampleText:
      "Re7 activates the rook on the seventh rank and attacks a7 and f7; the king is already active on d3.",
  },
  {
    id: "centralize-queen-endgame",
    phase: "endgame",
    shortForm: "Centralize the queen in the endgame",
    reason:
      "A centralized queen reaches both flanks quickly and combines checks with attacks on pawns.",
    exception: "When the central square exposes her to checks.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanEndgame,
    exampleFen: "8/8/4k3/8/3Q4/8/4K3/8 w - - 0 1",
    priority: null,
  },

  // Thinking process (research §A.4)
  {
    id: "real-not-hope-chess",
    phase: "thinking",
    shortForm: "Check replies before moving",
    reason:
      "Checking every opponent reply avoids moving and hoping the opponent misses it.",
    exception: "",
    creators: ["Dan Heisman"],
    sourceUrl: heismanThought,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6",
    priority: null,
  },
  {
    id: "board-vision",
    phase: "thinking",
    shortForm: "See every piece before calculating",
    reason:
      "Calculation fails when pieces go unnoticed.",
    exception: "",
    creators: ["Dan Heisman"],
    sourceUrl: null,
    exampleFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    priority: null,
    exampleText:
      "Name undefended pawns (none initially) and legal knight moves (Na3, Nc3, Nf3, Nh3), then repeat after each position change.",
  },
  {
    id: "better-move-safe-first",
    phase: "thinking",
    shortForm: "Check move safety, then compare alternatives",
    reason:
      "Checking replies exposes newly undefended pieces before committing to a candidate; comparing alternatives can reveal a better move.",
    exception: "In time trouble, take the safe move.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanThought,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    priority: 2,
  },
  {
    id: "ask-opponent-intent",
    phase: "thinking",
    shortForm: "Check the purpose of every opponent move",
    reason:
      "Ignoring the opponent’s intention leaves threats undiscovered until too late.",
    exception: "",
    creators: ["Chess.com", "Daniel Naroditsky"],
    sourceUrl: chessCom,
    exampleFen:
      "rnb1kbnr/pp2pppp/1q6/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 4 4",
    arrows: [
      {
        kind: "ray",
        from: "b6",
        to: "b2",
        label: "Opponent threat: Qb6 attacks b2",
        color: "red",
      },
    ],
    priority: 6,
  },
  {
    id: "question-your-move",
    phase: "thinking",
    shortForm: "Question automatic moves",
    reason:
      "Automatic moves, including unexamined checks, are the most common cause of blunders at 1000 Elo.",
    exception: "Book moves in the first eight moves.",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditsky,
    exampleFen:
      "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 6",
    arrows: [{ kind: "move", from: "c4", to: "f7", color: "red" }],
    priority: null,
  },
  {
    id: "plan-four-five-moves",
    phase: "thinking",
    shortForm: "Plan in four or five moves, not fifteen",
    reason: "A plan needs concrete steps.",
    exception: "",
    creators: ["Daniel Naroditsky"],
    sourceUrl: naroditsky,
    exampleFen:
      "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 6",
    priority: null,
    exampleText:
      "Consider c3, Re1, Nbd2, Nf1 and Ng3 as five White moves, rescanning threats and adjusting their order after each reply.",
  },

  // Time management (research §A.5)
  {
    id: "botvinnik-time-budget",
    phase: "time",
    shortForm: "Play longer games, think on every move",
    reason:
      "Botvinnik’s slow-game heuristic reserves roughly 20% of starting time for moves 1-15, leaving the rest for the middlegame.",
    exception:
      "Very tactical openings, or when you are out of book after two moves.",
    creators: ["Dan Heisman", "Mikhail Botvinnik"],
    sourceUrl: heismanThought,
    exampleFen:
      "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 3",
    priority: 10,
    exampleText:
      "Budget about 12 of 60 minutes for moves 1-15, retaining 48; adjust for critical positions and increment.",
  },
  {
    id: "slow-critical-moves",
    phase: "time",
    shortForm: "Slow down on critical moves, not on every move",
    reason:
      "Regular 30-second thinks beat instant moves surrounding one three-minute think; critical positions need extra time.",
    exception:
      "Use less time with a clear plan in quiet positions; still check safety.",
    creators: ["Dan Heisman"],
    sourceUrl: heismanThought,
    exampleFen:
      "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 4 8",
    priority: null,
    exampleText:
      "In slow games, allow roughly 30 seconds for routine threat scans, candidate comparison and safety checks; forcing decisions need minutes.",
  },
  {
    id: "long-time-controls",
    phase: "time",
    shortForm: "Play longer time controls to improve",
    reason: "Blitz trains pattern recognition; rapid trains thinking.",
    exception: "Use blitz as a reward, not as your training.",
    creators: [],
    sourceUrl: null,
    exampleFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    priority: null,
    exampleText:
      "Try 30+20, scan threats and check safety each move, then review for ten minutes.",
  },
];

export function rulesByPhase(phase: RulePhase): GoldenRule[] {
  return goldenRules.filter((rule) => rule.phase === phase);
}

export const topRules: GoldenRule[] = goldenRules
  .filter((rule) => rule.priority !== null)
  .sort((a, b) => a.priority! - b.priority!);
