import { maxWireBytes, readLimited } from "./protocol";
export class SyncHttpError extends Error {
  constructor(public status: number) {
    super(
      status === 401
        ? "Sync is not authorized. Check the code and SYNC_ALLOWED_HASH in Vercel."
        : status === 413
          ? "Sync exceeds 4 MB. Export a JSON backup instead."
          : status === 412
            ? "Another device changed the cloud copy. Retry Sync now."
            : status === 404
              ? "Sync endpoint unavailable. Follow docs/hosting.md to enable it."
              : "Cloud sync unavailable. Keep learning offline; check Vercel limits and try Sync now later.",
    );
  }
}
export class SyncClient {
  constructor(
    private token: string,
    private fetcher: typeof fetch = fetch,
    private signal?: AbortSignal,
  ) {}
  private request(
    method: string,
    headers: Record<string, string> = {},
    body?: Uint8Array<ArrayBuffer>,
  ) {
    const fetcher = this.fetcher;
    return fetcher("/api/sync", {
      method,
      headers: { Authorization: `Bearer ${this.token}`, ...headers },
      body,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: this.signal ? AbortSignal.any([this.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
  }
  async pull() {
    const response = await this.request("GET");
    if (response.status === 404) return null;
    if (!response.ok) throw new SyncHttpError(response.status);
    const etag = response.headers.get("ETag");
    if (!etag || !response.body)
      throw new Error(
        "Invalid sync response. Check the hosting configuration.",
      );
    return { bytes: await readLimited(response.body, maxWireBytes), etag };
  }
  async push(bytes: Uint8Array<ArrayBuffer>, etag: string | null) {
    if (bytes.length > maxWireBytes) throw new SyncHttpError(413);
    const response = await this.request(
      "PUT",
      {
        "Content-Type": "application/octet-stream",
        ...(etag ? { "If-Match": etag } : { "X-Create-If-Absent": "1" }),
      },
      bytes,
    );
    if (!response.ok) throw new SyncHttpError(response.status);
    if (!response.headers.get("ETag"))
      throw new Error(
        "Invalid sync response. Check the hosting configuration.",
      );
  }
  async delete() {
    const response = await this.request("DELETE");
    if (!response.ok) throw new SyncHttpError(response.status);
  }
}
