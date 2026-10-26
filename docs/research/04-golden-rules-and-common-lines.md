# Recherche 04 — Goldene Regeln & häufigste Gegnerzüge (bis 1500)

Zielgruppe: ~1000 Elo (Chess.com). Repertoire: Italienisch + London (Weiß), Caro-Kann + QGD (Schwarz).
Stand: 24.10.2026.

**Methodik / Quellenlage**

- Teil A: Primärquellen sind Dan Heismans Prinzipien-Seiten (wörtliche Formulierungen, mit
  `*` markiert Heismans eigene Prinzipien) sowie Video-Titel/Chapter der genannten Creator.
  Wo ich nur den Video-Titel, aber keinen Transkript-Inhalt geprüft habe, steht das dabei.
- Teil B: **Die Lichess-Explorer-API war nicht erreichbar.** Getestet am 24.10.2026:
  `https://explorer.lichess.ovh/lichess?...` und `/masters?...` → **HTTP 401 (nginx)**,
  auch über serverseitige Proxies (`r.jina.ai` → 401, `allorigins`/`codetabs` → 522).
  Das ist kein Header-Problem lokal, sondern eine serverseitige Sperre. Ersatzquelle:
  Websuche + Sekundärstatistiken. **Alle Prozentwerte in Teil B sind deshalb
  Schätzungen/Größenordnungen (⚠), keine API-Messung.** Die Ordnung der Züge ist belastbar,
  die exakten Zahlen nicht — Reproduktionsbefehle in §B.6.

---

# Teil A — Goldene Regeln

## A.0 Top 10 für 1000 Elo (die anderen 26 sind Beiwerk)

| # | Regel | Warum genau für ihn |
|---|---|---|
| 1 | **Checks, Captures, Threats — für beide Seiten** | Direkter Fix für „Drohungen 2 Züge voraus". Ein Scan, der alles andere trägt. |
| 2 | **Is my move safe?** (Blunder-Check vor dem Zug) | Nicht die eigene Idee prüfen, sondern *was danach ungedeckt ist*. |
| 3 | **Assume your opponent plays his best move** (Anti-Hope-Chess) | Trennt Real Chess von Hope Chess. |
| 4 | **Move every piece once before any piece twice** | Eröffnungsdefizit ohne Theorie lösen; die häufigste 1000er-Schwäche. |
| 5 | **Castle early** | Ein Zug, zwei Figuren; verhindert die halbe Verlustursachen-Liste. |
| 6 | **What does my opponent want?** (nach jedem Gegnerzug) | Der „What changed?"-Drill in einem Satz. |
| 7 | **When ahead, trade pieces — not pawns** | Die meisten gewonnenen Stellungen werden bei 1000 noch verschenkt. |
| 8 | **Rooks need open files** | Turm auf e- bzw. d/c-Linie ist der billigste Mittelspiel-Plan. |
| 9 | **Passed pawns must be pushed** | Endspiel-Punkte ohne Technikwissen. |
| 10 | **Play longer games, think on every move** (Botvinnik: ~20 % der Zeit für die ersten 15 Züge) | Ohne Zeit hilft keine Regel. |

## A.1 Eröffnung

| # | Regel (EN) | Begründung (1 Satz) | Wichtige Ausnahme | Vertreter / Quelle |
|---|---|---|---|---|
| 1 | *Move every piece once before you move any piece twice* | Jeder Zweitzug einer Figur ist ein verschenktes Tempo, das der Gegner mit einer neuen Figur bezahlt. | Die Figur wird angegriffen, oder es gibt einen konkreten Taktikzug für beide Seiten. | Heisman, Opening Principles #1 (wörtlich) |
| 2 | *Knights before bishops* | Springer haben weniger gute Felder, der Läufer kann später leichter das richtige Diagonale wählen. | Meint meist „Springer vor dem Läufer **derselben Seite**"; Ausnahme: der Läufer muss zuerst (Pinn, London-`Bf4`) | Heisman #7; Chess.com „Principles of Chess" |
| 3 | *Castling is usually the most important move in any opening* | Es ist der einzige Zug, der zwei Figuren gleichzeitig entwickelt und den König sichert. | Offene Zentren, in denen Rochade zu langsam ist — dann zuerst Zentrum schließen. | Heisman #5 |
| 4 | *Don't bring your queen out early* | Die Dame wird von Springern/Läufern mit Tempogewinn angegriffen. | Wenn die Dame konkret Material gewinnt oder Matt droht. | Chess.com „Principles of Chess"; GothamChess (Standardkritik in Game Reviews) |
| 5 | *Develop the pieces on the side you will castle first* | Die Angriffs-/Schutzseite muss zuerst stehen. | Bei Rochade nach der anderen Seite entsprechend spiegeln. | Heisman #3 |
| 6 | *Don't develop to squares a lesser piece can hit* | Ein Bauern-Tempo gegen eine Figur kostet zwei Züge. | Wenn der Angreifer dadurch selbst schwächt (Löcher, Bauernexponierung). | Heisman #4 |
| 7 | *Two pawns is not enough, six is too many* | Zwei Bauernzüge geben keinen Raum, sechs kosten zu viel Zeit und schwächen. | Geschlossene Systeme (Königsindisch-Aufbauten) brauchen mehr Bauernzüge. | Heisman (Hon. Mention) |
| 8 | *Don't start a fight until your king is safe* | Angriff ohne sicheren König endet in Gegenschach. | Wenn der Gegner noch unrochiert ist und die Initiative alles wert ist. | Heisman (Hon. Mention) |
| 9 | *The main goal of the opening is to develop your rooks* | Wer die Türme zuerst verbindet und auf Linien bringt, gewinnt das Mittelspiel. | — | Heisman #9 |
| 10 | *If you don't know the opening, follow the principles — don't panic* | 90 % der 1000er-Antworten sind mit 4 Prinzipien spielbar. | Echte Theorie-Fallen (Fried Liver, ...Qb6xb2 im London) muss man kennen. | Heisman #6 |
| 11 | *Develop with tempo* | Ein Zug, der entwickelt **und** droht, ist zwei Züge wert. | Nicht in Drohungen verrennen, die der Gegner einfach pariert. | Naroditsky (Speedrun-Zusammenfassungen) |
| 12 | *Don't block your break moves with pieces* | Der Bruchzug (`c5`/`e5`/`c4`/`e4`) ist der Sinn der Struktur. | Wenn der Blockadezug selbst die Stellung trägt. | Heisman #10 |

## A.2 Mittelspiel

| # | Regel (EN) | Begründung | Ausnahme | Vertreter / Quelle |
|---|---|---|---|---|
| 13 | *Checks, Captures, Threats — in that order, for both players* | Zwingende Züge zuerst prüfen, weil sie die Rechnung abkürzen. | Stellung ist ruhig und statisch — dann Plan zuerst. | Heisman, Middlegame Principles (wörtlich) |
| 14 | *Assume your opponent's move is his best move* | Wer die beste Antwort erwartet, verliert keine Figur an eine „Hoffnung". | Gegen klar schwächere Gegner: Drohungen trotzdem respektieren. | Chess.com „Principles of Chess"; Heisman (Hope Chess) |
| 15 | *Rooks need open and semi-open files* | Ohne Linie ist der Turm eine teure Figur ohne Aufgabe. | Geschlossene Stellung: Turm hinter den eigenen Bauernbruch. | Heisman (wörtlich) |
| 16 | *A knight on the rim is dim* | Randspringer hat die Hälfte seiner Felder verloren. | Im Endspiel oder mit konkreter Kontrolle von c/d-Feldern oft gut. | Chess.com „Principles of Chess" |
| 17 | *When ahead pieces trade pieces, when behind pieces trade pawns* | Vorsprung lässt sich mit weniger Material leichter verwerten; in Unterzahl braucht man Verwirrung. | Remis-Tendenz (Springergabel-Festungen) oder wenn das Endspiel technisch schwer ist. | Heisman (wörtlich) |
| 18 | *Bishops open, knights closed* | Läufer brauchen Diagonalen, Springer feste Stützpunkte. | Springer auf e5/d5 im geschlossenen Zentrum ist stärker als jeder Läufer. | Heisman |
| 19 | *An attack on the flank is met by a counterattack in the center* | Der Gegner gibt dort Raum auf, wo er angreift. | Wenn das Zentrum fixiert/geschlossen ist. | Heisman (wörtlich) |
| 20 | *If winning by a piece or more, think defense first* | Die häufigste 1000er-Niederlage: gewonnen und dann offen gespielt. | Nicht passiv werden — Verteidigung heißt „Drohungen entschärfen", nicht „zurückziehen". | Heisman (Dan-Original) |
| 21 | *Attack pinned pieces with cheaper pieces; don't take a pinned piece* | Die Fessel hält die Figur fest — Tausch hebt die Fessel auf. | Wenn der Tausch konkret Material oder Matt erzwingt. | Heisman |
| 22 | *Count attackers vs defenders before trading* | „Angegriffen und verteidigt" heißt nicht „gewinnt". | Wenn ein Verteidiger nicht zählt (überlastet, weglenkbar). | Naroditsky (Speedrun-Lessons) |
| 23 | *The least valuable piece should do the job* | Bauernzug statt Figurenzug spart die Figur für Wichtigeres. | Wenn nur die Figur das Feld erreicht. | Naroditsky (Listudy-Sammlung) |
| 24 | *When the position gets sharp, take the capture* | Ein ruhiger Zug gibt dem Gegner die Initiative. | Wenn die Abwicklung materialverlierend ist — rechnen, nicht prinzipien. | Heisman |
| 25 | *Don't create weaknesses in front of your king* | Bauernzüge sind nicht rückgängig zu machen. | Wenn der Angriff sonst nicht durchkommt (mit Damen auf dem Brett selten). | Naroditsky |

## A.3 Endspiel

| # | Regel (EN) | Begründung | Ausnahme | Vertreter / Quelle |
|---|---|---|---|---|
| 26 | *Passed pawns must be pushed* | Ein Freibauer bindet Figuren und wird stärker, je näher er der Umwandlung ist. | Siehe #27 — nie über die Deckungszone hinaus. | Heisman (wörtlich) |
| 27 | *Never push a passed pawn past its zone of protection* | Ein gedeckter Freibauer ist eine Waffe, ein ungedeckter eine Zielscheibe. | Wenn er forciert umwandelt. | Heisman (Dan-Original) |
| 28 | *The king is a strong piece in the endgame — move it toward the action* | Der König kämpft im Endspiel wie ~4 Bauern. | Bei offenen schweren Figuren (v. a. Damen) bleibt er zurück. | Heisman (wörtlich) |
| 29 | *In king-and-pawn endgames the king comes first* | Bauernzüge warten können, die Opposition nicht. | Wenn ein Durchbruch sofort entscheidet. | Heisman |
| 30 | *Connected passed pawns are pushed together (6th rank beats a rook)* | Zwei verbundene Freibauern sind stärker als die Figur, die sie stoppen soll. | Wenn ein Bauer als Köder/Blockade geopfert werden muss. | Heisman |
| 31 | *Bishops of opposite colour = easiest draw* | Kein Fortschritt möglich, häufig ein bis zwei Bauern Remis-Kompensation. | Wenn der eigene König/ die Feldfarbe klar dominiert. | Heisman |
| 32 | *In rook endings the active king and rook matter most* | Aktivität schlägt Bauernzahl in T-Endspielen. | Bei gedeckten Freibauern und Turm hinter dem Bauern. | Heisman |
| 33 | *Centralize the queen in the endgame* | Die Dame ist die einzige Figur, die von der Mitte aus beide Flügel erreicht. | Wenn sie dort Schachziel wird. | Heisman |

## A.4 Denkprozess

| # | Regel (EN) | Begründung | Ausnahme | Vertreter / Quelle |
|---|---|---|---|---|
| 34 | *Real chess vs Hope chess* | Hope Chess = ziehen und hoffen; Real Chess = alle gegnerischen Antworten vorher durchgehen. | Keine. Das ist die Kernregel. | Heisman (wörtlich, „Passive vs Basic Hope Chess") |
| 35 | *You can't play what you don't see* | Board Vision ist die Voraussetzung, nicht die Kür. | — | Heisman (Dan-Original) |
| 36 | *If you see a good move, look for a better one — but first make sure yours is safe* | Zwei Fehler in einem Satz: zu früh zufrieden, zu spät geprüft. | Zeitnot: dann den sicheren Zug nehmen. | Heisman |
| 37 | *Ask „why did he move there?" after every opponent move* | Jeder Gegnerzug hat eine Absicht; wer sie nicht sucht, findet sie erst nach dem Matt. | — | Chess.com „Principles of Chess"; Naroditsky |
| 38 | *Don't move automatically — question your move* | Automatikzüge („Schach, weil Schach") sind die häufigste 1000er-Fehlerquelle. | Theoriezüge in den ersten 8 Zügen. | Naroditsky (Speedrun-Lessons) |
| 39 | *Plan in 4–5 Zügen, nicht in 15* | Ein Plan ist eine Kette konkreter Schritte, kein Tagtraum. | — | Naroditsky |

## A.5 Zeitmanagement

| # | Regel (EN) | Begründung | Ausnahme | Vertreter / Quelle |
|---|---|---|---|---|
| 40 | **Botvinnik's rule**: ~20 % der Zeit für die ersten 15 Züge (langsame Partien) | Wer die Eröffnung verbraucht, hat im Mittelspiel kein Geld mehr. | Sehr taktische Eröffnungen bzw. wenn man nach 2 Zügen aus dem Buch ist. | Heisman (zitiert Botvinnik) |
| 41 | *Slow down on critical moves, not on every move* | 30 s pro Zug schlägt 3 min einmal. | Wenn die Stellung ruhig ist und der Plan klar ist. | Heisman (Thought Process); verbreitete Coach-Empfehlung |
| 42 | *Play longer time controls to improve* | Blitz trainiert Muster, Rapid trainiert Denken. | Blitz als Belohnung, nicht als Training. | — (keine Einzelquelle; verbreitete Coach-Empfehlung, vgl. Recherche 01 §1.3) |

## A.6 Wer steht wofür (Kurzprofile mit Quelle)

| Creator | Rolle im Regelkanon | Belegte Quelle |
|---|---|---|
| **Dan Heisman** | Der präziseste Katalog: Thought Process, Hope Chess, CCT, Eröffnungs-/Mittel-/Endspiel-Prinzipien mit Ausnahmen. Für ein Lernprogramm die beste Textbasis. | https://www.danheisman.com/thought-process-principles.html · /opening-principles.html · /middlegame-principles.html · /endgame-principles.html |
| **Levy Rozman (GothamChess)** | Fehlerkatalog „was 800–1400 falsch machen": frühe Dame, Figur mehrfach ziehen, Angriff ohne Entwicklung, Autopilot-Zugfolgen. | „7 MOST COMMON Chess Mistakes" https://www.youtube.com/watch?v=SXrKRA_KZ5k · „How To Calculate In Chess" https://www.youtube.com/watch?v=9Ga9dP3bvN8 · „How To Learn & Study Chess Openings" https://www.youtube.com/watch?v=6IegDENuxU4 |
| **Daniel Naroditsky** | Prinzipien *im* Zug erklärt: Entwicklung mit Tempo, Prophylaxe, Angreifer/Verteidiger zählen, „least valuable piece", Pläne in 4–5 Zügen. | Playlist https://www.youtube.com/playlist?list=PLT1F2nOxLHOfQ-eoJTpyvKkQFwYewDduj · Zusammenfassung https://chess.stasdeep.com/blog/naroditsky-speedrun-learnings/back-to-3000/elo-700-1000 · Sammlung https://listudy.org/en/blog/daniel-naroditsky-speedrun-principles |
| **Hikaru Nakamura** | „So bestraft man schwache Züge": Entwicklung, Aktivität, gegnerische Passivität ausnutzen; auch direkte Eröffnungs-Masterclasses (London, Caro-Kann). | „How to Crush a 500, Every Step Explained" https://www.youtube.com/watch?v=_eBxJWRHV48 · „SLOWKARU: Crossing 1000 with Caro-Kann Masterclass" https://www.youtube.com/watch?v=PBXGp_px9m4 |
| **Nelson Lopez (Chess Vibes)** | Systematische Prinzipien-Sammlungen über alle drei Phasen — gut als Checkliste, weniger als Erklärung. | „35 Vital Chess Principles" https://www.youtube.com/watch?v=nXyJdetptXg · „Why You Keep Losing — 15 Chess Principles" https://www.youtube.com/watch?v=7zZUz5DQZJM |
| **Anna Cramling** | Blunder-Vermeidung und „was denkt der Gegner"-Routinen, sehr niedrigschwellig. | „The SECRET To Stop Blundering Your Pieces" https://www.youtube.com/watch?v=7vt5Lt5VUH4 · „5 MUST-KNOW Chess Tips For Every Beginner" https://www.youtube.com/watch?v=QxP_u5Puyx8 |
| **IM Eric Rosen** | Ruhiges Rechnen, Fallen erkennen/vermeiden, London-System als solides Weiß-Repertoire. | „Beginner Opening Lessons & Tactics (Speedrun 2)" https://www.youtube.com/watch?v=XJ2T-Ksi59c · „How to Punish Beginner Opening Mistakes (Speedrun 3)" https://www.youtube.com/watch?v=WOp-An1ubJk |
| **TheBigGreek** | „Guess the Elo": wiederkehrende Fehlermuster pro Ratingstufe (Entwicklung, loses Material, Planlosigkeit). | Kanal https://www.youtube.com/@TheBigGreek84 — ⚠ *keine einzelne Video-URL verifiziert*, Aussagen daher nicht zitatfähig |

> Hinweis: Regeln #12, #16, #33 u. a. sind klassisches Allgemeingut (Tarrasch, Lasker,
> Steinitz). Ich habe sie nur dort einem Creator zugeordnet, wo ich die Formulierung
> tatsächlich in einer Quelle gelesen habe.

---

# Teil B — Häufigste gegnerische Antworten bis 1500

> ⚠ **Fallback-Kennzeichnung.** Die Lichess-Explorer-API liefert 401 (siehe Methodik).
> Die Prozentwerte unten sind **Schätzungen aus Sekundärquellen und Erfahrungswerten**,
> keine Messung. Belastbar ist die **Reihenfolge**, nicht die Nachkommastelle.
> Reproduktion mit echten Zahlen: §B.6.

Anker (echte Zahlen, aber Meister-/Turnier-Datenbank, nicht 1000-1400):
1.e4 47,0 %, 1.d4 34,6 %, 1.Nf3 9,4 %, 1.c4 7,1 % von 2.150.754 Partien
(chessgames.com-Explorer). ⚠ Auf Lichess 1000–1400 ist 1.e4 nach allen mir
zugänglichen Sekundärquellen deutlich häufiger (Schätzung ~55–60 %),
1.d4 ~28–32 %, 1.c4/1.Nf3 je ~4–6 %.

## B.1 Weiß: Italienisch — was kommt nach 1.e4?

| Zug | ⚠ Anteil | Empfohlene Antwort (SAN) | Idee in einem Satz |
|---|---|---|---|
| 1...e5 | 35–45 % | 2.Nf3 → 3.Bc4 (Repertoire) | Normalfall; Ziel ist `c3`+`d4`+`O-O`+`Re1`. |
| 1...c5 | 18–23 % | 2.Nf3, dann 3.d4 | Offenes Sizilianisch mit Prinzipien statt Theorie; **nicht** 2...d6 fürchten, 4.Nxd4 ist immer möglich. |
| 1...e6 | 8–11 % | 2.d4 d5 3.exd5 exd5 | Französisch symmetrisch entschärft: keine Läuferprobleme, keine Theorie, nur `Nf3`/`Bd3`/`O-O`. |
| 1...c6 | 7–10 % | 2.d4 d5 3.Nc3 dxe4 4.Nxe4 | Genau seine eigene Caro-Struktur mit vertauschten Farben — weißes Plus: der Läufer kommt frei. |
| 1...d6 | 5–8 % | 2.d4 Nf6 3.Nc3 g6 4.Be3, `Qd2`, `O-O-O` | Pirc/Modern mit dem „150-Angriff light": Bauernsturm `h4-h5`, sonst nichts Neues. |
| 1...d5 | 3–5 % | 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 | Skandinavisch = sein Schwarz-Repertoire; weiß nur mit einem Tempo mehr. |
| 1...Nf6 | 2–4 % | 2.e5 Nd5 3.d4 d6 4.Nf3, `c4` | Aljechin: Raumgewinn mit Bauern, danach normal entwickeln. |
| 1...g6 | 2–4 % | 2.d4 Bg7 3.Nc3 d6 4.Be3 | Modern; ruhig aufbauen, Zentrum halten, nicht sofort öffnen. |
| 1...Nc6 | 1–3 % | 2.d4 d5 3.Nc3 | Nimzowitsch-Verteidigung; wird zur Art Französisch/Caro mit vertauschten Farben. |
| 1...b6 / 1...a6 / 1...h6 / 1...f5 | je <2 % | 2.d4 + normale Entwicklung | Gegen exotische Erstzüge gilt nur Regel A.1 #10: nicht panisch, Prinzipien. |

**Verzweigung nach 1.e4 e5 2.Nf3**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 2...Nc6 | 55–65 % | 3.Bc4 | Standardpfad ins Repertoire. |
| 2...Nf6 | 8–12 % | 3.Nc3 (Vierspringer) | Umgeht Petrov-Theorie; `Bc4`/`d3`/`O-O` folgt demselben Bild. |
| 2...d6 | 6–9 % | 3.d4 exd4 4.Nxd4 | Philidor: Weiß bekommt das volle Zentrum geschenkt. |
| 2...f5?! / 2...Bc5?! / 2...Qe7 | je <2 % | 3.d4 / 3.Bc4 | Sonderzüge bestrafen, nicht studieren. |

**Verzweigung nach 3.Bc4**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 3...Bc5 | 40–45 % | 4.c3, dann `d4`, `O-O`, `Re1`, `Nbd2` | Giuoco Pianissimo: das Dreieck c3/d4/e3 hält das Zentrum. |
| 3...Nf6 | 30–35 % | 4.d3 (Two Knights → Pianissimo) | **Nicht** 4.Ng5 (Fried-Liver-Fallen). |
| 3...Be7 | 5–8 % | 4.d4 exd4 5.Nxd4 | Ungarisch: Weiß bekommt freies Spiel, Schwarz bleibt passiv. |
| 3...d6 | 4–6 % | 4.c3, `d4` | Sehr solide, aber Schwarz gibt das Zentrum kampflos. |
| 3...Na5 / 3...Nd4 / 3...h6 | je <2 % | 4.Nxe5 bzw. 4.c3 | Randzüge: Zentrum mit `d4` sofort bestrafen. |

**Nach 4.c3 (gegen 3...Bc5)**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 4...Nf6 | 50–55 % | 5.d3 (Pianissimo) | Der Hauptpfad seines Repertoires. |
| 4...Qe7 | 8–12 % | 5.d4 Bb6 6.O-O | Frühe Dame: Entwicklung mit `Re1`/`Bg5`-Druck bestrafen. |
| 4...d6 | 6–10 % | 5.d4 Bb6 6.O-O | Ruhig; `a4`/`Nbd2` mit späterem `a4`-Vorstoß. |
| 4...Bb6 | 4–6 % | 5.d4 Qe7 6.O-O | Läuferzug ohne Entwicklung; Weiß gewinnt ein Tempo. |
| 4...Qf6 / 4...h6 / 4...Bxf2+ | je <3 % | 5.d4 / 5.d4 | Sonderfälle; `Bxf2+` ist ein Bauernopfer ohne echten Angriff. |

## B.2 Weiß: London — was kommt nach 1.d4?

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 1...Nf6 | 35–42 % | 2.Bf4 → 3.e3, `c3`, `Nd2`, `Bd3` | Der häufigste Fall; System bleibt identisch. |
| 1...d5 | 30–35 % | 2.Bf4 Nf6 3.e3 c5 4.c3 Nc6 5.Nd2 | Standard-London mit festem Aufbau. |
| 1...e6 | 4–6 % | 2.Bf4 d5 3.e3 | Transponiert in dasselbe Bild. |
| 1...g6 | 4–6 % | 2.Nf3 Bg7 3.Bf4 | Gegen KID/Modern: erst `e3`/`Bd3`, `c4` nur wenn es sicher ist. |
| 1...d6 | 3–5 % | 2.e4 | Altindisch/Pirc-Aufbau: Weiß darf `e4` sofort spielen. |
| 1...c5 | 2–4 % | 2.d5 e6 3.c4 | Benoni: Raum nehmen, nicht in wilde Theorie gehen. |
| 1...f5 | 2–4 % | 2.Nf3 e6 3.Bf4 | Holländisch: Londoner Aufbau funktioniert unverändert. |
| 1...c6 / 1...Nc6 / 1...b6 / 1...b5 | je 1–3 % | 2.Bf4 bzw. 2.e4 | Exoten: Prinzipien, kein Studium. |

**Nach 2.Bf4 (der typische Punkt, an dem die Partie kippt)**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 2...Nf6 | 32–38 % | 3.e3 → 4.c3/`Nd2` | Normalpfad. |
| 2...c5 | 15–20 % | 3.e3 Qb6 4.Nc3 (b2 decken!) | **Kernfalle:** `...Qb6` greift b2 an, weil `Bf4` b2 nicht mehr deckt. |
| 2...e6 | 10–14 % | 3.e3 c5 4.c3 Nc6 5.Nd2 | Klassischer QGD-artiger Aufbau. |
| 2...Nc6 | 6–9 % | 3.e3 e6 4.c3 Bd6 5.Bg3 | Läufer auf g3 stellt den Tausch `...Bxg3` in Rechnung. |
| 2...Bf5 | 5–7 % | 3.e3 e6 4.Nf3, `Bd3` | Spiegel-Läufer: `Bd3` erzwingt den Tausch. |
| 2...c6 / 2...g6 / 2...Bd6 | je 3–5 % | 3.e3 + Standardaufbau | System bleibt, nur Reihenfolge anders. |

## B.3 Schwarz: Caro-Kann — was spielt Weiß nach 1.e4 c6?

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 2.d4 | 50–58 % | 2...d5 | Hauptpfad. |
| 2.Nc3 | 12–16 % | 2...d5 3.Nf3 Bg4 | Sf3 früh → `Bg4` fesselt und provoziert `h3`/`Bxf3`. |
| 2.Nf3 | 8–12 % | 2...d5 3.Nc3 dxe4 4.Nxe4 | Transponiert in seine Hauptlinie. |
| 2.c4 | 4–7 % | 2...d5 3.cxd5 cxd5 4.exd5 Nf6 | Panov-Vorbereitung; Entwicklung mit `Nf6`/`Nc6`, kein Bauernhunger. |
| 2.d3 | 4–6 % | 2...d5 3.Nd2 e5 | Königsfianchetto-Idee entschärfen: sofort `e5`. |
| 2.Bc4 | 2–3 % | 2...d5 3.Bb3 e6 | Hillbilly-Angriff: ruhig `e6`/`Nf6`, dann `c5`. |
| 2.e5? / 2.f4? | <2 % | 2...d5 | Vorstoß ins Leere: normal entwickeln, Weiß hat Löcher. |

**Nach 2.d4 d5**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 3.Nc3 | 38–45 % | 3...dxe4 4.Nxe4 Bf5 | Hauptlinie: Läufer **vor** `e6` raus — der ganze Sinn des Caro-Kann. |
| 3.e5 | 22–28 % | 3...Bf5 4.Nf3 e6 5.Be2 c5 | Vorstoß-Variante: `c5` ist der einzige Befreiungsplan, den er braucht. |
| 3.exd5 | 18–22 % | 3...cxd5 4.Bd3 Nc6 5.c3 | Abtausch: Struktur bleibt symmetrisch, Schwarz hat null Risiko. |
| 3.Nd2 | 5–8 % | 3...dxe4 4.Nxe4 Nd7 (oder `Bf5`) | Sd2 ist ungenau — `Nd7`/`Ngf6` mit Druck auf den Se4. |
| 3.f3 | 2–4 % | 3...dxe4 4.fxe4 e5! | Der klassische Konter: Weiß hat den Läufer eingesperrt und `e5` öffnet das Zentrum. |
| 3.Be3 / 3.Bd3 / 3.h4 | je <2 % | 3...dxe4 + `Bf5`/`e6` | Exoten: Hauptaufbau, keine Sonderregel nötig. |

## B.4 Schwarz: QGD — was spielt Weiß nach 1.d4 d5?

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 2.c4 | 50–58 % | 2...e6 → QGD | Hauptpfad; **nicht** 2...c6 oder 2...Nc6, sonst verliert er sein Schema. |
| 2.Bf4 (London) | 15–20 % | 2...Nf6 3.e3 e6 4.Nf3 c5 5.c3 Nc6 | London mit QGD-Aufbau beantworten: `c5` + `Nc6` + `Bd6`-Tausch. |
| 2.Nf3 | 12–16 % | 2...Nf6 3.c4 e6 | Transponiert ins QGD; gegen 3.Bf4 wieder London-Schema. |
| 2.e3 | 4–6 % | 2...Nf6 3.Bd3 c5 4.c3 Nc6 | Colle/Angriff auf h7: `c5` sofort, das nimmt dem Aufbau die Spitze. |
| 2.Nc3 | 2–4 % | 2...Nf6 3.Bf4 e6 | Transponiert; früh `c5` planen. |
| 2.Bg5 / 2.g3 / 2.b3 | je <3 % | 2...Nf6 + `e6` | Exoten: Standardentwicklung, dann `c5`. |

**Nach 1.d4 d5 2.c4 e6**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 3.Nc3 | 40–48 % | 3...Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 | Hauptlinie seines Repertoires (mit `Rc1`, `Bd3`, `c6`). |
| 3.Nf3 | 30–38 % | 3...Nf6 4.Bg5 Be7 5.e3 O-O 6.Nbd7 | Transposition; `Nbd7` **muss** kommen, sonst hängt Sf6 nach `Bg5`. |
| 3.cxd5 | 6–10 % | 3...exd5 | Abtausch-QGD: `Bd6`, `Nge7`/`Nf6`, `O-O` — die einfachste Struktur. |
| 3.e3 / 3.Bf4 | 4–7 % | 3...Nf6 4.Nf3 c5 5.cxd5 Nxd5 | Isolani-/Tarrasch-Territorium: `c5` und Blockade auf d5. |
| 3.Bg5 | 2–4 % | 3...Be7 4.e3 Nf6 | Fessel ohne Drohung — mit `h6`/`Be7` neutralisieren (Lasker-Regel). |

**Gegen 1.c4 / 1.Nf3 / 1.b3 (Aufbau-Weiß)**

| Zug | ⚠ Anteil | Antwort | Idee |
|---|---|---|---|
| 1.c4 | — | 1...e6 2.d4 d5 | Sophisticated-QGD-Transposition; vermeidet Englisch-Theorie. |
| 1.Nf3 | — | 1...d5 2.d4 Nf6 3.c4 e6 | Reti → QGD. |
| 1.b3 / 1.b4 / 1.g3 | — | 1...d5 + `Nf6`/`e6`/`c5` | Immer derselbe Aufbau; gegen `b4`/`Bb2` früh `c5`. |

## B.5 Was er **nicht** abdecken muss (bewusst ignorieren)

- Alles unter ~3 %: `1...a6`, `1...h6`, `1...Na6`, `2...Qe7`-Exoten, Birds/Larsen-Systeme.
- Sizilianisch-Nebenlinien als Schwarz, Königsindisch, Grünfeld, Französisch als Schwarz — bewusst nicht im Repertoire.
- Theorie-Tiefe über Zug 8 hinaus: nach dem Aufbau-Bild greifen die Regeln aus Teil A.
- Fallen-Sammlungen: nur die, die sein *eigenes* Repertoire berühren (London `...Qb6xb2`, Italienisch Fried Liver, Caro `h4-h5`).

## B.6 Echte Zahlen reproduzieren (wenn die API wieder erreichbar ist)

```
# Blocker-Check zuerst:
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid&ratings=1000,1200,1400&play=e2e4"
# Erwartung 200. Am 24.10.2026: 401 (nginx) → Fallback in diesem Dokument.

# Pro Verzweigungspunkt (UCI-Züge kommagetrennt, kein Leerzeichen):
...&play=e2e4,e7e5,g1f3          # Antworten auf 2.Nf3
...&play=e2e4,e7e5,g1f3,b8c6,f1c4  # Antworten auf 3.Bc4
...&play=e2e4,e7e5,g1f3,b8c6,f1c4,f8c5,c2c3  # Antworten auf 4.c3
...&play=d2d4,g8f6,c1f4          # Antworten auf 2.Bf4 (London)
...&play=e2e4,c7c6,d2d4,d7d5     # Antworten auf 3.Nc3/3.e5/3.exd5
...&play=d2d4,d7d5,c2c4,e7e6     # Antworten auf 3.Nc3/3.Nf3 im QGD
# Antwort = Prozent = games / total_count im JSON-Feld "moves[]".
```

Server-Proxy-Test (falls lokal 401, serverseitig aber offen):
`https://r.jina.ai/https://explorer.lichess.ovh/lichess?...` — war am 24.10.2026 ebenfalls 401.

---

## Quellen

**Prinzipien (Primär, wörtlich geprüft)**
- Dan Heisman, Thought Process Principles — https://www.danheisman.com/thought-process-principles.html
- Dan Heisman, Opening Principles — https://www.danheisman.com/opening-principles.html
- Dan Heisman, Middlegame Principles — https://www.danheisman.com/middlegame-principles.html
- Dan Heisman, Endgame Principles — https://www.danheisman.com/endgame-principles.html
- Dan Heisman, General/Other Principles — https://www.danheisman.com/generalother-principles.html
- Chess.com, „Principles of Chess" (Klassikerliste: knight on the rim, queen out early, assume best move) — https://www.chess.com/article/view/principles-of-chess
- Chess.com, „The Principles of the Opening" — https://www.chess.com/article/view/the-principles-of-the-opening

**Creator**
- GothamChess, 7 MOST COMMON Chess Mistakes — https://www.youtube.com/watch?v=SXrKRA_KZ5k
- GothamChess, How To Calculate In Chess — https://www.youtube.com/watch?v=9Ga9dP3bvN8
- Naroditsky Speedrun-Playlist — https://www.youtube.com/playlist?list=PLT1F2nOxLHOfQ-eoJTpyvKkQFwYewDduj
- Naroditsky-Lessons (Elo 700–1000, mit Video-Quellen) — https://chess.stasdeep.com/blog/naroditsky-speedrun-learnings/back-to-3000/elo-700-1000
- „25 Lessons from Naroditsky's Speedrun" (Listudy) — https://listudy.org/en/blog/daniel-naroditsky-speedrun-principles (am 24.10.2026 HTTP 500, Inhalt nur via Suchsnippet)
- GMHikaru, How to Crush a 500 — https://www.youtube.com/watch?v=_eBxJWRHV48
- GMHikaru, Caro-Kann Masterclass (Slowkaru 1000) — https://www.youtube.com/watch?v=PBXGp_px9m4
- Chess Vibes, 35 Vital Chess Principles — https://www.youtube.com/watch?v=nXyJdetptXg
- Chess Vibes, Why You Keep Losing — https://www.youtube.com/watch?v=7zZUz5DQZJM
- Anna Cramling, Stop Blundering Your Pieces — https://www.youtube.com/watch?v=7vt5Lt5VUH4
- Anna Cramling, 5 MUST-KNOW Chess Tips — https://www.youtube.com/watch?v=QxP_u5Puyx8
- Eric Rosen, Speedrun Ep. 2 — https://www.youtube.com/watch?v=XJ2T-Ksi59c · Ep. 3 — https://www.youtube.com/watch?v=WOp-An1ubJk
- TheBigGreek (Kanal) — https://www.youtube.com/@TheBigGreek84

**Statistik / Fallback**
- Lichess Opening Explorer API (Ziel-API, am 24.10.2026: 401) — https://explorer.lichess.ovh/lichess
- chessgames.com Opening Explorer (Meister-DB, echte Zählungen) — https://www.chessgames.com/perl/explorer
- 365Chess Opening Explorer (große DB inkl. Amateure) — https://www.365chess.com/opening.php
- Chess.com, „Chess Opening Frequency" (1.e4 70 %, 1.d4 20 % im Amateur-Sample) — https://www.chess.com/article/view/chess-opening-frequency
