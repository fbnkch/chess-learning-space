import { useEffect, useMemo, useState } from "react";
import type { Progress } from "../progress/Progress";
import { SyncEngine, type SyncStatus } from "./engine";
import graphs from "virtual:repertoire";
import { version } from "../../package.json";
export function useSync(store: Progress | null, onMerged: () => Promise<void>) {
  const [status, setStatus] = useState<SyncStatus>({ kind: "off" });
  const engine = useMemo(
    () =>
      store
        ? new SyncEngine(store, {
            onStatus: setStatus,
            onMerged,
            appVersion: version,
            contentVersions: {
              white: graphs.white.contentVersion,
              black: graphs.black.contentVersion,
            },
          })
        : null,
    [store, onMerged],
  );
  useEffect(() => {
    if (!engine) return;
    const pull = () => {
      void engine.sync({ manual: false, pull: true }).catch(() => {});
    };
    const push = () => {
      void engine.sync({ manual: false, pull: false }).catch(() => {});
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") push();
    };
    pull();
    const timer = window.setInterval(push, 120 * 60_000);
    window.addEventListener("focus", pull);
    window.addEventListener("online", pull);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      engine.dispose();
      clearInterval(timer);
      window.removeEventListener("focus", pull);
      window.removeEventListener("online", pull);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [engine]);
  return { engine, status };
}
