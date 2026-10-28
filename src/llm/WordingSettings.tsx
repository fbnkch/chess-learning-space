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
        Off by default. Only Rephrase in Game Review sends data to your chosen
        provider. The request includes the displayed engine findings and
        relevant Golden Rules, but not the full game or player names. The
        provider may store the request and charge you.
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
            The key stays in this browser and is never added to backups.
            Browser scripts and extensions can read it, so use a restricted
            key for this app.
          </p>
          {config.provider === "anthropic" && (
            <p>
              Anthropic access from this browser is enabled by
              anthropic-dangerous-direct-browser-access. Your key goes straight
              to the endpoint shown here. Check the address before saving.
            </p>
          )}
          {config.provider === "ollama" && (
            <p>
              When Ollama runs locally, allow this app's origin in
              OLLAMA_ORIGINS.
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
