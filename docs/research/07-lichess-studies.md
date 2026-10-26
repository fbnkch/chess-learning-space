# 07 - Lichess study survey for the repertoire

Stand: 2026-10-25. Quellen: Lichess-Studienseiten und `api/study/{id}.pgn` per curl (User-Agent gesetzt), `api/user/{name}` für Titel, Lichess-Nutzungsbedingungen.

## Methodik und Einschränkungen

- `lichess.org/study/search?q=...` und Topic-Listen liefern per curl und WebFetch **HTTP 403**. Die Suche musste daher über WebSearch laufen; die Studien-IDs stammen aus Suchtreffern und Autoren-Listen (`api/study/by/{user}`).
- Der Masters-Explorer (`explorer.lichess.ovh/masters`) antwortet **401**. Die Stichprobe gegen die Masters-DB konnte deshalb **nicht durchgeführt** werden. Alle Aussagen zur Theorie unten sind Einschätzungen aus Fachwissen, nicht gegen die DB geprüft.
- Titel wurden über `api/user/{name}` geprüft (Feld `title`). Leer = kein FIDE-/Lichess-Titel.
- Likes stammen aus dem JSON der Studienseite am 2026-10-25. Kapitelzahlen stammen aus der PGN-Ausgabe oder der Kapitelliste der Seite.

## Ergebnis in Kürze

| Eröffnung | Beste Studie | Titel des Autors | Verdict |
|---|---|---|---|
| Italian, Giuoco Pianissimo | keine saubere Empfehlung | FM (Zig_Zag_Zug_Zwang) bzw. kein Titel | Nur eingeschränkt brauchbar |
| Caro-Kann (Gesamt) | Shreksify, "The Caro Kann Defence: Complete Repertoire" | kein Titel | Brauchbar, Abdeckung passt |
| Caro-Kann (Exchange) | GM JThybo, "Kill The Caro-Kann - Exchange variation" | GM | Seriös, aber nur Exchange, wenig Likes |
| London (als Weiß) | davidharoldchess, "London System Repertoire" | kein Titel | Gut passend, viele Likes |
| QGD / ...d5 | Bosburp, "Queen's Gambit \| Full Repertoire" | kein Titel | Brauchbar, Abdeckung prüfen |

## Italian (Giuoco Pianissimo)

**1. FM Zig_Zag_Zug_Zwang, "How to play the Italian"**
- URL: https://lichess.org/study/tNLu9LfW
- Autor: Zig_Zag_Zug_Zwang, FM (verifiziert über API)
- Likes: 1583; Kapitel: ca. 23 (Titel auf der Seite, PGN-Export liefert nichts)
- Level: Einsteiger bis Club; Kapitel mit Emoji-Titeln und Erklärstil
- Relevant: "Stopping b4!", "Bishop Trade?", "Black's Knight Maneuver", "Taking back with the Bishop/knight", "a6 prophylaxis", Sideline "Be7 Italian", "Fianchetto Italian"
- Verdict: Seriös genug (FM, hohe Likes, Autor aktiv). Enthält aber keinen erkennbaren Kapitelaufbau nach 4.c3 Nf6 5.d3. Ob die Kapitel Giuoco Pianissimo exakt abdecken, ist ungeprüft. Als Ergänzung geeignet, nicht als Hauptquelle.

**2. Thinodya, "Italian Game (50 Lessons): Two Gambits and a Meeting with Bobby Fischer!"**
- URL: https://lichess.org/study/EY8AUyPd (neuere Version) bzw. https://lichess.org/study/LVjM0eZI (ältere Version)
- Autor: Thinodya (kein Titel)
- Likes: 4980 (EY8AUyPd), 1932 (LVjM0eZI); Kapitel: 50
- Kapitel (Auszug): Giuoco Piano, Greco Gambit (Bb6/Be7/exd4), "Traditional Line" (Bxd2, Nxe4, d5), "Modern Line" (d5, Ne4, Ng4, Nh5), Evans Gambit "Meet Bobby Fischer"
- Verdict: **Eher nicht empfehlen.** Der Schwerpunkt liegt auf Gambits und dem Clickbait-Titel. Die Kapitel "Traditional/Modern Line" könnten Giuoco Piano berühren, sind aber nicht als Giuoco-Pianissimo-Repertoire aufgebaut. Ablehnen als Hauptquelle, Gambits gehören nicht zu unserem Repertoire.

Keine Studie mit GM/IM-Autor zu Giuoco Pianissimo gefunden (Suchtreffer: nur Kursangebote von GM Basso / GM Supi, nicht auf Lichess).

## Caro-Kann

**1. Shreksify, "The Caro Kann Defence: Complete Repertoire"**
- URL: https://lichess.org/study/MBQ3N0F8
- Autor: shreksify (kein Titel), Likes: 1777, Kapitel: 60 (PGN-Export)
- Level: Club bis Fortgeschritten, lange Studie, gute Kapitelbeschreibung
- Abdeckung: Introduction; Interactive Lessons zu Exchange, Panov, Tartakower, Advance, Two Knights, Accelerated Panov, Fantasy 3.f3; Kapitel 1–3 Exchange (inkl. Rubinstein, Nf3/Nc3-Seitenlinien); Kapitel 4–6 Panov (Fianchetto, Standard, QGD-Struktur); Kapitel 7–12 Classical (Capablanca, Tartakower/Korchnoi, Bronstein-Larsen, Karpov/Smyslov-Petrosian, Finnish, Modern); Kapitel 13–16 Advance (Bf5-Move-Order, Botvinnik-Carlsbad); Kapitel 17–19 Two Knights (Tartakower, Karpov, Classical)
- Verdict: Brauchbar und passt in Umfang zu unserer Caro-Liste (Advance, Exchange, Classical, Fantasy, Two Knights). Nicht von einem Titelträger. Typos im Text ("Tarkakower"). Vor Übernahme jede Hauptlinie gegen Fachliteratur prüfen.

**2. GM JThybo, "Kill The Caro-Kann - Exchange variation Complete Repertoire by GM"**
- URL: https://lichess.org/study/iO8MI04A
- Autor: JThybo, GM (verifiziert über API). Likes: 109. Kapitel: 2 (PGN: "Full Repertoire", "EASY line VS the Caro-Kann")
- Verdict: Seriöser Autor, aber nur Exchange und wenige Likes. Als Querverweis für unsere Exchange-Kapitel nützlich, nicht als Hauptquelle.

Weitere gesichtete Caro-Studien (nicht empfohlen): Bosburp "CRUSH the Caro-Kann!" (https://lichess.org/study/64DHMYix, 1190 Likes, 35 Kapitel, Schwerpunkt Gambits/"Insane Gambits" und 4...Bf5?!-Trickfallen, kein Titel), Gurupriya2011 "The Caro Kann Defence: Full Repertoire" (https://lichess.org/study/hvIiNClg, 89 Likes, 9 Kapitel, kein Titel), anomality "Caro-Kann Defense" (https://lichess.org/study/YldXJ931, 6 Likes).

## London System (als Weiß mit Bf4)

**1. davidharoldchess, "London System Repertoire"**
- URL: https://lichess.org/study/2EaSmZtz
- Autor: davidharoldchess (kein Titel, 7734 Partien). Likes: 2609. Kapitel: 18 (PGN: Introduction, London System Basics, vs d5 e6 Part 1/2, vs d5 c5 Part 1, vs KID/Grünfeld, vs Benoni, vs Old Benoni, Stonewall London, Alternative London, vs cxd4, vs Ne4, vs Bf5, Anti-Londons Part 1–5)
- Startstellung der Einleitung (FEN aus dem PGN): Weiß mit d4, Bf4, c3, e3, Bd3, Nf3, Nd2, Qc2 gegen die unveränderte schwarze Grundstellung. Das ist ein Setup mit Qc2/Nd2, nicht die reine Bf4-Ausprägung. Für unseren Plan sollte die Notation dies explizit festhalten.
- Relevant: Kapitel "London System Basics", "vs d5 e6", "vs cxd4", "vs Ne4", "vs Bf5" (unsere Linien gegen Schwarz-Systeme) sowie die Anti-London-Kapitel (Schwarz-Gegenwehr, aus unserer Sicht nützlich zum Verständnis, nicht zum Spielen).
- Verdict: Hohe Popularität, vollständige Struktur, Bf4-Plan passt. Kein Titel, und die Suchtreffer nennen einen anderen Autor (SummerAndo); die PGN-Annotator-Angabe ist davidharoldchess. Wir haben nur die PGN-Seite gesehen, die Varianten nicht gegen die Masters-DB geprüft.

## QGD / ...d5 (gegen 1.d4)

**1. Bosburp, "Queen's Gambit | Full Repertoire"**
- URL: https://lichess.org/study/0uRBskUV
- Autor: bosburp (kein Titel). Likes: 1456. Kapitel: 40 (Titelliste auf der Seite)
- Abschnitte: Queen's Gambit Accepted (Rosenthal, Classical, Smyslov, Janowski-Larsen, Gunsberg, Alekhine, Slav-Gambit), Queen's Gambit Declined (Exchange 3...Nf6 4.cxd5, Charousek 3...Be7, Tarrasch 3...c5, Janowski 3...a6, 3...dxc4), Slav/Semi-Slav (Czech, Steiner, Soultanbeieff, Smyslov, Botvinnik, Anti-Moscow), Move-2-Sidelines (Albin, Chigorin, Austrian, Marshall, Baltic)
- Verdict: Brauchbar für den QGD-Kern. Keine Abdeckung von London/Colle/1.Nf3/1.c4 erkennbar (Titel zeigen nur 1.d4-Systeme mit 2.c4). Die Linien "Charousek", "Tarrasch" und "Janowski" sind Nebenlinien, die für unser Ziel (QGD-Hauptlinien) ggf. zu breit sind. Nicht mit Gambit-Trickfallen verwechseln, das ist hier nicht der Schwerpunkt.

**Abgelehnt:** psj34q3D "QGD Aaryans class BG5" (https://lichess.org/study/psj34q3D, 1 Like, Autor Weak_Player_GM ohne Titel).

Kursangebote mit Titelträgern (nicht auf Lichess, nur Hinweis): Sam Collins (Lasker-Variante), John Cox (Tartakower/Lasker), Michael Prusikin (New in Chess 2022). Nicht geprüft, nur als Fremdquellen gelistet.

## Abweichungen zu unserem Plan (Stichpunkte)

- Italian: Lichess-Studien empfehlen Giuoco Piano breit und mit Gambits (Greco, Evans). Unser Plan 4.c3 Nf6 5.d3 bzw. 4.d3 gegen 3...Nf6 ist im Rahmen des Pianissimo; kein Studienkapitel verifiziert genau diese Zugfolge.
- London: Die Studie nutzt Bf4 mit e3/Bd3 und 2.Nf3-Setup, deckt aber auch 1.d4 d5 2.Bf4 Stonewall-London ab. Wir sollten bei unserer Notation den gleichen Bf4-Aufbau nehmen und Stonewall gesondert markieren.
- Caro-Kann: Shreksify nutzt den Exchange-Aufbau 3.exd5 cxd5 4.Bd3 (gängig). Die Two-Knights-Kapitel verwenden 2.Nf3 d5 3.Nc3 dxe4 4.Nxe4 Nf6 (Tartakower-Ausprägung), unser Plan 2.Nc3 d5 3.Nf3 ist die andere Reihenfolge. Beide führen in dieselbe Stellung, Umstellung sollte konsistent sein.
- QGD: Bosburp führt 3...Be7 (Charousek) und 3...c5 (Tarrasch) als Hauptlinien; unser Plan betont 3...Nf6 4.Nc3 e6 bzw. Lasker-Ausprägung. Die Abdeckung der Hauptlinien ist gleich, aber die Gewichtung weicht ab.

## Lizenz

- Lichess-Nutzungsbedingungen (https://lichess.org/terms-of-service): Nutzer behalten die Rechte an eingereichten Inhalten. Lichess erhält eine nicht-exklusive Lizenz zur Anzeige. Eine ausdrückliche CC0/CC-BY-Freigabe für Studien habe ich in den Bedingungen nicht gefunden (Stand 2026-10-25, Stichprobe).
- Folgerung: **Nicht übernehmen, nur verlinken und in eigenen Worten zusammenfassen.** PGN-Kopien aus fremden Studien in die App wären ohne Erlaubnis des Autors riskant.
- Die Lichess-Partiedatenbank ist laut Lichess-Dokumentation CC0. Das gilt für Partien, nicht für Studien. Hier nur aus Fachwissen, nicht im Rahmen dieser Recherche bestätigt.

## Empfehlungen für unsere Content-Autorenschaft

- Italian: Eigene Kapitel auf Basis Standard-Theorie (4.c3 Nf6 5.d3) erstellen. Die Studie von FM Zig_Zag_Zug_Zwang nur als Ergänzung verlinken, nicht übernehmen.
- Gambits (Greco, Evans) bewusst aus dem Repertoire ausschließen oder in einem separaten Sideline-Kapitel behandeln.
- Caro-Kann: Shreksify-Studie als Referenz für Kapitelstruktur (Exchange, Panov, Classical, Advance, Two Knights, Fantasy) lesen, Linien selbst gegen Masters-DB prüfen.
- London: Kapitelstruktur von davidharoldchess (Basics, vs d5 e6, vs cxd4, vs Ne4, vs Bf5) übernehmen, Zugfolgen eigenständig schreiben.
- QGD: Bosburp-Abschnitte als Checkliste für Vollständigkeit nutzen; die Nebenlinien 3...Be7 und 3...c5 als "Sideline" markieren.
- Explorer-Stichprobe nachholen, sobald der Masters-Explorer ohne Auth erreichbar ist (aktuell 401). Erst danach Theorie-Aussagen als verifiziert markieren.
- Studien-Likes und Titel vor einer Entscheidung erneut prüfen; die Werte sind Momentaufnahmen.
- Für Recherche zu Lichess-Studien künftig Lichess-API-Endpunkte (`api/study/by/{user}`, `api/study/{id}.pgn`) nutzen, weil die Suchseite 403 liefert.
