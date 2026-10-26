import { useEffect, useRef, useState } from "react";
import type { Progress } from "../progress/Progress";
import { repertoire } from "../repertoire/bundled";
import { ExplorerError, tokenSecret } from "./provider";
import { refreshWeights } from "./refresh";
export function ExplorerSettings({
  store,
  onRefreshed,
}: {
  store: Progress | null;
  onRefreshed: () => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const control = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    if (store)
      void Promise.all([store.secret(tokenSecret), store.replyWeights()])
        .then(([secret, rows]) => {
          if (active) {
            setToken(secret ?? "");
            setLoaded(true);
            setLastFetch(
              rows.length ? Math.max(...rows.map((r) => r.fetchedAt)) : null,
            );
          }
        })
        .catch(() => {
          if (active) setStatus("Could not load Lichess settings.");
        });
    const abort = () => control.current?.abort();
    window.addEventListener("hashchange", abort);
    window.addEventListener("pagehide", abort);
    return () => {
      active = false;
      abort();
      window.removeEventListener("hashchange", abort);
      window.removeEventListener("pagehide", abort);
    };
  }, [store]);
  return (
    <section className="wording-settings" aria-label="Lichess opening explorer">
      <h2>Lichess opening explorer</h2>
      <p>
        Optional: refresh reply popularity for blitz and rapid at Lichess
        ratings 1000, 1200 and 1400. Bundled estimates work offline. Requests
        run only when you click Refresh.
      </p>
      <label>
        Lichess personal API token
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          disabled={!loaded || busy}
          onChange={(event) => setToken(event.target.value)}
        />
      </label>
      <p>
        Create your own{" "}
        <a
          href="https://lichess.org/account/oauth/token/create"
          target="_blank"
          rel="noreferrer"
        >
          personal API token
        </a>{" "}
        with no scopes. Stored only in this browser's secrets store; never
        included in backups. An empty value removes the saved token.
      </p>
      <button
        disabled={!store || !loaded || busy}
        onClick={async () => {
          try {
            await store!.saveSecret(tokenSecret, token.trim());
            setStatus("Lichess token saved.");
          } catch {
            setStatus("Could not save Lichess token.");
          }
        }}
      >
        Save Lichess token
      </button>
      <button
        disabled={!store || !loaded || busy || !token.trim()}
        onClick={async () => {
          const controller = new AbortController();
          control.current = controller;
          setBusy(true);
          setStatus("Starting Lichess refresh…");
          try {
            const savedToken = await store!.secret(tokenSecret);
            controller.signal.throwIfAborted();
            if (!savedToken || savedToken !== token.trim())
              throw new ExplorerError(
                "Save your Lichess token before refreshing.",
              );
            const count = await refreshWeights(
              repertoire,
              savedToken,
              store!,
              controller.signal,
              {
                onProgress: (done, total) =>
                  setStatus(
                    `Refreshing ${done}/${total} positions. Previous weights remain active until complete.`,
                  ),
              },
            );
            await onRefreshed();
            setLastFetch(Date.now());
            setStatus(`Reply weights refreshed for ${count} positions.`);
          } catch (error) {
            setStatus(
              controller.signal.aborted
                ? "Refresh canceled. Previous weights kept."
                : error instanceof ExplorerError
                  ? error.message
                  : "Refresh failed. Previous weights kept.",
            );
          } finally {
            setBusy(false);
            control.current = null;
          }
        }}
      >
        Refresh reply weights from Lichess
      </button>
      {busy && (
        <button onClick={() => control.current?.abort()}>Cancel refresh</button>
      )}
      <p>
        {lastFetch
          ? `Last refresh: ${new Date(lastFetch).toLocaleString()}. Missing replies use bundled estimates.`
          : "Using bundled reply estimates."}
      </p>
      <p role="status">{status}</p>
    </section>
  );
}
