/** Confirms file close with the picker; the download fallback can only report a request. */
export async function downloadBackup(
  json: string,
  filename: string,
): Promise<string> {
  const picker = (
    window as unknown as {
      showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
        name: string;
        createWritable(): Promise<{
          write(data: Blob): Promise<void>;
          close(): Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;
  if (picker) {
    const file = await picker.call(window, { suggestedName: filename });
    const writer = await file.createWritable();
    await writer.write(new Blob([json], { type: "application/json" }));
    await writer.close();
    return `Optional snapshot saved to the file you selected: ${file.name}.`;
  }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    return `Optional snapshot download requested: ${filename} (your browser's download location).`;
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
