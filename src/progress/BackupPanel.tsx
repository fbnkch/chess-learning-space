import { useEffect, useRef, useState } from "react";
import {
  Backup,
  importError,
  maxBackupBytes,
  type ValidatedBackup,
} from "./Backup";

export function BackupPanel({
  backup,
  lastExportAt,
  storage,
  onExport,
  onImported,
}: {
  backup: Backup | null;
  lastExportAt: number | null;
  storage: string;
  onExport: () => Promise<void>;
  onImported: () => Promise<void>;
}) {
  const [pending, setPending] = useState<{
    data: ValidatedBackup;
    reviews: number;
  } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const choices = useRef<HTMLDivElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmReplace && pending) confirmation.current?.showModal();
  }, [confirmReplace, pending]);
  useEffect(() => {
    if (pending) choices.current?.focus();
  }, [pending]);
  useEffect(() => {
    void backup
      ?.hasUndo()
      .then(setCanUndo)
      .catch(() => setCanUndo(false));
  }, [backup]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Backup failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function importData(mode: "replace" | "merge") {
    if (!backup || !pending) return;
    setConfirmReplace(false);
    await run(async () => {
      const snapshot = await backup.import(pending.data, mode);
      setCanUndo(true);
      setConfirmReplace(false);
      setPending(null);
      await onImported();
      setMessage(
        `Import complete. Undo last import is available in Data & backup. ${snapshot}`,
      );
    });
  }
  return (
    <section
      className="backup-panel"
      aria-labelledby="backup-heading"
      aria-busy={busy}
    >
      <h2 id="backup-heading">Data &amp; backup</h2>
      <p>Progress storage: {storage}</p>
      {storage === "best-effort" && (
        <p className="muted">
          Your browser may clear this data when space is low, so keep backups.
        </p>
      )}
      <p className="muted">
        Last export:{" "}
        {lastExportAt === null
          ? "Never"
          : new Date(lastExportAt).toLocaleString()}
      </p>
      <p className="muted">
        Export a copy outside the browser. Backups contain training progress
        and settings, but never API keys or tokens.
      </p>
      <div className="backup-actions">
        <button
          disabled={!backup || busy}
          onClick={() =>
            void run(async () => {
              await backup!.export();
              await onExport();
              setMessage("Backup download started.");
            })
          }
        >
          Export JSON
        </button>
        <label className="backup-file">
          Import JSON
          <input
            aria-label="Import JSON"
            type="file"
            accept=".json,application/json"
            disabled={!backup || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              setPending(null);
              setConfirmReplace(false);
              if (file)
                void run(async () => {
                  if (file.size > maxBackupBytes)
                    throw importError(
                      new Error("Backup exceeds the 50 MB limit."),
                    );
                  try {
                    const data = backup!.preview(await file.text());
                    setPending({ data, reviews: data.reviewLog.length });
                  } catch (error) {
                    throw importError(error);
                  }
                });
            }}
          />
        </label>
      </div>
      {pending && (
        <div
          className="import-choice"
          ref={choices}
          tabIndex={-1}
          aria-label="Import choices"
        >
          <h3>Import {pending.reviews} review attempts</h3>
          <p>{pending.data.scanLog.length} Threat Scan attempts included.</p>
          <p>{pending.data.games.length} games included.</p>
          <p>
            {pending.data.personalCards.length} personal mistake cards included.
          </p>
          {canUndo && (
            <p className="muted">
              Note: this import replaces the Undo point of your previous import.
            </p>
          )}
          <p className="muted">
            Replace clears current progress and loads the backup's settings.
            Merge adds the backup's attempts and keeps your current settings.
            Cards whose content was removed are kept as retired cards.
          </p>
          <p className="muted">
            Before importing, the app saves a restore point in this browser so
            you can use Undo last import. Downloading an extra snapshot is
            optional.
          </p>
          <div className="backup-actions">
            <button disabled={busy} onClick={() => setConfirmReplace(true)}>
              Replace
            </button>
            <button disabled={busy} onClick={() => void importData("merge")}>
              Merge
            </button>
            <button disabled={busy} onClick={() => setPending(null)}>
              Cancel import
            </button>
          </div>
        </div>
      )}
      {confirmReplace && pending && (
        <dialog
          ref={confirmation}
          className="import-confirmation"
          onCancel={() => setConfirmReplace(false)}
          aria-labelledby="replace-title"
        >
          <h3 id="replace-title">Replace current progress?</h3>
          <p>
            This file will replace your review history, Threat Scan results,
            learned rules, games, personal mistake cards and backup history.
            It will also replace settings if the file includes them. You can
            undo the import from Data &amp; backup.
          </p>
          <button disabled={busy} onClick={() => void importData("replace")}>
            Confirm replace
          </button>
          <button disabled={busy} onClick={() => setConfirmReplace(false)}>
            Keep current data
          </button>
        </dialog>
      )}
      <button
        disabled={!backup || busy || !canUndo}
        onClick={() =>
          void run(async () => {
            const info = await backup!.undoInfo();
            if (!info) return;
            const when = new Date(info.at).toLocaleString();
            const kept = info.laterReviews
              ? ` Your ${info.laterReviews} review attempt${info.laterReviews === 1 ? "" : "s"} since then will be kept.`
              : "";
            if (
              !window.confirm(
                `Undo the import from ${when}? ${info.laterScans} later scans, ${info.laterGames} later games and ${info.laterCards} later personal-card changes will be kept. Learned rules will be restored; ${info.laterRules} learned-rule changes since the import will be kept.${kept}`,
              )
            )
              return;
            await backup!.undo();
            setCanUndo(false);
            await onImported();
            setMessage(
              "Import undone. Your previous progress and settings are restored.",
            );
          })
        }
      >
        Undo last import
      </button>
      {busy && (
        <p role="status" className="muted">
          Working… Keep this window open.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {message && (
        <p aria-live="polite" className="muted">
          {message}
        </p>
      )}
    </section>
  );
}
