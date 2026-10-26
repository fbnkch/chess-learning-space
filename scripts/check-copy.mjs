import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";
import { goldenRules, phases } from "../src/rules/catalogue.ts";

// Scope this check to authored learning copy. IDs, URLs, FENs, annotations,
// implementation comments and the security-reviewed LLM prompt are not prose.
const banned =
  /\b(?:it is important to note|in order to|helps you|ensure|crucial|key|vital|landscape|foster|seamless|unlock|journey|elevate)\b/i;
const words = (text) => (text.trim() ? text.trim().split(/\s+/u).length : 0);
const errors = [];
let checked = 0;
function check(label, text, limit) {
  checked++;
  if (/[\u2013\u2014]/u.test(text)) errors.push(`${label}: en/em dash`);
  const match = text.match(banned);
  if (match) errors.push(`${label}: banned wording "${match[0]}"`);
  if (limit && words(text) > limit)
    errors.push(`${label}: ${words(text)} words (maximum ${limit})`);
}
for (const rule of goldenRules) {
  for (const field of ["shortForm", "reason", "exception", "exampleText"])
    check(
      `${rule.id}.${field}`,
      rule[field] ?? "",
      { reason: 20, exception: 15 }[field],
    );
  if ((rule.reason.match(/[.!?](?:\s|$)/gu) ?? []).length !== 1)
    errors.push(`${rule.id}.reason: expected one sentence`);
}
for (const phase of phases) check(`phase.${phase.id}`, phase.label);
for (const side of ["white", "black"]) {
  for (const file of readdirSync(`content/${side}`)
    .filter((file) => file.endsWith(".pgn"))
    .sort()) {
    const name = `content/${side}/${file}`;
    const source = readFileSync(name, "utf8");
    for (const match of source.matchAll(/\{([^}]*)\}/gu)) {
      const line = source.slice(0, match.index).split("\n").length;
      check(
        `${name}:${line}`,
        match[1].replace(/\[%[^\]]*\]/gu, "").trim(),
        25,
      );
    }
    for (const match of source.matchAll(/\[Summary "([^"]*)"\]/gu)) {
      const text = match[1];
      check(`${name} summary`, text);
      // Ellipses in SAN (e.g. ...Nf6) are not sentence endings.
      if ((text.match(/(?<!\.)[.!?](?:\s|$)/gu) ?? []).length > 2)
        errors.push(`${name} summary: maximum two sentences`);
    }
  }
}
const modules = [
  "src/review/explain.ts",
  "src/review/hint.ts",
  "src/rules/quizDistractors.ts",
  ...["threats", "engine", "trainer"].flatMap((area) =>
    readdirSync(`src/${area}`)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => `src/${area}/${file}`),
  ),
];
for (const file of modules) {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      // Human-facing phrases have words separated by whitespace. Single-word
      // labels still pass through punctuation checks; identifiers are harmless.
      const line =
        source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      check(`${file}:${line}`, node.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function scanJsx(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      scanJsx(file);
      continue;
    }
    if (!file.endsWith(".tsx")) continue;
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (
        ts.isJsxText(node) ||
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        checked++;
        if (/[\u2013\u2014]/u.test(node.text))
          errors.push(
            `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}: en/em dash in UI string`,
          );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scanJsx("src");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `PASS: ${checked} copy items; rule reasons ≤20 words, exceptions ≤15, PGN comments ≤25; no banned wording or en/em dashes.`,
  );
