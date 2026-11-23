import {
  clampSplit,
  MAX_SPLIT,
  MIN_SPLIT,
  shareLabel,
  splitTracks,
} from '@shared/selling-layout';
import { type KeyboardEvent, type PointerEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

// A step of the keyboard: 5% of the box.
const KEY_STEP = 0.05;

// A press must travel this far (px) before it drags the handle.
const DRAG_THRESHOLD = 4;

// The handle between two panels of a split. Dragging follows the pointer
// (held between a fifth and four fifths, pulled onto the marks) and changes
// the grid of the box it sits in right there, with no label: only the colour
// of the handle tells when it hits a limit. The share is kept when the
// pointer is released. A double press puts the sample's share back. The
// arrow keys move it by 5% and Home/End jump to a fifth and four fifths.
// Under 768px the stylesheet hides it and the panels stack.
export function SplitDivider({
  share,
  mirrored,
  vertical,
  names,
  onCommit,
  onReset,
}: {
  // The first part's share of the box.
  share: number;
  // The first part sits at the end of the box (the catalogue on the right).
  mirrored: boolean;
  // The parts stack: the box is split by rows, not columns.
  vertical: boolean;
  // The two parts' names, for the label and the accessible value.
  names: readonly [string, string];
  onCommit: (share: number) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState<{ limit: boolean } | null>(null);

  const shareText = (value: number) =>
    `${names[0]} ${shareLabel(value)} · ${names[1]} ${shareLabel(1 - value)}`;

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary) return;
    const handle = event.currentTarget;
    const box = handle.parentElement;
    if (!box) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    let latest = share;
    const rect = box.getBoundingClientRect();
    const grip = handle.getBoundingClientRect();
    // The tracks share what the handle leaves: the box less the handle.
    const handleSize = vertical ? grip.height : grip.width;
    const span = (vertical ? rect.height : rect.width) - handleSize;
    const start = vertical ? event.clientY : event.clientX;
    let moving = false;
    const move = (moveEvent: globalThis.PointerEvent) => {
      const at = vertical ? moveEvent.clientY : moveEvent.clientX;
      // A press that barely moves is a click, not a drag.
      if (!moving && Math.abs(at - start) < DRAG_THRESHOLD) return;
      moving = true;
      let raw = (at - (vertical ? rect.top : rect.left) - handleSize / 2) / span;
      if (mirrored) raw = 1 - raw;
      if (!Number.isFinite(raw)) return;
      latest = clampSplit(raw);
      box.style.setProperty('--selling-tracks', splitTracks(latest, mirrored));
      setDrag({ limit: raw < MIN_SPLIT || raw > MAX_SPLIT });
    };
    const finish = (endEvent: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', finish);
      handle.removeEventListener('pointercancel', finish);
      if (handle.hasPointerCapture(endEvent.pointerId))
        handle.releasePointerCapture(endEvent.pointerId);
      setDrag(null);
      if (endEvent.type === 'pointerup' && latest !== share) onCommit(latest);
      // A drag that ends without a new share puts the grid back as it was.
      else box.style.setProperty('--selling-tracks', splitTracks(share, mirrored));
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', finish);
    handle.addEventListener('pointercancel', finish);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const back = vertical ? 'ArrowUp' : 'ArrowLeft';
    const forward = vertical ? 'ArrowDown' : 'ArrowRight';
    let next: number | null = null;
    if (event.key === back || event.key === forward) {
      // Moving the handle toward the start shrinks the first part, unless
      // the first part is the one at the end.
      const toward = (event.key === back ? -1 : 1) * (mirrored ? -1 : 1);
      next = clampSplit(share + toward * KEY_STEP);
    } else if (event.key === 'Home') next = MIN_SPLIT;
    else if (event.key === 'End') next = MAX_SPLIT;
    if (next === null) return;
    event.preventDefault();
    if (next !== share) onCommit(next);
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a window splitter is a focusable separator
    <div
      className="split-divider"
      role="separator"
      tabIndex={0}
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={t('sellingLayoutDivider', { first: names[0], second: names[1] })}
      aria-valuemin={Math.round(MIN_SPLIT * 100)}
      aria-valuemax={Math.round(MAX_SPLIT * 100)}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={shareText(share)}
      data-vertical={vertical || undefined}
      data-dragging={drag ? 'true' : undefined}
      data-limit={drag?.limit ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  );
}
