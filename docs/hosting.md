# Deploy on Vercel Hobby and sync devices

Sync is optional. Local learning/export/import work without hosting or a cloud
connection. Vercel Hobby is for personal, non-commercial use. This change does not
deploy anything; the owner performs the following steps when ready.

## Free deployment

1. Export JSON on every existing device. In Vercel, choose **Add New > Project >
   Import Git Repository**, select `fbnkch/chess-learning-space`, and use your
   personal **Hobby** scope (not a paid team/trial).
2. Use the repo root and Node.js 24. `vercel.json` sets `npm run build` and `dist`;
   installation follows package-lock.json. Hash routing needs no rewrites, and
   /api/sync must remain a function. Deploy the reviewed branch you intend to use.
3. Open the HTTPS site. In the project's Storage tab, create/attach a **private
   Vercel Blob store** in the same Hobby scope. Connect Production, and Preview
   only if wanted. Vercel supplies server-only `BLOB_READ_WRITE_TOKEN`. Never put
   it in a VITE_ variable, client code, Git or chat. Use separate Preview/Production
   stores for independent testing; a shared store shares its cloud copy.
4. Recommended: in Settings > Cross-device sync, choose **Create sync code**.
   The masked code remains saved even if its first upload fails. Expand **Hosting
   restriction hash** and copy **Allowed sync hash**. Add server environment
   variable `SYNC_ALLOWED_HASH` with this complete 64-character lowercase hex
   value to the corresponding Vercel environments, then redeploy. Click **Sync
   now**. You can generate the code/hash on localhost before deploying, too.
   Without the restriction, strangers knowing the endpoint can create namespaces
   with their own codes and consume your free allowance. The hash is safe to share;
   the sync code is private. A malformed configured hash denies all access.
5. Confirm **Synced ... min ago**. Save the code privately, e.g. in your password
   manager. There is no recovery service for a lost code.

UI labels may change. The optional Node function uses the documented Web Standard
fetch entry point. No CLI/real Blob connection is needed for the mocked test suite.

## Several devices

Create a code once on A. Copy or explicitly reveal it. On B, open the **same
site origin**, paste into **Sync code from another device**, and choose **Enter
sync code**. Existing progress merges; it is not replaced. Sync A once more to
receive B's additions. Settings stay device-local. Credentials/explorer tokens
and sync codes never travel in the payload.

Start and focus pull (focus pulls at least five minutes apart). Automatic uploads
wait 120 minutes and only upload changed progress. A 120-minute timer and best-effort
hidden-page trigger check dirty data. Sync now bypasses the interval, never the
monthly guard. Wait for Synced before changing device; closing a tab cannot
reliably deliver an upload. Modern HTTPS/localhost browsers with WebCrypto,
CompressionStream and IndexedDB are required. Offline status does not block learning.

**Turn off** removes only this browser's code, keeping local/cloud progress.
For **Delete cloud copy**, first turn off other devices, then click and confirm
on the remaining device. Deletion also turns sync off there. An enabled device
can recreate a deleted copy. Sync bypasses Blob's CDN cache for current reads.

Replace and Undo automatically pause configured sync, including after reload.
In Settings, choose **Delete cloud copy and upload this device** to confirm a
DELETE followed by a fresh device upload (turn off other devices and export JSON
first), or **Resume and merge cloud data** to accept that removed/undone data may
return. Sync now, focus and timers cannot resume it. Failed cloud replacement
stays paused. Aborting an in-flight upload cannot recall data already accepted
by the server; the explicit deletion choice removes that copy.

## Limits and quota math

Hobby never bills overages. Exceeding Blob allowances blocks Blob access until
next month; local training and JSON backups still work. Monitor the Vercel usage
dashboard; Functions and data transfer have separate allowances too.

- Blob: 1 GB storage, 10,000 simple and 2,000 advanced operations/month; uploads
  and lists are advanced. Advanced rate limit: 15/s. Static upload limit: 100 MB
  per file. This app stores one encrypted <=4,000,000-byte object per code.
- A normal changed sync is one GET + one PUT, unchanged sync has no PUT. Conflicts
  can require three full attempts. No lists/multipart upload are used. Failed
  creation classification may need one extra GET; SDK retries can add operations.
- 120-minute spacing alone permits 12/day or 372 uploads in 31 days. A hard local
  guard stops at **400 PUT attempts per UTC calendar month**, across tabs/codes in
  this browser profile, including manual attempts and conflicts. Pulls continue.
  Import/Undo cannot reset it; clearing browser storage does. Next month resets.
  Sync now bypasses the interval but obeys this cap; a warning starts at 360 attempts.
- Three browsers x 400 = 1,200 <= Hobby's 2,000 advanced operations, leaving 800
  for retries, deletion and other usage. **This is not global metering**: more
  browsers, other apps and SDK retries can exhaust the reserve. Monitor combined
  usage and set SYNC_ALLOWED_HASH. Numerous focus pulls across devices can also
  exhaust 10,000 simple ops. No account-wide guarantee is claimed.
- Wire payloads are capped at 4,000,000 bytes, below Vercel's documented 4.5 MB
  request/response ceiling. Expanded JSON is capped at the existing 50 MiB backup
  limit and import record caps. Too-large data does not partially overwrite cloud
  or local progress. Use JSON backup instead.

At limits, export JSON and keep learning offline until the next month, or inspect
the usage dashboard. No paid upgrade is required to keep using the local app.

## Backups, recovery and privacy

Export JSON regularly, especially before changing codes, deleting cloud data,
clearing storage or manual Replace. Sync keeps one snapshot, not a backup history.
It never consumes your manual import Undo point or resets backup reminders.
Save the code separately: JSON never includes it. Backups are plaintext, including
games/player details, so keep them private.

For decryption failure, verify the code/site on both devices and export their
local JSON. For a newer-schema message, update the app before retrying. Keep
backups before deliberately deleting a damaged cloud object and reconnecting.
A wrong code normally selects another empty namespace (or gets 401 if restricted).
For 401 check SYNC_ALLOWED_HASH and redeploy; for 503 check the private Blob
connection/usage limits. A failed pull does not replace local progress.

HKDF-SHA256 derives independent encryption and auth keys. Gzip backup JSON is
AES-256-GCM encrypted/authenticated with a new random IV on every upload. The
server sees auth, ciphertext, namespace, size and timing, not the code/plaintext.
Anyone holding the code can decrypt/write/delete that namespace. A server can
replay an old valid object: merge cannot delete newer local union members, but a
new device cannot prove snapshot freshness. Trusted origin scripts/extensions
can read browser-held secrets; use only builds you trust.

CSP allows self scripts, WASM compilation, self/blob workers, inline board styles,
and arbitrary HTTPS plus HTTP localhost/127.0.0.1/::1 ports for configurable LLM
endpoints. This includes explorer.lichess.ovh and api.chess.com and is deliberately
broader than a fixed API allow-list. See [wording](llm-wording.md).

Assets, puzzles and Stockfish use one-year immutable caching. Updates under those
paths must use new versioned filenames/paths with callers updated (manifest/shards
together); otherwise browsers may retain old content. HTML is not immutable.

[ADR-0005](adr/0005-optional-encrypted-sync.md) specifies the exact wire and endpoint.
Official references checked 2026-10-26:
[Blob SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk),
[private Blob](https://vercel.com/docs/vercel-blob/private-storage),
[Function limits](https://vercel.com/docs/functions/limitations),
[Hobby](https://vercel.com/docs/plans/hobby),
[Blob usage](https://vercel.com/docs/vercel-blob/usage-and-pricing).
