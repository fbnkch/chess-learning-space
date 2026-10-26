import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { compileSide } from "./src/repertoire/compiler.ts";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "repertoire-pgn",
      resolveId(id) {
        if (id === "virtual:repertoire") return "\0virtual:repertoire";
      },
      load(id) {
        if (id !== "\0virtual:repertoire") return;
        // One folder per training side: content/white/*.pgn, content/black/*.pgn.
        const compile = (side: "white" | "black") => {
          const dir = resolve("content", side);
          const sources = existsSync(dir)
            ? readdirSync(dir)
                .filter((file) => file.endsWith(".pgn"))
                .sort()
                .map((file) => resolve(dir, file))
            : [];
          sources.forEach((source) => this.addWatchFile(source));
          return compileSide(
            sources.map((source) => readFileSync(source, "utf8")),
            side,
          );
        };
        return `export default ${JSON.stringify({
          white: compile("white"),
          black: compile("black"),
        })}`;
      },
    },
  ],
  test: { include: ["src/**/*.test.ts"] },
});
