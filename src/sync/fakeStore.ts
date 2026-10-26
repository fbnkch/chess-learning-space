import { type BlobStore, PreconditionFailed } from "../../api/sync";
export function memoryBlobStore(): BlobStore {
  const blobs = new Map<
    string,
    { bytes: Uint8Array<ArrayBuffer>; etag: string }
  >();
  let revision = 0;
  return {
    async read(path) {
      return blobs.get(path) ?? null;
    },
    async write(path, bytes, etag) {
      const old = blobs.get(path);
      if (etag === null ? !!old : old?.etag !== etag)
        throw new PreconditionFailed();
      const next = `"${++revision}"`;
      blobs.set(path, { bytes: bytes.slice(), etag: next });
      return next;
    },
    async delete(path) {
      blobs.delete(path);
    },
  };
}
