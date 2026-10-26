# Optional explanation wording

Game Review keeps rule-based explanations as the default. Configure **Explanation
wording** in Settings and save, then explicitly click **Rephrase** on a reviewed
mistake. There are no automatic requests, including while playing or navigating.
Off sends nothing. Hint remains deterministic.

The browser sends only structured classification, verified best/PV SAN, findings
and their golden-rule texts. It does not send the PGN, player names, API key in the
prompt, or full FEN. Every supplied line is replayed legally before building facts.
Responses must be JSON containing only `text`. Unknown SAN/coordinate moves,
squares, numeric literals and rule IDs cause fallback to the deterministic text.
This is a lexical guard, not proof that arbitrary prose is true: **AI wording** is
labelled and the rule-based finding is one click away (and remains visible).

Ollama uses `/api/chat` (non-streaming); configure `OLLAMA_ORIGINS` for this app's
origin. Anthropic uses `/v1/messages`; OpenAI-compatible uses
`/v1/chat/completions`. Enter a base URL without these paths. Remote endpoints
must use HTTPS; plain HTTP is allowed only on loopback. Providers must support
browser CORS. All requests omit browser credentials, reject redirects and abort
after 20 seconds. Cancel, leaving Review or changing the selected move aborts a
pending request. Failed/invalid responses keep rule-based wording with a small
status note, never an error dialog or unvalidated text.

Anthropic deliberately sets `anthropic-dangerous-direct-browser-access: true`.
This exposes your own key to browser scripts/extensions and sends it directly to
the configured endpoint. Use only in the private app, verify the URL, and use a
restricted key. Providers may store the supplied facts and charge for requests.
The model is editable; the default Anthropic model is `claude-haiku-5-5`.

Provider, endpoint, model and key are one private `explanation-wording` record in
the existing IndexedDB `secrets` store. They are not settings/localStorage, never
exported, restored or included in Undo snapshots. Wording itself requires no schema migration or version
change (introduced at schemaVersion 10; explorer weights later add version 11). Saving Off replaces that record
and removes its prior key. Clearing browser storage deletes credentials. Tests
use only fake keys and intercepted requests; no real provider is called.
