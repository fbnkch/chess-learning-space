import type { Progress } from "../progress/Progress";
import { configSchema, defaults, type WordingConfig } from "./provider";
export const wordingSecret = "explanation-wording";
export async function loadWording(
  store: Progress | null,
): Promise<WordingConfig> {
  const raw = await store?.secret(wordingSecret);
  if (!raw) return defaults("off");
  return configSchema.parse(JSON.parse(raw));
}
