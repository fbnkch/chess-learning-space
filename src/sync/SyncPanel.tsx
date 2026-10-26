import { useEffect, useState } from "react";
import type { Progress } from "../progress/Progress";
import type { SyncEngine, SyncStatus } from "./engine";
import { createCode, deriveKeys } from "./crypto";
import "./sync.css";
export function SyncPanel({
  store,
  engine,
  status,
}: {
  store: Progress | null;
  engine: SyncEngine | null;
  status: SyncStatus;
}) {
  const [code, setCode] = useState("");
  const [entered, setEntered] = useState("");
  const [hash, setHash] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmDevice, setConfirmDevice] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    if (store)
      void store
        .secret("sync-code")
        .then(async (saved) => {
          if (!active) return;
          if (saved) {
            const keys = await deriveKeys(saved);
            if (active) {
              setCode(saved);
              setHash(keys.hash);
            }
          }
        })
        .catch(() => {
          if (active)
            setMessage("Could not read the sync code. Reload and try again.");
        });
    return () => {
      active = false;
    };
  }, [store]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  async function action(run: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await run();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Sync failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enable(next: string) {
    if (!store || !engine) return;
    const keys = await deriveKeys(next);
    await store.saveSecret("sync-code", next);
    setCode(next);
    setHash(keys.hash);
    setEntered("");
    setRevealed(false);
    await engine.sync();
  }
  const disabled = busy || !store || !engine || status.kind === "syncing";
  const label =
    status.kind === "off"
      ? "Off"
      : status.kind === "paused"
        ? "Paused"
        : status.kind === "syncing"
          ? "Syncing…"
          : status.kind === "offline"
            ? "Offline"
            : status.kind === "error"
              ? "Error"
              : `Synced ${Math.max(0, Math.floor((now - (status.at ?? now)) / 60_000))} min ago`;
  return (
    <section className="sync-panel" aria-label="Cross-device sync">
      <h3>
        Cross-device sync <span className="sync-optional">optional</span>
      </h3>
      <p>
        Encrypted progress on your own Vercel deployment. Your app works offline
        with sync off. Keep the same code on every device and save a JSON backup
        separately.
      </p>
      <p role="status" aria-live="polite">
        {label}
        {status.message ? ` - ${status.message}` : ""}
      </p>
      {!code ? (
        <>
          <button
            disabled={disabled}
            onClick={() => void action(() => enable(createCode()))}
          >
            Create sync code
          </button>
          <label>
            Sync code from another device
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={entered}
              onChange={(event) => setEntered(event.target.value.trim())}
            />
          </label>
          <button
            disabled={disabled || !entered}
            onClick={() => void action(() => enable(entered))}
          >
            Enter sync code
          </button>
        </>
      ) : (
        <>
          {status.kind === "paused" && (
            <div className="sync-confirm">
              <p>
                Sync paused after Replace or Undo. Choose how to continue.
                Resume and merge cloud data may bring back data you just
                removed.
              </p>
              {!confirmDevice ? (
                <button
                  disabled={disabled}
                  onClick={() => setConfirmDevice(true)}
                >
                  Delete cloud copy and upload this device
                </button>
              ) : (
                <>
                  <p>
                    Delete the cloud copy and replace it with this device? Turn
                    off sync on your other devices first so they cannot bring
                    old data back. Export JSON first.
                  </p>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      void action(async () => {
                        await engine!.replaceCloudWithDevice();
                        setConfirmDevice(false);
                      })
                    }
                  >
                    Confirm delete and upload this device
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() => setConfirmDevice(false)}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                disabled={disabled}
                onClick={() => void action(() => engine!.resumeAndMerge())}
              >
                Resume and merge cloud data
              </button>
            </div>
          )}
          <label>
            Your sync code
            <input
              type={revealed ? "text" : "password"}
              readOnly
              value={code}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="sync-actions">
            <button onClick={() => setRevealed((value) => !value)}>
              {revealed ? "Hide code" : "Reveal code"}
            </button>
            <button
              onClick={() =>
                void action(async () => {
                  await navigator.clipboard.writeText(code);
                  setMessage("Sync code copied.");
                })
              }
              disabled={disabled}
            >
              Copy code
            </button>
            <button
              onClick={() => void action(() => engine!.sync())}
              disabled={disabled || status.kind === "paused"}
            >
              Sync now
            </button>
            <button
              onClick={() =>
                void action(async () => {
                  await engine!.turnOff();
                  setCode("");
                  setHash("");
                  setRevealed(false);
                  setConfirmDelete(false);
                })
              }
              disabled={disabled}
            >
              Turn off
            </button>
          </div>
          <details>
            <summary>Hosting restriction hash</summary>
            <p>
              Set SYNC_ALLOWED_HASH in Vercel to this value, then redeploy. This
              hash is safe to copy; keep the sync code private.
            </p>
            <input aria-label="Allowed sync hash" readOnly value={hash} />
          </details>
          {!confirmDelete ? (
            <button
              className="sync-delete"
              disabled={disabled}
              onClick={() => setConfirmDelete(true)}
            >
              Delete cloud copy
            </button>
          ) : (
            <div className="sync-confirm">
              <p>
                Delete the encrypted cloud copy? Local progress stays. Turn off
                sync on your other devices first so they cannot upload it again.
                Export JSON before deleting.
              </p>
              <button
                disabled={disabled}
                onClick={() =>
                  void action(async () => {
                    await engine!.deleteCloud();
                    setCode("");
                    setHash("");
                    setConfirmDelete(false);
                  })
                }
              >
                Confirm delete cloud copy
              </button>{" "}
              <button
                disabled={disabled}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}
      {message && (
        <p className="sync-message" role="alert">
          {message}
        </p>
      )}
      <p className="sync-optional">
        Automatic uploads wait at least 120 minutes. At most 400 upload attempts
        per UTC calendar month in this browser; manual sync also counts. Export
        JSON if cloud access is blocked.
      </p>
    </section>
  );
}
