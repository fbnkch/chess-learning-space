import { afterEach, expect, it, vi } from "vitest";
import { downloadBackup } from "./download";

afterEach(() => vi.unstubAllGlobals());
it("awaits the chosen file writer's close before reporting that a file is saved", async () => {
  let finish!: () => void;
  const write = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const picker = vi
    .fn()
    .mockResolvedValue({
      name: "my-backup.json",
      createWritable: async () => ({ write, close }),
    });
  vi.stubGlobal("window", { showSaveFilePicker: picker });
  let completed = false;
  const result = downloadBackup("{}", "backup.json").then((message) => {
    completed = true;
    return message;
  });
  await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(write).toHaveBeenCalledOnce();
  expect(completed).toBe(false);
  finish();
  expect(await result).toContain("my-backup.json");
});
it("reports a failed file close instead of claiming the backup was saved", async () => {
  vi.stubGlobal("window", {
    showSaveFilePicker: async () => ({
      createWritable: async () => ({
        write: async () => {},
        close: async () => {
          throw new Error("disk full");
        },
      }),
    }),
  });
  await expect(downloadBackup("{}", "backup.json")).rejects.toThrow(
    "disk full",
  );
});
