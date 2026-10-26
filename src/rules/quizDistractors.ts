/** Reviewed against each resolved repertoire/catalogue example, not inferred from phase. */
export const quizDistractors: Record<
  string,
  { distractor: string; distractorReason: string }
> = {
  "one-move-per-piece": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Nf3 develops a knight; neither side has a passed pawn to advance.",
  },
  "knights-before-bishops": {
    distractor: "push-passed-pawns",
    distractorReason:
      "All sixteen pawns remain; this move develops a minor piece rather than advancing a passed pawn.",
  },
  "castle-early": {
    distractor: "knight-on-rim",
    distractorReason:
      "O-O moves the king and rook; neither white knight is on the rim.",
  },
  "queen-out-late": {
    distractor: "knight-on-rim",
    distractorReason:
      "Qd2 connects the rooks; neither white knight is on the rim.",
  },
  "develop-castling-side-first": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Nf6 prepares castling; Black has no passed pawn to push.",
  },
  "avoid-lesser-piece-hits": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Bb3 preserves the bishop; there is no white passed pawn to advance.",
  },
  "pawn-moves-two-to-six": {
    distractor: "flank-attack-centre-counter",
    distractorReason:
      "After 1.e4, no flank attack needs a counterattack.",
  },
  "king-safe-before-attack": {
    distractor: "defend-when-winning",
    distractorReason:
      "Material is equal, so Black is not defending a piece-up advantage.",
  },
  "opening-goal-rooks": {
    distractor: "attack-pinned-cheaply",
    distractorReason:
      "Re1 occupies an open file; it does not add a cheaper attacker to a pinned piece.",
  },
  "follow-principles-unknown-opening": {
    distractor: "push-passed-pawns",
    distractorReason:
      "All sixteen pawns remain; none is passed.",
  },
  "develop-with-tempo": {
    distractor: "centralize-queen-endgame",
    distractorReason:
      "Nc3 develops a knight against the exposed queen; this is not a queen endgame.",
  },
  "dont-block-breaks": {
    distractor: "push-passed-pawns",
    distractorReason:
      "The c-pawn needs access to c4; it is not passed.",
  },
  "cct-scan": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Nxe5 captures with a knight; White has no passed pawn to push.",
  },
  "assume-best-move": {
    distractor: "passed-pawn-zone",
    distractorReason:
      "White has no passed pawn to keep protected.",
  },
  "rooks-open-files": {
    distractor: "king-active-endgame",
    distractorReason:
      "Re8 activates a rook in a queen-rich middlegame; the black king should remain sheltered.",
  },
  "knight-on-rim": {
    distractor: "king-first-pawn-endings",
    distractorReason:
      "All pieces remain on the board; this is not a king-and-pawn ending.",
  },
  "trade-when-ahead": {
    distractor: "connected-passers-together",
    distractorReason:
      "White has an extra knight but no connected passed pawns to advance.",
  },
  "bishops-open-knights-closed": {
    distractor: "opposite-bishops-draw",
    distractorReason:
      "Both sides retain both bishops and queens; this is no opposite-colored-bishop endgame or blockade.",
  },
  "flank-attack-centre-counter": {
    distractor: "rook-endings-activity",
    distractorReason:
      "The move ...c5 challenges d4 in the opening; this is not a rook ending.",
  },
  "defend-when-winning": {
    distractor: "knight-on-rim",
    distractorReason:
      "There are no knights on the board; g3 addresses the mating threat on h2.",
  },
  "attack-pinned-cheaply": {
    distractor: "push-passed-pawns",
    distractorReason:
      "The e-pawn is not passed: Black has pawns on d6 and e6; e5 attacks the pinned knight.",
  },
  "count-attackers-defenders": {
    distractor: "connected-passers-together",
    distractorReason:
      "White has only one advanced central pawn, not connected passed pawns to advance together.",
  },
  "least-valuable-piece": {
    distractor: "push-passed-pawns",
    distractorReason:
      "The a2 pawn is opposed by a7 and b7; a3 challenges a bishop rather than advancing a passer.",
  },
  "capture-when-sharp": {
    distractor: "rook-endings-activity",
    distractorReason:
      "The move ...dxe4 resolves opening pawn tension; all major and minor pieces remain.",
  },
  "no-weaknesses-near-king": {
    distractor: "push-passed-pawns",
    distractorReason:
      "White has no passed pawn; the example concerns the pawn shield around g1.",
  },
  "push-passed-pawns": {
    distractor: "knight-on-rim",
    distractorReason:
      "Only kings and a pawn remain; there is no knight on a rim square.",
  },
  "passed-pawn-zone": {
    distractor: "knight-on-rim",
    distractorReason:
      "There are no knights; the mistake is leaving the e-pawn outside its king's protection.",
  },
  "king-active-endgame": {
    distractor: "centralize-queen-endgame",
    distractorReason:
      "There are no queens; the white king must approach the pawn action.",
  },
  "king-first-pawn-endings": {
    distractor: "rooks-open-files",
    distractorReason:
      "There are no rooks; opposition between the kings decides the pawn ending.",
  },
  "connected-passers-together": {
    distractor: "opposite-bishops-draw",
    distractorReason:
      "No bishops remain; coordinate the b- and c-pawns against the rook.",
  },
  "opposite-bishops-draw": {
    distractor: "rook-endings-activity",
    distractorReason:
      "There are no rooks; the opposite-colored bishops enable a blockade.",
  },
  "rook-endings-activity": {
    distractor: "knight-on-rim",
    distractorReason:
      "There are no knights; Re7 activates a rook and attacks pawns.",
  },
  "centralize-queen-endgame": {
    distractor: "connected-passers-together",
    distractorReason:
      "No pawns remain; the queen is on d4.",
  },
  "real-not-hope-chess": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Black has no passed pawn; check the opponent’s replies.",
  },
  "board-vision": {
    distractor: "attack-pinned-cheaply",
    distractorReason:
      "The starting position has no pinned piece to attack.",
  },
  "better-move-safe-first": {
    distractor: "connected-passers-together",
    distractorReason:
      "Bb3 saves an attacked bishop; White has no connected passed pawns to advance.",
  },
  "ask-opponent-intent": {
    distractor: "push-passed-pawns",
    distractorReason:
      "Qb3 concerns pressure on b7 and d5; White has no passed pawn to push.",
  },
  "question-your-move": {
    distractor: "connected-passers-together",
    distractorReason:
      "Bxf7+ is a candidate bishop sacrifice, not an advance by connected passed pawns.",
  },
  "plan-four-five-moves": {
    distractor: "castle-early",
    distractorReason:
      "White has already castled on g1.",
  },
  "botvinnik-time-budget": {
    distractor: "rook-endings-activity",
    distractorReason:
      "This is opening time management; all rooks remain on their starting squares.",
  },
  "slow-critical-moves": {
    distractor: "connected-passers-together",
    distractorReason:
      "The scenario allocates thinking time; there are no connected passed pawns on this board.",
  },
  "long-time-controls": {
    distractor: "attack-pinned-cheaply",
    distractorReason:
      "The starting position has no pinned piece; the scenario chooses a training time control.",
  },
};
