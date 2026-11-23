// Whether the selling toolbar is folded to its « button: a choice of this
// device, kept like the other device settings.
export const TOOLBAR_COLLAPSED_KEY = 'parkviet-pos:toolbar-collapsed';

// With no choice on this device the toolbar starts folded on a phone-width
// screen, where its tools would push the header onto a second row.
function narrowScreen(): boolean {
  try {
    return window.matchMedia?.('(max-width: 700px)').matches ?? false;
  } catch {
    return false;
  }
}

export function savedToolbarCollapsed(): boolean {
  try {
    const saved = window.localStorage.getItem(TOOLBAR_COLLAPSED_KEY);
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch {
    // Storage blocked (private mode, policy): fall back to the screen default.
  }
  return narrowScreen();
}

export function saveToolbarCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(TOOLBAR_COLLAPSED_KEY, 'on');
    else if (narrowScreen()) window.localStorage.setItem(TOOLBAR_COLLAPSED_KEY, 'off');
    else window.localStorage.removeItem(TOOLBAR_COLLAPSED_KEY);
  } catch {
    // Not remembered on this device; the choice still applies until reload.
  }
}
