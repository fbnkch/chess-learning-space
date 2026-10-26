import { expect, it } from "vitest";
import { handleSync } from "../../api/sync";
import { memoryBlobStore } from "./fakeStore";
import { createCode, deriveKeys } from "./crypto";
it("authenticates, isolates namespaces, enforces atomic preconditions, size and allowed hash", async () => {
  const store = memoryBlobStore();
  const keys = await deriveKeys(createCode());
  const request = (
    method: string,
    headers = {},
    body?: Uint8Array<ArrayBuffer>,
  ) =>
    new Request("https://test/api/sync", {
      method,
      headers: { Authorization: `Bearer ${keys.authToken}`, ...headers },
      body,
    });
  expect(
    (await handleSync(new Request("https://test/api/sync"), store)).status,
  ).toBe(401);
  expect((await handleSync(request("GET"), store)).status).toBe(404);
  expect((await handleSync(request("GET"), store, "0".repeat(64))).status).toBe(
    401,
  );
  expect((await handleSync(request("GET"), store, "bad-config")).status).toBe(
    401,
  );
  const bytes = new Uint8Array(40);
  const first = await handleSync(
    request("PUT", { "X-Create-If-Absent": "1" }, bytes),
    store,
    keys.hash,
  );
  expect(first.status).toBe(200);
  const etag = first.headers.get("ETag")!;
  expect(
    (await handleSync(request("PUT", { "X-Create-If-Absent": "1" }, bytes), store))
      .status,
  ).toBe(412);
  expect(
    (await handleSync(request("PUT", { "If-Match": '"wrong"' }, bytes), store))
      .status,
  ).toBe(412);
  expect((await handleSync(request("PUT", {}, bytes), store)).status).toBe(428);
  expect(
    (await handleSync(request("PUT", { "If-Match": etag }, bytes), store))
      .status,
  ).toBe(200);
  const fetched = await handleSync(request("GET"), store);
  expect(new Uint8Array(await fetched.arrayBuffer())).toEqual(bytes);
  expect(
    (
      await handleSync(
        request("PUT", { "If-Match": etag }, new Uint8Array(4_000_001)),
        store,
      )
    ).status,
  ).toBe(413);
  const other = await deriveKeys(createCode());
  expect(
    (
      await handleSync(
        request("GET", { Authorization: `Bearer ${other.authToken}` }),
        store,
      )
    ).status,
  ).toBe(404);
  expect((await handleSync(request("DELETE"), store)).status).toBe(204);
  expect((await handleSync(request("GET"), store)).status).toBe(404);
});
