import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useRealtimeStatus } from '../hooks/use-branch-events';
import { HoverTip } from './hover-tip';
import { PosIcon } from './pos-icon';

type Health = 'live' | 'connecting' | 'polling' | 'offline';

const HEALTH_LABELS: Record<Health, { short: string | null; long: string }> = {
  live: { short: null, long: 'statusLiveHint' },
  connecting: { short: null, long: 'statusConnectingHint' },
  polling: { short: 'statusPolling', long: 'statusPollingHint' },
  offline: { short: 'statusOffline', long: 'connectionOffline' },
};

// The counter's link to the server: whether it can reach the API at all, and
// whether changes from other screens arrive live or only on the periodic
// reload. A healthy link is a dot on an icon; only a degraded or lost link
// also says it in words.
export function ConnectionBadge({ offline, loading }: { offline: boolean; loading: boolean }) {
  const { t } = useTranslation();
  const tipId = useId();
  const realtime = useRealtimeStatus();
  const health: Health = offline
    ? 'offline'
    : loading || realtime === 'connecting'
      ? 'connecting'
      : realtime === 'offline'
        ? 'polling'
        : 'live';
  const label = HEALTH_LABELS[health];
  return (
    <span
      className="header-status has-tip realtime-status"
      data-status={realtime}
      data-health={health}
      role="status"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so a keyboard user can read the status tooltip
      tabIndex={0}
      aria-describedby={tipId}
    >
      <span className="header-status-icon">
        <PosIcon name="wifi" />
        <span className="header-status-dot" aria-hidden />
      </span>
      {label.short ? <span className="header-status-text">{t(label.short)}</span> : null}
      <HoverTip id={tipId}>{t(label.long)}</HoverTip>
    </span>
  );
}

// The shift of this register as one icon button with a dot: green when a shift
// is open, amber when none is. With no shift and the right to open one it
// opens the open-shift dialog; otherwise it only tells the state.
export function ShiftStatus({
  open,
  canOpen,
  onEnter,
}: {
  open: boolean;
  canOpen: boolean;
  onEnter: () => void;
}) {
  const { t } = useTranslation();
  const tipId = useId();
  const actionable = canOpen && !open;
  const title = t(open ? 'shiftOpenCompact' : 'shiftClosedCompact');
  const body = (
    <>
      <span className="header-status-icon">
        <PosIcon name="clock" />
        <span className="header-status-dot" aria-hidden />
      </span>
      <HoverTip id={tipId}>
        <strong>{title}</strong>
        <span>{t(open ? 'shiftOpenHint' : actionable ? 'shiftEnterHint' : 'shiftNotOpen')}</span>
      </HoverTip>
    </>
  );
  return actionable ? (
    <button
      type="button"
      className="header-status shift-status has-tip"
      data-open={false}
      aria-label={title}
      aria-describedby={tipId}
      aria-haspopup="dialog"
      onClick={onEnter}
    >
      {body}
    </button>
  ) : (
    <span
      className="header-status shift-status has-tip"
      data-open={open}
      role="status"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so a keyboard user can read the status tooltip
      tabIndex={0}
      aria-describedby={tipId}
    >
      {body}
    </span>
  );
}
