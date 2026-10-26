import { useEffect, useRef, useState } from "react";
import type { Progress } from "../progress/Progress";
import type { Finding } from "../review/explain";
import { loadWording } from "./storage";
import { requestWording } from "./provider";
import { buildFacts, buildPrompt, validateWording } from "./wording";
export function Rephrase({
  store,
  findings,
  classification,
  fen,
  best,
}: {
  store: Progress | null;
  findings: Finding[];
  classification: string;
  fen: string;
  best: string[];
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  return (
    <section aria-label="Optional AI wording">
      <p className="muted">
        Rephrase sends these engine facts to the provider saved in Settings,
        only when requested.
      </p>
      <button
        disabled={!store || busy}
        onClick={async () => {
          const controller = new AbortController();
          request.current = controller;
          setBusy(true);
          setText("");
          setNote("");
          try {
            const config = await loadWording(store);
            controller.signal.throwIfAborted();
            if (config.provider === "off") {
              setNote(
                "Explanation wording is Off. Rule-based text is shown; nothing was sent.",
              );
              return;
            }
            const facts = buildFacts(classification, findings, fen, best);
            const raw = await requestWording(
              config,
              buildPrompt(facts),
              controller.signal,
            );
            controller.signal.throwIfAborted();
            const result = validateWording(raw, facts);
            if (result) setText(result);
            else
              setNote(
                "AI wording could not be verified. Rule-based text is shown.",
              );
          } catch {
            if (!controller.signal.aborted)
              setNote("AI wording unavailable. Rule-based text is shown.");
          } finally {
            if (!controller.signal.aborted) setBusy(false);
          }
        }}
      >
        {busy ? "Rephrasing…" : "Rephrase"}
      </button>
      {busy && (
        <button
          onClick={() => {
            request.current?.abort();
            setBusy(false);
            setNote("Canceled. Rule-based text is shown.");
          }}
        >
          Cancel rephrasing
        </button>
      )}
      {text && (
        <>
          <h4>AI wording</h4>
          <p>{text}</p>
          <details>
            <summary>Show rule-based explanation</summary>
            {findings.map((f, i) => (
              <p key={i}>{f.text}</p>
            ))}
          </details>
          <p className="muted">
            AI wording may misstate facts. The rule-based explanation is
            authoritative.
          </p>
        </>
      )}
      {note && <p role="status">{note}</p>}
    </section>
  );
}
