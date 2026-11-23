import { type ReactNode, useEffect, useId, useRef } from 'react';
import { HoverTip } from '../hover-tip';
import { PosIcon } from '../pos-icon';

// One toolbar button with a popover under it. The popover closes on a press
// outside it or on Esc, and Esc hands the focus back to the button.
export function ToolbarPopover({
  icon,
  label,
  title,
  open,
  onOpenChange,
  children,
}: {
  icon: Parameters<typeof PosIcon>[0]['name'];
  // The accessible name of the icon button, shown as its tooltip.
  label: string;
  // The popover's own heading.
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const close = useRef(onOpenChange);
  close.current = onOpenChange;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        close.current(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close.current(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div className="toolbar-item" ref={root}>
      <button
        ref={button}
        type="button"
        className="toolbar-button has-tip"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => onOpenChange(!open)}
      >
        <PosIcon name={icon} />
        <HoverTip>{label}</HoverTip>
      </button>
      {open ? (
        <div className="toolbar-popover" id={panelId} role="dialog" aria-label={title}>
          <h2 className="toolbar-popover-title">{title}</h2>
          {children}
        </div>
      ) : null}
    </div>
  );
}
