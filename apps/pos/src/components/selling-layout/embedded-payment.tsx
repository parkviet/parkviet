import { pendingKitchenUnits } from '@parkviet/pos-shared/ticket-groups';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PosWorkspace } from '../../lib/pos-context';
import { PaymentPanel } from '../payment-panel';
import { activePaymentProps, type SellingWorkspace } from '../workspace-tabs';

export const SELLING_PAYMENT_ID = 'selling-payment';

// Moves the focus to the payment that stays open beside or under the order.
export function focusPayment() {
  const target = document.getElementById(SELLING_PAYMENT_ID);
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
}

// The payment that stays open in its own column or under the order: the same
// panel the counter checks out with, so every rule that holds back a payment
// (no shift open, an empty or syncing order, unresolved attempts, a closed
// order) is the panel's own and applies here as it does there. `onSettled`
// gets the order once it is completed, for the screen to hand it over.
export function EmbeddedPayment({
  selling,
  onSettled,
}: {
  selling: SellingWorkspace;
  onSettled: (workspace: PosWorkspace) => void;
}) {
  const { t } = useTranslation();
  const { active, kitchenOn, locked, busy, run, command, workspaces } = selling;
  const [sending, setSending] = useState(false);
  // Dishes the kitchen has not had cannot go once the order is completed, so
  // they are called out here with their send, as on the payment screen.
  const unsent = kitchenOn && active ? pendingKitchenUnits(active) : 0;

  async function sendToKitchen() {
    if (!active || sending) return;
    setSending(true);
    try {
      await run(() => command(active, (current) => workspaces.sendToKitchen(current)));
    } finally {
      setSending(false);
    }
  }

  return (
    <aside
      className="selling-pay-panel"
      id={SELLING_PAYMENT_ID}
      tabIndex={-1}
      aria-label={t('checkoutTitle')}
    >
      {active && unsent > 0 && active.operational_status !== 'completed' ? (
        <div className="attention-box pay-unsent" role="alert">
          <span>{t('boardLegend_unsent')}</span>
          <button
            type="button"
            disabled={sending || locked || busy}
            onClick={() => void sendToKitchen()}
          >
            {t('ticketSend', { count: unsent })}
          </button>
        </div>
      ) : null}
      {active ? (
        <PaymentPanel
          key={active.id}
          {...activePaymentProps(selling, active)}
          showDue
          onSettled={onSettled}
        />
      ) : (
        <p className="muted ticket-empty" role="status">
          {selling.activeLoading ? t('contextWaiting') : t('checkoutNoPayment')}
        </p>
      )}
    </aside>
  );
}
