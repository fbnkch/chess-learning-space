import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { compileSide } from "../src/repertoire/compiler.ts";
import { parseInfo } from "../src/engine/uci.ts";

const require = createRequire(import.meta.url);
const stockfish = require("stockfish");
const version = JSON.parse(
  readFileSync("node_modules/stockfish/package.json", "utf8"),
).version;
if (version !== "19.0.1")
  throw new Error(`Unexpected Stockfish version: ${version}`);
const engine = spawn(process.execPath, [stockfish.findEngine("lite-single")], {
  stdio: "pipe",
});
const output = createInterface({ input: engine.stdout });
let receive: ((line: string) => void) | undefined;
let fail: ((error: Error) => void) | undefined;
output.on("line", (line) => receive?.(line));
engine.on("error", (error) => fail?.(error));
engine.on("exit", (code) => fail?.(new Error(`Stockfish exited (${code})`)));
engine.stderr.on("data", (data) => process.stderr.write(data));
function command(
  commands: string[],
  until: (line: string) => boolean,
  info?: (line: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => done(new Error("Stockfish response timed out")),
      30_000,
    );
    function done(error?: Error) {
      clearTimeout(timer);
      receive = undefined;
      fail = undefined;
      if (error) reject(error);
      else resolve();
    }
    fail = done;
    receive = (line) => {
      info?.(line);
      if (until(line)) done();
    };
    engine.stdin.write(commands.join("\n") + "\n");
  });
}
const budget = 50_000;
const results: {
  side: string;
  fen: string;
  score: number;
  depth: number;
  context: string;
  pv: string;
}[] = [];
try {
  await command(["uci"], (line) => line === "uciok");
  await command(
    [
      "setoption name Hash value 16",
      "setoption name MultiPV value 1",
      "isready",
    ],
    (line) => line === "readyok",
  );
  console.log(
    `Stockfish ${version} lite-single WASM; ${budget} nodes/position; Hash 16 MB; MultiPV 1; fresh hash per position; threshold -1.00 from repertoire side.`,
  );
  for (const side of ["white", "black"] as const) {
    const folder = `content/${side}`;
    if (!existsSync(folder)) continue;
    const graph = compileSide(
      readdirSync(folder)
        .filter((f) => f.endsWith(".pgn"))
        .sort()
        .map((f) => readFileSync(`${folder}/${f}`, "utf8")),
      side,
    );
    console.log(
      `${side}: ${graph.lines.length} lines, ${Object.keys(graph.nodes).length} unique positions (including roots and endpoints).`,
    );
    for (const node of Object.values(graph.nodes)) {
      const turn = node.fen.split(" ")[1] === "w" ? "white" : "black";
      let score: number | undefined,
        depth = 0,
        pv = "";
      await command(["ucinewgame", "isready"], (line) => line === "readyok");
      await command(
        [`position fen ${node.fen}`, `go nodes ${budget}`],
        (line) => line.startsWith("bestmove "),
        (line) => {
          const parsed = parseInfo(line, turn);
          if (!parsed || parsed.multipv !== 1) return;
          const result = parsed.line;
          const whiteScore =
            result.cp !== undefined ? result.cp / 100 : result.winner! * 1000;
          score = whiteScore * (side === "white" ? 1 : -1);
          depth = result.depth;
          pv = result.uci.join(" ");
        },
      );
      if (score === undefined)
        throw new Error(`No exact engine score for ${node.fen}`);
      const context = node.lines
        .map((m) => `${m.lineId}@ply${m.ply}`)
        .join(", ");
      results.push({ side, fen: node.fen, score, depth, context, pv });
      if (results.length % 40 === 0)
        console.log(`Analysed ${results.length} positions...`);
    }
  }
  results.sort((a, b) => a.score - b.score || a.fen.localeCompare(b.fen));
  const flagged = results.filter((r) => r.score < -1);
  console.log(
    `\nWorst positions (${results.length} checked, ${flagged.length} flags):`,
  );
  for (const row of results.slice(0, 10))
    console.log(
      `${row.score.toFixed(2)} depth ${row.depth} | ${row.context}\n  ${row.fen}\n  PV ${row.pv}`,
    );
  for (const row of flagged.slice(10))
    console.log(`FLAG ${row.score.toFixed(2)} | ${row.context} | ${row.fen}`);
  console.log(
    flagged.length
      ? "FAIL: repertoire positions below -1.00."
      : "PASS: all repertoire positions meet the -1.00 threshold.",
  );
  if (flagged.length) process.exitCode = 1;
} finally {
  output.close();
  engine.stdin.end("quit\n");
  engine.kill();
}
