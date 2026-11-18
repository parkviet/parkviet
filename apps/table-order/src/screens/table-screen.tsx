import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QrMark } from '../components/qr-mark';
import { expirySeconds, formatDuration, isOrderQrActive } from '../lib/emenu';
import { formatMoney } from '../lib/money';
import type {
  GuestMenu,
  GuestOrder,
  GuestRequest,
  GuestSession,
  GuestTable,
  PaymentQr,
} from '../lib/types';

// "Bàn của tôi": this phone's orders and where they are, what is on the
// table with its kitchen state, and the calls for staff and for the bill.
export function TableScreen({
  session,
  table,
  payment,
  now,
  busy,
  bill,
  restorableOrderId,
  onPayVietqr,
  onCancelOrder,
  onRestoreOrder,
  onRequest,
}: {
  session: GuestSession;
  table: GuestTable | null;
  payment?: GuestMenu['payment'];
  now: number;
  busy: boolean;
  bill: PaymentQr | null;
  restorableOrderId: string | null;
  onPayVietqr: () => void;
  onCancelOrder: (orderId: string) => void;
  onRestoreOrder: () => void;
  onRequest: (kind: GuestRequest['kind']) => void;
}) {
  const { t, i18n } = useTranslation();
  const [choicesOpen, setChoicesOpen] = useState(false);
  const open = (kind: GuestRequest['kind']) =>
    (table?.requests ?? []).some((request) => request.kind === kind && request.status === 'open');
  const tableOpen = session.status === 'open';
  const ordering = tableOpen && !session.paused;
  const timed = session.timed || table?.has_timed === true;
  const paidAmount = Number(table?.paid ?? 0);
  const dueAmount = Number(table?.due ?? 0);

  const isPayAfter = !payment || payment.timing === 'pay_after';
  const methods = isPayAfter ? (payment?.methods ?? ['counter']) : ['counter'];
  const offersVietqr = isPayAfter && methods.includes('vietqr');
  const hasVietqr = Boolean(offersVietqr && payment?.vietqr_available);
  const hasCounter = methods.includes('counter');
  const multiChoice = offersVietqr && hasCounter;
  const vietqrOnlyUnavailable = Boolean(offersVietqr && !hasCounter && !payment?.vietqr_available);
  const showChoices =
    choicesOpen && ordering && dueAmount > 0 && (multiChoice || vietqrOnlyUnavailable);

  const handlePayBill = () => {
    if (multiChoice || vietqrOnlyUnavailable) {
      setChoicesOpen((value) => !value);
    } else if (hasVietqr) {
      onPayVietqr();
    } else if (hasCounter) {
      onRequest('request_bill');
    }
  };

  return (
    <section aria-label={t('tabTable')}>
      {(table?.orders ?? []).length > 0 ? (
        <>
          <h2>{t('myOrders')}</h2>
          <ul className="orders" data-testid="my-orders">
            {[...(table?.orders ?? [])].reverse().map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                busy={busy}
                canRestore={restorableOrderId === order.id}
                onCancel={onCancelOrder}
                onRestore={onRestoreOrder}
              />
            ))}
          </ul>
        </>
      ) : null}
      {tableOpen ? (
        <>
          <h2>{t('onTable')}</h2>
          {(table?.lines ?? []).length === 0 ? (
            <p className="muted">{t('tableEmpty')}</p>
          ) : (
            <ul className="table-lines" data-testid="table-lines">
              {(table?.lines ?? []).map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the server sends lines in a fixed order
                <li key={index}>
                  <span>
                    {Number(line.quantity)} × {line.name}
                    {line.size ? ` (${line.size})` : ''}
                    {line.options.length > 0 ? <small>{line.options.join(', ')}</small> : null}
                  </span>
                  <span className="muted">{t(`kitchen_${line.kitchen}`)}</span>
                </li>
              ))}
            </ul>
          )}
          {table?.subtotal ? (
            <p className="total">
              {t('subtotal')}:{' '}
              <strong>{formatMoney(table.subtotal, session.currency, i18n.language)}</strong>
            </p>
          ) : null}
          {paidAmount > 0 ? (
            <p className="total" data-testid="amount-paid">
              {t('paidAmount')}:{' '}
              <strong>{formatMoney(table?.paid, session.currency, i18n.language)}</strong>
            </p>
          ) : null}
          {dueAmount > 0 ? (
            <p className="total" data-testid="amount-due">
              {t('due')}:{' '}
              <strong>{formatMoney(table?.due, session.currency, i18n.language)}</strong>
            </p>
          ) : null}
        </>
      ) : null}
      <div className="requests">
        <button
          type="button"
          disabled={busy || open('call_staff')}
          data-testid="call-staff"
          onClick={() => onRequest('call_staff')}
        >
          {t('callStaff')}
        </button>
        {ordering ? (
          <button
            type="button"
            className="primary"
            disabled={busy || dueAmount <= 0 || (!offersVietqr && open('request_bill'))}
            data-testid="pay-bill"
            onClick={handlePayBill}
          >
            {t('payBill')}
          </button>
        ) : null}
      </div>
      {showChoices ? (
        <div className="pay-choices" data-testid="pay-choices">
          {offersVietqr ? (
            <button
              type="button"
              disabled={busy || !hasVietqr}
              data-testid="pay-vietqr"
              onClick={() => {
                setChoicesOpen(false);
                onPayVietqr();
              }}
            >
              {t('payVietqr')}
            </button>
          ) : null}
          {hasCounter ? (
            <button
              type="button"
              disabled={busy || open('request_bill')}
              data-testid="request-bill"
              onClick={() => {
                setChoicesOpen(false);
                onRequest('request_bill');
              }}
            >
              {t('payCounter')}
            </button>
          ) : null}
          {offersVietqr && !hasVietqr ? (
            <p className="error" role="alert" data-testid="vietqr-unavailable">
              {t('error_vietqr_unavailable')}
            </p>
          ) : null}
        </div>
      ) : null}
      {bill?.payload ? (
        <div className="qr-card" data-testid="bill-qr">
          <QrMark payload={bill.payload} label={t('payVietqr')} />
          <p className="qr-amount">
            <strong>
              {formatMoney(bill.amount, bill.currency || session.currency, i18n.language)}
            </strong>
          </p>
          <p className="qr-meta">
            <span>{t('transferContent')}:</span> <strong>{bill.transfer_content}</strong>
          </p>
          {bill.bank_name || bill.account_number || bill.account_name ? (
            <p className="qr-meta">
              <span>{t('bankAccount')}:</span>{' '}
              <strong>
                {[bill.bank_name, bill.account_number, bill.account_name]
                  .filter(Boolean)
                  .join(' · ')}
              </strong>
            </p>
          ) : null}
        </div>
      ) : null}
      {tableOpen && timed ? <p className="muted">{t('timedNote')}</p> : null}
      {(['call_staff', 'request_bill'] as const).map((kind) =>
        open(kind) ? (
          <p key={kind} role="status" className="notice">
            {t(`requestOpen_${kind}`)}
          </p>
        ) : null,
      )}
    </section>
  );
}

function OrderRow({
  order,
  now,
  busy,
  canRestore,
  onCancel,
  onRestore,
}: {
  order: GuestOrder;
  now: number;
  busy: boolean;
  canRestore: boolean;
  onCancel: (id: string) => void;
  onRestore: () => void;
}) {
  const { t, i18n } = useTranslation();
  const qr = order.payment?.qr ?? null;
  const qrActive =
    order.status === 'awaiting_payment' && isOrderQrActive(order.payment?.expires_at, now);
  const secondsLeft = qrActive ? expirySeconds(order.payment?.expires_at, now) : null;
  const showRestore =
    canRestore &&
    (order.status === 'canceled' ||
      order.status === 'expired' ||
      (order.status === 'awaiting_payment' && !qrActive));

  return (
    <li data-status={order.status} data-testid={`order-${order.id}`}>
      <p>
        <strong>
          {order.status === 'rejected'
            ? t('status_rejected', { reason: order.reject_reason ?? '' })
            : t(`status_${order.status}`)}
        </strong>{' '}
        · {formatMoney(order.quoted_total, order.currency, i18n.language)}
      </p>
      {qrActive && qr?.payload ? (
        <div className="qr-card" data-testid={`order-qr-${order.id}`}>
          <QrMark payload={qr.payload} label={t('payVietqr')} />
          <p className="qr-amount">
            <strong>{formatMoney(qr.amount, qr.currency || order.currency, i18n.language)}</strong>
          </p>
          <p className="qr-meta">
            <span>{t('transferContent')}:</span> <strong>{qr.transfer_content}</strong>
          </p>
          {qr.bank_name || qr.account_number || qr.account_name ? (
            <p className="qr-meta">
              <span>{t('bankAccount')}:</span>{' '}
              <strong>
                {[qr.bank_name, qr.account_number, qr.account_name].filter(Boolean).join(' · ')}
              </strong>
            </p>
          ) : null}
          {secondsLeft !== null && secondsLeft > 0 ? (
            <p className="muted qr-expiry">
              {t('expiresIn', { time: formatDuration(secondsLeft) })}
            </p>
          ) : null}
        </div>
      ) : null}
      {qrActive ? (
        <div className="order-actions">
          <button
            type="button"
            disabled={busy}
            data-testid={`cancel-order-${order.id}`}
            onClick={() => onCancel(order.id)}
          >
            {t('cancelPayment')}
          </button>
        </div>
      ) : null}
      {showRestore ? (
        <div className="order-actions">
          <button
            type="button"
            disabled={busy}
            data-testid={`restore-order-${order.id}`}
            onClick={onRestore}
          >
            {t('restoreCart')}
          </button>
        </div>
      ) : null}
      <ul>
        {order.items.map((item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the server sends items in a fixed order
          <li key={index} className={item.outcome === 'left_out' ? 'left-out' : undefined}>
            {item.quantity} × {item.name}
            {item.size ? ` (${item.size})` : ''}
            {item.options.length > 0 ? ` · ${item.options.join(', ')}` : ''}
            {item.outcome === 'left_out' ? ` · ${t('leftOut')}` : ''}
          </li>
        ))}
      </ul>
    </li>
  );
}
