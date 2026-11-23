import type { ReactNode } from 'react';

// The tooltip of an icon-only control. Put it inside the control, which takes
// the `has-tip` class: the stylesheet shows it on hover and on keyboard focus.
// With an `id` it is a real tooltip the control points at with
// `aria-describedby`; without one the control already carries its own
// accessible name, so the tip is hidden from assistive technology.
export function HoverTip({ id, children }: { id?: string; children: ReactNode }) {
  return id ? (
    <span className="tip" role="tooltip" id={id}>
      {children}
    </span>
  ) : (
    <span className="tip" aria-hidden="true">
      {children}
    </span>
  );
}
