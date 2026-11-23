import { createContext, useContext, useSyncExternalStore } from 'react';

// A place in the header the selling screen puts its own controls in (the
// order tabs), so they sit in the top bar instead of taking a row of the
// screen. Null off the selling page and before the header is drawn.
const HeaderSlot = createContext<HTMLElement | null>(null);

export const HeaderSlotProvider = HeaderSlot.Provider;

// A tablet's or phone's header has no room left beside its tools: there the
// tabs keep their own row on the screen.
const WIDE = '(min-width: 1100px)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(WIDE);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

function wide() {
  return window.matchMedia?.(WIDE).matches ?? true;
}

export function useHeaderSlot(): HTMLElement | null {
  const slot = useContext(HeaderSlot);
  const roomy = useSyncExternalStore(subscribe, wide, () => true);
  return roomy ? slot : null;
}
