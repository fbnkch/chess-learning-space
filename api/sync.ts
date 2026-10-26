import { createHash, timingSafeEqual } from "node:crypto";
import {
  put,
  get,
  del,
  BlobPreconditionFailedError,
  BlobNotFoundError,
} from "@vercel/blob";
import { maxWireBytes, readLimited } from "../src/sync/protocol.js";
export class PreconditionFailed extends Error {}
export interface BlobStore {
  read(
    path: string,
  ): Promise<{ bytes: Uint8Array<ArrayBuffer>; etag: string } | null>;
  /** null means create-if-absent; otherwise compare-and-swap MUST be atomic in storage. */
  write(
    path: string,
    bytes: Uint8Array<ArrayBuffer>,
    etag: string | null,
  ): Promise<string>;
  delete(path: string): Promise<void>;
}
function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
const response = (
  status: number,
  etag?: string,
  body?: Uint8Array<ArrayBuffer>,
) =>
  new Response(body ?? (status >= 400 ? "Sync request failed." : null), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      ...(etag ? { ETag: etag } : {}),
    },
  });
/** Pure protocol handler: all storage and configuration are injected; no token logging. */
export async function handleSync(
  request: Request,
  store: BlobStore,
  allowedHash?: string,
): Promise<Response> {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.get("Authorization") ?? "",
  );
  if (!match) return response(401);
  const token = Buffer.from(match[1], "base64url");
  if (token.length !== 32 || !equal(token.toString("base64url"), match[1]))
    return response(401);
  const hash = createHash("sha256").update(token).digest("hex");
  if (
    allowedHash !== undefined &&
    (!/^[a-f0-9]{64}$/.test(allowedHash) || !equal(hash, allowedHash))
  )
    return response(401);
  const path = `sync/${hash}/snapshot.bin`;
  try {
    if (request.method === "GET") {
      const blob = await store.read(path);
      if (!blob) return response(404);
      if (blob.bytes.length > maxWireBytes) return response(413);
      return response(200, blob.etag, blob.bytes);
    }
    if (request.method === "DELETE") {
      await store.delete(path);
      return response(204);
    }
    if (request.method !== "PUT") return response(405);
    if (Number(request.headers.get("Content-Length")) > maxWireBytes)
      return response(413);
    const etag = request.headers.get("If-Match");
    const create = request.headers.get("X-Create-If-Absent") === "1";
    if (
      (!etag && !create) ||
      (etag && create) ||
      (etag && (etag.length > 256 || etag === "*"))
    )
      return response(428);
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = request.body
        ? await readLimited(request.body, maxWireBytes)
        : new Uint8Array();
    } catch {
      return response(413);
    }
    if (bytes.length < 33) return response(400);
    return response(200, await store.write(path, bytes, etag));
  } catch (error) {
    if (error instanceof PreconditionFailed) return response(412);
    return response(503);
  }
}
const blobStore: BlobStore = {
  async read(path) {
    try {
      const result = await get(path, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return {
        bytes: await readLimited(result.stream, maxWireBytes),
        etag: result.blob.etag,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },
  async write(path, bytes, etag) {
    try {
      const blob = await put(path, Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: etag !== null,
        ...(etag !== null ? { ifMatch: etag } : {}),
        contentType: "application/octet-stream",
        cacheControlMaxAge: 60,
      });
      return blob.etag;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError)
        throw new PreconditionFailed();
      // The SDK reports create-if-absent collisions as a generic BlobError in some versions.
      // Classify a failed creation by an uncached read, never by a non-atomic head-then-put.
      if (
        etag === null &&
        (await get(path, { access: "private", useCache: false }).then(
          async (result) => {
            if (result?.stream) await result.stream.cancel();
            return !!result;
          },
        ))
      )
        throw new PreconditionFailed();
      throw error;
    }
  },
  async delete(path) {
    await del(path);
  },
};
export default {
  fetch: (request: Request) =>
    handleSync(request, blobStore, process.env.SYNC_ALLOWED_HASH),
};
