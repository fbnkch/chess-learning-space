import { useEffect, useState } from "react";
import { loadWording, wordingSecret } from "./storage";
import type { Progress } from "../progress/Progress";
import { checkConfig, defaults, type WordingConfig } from "./provider";
export function WordingSettings({ store }: { store: Progress | null }) {
  const [config, setConfig] = useState(defaults("off"));
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    loadWording(store)
      .then((c) => {
        if (active) {
          setConfig(c);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setMessage("Could not load wording settings.");
      });
    return () => {
      active = false;
    };
  }, [store]);
  return (
    <section className="wording-settings" aria-label="Explanation wording">
      <h2>Explanation wording</h2>
      <p>
        Off by default. Only clicking Rephrase in Game Review sends the shown
        engine facts and golden rules to your chosen provider. No full game or
        player names are sent. Your provider may retain facts and charge for
        requests.
      </p>
      <label>
        Wording provider
        <select
          aria-label="Wording provider"
          disabled={!loaded}
          value={config.provider}
          onChange={(e) => {
            setConfig(defaults(e.target.value as WordingConfig["provider"]));
            setMessage("");
          }}
        >
          <option value="off">Off (rule-based)</option>
          <option value="ollama">Ollama</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI-compatible</option>
        </select>
      </label>
      {config.provider !== "off" && (
        <>
          <label>
            Provider base URL
            <input
              aria-label="Provider base URL"
              type="url"
              value={config.endpoint}
              onChange={(e) =>
                setConfig({ ...config, endpoint: e.target.value })
              }
            />
          </label>
          <label>
            Wording model
            <input
              aria-label="Wording model"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
            />
          </label>
          {config.provider !== "ollama" && (
            <label>
              Provider API key
              <input
                aria-label="Provider API key"
                type="password"
                autoComplete="off"
                value={config.key}
                onChange={(e) => setConfig({ ...config, key: e.target.value })}
              />
            </label>
          )}
          <p>
            Stored only in this browser's secrets store; never included in
            backups. Browser scripts and extensions can access this key. Use
            your own restricted key in this private app.
          </p>
          {config.provider === "anthropic" && (
            <p>
              Anthropic calls enable anthropic-dangerous-direct-browser-access.
              Your key is sent directly from this browser to the configured
              endpoint. Verify the URL before saving.
            </p>
          )}
          {config.provider === "ollama" && (
            <p>
              Run Ollama locally and allow this app's origin using
              OLLAMA_ORIGINS. CORS must be enabled by your provider.
            </p>
          )}
        </>
      )}
      <button
        disabled={!store || !loaded}
        onClick={async () => {
          try {
            checkConfig(config);
            await store!.saveSecret(wordingSecret, JSON.stringify(config));
            setMessage("Wording settings saved.");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Could not save wording settings.",
            );
          }
        }}
      >
        Save wording settings
      </button>
      <p role="status">{message}</p>
    </section>
  );
}
