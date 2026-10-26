import { learnedRuleIds, quizItems } from "../rules/quiz";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Scheduler, retiredCardIds } from "../scheduler/Scheduler";
import { drillCards } from "../trainer/stages";
import { repertoire } from "../repertoire/bundled";
import { openProgress, type Progress } from "./Progress";
import { Backup } from "./Backup";
import { downloadBackup } from "./download";
import { readSettings, type Settings } from "../settings";
import graphs from "virtual:repertoire";
import { version } from "../../package.json";
import { PuzzleTraining } from "../puzzles/PuzzleTraining";

export function useProgress(onSettings: (settings: Settings) => void) {
  const [store, setStore] = useState<Progress | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [learnedRules, setLearnedRules] = useState<string[]>([]);
  const [retiredCount, setRetiredCount] = useState(0);
  const [storage, setStorage] = useState("loading");
  const [error, setError] = useState("");
  const [lastExportAt, setLastExportAt] = useState<number | null>(null);
  const [nudge, setNudge] = useState(false);
  const [revision, setRevision] = useState(0);
  const backupFor = useCallback(
    (progress: Progress) =>
      new Backup(progress, {
        download: downloadBackup,
        appVersion: version,
        contentVersions: {
          white: graphs.white.contentVersion,
          black: graphs.black.contentVersion,
        },
      }),
    [],
  );
  const refresh = useCallback(
    async (progress: Progress) => {
      repertoire.setReplyWeights(await progress.replyWeights());
      const [due, reviews, status, exported, nudge, settings, ruleStates] =
        await Promise.all([
          new Scheduler((log) => drillCards(repertoire, log), progress).due(
            Date.now(),
          ),
          progress.reviews(),
          progress.metadata("storage"),
          progress.metadata("lastExportAt"),
          backupFor(progress).nudge(),
          progress.settings(),
          progress.ruleStates(),
        ]);
      setDueCount(due.length);
      setReviewCount(reviews.length);
      setLearnedRules(learnedRuleIds(ruleStates, reviews));
      setStorage(String(status?.value ?? "best-effort"));
      setLastExportAt(exported ? Number(exported.value) : null);
      setNudge(nudge);
      if (settings) onSettings(settings);
      const personalCards = await progress.personalCards();
      setRetiredCount(
        retiredCardIds(
          [
            ...repertoire.cards("white"),
            ...repertoire.cards("black"),
            ...personalCards,
            ...quizItems.map((q) => ({ id: q.id, kind: "rule" as const })),
          ],
          reviews.filter((r) => !r.cardId.startsWith("puzzle:")),
        ).length,
      );
    },
    [backupFor, onSettings],
  );
  useEffect(() => {
    let active = true;
    let connection: Progress | undefined;
    openProgress({
      onStorageChange: () => {
        if (active && connection)
          void refresh(connection).catch(() =>
            setError("Could not read progress. Please reload."),
          );
      },
      onBlocked: () =>
        setError(
          "Close other Chess Learning Space tabs so progress storage can upgrade, then reload.",
        ),
      onVersionChange: () =>
        setError(
          "Progress was upgraded in another tab. Reload this page to continue.",
        ),
    })
      .then(async (progress) => {
        connection = progress;
        if (!active) {
          progress.close();
          return;
        }
        if (!(await progress.settings()))
          await progress.saveSettings(readSettings());
        await refresh(progress);
        if (active) setStore(progress);
      })
      .catch(() => {
        if (active)
          setError(
            "Progress storage is unavailable. Please reload or enable browser storage before drilling.",
          );
      });
    return () => {
      active = false;
      connection?.close();
    };
  }, [refresh]);
  useEffect(() => {
    if (!store) return;
    const update = () => {
      void refresh(store).catch(() =>
        setError("Could not read progress. Please reload."),
      );
    };
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, [store, refresh]);
  const scheduler = useMemo(
    () =>
      store ? new Scheduler((log) => drillCards(repertoire, log), store) : null,
    [store],
  );
  const backup = useMemo(
    () => (store ? backupFor(store) : null),
    [store, backupFor],
  );
  const puzzles = useMemo(
    () => (store ? new PuzzleTraining(store) : null),
    [store],
  );
  const imported = useCallback(async () => {
    if (!store) return;
    const settings = (await store.settings()) ?? readSettings();
    onSettings(settings);
    await refresh(store);
    setRevision((value) => value + 1);
  }, [store, onSettings, refresh]);
  return {
    puzzles,
    backup,
    lastExportAt,
    nudge,
    revision,
    imported,
    async dismissNudge() {
      if (backup && store) {
        await backup.dismiss();
        await refresh(store);
      }
    },
    async setRuleLearned(ruleId: string, learned: boolean) {
      if (!store) return;
      const now = Date.now();
      await store.saveRuleState({
        ruleId,
        learned,
        learnedAt: learned ? now : null,
        updatedAt: now,
      });
      setLearnedRules(
        learnedRuleIds(await store.ruleStates(), await store.reviews()),
      );
      setError("");
    },
    learnedRules,
    scheduler,
    store,
    dueCount,
    reviewCount,
    retiredCount,
    storage,
    error,
    reportError: setError,
    refresh,
  };
}
