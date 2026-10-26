import { maxBackupBytes } from "../progress/Backup";
import { maxWireBytes, readLimited } from "./protocol";
const encoder = new TextEncoder();
const magic = new Uint8Array([0x43, 0x4c, 0x53, 0x59, 1]); // CLSY + version
function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function createCode() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
export interface SyncKeys {
  key: CryptoKey;
  authToken: string;
  hash: string;
}
export async function deriveKeys(code: string): Promise<SyncKeys> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code))
    throw new Error("Enter a valid 43-character sync code.");
  const seed = Uint8Array.from(
    atob(code.replace(/-/g, "+").replace(/_/g, "/") + "="),
    (c) => c.charCodeAt(0),
  );
  if (base64url(seed) !== code) throw new Error("Enter a valid sync code.");
  const material = await crypto.subtle.importKey("raw", seed, "HKDF", false, [
    "deriveBits",
    "deriveKey",
  ]);
  const params = (label: string) => ({
    name: "HKDF",
    hash: "SHA-256",
    salt: encoder.encode("chess-learning-space/sync/v1"),
    info: encoder.encode(label),
  });
  const key = await crypto.subtle.deriveKey(
    params("encryption"),
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const auth = await crypto.subtle.deriveBits(
    params("authentication"),
    material,
    256,
  );
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", auth))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { key, authToken: base64url(new Uint8Array(auth)), hash };
}
export async function encrypt(json: string, keys: SyncKeys) {
  const bytes = encoder.encode(json);
  if (bytes.length > maxBackupBytes)
    throw new Error("Backup exceeds the 50 MB limit.");
  const compressed = await readLimited(
    new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")),
    maxWireBytes - 33,
  );
  const header = new Uint8Array(17);
  header.set(magic);
  header.set(crypto.getRandomValues(new Uint8Array(12)), 5);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: header.slice(5), additionalData: header },
    keys.key,
    compressed,
  );
  const result = new Uint8Array(header.length + ciphertext.byteLength);
  result.set(header);
  result.set(new Uint8Array(ciphertext), header.length);
  return result;
}
export async function decrypt(wire: Uint8Array<ArrayBuffer>, keys: SyncKeys) {
  if (
    wire.length < 33 ||
    wire.length > maxWireBytes ||
    !magic.every((b, i) => wire[i] === b)
  )
    throw new Error(
      "Unsupported sync data. Check your code and update the app.",
    );
  let compressed: ArrayBuffer;
  try {
    compressed = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: wire.slice(5, 17),
        additionalData: wire.slice(0, 17),
      },
      keys.key,
      wire.slice(17),
    );
  } catch {
    throw new Error(
      "Cannot decrypt cloud data. Check the sync code on both devices; keep a JSON backup before deleting a damaged cloud copy.",
    );
  }
  try {
    const bytes = await readLimited(
      new Blob([compressed])
        .stream()
        .pipeThrough(new DecompressionStream("gzip")),
      maxBackupBytes,
    );
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Cloud data is damaged or exceeds the 50 MB backup limit. Keep a JSON backup, check the code, and update the app before deleting the cloud copy.",
    );
  }
}
