import { paymentBesideOrder, splitTracks } from '@parkviet/pos-shared/selling-layout';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SellingLayoutControl } from '../../hooks/use-selling-layout';
import { popupOpen, typingTarget } from '../menu-grid';
import { PosIcon } from '../pos-icon';
import { idleScanField } from '../scan-input';
import { SplitDivider } from './split-divider';

// Where a modal is open the payment key waits, like the counter's own keys.
function modalOpen() {
  return document.querySelector('dialog[open], .modifier-panel') !== null;
}

// A key typed into a text field is the field's, unless the field is waiting
// for input: an empty search box or a scan field with nothing typed in it.
function typingIn(target: EventTarget | null) {
  if (!typingTarget(target)) return false;
  if (idleScanField(target)) return false;
  return !(target instanceof HTMLInputElement && target.type === 'search' && target.value === '');
}

// F9 asks to pay the order on the ticket, in whatever way this layout pays.
function usePayKey(onPayKey: (() => void) | undefined) {
  const handler = useRef(onPayKey);
  handler.current = onPayKey;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'F9' || event.defaultPrevented || !handler.current) return;
      // A key held with a modifier is the browser's or the system's.
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (typingIn(event.target) || popupOpen() || modalOpen()) return;
      event.preventDefault();
      handler.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// Payment in a dialog over the frame, which stays behind it.
function PayDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="selling-pay-dialog"
      aria-modal="true"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      {children}
    </dialog>
  );
}

// The head of a payment shown in place of the order or in a dialog: a way
// back to the order.
export function PaySheetHeader({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="selling-pay-head">
      <button type="button" className="ticket-back" onClick={onBack}>
        <PosIcon name="back" /> {backLabel}
      </button>
      <h2>{title}</h2>
    </div>
  );
}

// The frame the selling screens put their panels in: the catalogue, the
// order and the payment, laid out by the layout of this device (catalogue on
// the left, right or top; payment in a dialog, in place of the order, under
// it or in a column of its own) with draggable dividers between the panels.
// The screens keep their own panels and rules; the frame only places them.
// With the catalogue on top and a payment column, the payment takes the full
// height on the right and the catalogue sits over the order on the left.
//
// - `payment` stays open in its place when the layout pays `below` or in a
//   `column`.
// - `paySheet` is shown only while `paying`: as a dialog (`popup`) or in
//   place of the order (`slide`). It defaults to `payment`.
export function SellingFrame({
  control,
  catalog,
  order,
  payment,
  paySheet,
  paying = false,
  payLabel,
  onPayClose,
  onPayKey,
  card = true,
}: {
  control: SellingLayoutControl;
  catalog: ReactNode;
  order: ReactNode;
  payment?: ReactNode;
  paySheet?: ReactNode;
  paying?: boolean;
  // The accessible name of the payment dialog.
  payLabel: string;
  // Esc on the payment dialog.
  onPayClose?: () => void;
  onPayKey?: () => void;
  // The frame draws the panels' own box; off where they draw it themselves.
  card?: boolean;
}) {
  const { t } = useTranslation();
  const { layout, change, resetShare } = control;
  const { side, pay, split, paySplit } = layout;
  usePayKey(onPayKey);
  const mirrored = side === 'right';
  const top = side === 'top';
  const beside = paymentBesideOrder(layout);
  // One payment node may serve both: open in its place, or as the sheet.
  const sheet = paySheet ?? payment;
  const slideOpen = pay === 'slide' && paying && sheet !== undefined;
  const dialogOpen = pay === 'popup' && paying && sheet !== undefined;
  const alwaysOpen = (pay === 'column' || pay === 'below') && payment !== undefined;
  const names = {
    catalog: t('sellingLayoutCatalog'),
    order: t('sellingLayoutOrder'),
    payment: t('sellingLayoutPayment'),
  };

  const orderRegion = (
    <div className="selling-region selling-order" data-pay-sheet={slideOpen || undefined}>
      {slideOpen ? sheet : order}
    </div>
  );
  const paymentRegion = alwaysOpen ? (
    <div className="selling-region selling-payment">{payment}</div>
  ) : null;
  const group =
    paymentRegion && beside ? (
      <div
        className="selling-group"
        data-beside="true"
        style={{ '--selling-tracks': splitTracks(paySplit, mirrored) } as CSSProperties}
      >
        {mirrored ? paymentRegion : orderRegion}
        <SplitDivider
          share={paySplit}
          mirrored={mirrored}
          vertical={false}
          names={[names.order, names.payment]}
          onCommit={(share) => change({ paySplit: share })}
          onReset={() => resetShare('paySplit')}
        />
        {mirrored ? orderRegion : paymentRegion}
      </div>
    ) : paymentRegion ? (
      <div className="selling-group" data-stack="true">
        {orderRegion}
        {paymentRegion}
      </div>
    ) : (
      <div className="selling-group">{orderRegion}</div>
    );
  const catalogRegion = <div className="selling-region selling-catalog">{catalog}</div>;
  const divider = (
    <SplitDivider
      share={split}
      mirrored={mirrored}
      vertical={top}
      names={[names.catalog, names.order]}
      onCommit={(share) => change({ split: share })}
      onReset={() => resetShare('split')}
    />
  );

  // Catalogue over the order on the left, the payment column on the right.
  const payColumnBeside = top && pay === 'column' && paymentRegion !== null;
  const frame = payColumnBeside ? (
    <div
      className="selling-frame"
      data-side={side}
      data-pay={pay}
      data-pay-full="true"
      data-card={card || undefined}
      style={{ '--selling-tracks': splitTracks(paySplit, false) } as CSSProperties}
    >
      <div
        className="selling-group"
        data-rows="true"
        style={{ '--selling-tracks': splitTracks(split, false) } as CSSProperties}
      >
        {catalogRegion}
        {divider}
        {orderRegion}
      </div>
      <SplitDivider
        share={paySplit}
        mirrored={false}
        vertical={false}
        names={[names.order, names.payment]}
        onCommit={(share) => change({ paySplit: share })}
        onReset={() => resetShare('paySplit')}
      />
      {paymentRegion}
    </div>
  ) : null;

  return (
    <>
      {frame ?? (
        <div
          className="selling-frame"
          data-side={side}
          data-pay={pay}
          data-card={card || undefined}
          aria-hidden={dialogOpen || undefined}
          style={{ '--selling-tracks': splitTracks(split, mirrored) } as CSSProperties}
        >
          {mirrored ? group : catalogRegion}
          {divider}
          {mirrored ? catalogRegion : group}
        </div>
      )}
      {dialogOpen ? (
        <PayDialog label={payLabel} onClose={() => onPayClose?.()}>
          {sheet}
        </PayDialog>
      ) : null}
    </>
  );
}
