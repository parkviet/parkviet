import { formatMoney } from '@parkviet/pos-shared/money';
import { rateLabel } from '@parkviet/pos-shared/receipt-template/data';
import { useTranslation } from 'react-i18next';
import type { PosWorkspace } from '../../lib/pos-context';
import { courseName } from '../../lib/table-courses';
import { isTab, isTableOrder } from '../../lib/tables';
import { CompactOrderFoot } from '../selling-layout/compact-order-foot';
import type { SellingWorkspace } from '../workspace-tabs';
import type { TicketMorePanel } from './ticket-more-menu';

// The course "Giữ món" holds the next dishes in when none was picked.
const HOLD_COURSE = 2;
const OPEN_STATUSES = ['editing', 'parked'];

// The foot of the table ticket: what the order holds and costs, the
// secondary tools (pre-bill, hold, send and stay), then the two big buttons
// "Gửi bếp (n)" and "Thanh toán · total". A bar's tab has one send, "Gửi (n)",
// which stays on the tab, and closes the tab with its payment.
export function TicketFooter({
  selling,
  active,
  pending,
  sending,
  clockAmount = null,
  tabMode = false,
  compact = false,
  onMore,
  onSend,
  onPay,
}: {
  selling: SellingWorkspace;
  active: PosWorkspace;
  // Units the next kitchen send takes.
  pending: number;
  sending: boolean;
  // A room clock still counting: the server's quote of its time so far,
  // not on the order until the clock stops.
  clockAmount?: string | null;
  // A bar's open tabs sit beside the ticket.
  tabMode?: boolean;
  // The compact foot of this device's layout: chips and one bar.
  compact?: boolean;
  // Opens one of the order's editors (discount, note, customer, table).
  onMore?: (panel: TicketMorePanel) => void;
  onSend: (stay: boolean) => void;
  onPay: () => void;
}) {
  const { t } = useTranslation();
  const {
    data,
    activeTable,
    kitchenOn,
    locked,
    busy,
    editDisabled,
    isEditor,
    canAppend,
    placement,
    setPlacement,
    setPrebillOpen,
  } = selling;
  const table = activeTable.table !== null;
  // A table order or a bar tab is served by everyone: sent without the lease.
  const shared = isTableOrder(active);
  const currency = active.totals?.currency ?? 'VND';
  const branch = data?.branches.find((row) => row.id === active.branch_id);
  // A table order or a tab is always sent by hand; another order when the
  // branch is `manual` or `on_save` (for held dishes and fired courses).
  const canSend =
    kitchenOn &&
    (shared ||
      branch?.kitchen_send_trigger === 'manual' ||
      branch?.kitchen_send_trigger === 'on_save');
  // Anyone serving a table or a tab sends its additions; another order is
  // sent by the person holding it.
  const sendLocked = shared
    ? locked || busy || !OPEN_STATUSES.includes(active.operational_status)
    : editDisabled || !isEditor;
  const sendDisabled = sending || pending <= 0 || sendLocked;
  const canHold = kitchenOn && table && !active.payments;
  const count = (active.line_items ?? []).reduce(
    (sum, line) => sum + Math.max(0, line.quantity),
    0,
  );
  const charge = activeTable.serviceCharge;
  // What is added on top of the dishes, said by its rate.
  const extras = [
    ...(charge?.applies && !charge.waived && charge.rate
      ? [t('ticketServiceCharge', { rate: charge.rate.replace(/\.0+$/, '') })]
      : []),
    ...(active.totals?.taxes ?? []).map((tax) => `${tax.label} ${rateLabel(tax.rate)}`),
  ];
  // While the clock counts the total adds its quote, said as an estimate; with
  // a service charge or tax on top it also says those are not on the time yet.
  const clock = clockAmount !== null && Number.isFinite(Number(clockAmount)) ? clockAmount : null;
  const chargedOnTop =
    Boolean(charge?.applies && !charge.waived && charge.rate) ||
    (active.totals?.taxes ?? []).length > 0;
  const allocated = active.financial?.allocated ?? '0';
  const hasPaid = Number(allocated) > 0;
  const remaining =
    active.financial?.remaining ??
    String(Math.max(0, Number(active.totals?.total ?? 0) - Number(allocated)));
  const basePay = hasPaid ? remaining : (active.totals?.total ?? '0');
  const payTotal = clock ? String(Number(basePay) + Number(clock)) : basePay;
  const paidInFull = hasPaid && Number(payTotal) <= 0;
  const placed = [
    placement.seat ? t('ticketSeat', { seat: placement.seat }) : null,
    placement.course ? courseName(placement.course) : null,
    placement.course && placement.hold ? t('ticketPlacementHeld') : null,
  ].filter((part): part is string => part !== null);

  const payText = clock
    ? t(chargedOnTop ? 'ticketPayEstimateBeforeCharges' : 'ticketPayEstimate')
    : tabMode && isTab(active)
      ? t('ticketCloseTab')
      : hasPaid && !paidInFull
        ? t('ticketPayRemaining')
        : t('ticketPay');

  if (compact) {
    const discount = Number(active.totals?.discount_total ?? 0);
    const open = (panel: TicketMorePanel) => onMore?.(panel);
    return (
      <div className="ticket-footer ticket-footer-compact">
        <CompactOrderFoot
          chips={[
            {
              key: 'discount',
              label: t('orderFootChip_discount'),
              icon: 'tag',
              value: discount !== 0 ? formatMoney(String(discount), currency) : null,
              onClick: () => open('discount'),
            },
            {
              key: 'note',
              label: t('orderFootChip_note'),
              icon: 'note',
              value: active.note ? '•' : null,
              onClick: () => open('note'),
            },
            {
              key: 'customer',
              label: t('orderFootChip_customer'),
              icon: 'user',
              value: active.customer?.name ?? null,
              onClick: () => open('customer'),
            },
            ...(table
              ? [
                  {
                    key: 'table',
                    label: t('orderFootChip_table'),
                    icon: 'grid' as const,
                    value: extras.length > 0 ? extras.join(' · ') : null,
                    onClick: () => open('table'),
                  },
                ]
              : []),
          ]}
          count={count}
          total={paidInFull ? t('ticketPaidInFull') : formatMoney(payTotal, currency)}
          rows={[
            ...(active.totals
              ? [
                  {
                    label: t('quickSubtotal', { count }),
                    value: formatMoney(active.totals.item_total, currency),
                  },
                  { label: t('discount'), value: formatMoney(String(discount), currency) },
                ]
              : []),
            ...(clock
              ? [{ label: t('ticketClockTime'), value: formatMoney(clock, currency) }]
              : []),
            ...(hasPaid
              ? [{ label: t('orderFootPaid'), value: formatMoney(allocated, currency) }]
              : []),
          ]}
          more={[
            {
              label: t('receiptPrebillOpen'),
              disabled: active.operational_status !== 'editing',
              onClick: () => setPrebillOpen(true),
            },
            ...(canHold
              ? [
                  {
                    label: t('ticketHold'),
                    pressed: Boolean(placement.course && placement.hold),
                    disabled: !canAppend || busy,
                    title: t('ticketHoldHint', {
                      course: courseName(placement.course ?? HOLD_COURSE),
                    }),
                    onClick: () =>
                      setPlacement(
                        placement.course && placement.hold
                          ? { ...placement, hold: false }
                          : { ...placement, course: placement.course ?? HOLD_COURSE, hold: true },
                      ),
                  },
                ]
              : []),
            ...(canSend && !tabMode
              ? [
                  {
                    label: t('ticketSendStay'),
                    disabled: sendDisabled,
                    onClick: () => onSend(true),
                  },
                ]
              : []),
            { label: t('ticketMore'), onClick: () => open('menu') },
          ]}
          kitchen={
            canSend
              ? {
                  label: t(tabMode ? 'ticketSendTab' : 'ticketSend', { count: pending }),
                  count: pending,
                  disabled: sendDisabled,
                  onClick: () => onSend(tabMode),
                }
              : undefined
          }
          payLabel={payText}
          onPay={onPay}
        />
      </div>
    );
  }

  return (
    <footer className="ticket-footer">
      {/* The bill in short: the dishes, the discount, what is added on top,
          what was paid, and what the guest still owes in large type. */}
      <div className="ticket-summary ticket-totals">
        <p className="ticket-totals-row">
          <span>{t('quickSubtotal', { count })}</span>
          <span>{active.totals ? formatMoney(active.totals.item_total, currency) : '—'}</span>
        </p>
        {clock ? (
          <p className="ticket-totals-row">
            <span>{t('ticketClockTime')}</span>
            <span>{formatMoney(clock, currency)}</span>
          </p>
        ) : null}
        {active.totals ? (
          <p className="ticket-totals-row">
            <span>{t('discount')}</span>
            <span>{formatMoney(active.totals.discount_total, currency)}</span>
          </p>
        ) : null}
        {extras.length > 0 ? (
          <p className="ticket-totals-row ticket-totals-note">{extras.join(' · ')}</p>
        ) : null}
        {hasPaid ? (
          <p className="ticket-totals-row">
            <span>{t('ticketPaid', { amount: formatMoney(allocated, currency) })}</span>
          </p>
        ) : null}
        <p className="ticket-totals-due">
          <span>{t('amountDue')}</span>
          <strong>{paidInFull ? t('ticketPaidInFull') : formatMoney(payTotal, currency)}</strong>
        </p>
      </div>
      {canHold && placed.length > 0 ? (
        <p className="ticket-placement" role="status">
          <span>{t('ticketPlacement', { place: placed.join(' · ') })}</span>
          <button type="button" disabled={!canAppend || busy} onClick={() => setPlacement({})}>
            {t('ticketPlacementClear')}
          </button>
        </p>
      ) : null}
      <div className="ticket-tools">
        <button
          type="button"
          disabled={active.operational_status !== 'editing'}
          onClick={() => setPrebillOpen(true)}
        >
          {t('receiptPrebillOpen')}
        </button>
        {canHold ? (
          <button
            type="button"
            aria-pressed={Boolean(placement.course && placement.hold)}
            disabled={!canAppend || busy}
            title={t('ticketHoldHint', { course: courseName(placement.course ?? HOLD_COURSE) })}
            onClick={() =>
              setPlacement(
                placement.course && placement.hold
                  ? { ...placement, hold: false }
                  : { ...placement, course: placement.course ?? HOLD_COURSE, hold: true },
              )
            }
          >
            {t('ticketHold')}
          </button>
        ) : null}
        {canSend && !tabMode ? (
          <button type="button" disabled={sendDisabled} onClick={() => onSend(true)}>
            {t('ticketSendStay')}
          </button>
        ) : null}
      </div>
      <div className={canSend ? 'ticket-main' : 'ticket-main ticket-main-single'}>
        {canSend ? (
          <button
            type="button"
            className="ticket-send"
            disabled={sendDisabled}
            onClick={() => onSend(tabMode)}
          >
            {t(tabMode ? 'ticketSendTab' : 'ticketSend', { count: pending })}
          </button>
        ) : null}
        <button type="button" className="ticket-pay" onClick={onPay}>
          <small>{payText}</small> {paidInFull ? <b>{t('ticketPaidInFull')}</b> : <kbd>F9</kbd>}
        </button>
      </div>
    </footer>
  );
}
