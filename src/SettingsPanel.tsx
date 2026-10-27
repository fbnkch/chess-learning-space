import { useEffect, useRef } from "react";
import type { Settings } from "./settings";
import type { ReactNode } from "react";
import { colorModes, themeChoices } from "./appearance";
export function SettingsPanel({
  settings,
  onChange,
  saved,
  onClose,
  children,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  saved: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      id="board-settings"
      className="settings-panel"
      aria-label="Settings"
    >
      <button
        className="settings-close"
        onClick={onClose}
        aria-label="Close settings"
      >
        Close
      </button>
      <h2>Settings</h2>
      <section className="appearance-settings" aria-label="Appearance">
        <fieldset className="appearance-modes">
          <legend>Appearance mode</legend>
          <div className="mode-options">
            {colorModes.map((mode) => (
              <label className="appearance-option mode-option" key={mode}>
                <input
                  type="radio"
                  name="appearance-mode"
                  value={mode}
                  checked={(settings.colorMode ?? "system") === mode}
                  onChange={() => onChange({ ...settings, colorMode: mode })}
                />
                <span>{mode === "system" ? "System" : mode === "light" ? "Light" : "Dark"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Color theme</legend>
          <div className="theme-options">
            {themeChoices.map((theme) => (
              <label className="appearance-option theme-option" key={theme.id}>
                <input
                  type="radio"
                  name="color-theme"
                  aria-label={theme.name}
                  aria-describedby={`theme-description-${theme.id}`}
                  value={theme.id}
                  checked={(settings.colorTheme ?? "graphite") === theme.id}
                  onChange={() => onChange({ ...settings, colorTheme: theme.id })}
                />
                <span className="theme-swatch" data-palette={theme.id} aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <span className="theme-option-name">{theme.name}</span>
                <small id={`theme-description-${theme.id}`}>{theme.description}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="appearance-note">
          {saved
            ? "Applies instantly. Saved on this device."
            : "Applies for this session. Storage is unavailable."}
        </p>
      </section>
      <details className="settings-section">
        <summary>Board and practice</summary>
        <label>
          <span>Chess.com username</span>
          <input
            aria-label="Chess.com username"
            maxLength={100}
            value={settings.chessComUsername ?? "fbnkch"}
            onChange={(e) =>
              onChange({ ...settings, chessComUsername: e.target.value })
            }
          />
        </label>
        <label>
          <span>
            Active lines per side{" "}
            <small>Starting cohort; progress stays unlocked</small>
          </span>
          <select
            aria-label="Active lines per side"
            value={settings.activeLines ?? 6}
            onChange={(e) =>
              onChange({ ...settings, activeLines: Number(e.target.value) })
            }
          >
            {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            Safety Check <small>Pause before judging a drill move</small>
          </span>
          <input
            type="checkbox"
            checked={settings.safetyCheck ?? false}
            onChange={(e) =>
              onChange({ ...settings, safetyCheck: e.target.checked })
            }
          />
        </label>
        <label>
          <span>
            Sound <small>Move, capture & check</small>
          </span>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => onChange({ ...settings, sound: e.target.checked })}
          />
        </label>
        <label>
          <span>Coordinates</span>
          <input
            type="checkbox"
            checked={settings.coordinates}
            onChange={(e) =>
              onChange({ ...settings, coordinates: e.target.checked })
            }
          />
        </label>
        <label>
          <span>Reduced motion</span>
          <input
            type="checkbox"
            checked={settings.reducedMotion}
            onChange={(e) =>
              onChange({ ...settings, reducedMotion: e.target.checked })
            }
          />
        </label>
        <label>
          <span>Animation speed</span>
          <select
            value={settings.animationMs}
            onChange={(e) =>
              onChange({ ...settings, animationMs: Number(e.target.value) })
            }
          >
            <option value={0}>Instant</option>
            <option value={100}>Fast</option>
            <option value={200}>Normal</option>
            <option value={400}>Slow</option>
          </select>
        </label>
        <p className="muted">
          {saved
            ? "Settings are saved in this browser."
            : "Storage unavailable. Settings apply for this session."}
        </p>
      </details>
      {children}
    </dialog>
  );
}
