import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { notifyPreferencesChanged, usePreferencesChanged } from '../../lib/device-preferences';
import { PosIcon } from '../pos-icon';
import { ToolbarPopover } from '../toolbar/toolbar-popover';

type IconName = Parameters<typeof PosIcon>[0]['name'];

// An extra of the order shown as a chip: its editor opens on a press, and
// what it holds (an amount, a name) shows on the chip.
export type FootChip = {
  key: string;
  label: string;
  icon: IconName;
  value?: string | null;
  disabled?: boolean;
  onClick: () => void;
};

export type FootAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  title?: string;
};

const HIDDEN_KEY = 'parkviet-pos:order-foot-hidden';

// The chips this device chose not to show.
function hiddenChips(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((key) => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

const FOLDED_KEY = 'parkviet-pos:order-foot-folded';

// Whether this device keeps the extras row folded away.
function savedFolded(): boolean {
  try {
    return window.localStorage.getItem(FOLDED_KEY) === 'on';
  } catch {
    return false;
  }
}

function saveFolded(folded: boolean) {
  try {
    if (folded) window.localStorage.setItem(FOLDED_KEY, 'on');
    else window.localStorage.removeItem(FOLDED_KEY);
  } catch {
    // Storage refused: the choice lasts until the page reloads.
  }
  notifyPreferencesChanged();
}

function saveHiddenChips(keys: string[]) {
  try {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(keys));
  } catch {
    // Storage refused: the choice lasts until the page reloads.
  }
  notifyPreferencesChanged();
}

// The compact foot of an order: a row of chips for its extras (which ones
// show is this device's choice, under the cog), then one bar with the count
// and the total (which unfolds into its lines), the rarer actions behind
// "⋮", the kitchen, a secondary action and the payment. Every action is the
// screen's own; the foot only lays them out.
export function CompactOrderFoot({
  chips,
  count,
  total,
  rows,
  more = [],
  kitchen,
  secondary,
  payLabel,
  payDisabled = false,
  payTitle,
  onPay,
}: {
  chips: FootChip[];
  count: number;
  // The amount still owed, formatted.
  total: string;
  // The lines the total unfolds into.
  rows: { label: string; value: string }[];
  more?: FootAction[];
  kitchen?: FootAction & { count: number };
  secondary?: FootAction;
  payLabel: string;
  payDisabled?: boolean;
  payTitle?: string;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const [hidden, setHidden] = useState(hiddenChips);
  // The extras row folds away under the arrow on the foot's edge, and stays
  // so on this device.
  const [folded, setFolded] = useState(savedFolded);
  usePreferencesChanged(() => {
    setHidden(hiddenChips());
    setFolded(savedFolded());
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const shown = chips.filter((chip) => !hidden.includes(chip.key));

  return (
    <footer className="order-foot" data-folded={folded || undefined}>
      {chips.length > 0 ? (
        <button
          type="button"
          className="order-foot-fold"
          aria-expanded={!folded}
          aria-label={t(folded ? 'orderFootUnfold' : 'orderFootFold')}
          title={t(folded ? 'orderFootUnfold' : 'orderFootFold')}
          onClick={() => {
            setFolded(!folded);
            saveFolded(!folded);
          }}
        >
          <PosIcon name="chevron" />
        </button>
      ) : null}
      {chips.length > 0 && !folded ? (
        <div className="order-foot-extras">
          <ToolbarPopover
            icon="cog"
            label={t('orderFootExtrasSettings')}
            title={t('orderFootExtras')}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          >
            {chips.map((chip) => (
              <label key={chip.key} className="toolbar-switch">
                <span className="toolbar-switch-text">{chip.label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={!hidden.includes(chip.key)}
                  aria-checked={!hidden.includes(chip.key)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? hidden.filter((key) => key !== chip.key)
                      : [...hidden, chip.key];
                    setHidden(next);
                    saveHiddenChips(next);
                  }}
                />
              </label>
            ))}
          </ToolbarPopover>
          <span className="order-foot-extras-label">{t('orderFootExtras')}</span>
          <div className="order-foot-chips">
            {shown.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="order-foot-chip"
                data-set={chip.value ? 'true' : undefined}
                disabled={chip.disabled}
                onClick={chip.onClick}
              >
                <PosIcon name={chip.icon} />
                <span>{chip.label}</span>
                {chip.value ? <b>{chip.value}</b> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {unfolded ? (
        <dl className="order-foot-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="order-foot-main">
        <button
          type="button"
          className="order-foot-total"
          aria-expanded={unfolded}
          aria-label={`${t('orderFootShowTotals')}: ${t('orderFootCount', { count })}, ${total}`}
          onClick={() => setUnfolded(!unfolded)}
        >
          <span className="order-foot-bag">
            <PosIcon name="bag" />
            {count > 0 ? <span className="order-foot-badge">{count}</span> : null}
          </span>
          <strong>{total}</strong>
          <PosIcon name="chevron" />
        </button>
        <span className="order-foot-actions">
          {more.length > 0 ? (
            <ToolbarPopover
              icon="dots"
              label={t('orderFootMore')}
              title={t('orderFootMore')}
              open={moreOpen}
              onOpenChange={setMoreOpen}
            >
              <div className="order-foot-menu">
                {more.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    disabled={action.disabled}
                    aria-pressed={action.pressed}
                    title={action.title}
                    onClick={() => {
                      setMoreOpen(false);
                      action.onClick();
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </ToolbarPopover>
          ) : null}
          {kitchen ? (
            <button
              type="button"
              className="order-foot-icon"
              aria-label={kitchen.label}
              title={kitchen.label}
              disabled={kitchen.disabled}
              onClick={kitchen.onClick}
            >
              <PosIcon name="chef" />
              {kitchen.count > 0 ? <span className="order-foot-badge">{kitchen.count}</span> : null}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              className="order-foot-secondary"
              disabled={secondary.disabled}
              title={secondary.title}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          ) : null}
          <button
            type="button"
            className="order-foot-pay"
            aria-keyshortcuts="F9"
            disabled={payDisabled}
            title={payTitle}
            onClick={onPay}
          >
            {payLabel} <kbd>F9</kbd>
          </button>
        </span>
      </div>
    </footer>
  );
}
