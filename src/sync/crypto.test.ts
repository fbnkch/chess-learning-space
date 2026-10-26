import { expect, it } from "vitest";
import { createCode, deriveKeys, encrypt, decrypt } from "./crypto";
it("encrypts a gzip envelope with a fresh IV and rejects wrong codes and tampering", async () => {
  const code = createCode();
  const keys = await deriveKeys(code);
  const json = '{"format":"chess-learning-space","data":{}}';
  const wire = await encrypt(json, keys);
  expect(await decrypt(wire, keys)).toBe(json);
  expect(await encrypt(json, keys)).not.toEqual(wire);
  await expect(decrypt(wire, await deriveKeys(createCode()))).rejects.toThrow();
  for (const offset of [0, 4, 7, wire.length - 1]) {
    const bad = wire.slice();
    bad[offset] ^= 1;
    await expect(decrypt(bad, keys)).rejects.toThrow();
  }
  expect(keys.authToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(keys.hash).toMatch(/^[a-f0-9]{64}$/);
  await expect(deriveKeys("invalid")).rejects.toThrow();
});
