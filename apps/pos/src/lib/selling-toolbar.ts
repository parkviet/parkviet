// Whether the selling toolbar is folded to its « button: a choice of this
// device, kept like the other device settings.
export const TOOLBAR_COLLAPSED_KEY = 'parkviet-pos:toolbar-collapsed';

export function savedToolbarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(TOOLBAR_COLLAPSED_KEY) === 'on';
  } catch {
    // Storage blocked (private mode, policy): the toolbar stays open.
    return false;
  }
}

export function saveToolbarCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(TOOLBAR_COLLAPSED_KEY, 'on');
    else window.localStorage.removeItem(TOOLBAR_COLLAPSED_KEY);
  } catch {
    // Not remembered on this device; the choice still applies until reload.
  }
}
