import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import source from "../../public/stockfish/SOURCE.json";
import { ENGINE_VERSION } from "./Engine";
import pkg from "../../package.json";

test("vendored engine and npm build match the pinned SHA-256 manifest", () => {
  expect(pkg.dependencies.stockfish).toBe(source.version);
  for (const [name, expected] of Object.entries(source.sha256)) {
    for (const folder of ["public/stockfish", "node_modules/stockfish/bin"]) {
      const bytes = readFileSync(`${folder}/${name}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
    }
  }
});

test("cache version follows the pinned source manifest", () => {
  expect(ENGINE_VERSION).toBe(
    `${source.package}@${source.version}/${source.build}`,
  );
});
