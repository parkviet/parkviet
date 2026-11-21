import {
  clampSplit,
  layoutIsCustom,
  MAX_SPLIT,
  MIN_SPLIT,
  paymentBesideOrder,
  presetLockReason,
  SELLING_PAYS,
  SELLING_PRESETS,
  SELLING_SIDES,
  SELLING_TILES,
  type SellingLayout,
  type SellingPreset,
  SPLIT_SNAPS,
  shareLabel,
} from '@parkviet/pos-shared/selling-layout';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type SellingLayoutControl, useSellingLayout } from '../../hooks/use-selling-layout';
import { usePosSelection } from '../pos-selection';

// A miniature of a sample screen for its card.
function Thumb({ preset }: { preset: SellingPreset }) {
  const cell = <span className="sl-cell" />;
  if (preset === 'tables_first')
    return (
      <span className="sl-thumb sl-thumb-tables">
        {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key, index) => (
          <span key={key} className={index % 3 === 0 ? 'sl-cell sl-accent' : 'sl-cell'} />
        ))}
      </span>
    );
  if (preset === 'one_step')
    return (
      <span className="sl-thumb sl-thumb-one">
        {cell}
        {cell}
        <span className="sl-cell sl-accent" />
      </span>
    );
  if (preset === 'big_menu')
    return (
      <span className="sl-thumb sl-thumb-big">
        <span className="sl-tiles">
          {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
            <span key={key} className="sl-cell sl-accent" />
          ))}
        </span>
        <span className="sl-cart">
          {cell}
          <span className="sl-cell sl-pay" />
        </span>
      </span>
    );
  return (
    <span className="sl-thumb sl-thumb-quick">
      {cell}
      <span className="sl-cart">
        {cell}
        <span className="sl-cell sl-pay" />
      </span>
    </span>
  );
}

// The layout drawn small, live: the catalogue, the order and where payment is.
function Preview({ layout }: { layout: SellingLayout }) {
  const { t } = useTranslation();
  const { side, pay, split, paySplit } = layout;
  const mirrored = side === 'right';
  const beside = paymentBesideOrder(layout);
  const fr = (share: number, reverse: boolean) =>
    reverse ? `${1 - share}fr ${share}fr` : `${share}fr ${1 - share}fr`;
  const order = (
    <span className="sl-box sl-order">
      {t('sellingLayoutOrder')}
      {pay === 'popup' || pay === 'slide' ? <span className="sl-pay-tag" /> : null}
    </span>
  );
  const payment = <span className="sl-box sl-payment">{t('sellingLayoutPayment')}</span>;
  const alwaysOpen = pay === 'column' || pay === 'below';
  const group = !alwaysOpen ? (
    order
  ) : beside ? (
    <span className="sl-group" style={{ gridTemplateColumns: fr(paySplit, mirrored) }}>
      {mirrored ? payment : order}
      {mirrored ? order : payment}
    </span>
  ) : (
    <span className="sl-group sl-stack">
      {order}
      {payment}
    </span>
  );
  const catalog = <span className="sl-box sl-catalog">{t('sellingLayoutCatalog')}</span>;
  return (
    <span
      className="sl-preview"
      role="img"
      aria-label={t(`sellingLayoutPreviewNote_${pay}`)}
      style={
        side === 'top'
          ? { gridTemplateRows: fr(split, false) }
          : { gridTemplateColumns: fr(split, mirrored) }
      }
    >
      {mirrored ? group : catalog}
      {mirrored ? catalog : group}
    </span>
  );
}

function Segmented<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="sl-row">
      <legend className="sl-row-label">
        {label}
        {hint ? <small> · {hint}</small> : null}
      </legend>
      <span className="sl-seg">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </span>
    </fieldset>
  );
}

// While the slider moves, the share is shown from `draft` (and the preview
// follows it); it is stored once the slider is let go: the browser's own
// `change` event, which a drag fires on release and a key press fires per step.
function ShareRow({
  label,
  names,
  share,
  onChange,
  onPreview,
}: {
  label: string;
  names: readonly [string, string];
  share: number;
  onChange: (share: number) => void;
  onPreview: (share: number | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const slider = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? share;
  const commit = useRef<(value: number) => void>(onChange);
  commit.current = (value) => {
    setDraft(null);
    onPreview(null);
    if (value !== share) onChange(value);
  };
  useEffect(() => {
    const element = slider.current;
    if (!element) return;
    const onSettled = () => commit.current(clampSplit(Number(element.value) / 100));
    element.addEventListener('change', onSettled);
    return () => element.removeEventListener('change', onSettled);
  }, []);
  return (
    <div className="sl-row">
      <label className="sl-row-label" htmlFor={id}>
        {label}{' '}
        <small>
          ·{' '}
          {t('sellingLayoutShareOf', {
            first: names[0],
            second: names[1],
            value: `${shareLabel(shown)} : ${shareLabel(1 - shown)}`,
          })}
        </small>
      </label>
      <span className="sl-share">
        <input
          ref={slider}
          id={id}
          type="range"
          min={MIN_SPLIT * 100 + 0.01}
          max={MAX_SPLIT * 100 - 0.01}
          step={0.5}
          value={shown * 100}
          aria-valuetext={`${names[0]} ${shareLabel(shown)} · ${names[1]} ${shareLabel(1 - shown)}`}
          onChange={(event) => {
            const next = clampSplit(Number(event.target.value) / 100);
            setDraft(next);
            onPreview(next);
          }}
        />
        <span className="sl-seg sl-snaps">
          {SPLIT_SNAPS.map((snap) => (
            <button
              key={snap}
              type="button"
              aria-pressed={shown === snap}
              onClick={() => onChange(snap)}
            >
              {shareLabel(snap)}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}

// "Chọn màn bán hàng": a sample screen to start from, then the options of its
// layout, applied to the selling screen behind as they are changed and kept
// on this device for this branch.
export function SellingLayoutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const control: SellingLayoutControl = useSellingLayout();
  const { context } = usePosSelection();
  const { layout, chosen, branchDefault, allowed } = control;
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  // The slider being moved: the preview follows before the share is stored.
  const [preview, setPreview] = useState<{ split?: number; paySplit?: number }>({});
  const shownLayout: SellingLayout = {
    ...layout,
    split: preview.split ?? layout.split,
    paySplit: preview.paySplit ?? layout.paySplit,
  };
  const custom = layoutIsCustom(layout);
  const top = layout.side === 'top';
  const names = {
    catalog: t('sellingLayoutCatalog'),
    order: t('sellingLayoutOrder'),
    payment: t('sellingLayoutPayment'),
  };

  return (
    <dialog
      ref={dialog}
      className="context-setup-dialog selling-layout-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="selling-layout-head">
        <h2 id={titleId}>{t('sellingLayoutTitle')}</h2>
        <button
          type="button"
          className="selling-layout-x"
          aria-label={t('sellingLayoutClose')}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="muted">{t('sellingLayoutIntro')}</p>
      <ul className="sl-cards" aria-label={t('sellingLayoutPresets')}>
        {SELLING_PRESETS.map((preset) => {
          const locked = presetLockReason(preset, context.data) !== null;
          const current = layout.preset === preset;
          return (
            <li key={preset}>
              <button
                type="button"
                className="sl-card"
                aria-pressed={current}
                disabled={locked || !allowed.includes(preset)}
                onClick={() => control.choosePreset(preset)}
              >
                {current ? (
                  <span className="sl-tag sl-tag-on">
                    {t(custom ? 'sellingLayoutCustomized' : 'sellingLayoutInUse')}
                  </span>
                ) : preset === branchDefault ? (
                  <span className="sl-tag">{t('sellingLayoutBranchDefault')}</span>
                ) : null}
                <Thumb preset={preset} />
                <strong>{t(`sellingLayoutPreset_${preset}`)}</strong>
                <span className="sl-card-text">{t(`sellingLayoutPresetHint_${preset}`)}</span>
                <small>{t(`sellingLayoutPresetFit_${preset}`)}</small>
                {locked ? (
                  <small className="sl-locked">{t('sellingLayoutLockedNeedsTables')}</small>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <h3>{t('sellingLayoutCustomizeTitle')}</h3>
      <div className="sl-customize">
        <div className="sl-options">
          <Segmented
            label={t('sellingLayoutSide')}
            hint={t('sellingLayoutSideHint')}
            value={layout.side}
            options={SELLING_SIDES.map((value) => ({
              value,
              label: t(`sellingLayoutSide_${value}`),
            }))}
            onChange={(side) => control.change({ side })}
          />
          <Segmented
            label={t('sellingLayoutPaySetting')}
            hint={t('sellingLayoutPayHint')}
            value={layout.pay}
            options={SELLING_PAYS.map((value) => ({
              value,
              label: t(`sellingLayoutPay_${value}`),
            }))}
            onChange={(pay) => control.change({ pay })}
          />
          <Segmented
            label={t('sellingLayoutTiles')}
            value={layout.tiles}
            options={SELLING_TILES.map((value) => ({
              value,
              label: t(`sellingLayoutTiles_${value}`),
            }))}
            onChange={(tiles) => control.change({ tiles })}
          />
          <ShareRow
            label={t(top ? 'sellingLayoutSplitHeight' : 'sellingLayoutSplitWidth')}
            names={[names.catalog, names.order]}
            share={layout.split}
            onChange={(split) => control.change({ split })}
            onPreview={(split) =>
              setPreview((current) => ({ ...current, split: split ?? undefined }))
            }
          />
          {paymentBesideOrder(layout) ? (
            <ShareRow
              label={t('sellingLayoutPaySplit')}
              names={[names.order, names.payment]}
              share={layout.paySplit}
              onChange={(paySplit) => control.change({ paySplit })}
              onPreview={(paySplit) =>
                setPreview((current) => ({ ...current, paySplit: paySplit ?? undefined }))
              }
            />
          ) : null}
          <p className="muted">{t('sellingLayoutDragHint')}</p>
        </div>
        <div className="sl-preview-box">
          <small>{t('sellingLayoutPreview')}</small>
          <Preview layout={shownLayout} />
          <small className="muted">{t(`sellingLayoutPreviewNote_${layout.pay}`)}</small>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" disabled={!custom} onClick={control.resetToPreset}>
          {t('sellingLayoutResetPreset')}
        </button>
        <button type="button" disabled={!chosen} onClick={control.useBranchDefault}>
          {t('sellingLayoutUseBranch')}
        </button>
        <button type="button" className="primary-button" onClick={onClose} data-autofocus>
          {t('sellingLayoutDone')}
        </button>
      </div>
    </dialog>
  );
}
