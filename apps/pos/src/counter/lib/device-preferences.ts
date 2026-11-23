import { useEffect } from 'react';

// Settings of this device live in localStorage, where the tab that wrote one
// is not told. Every writer announces the change so a screen already showing
// the setting, and the toolbar that changes it, stay in step.
export const PREFERENCES_CHANGED = 'parkviet-pos:preferences-changed';

export function notifyPreferencesChanged() {
  try {
    window.dispatchEvent(new Event(PREFERENCES_CHANGED));
  } catch {
    // No window (tests, workers): there is no screen to tell.
  }
}

// Runs `onChange` whenever a device setting is written, here or in another tab.
export function usePreferencesChanged(onChange: () => void) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the listener must not be re-bound on every render; `onChange` only re-reads storage
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('parkviet-pos:')) onChange();
    };
    window.addEventListener(PREFERENCES_CHANGED, onChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PREFERENCES_CHANGED, onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
}
