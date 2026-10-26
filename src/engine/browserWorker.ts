import type { UciWorker } from "./types";
export function browserWorker(): UciWorker {
  const worker = new Worker(
    `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`,
  );
  const port: UciWorker = {
    onmessage: null,
    onerror: null,
    postMessage: (command) => worker.postMessage(command),
    terminate: () => worker.terminate(),
  };
  worker.onmessage = (event) => port.onmessage?.(event);
  worker.onerror = (event) => {
    event.preventDefault();
    port.onerror?.(event);
  };
  worker.onmessageerror = (event) => port.onerror?.(event);
  return port;
}
