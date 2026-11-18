import { useTranslation } from 'react-i18next';
import {
  type CartLine,
  cartProblem,
  cartTotal,
  MAX_ITEMS,
  MAX_LINE_QUANTITY,
  MAX_LINES,
} from '../lib/cart';
import { isValidPrepayMethod } from '../lib/emenu';
import { formatMoney } from '../lib/money';
import type { GuestMenu } from '../lib/types';

// The cart before it is sent: change quantities, remove lines, send. A
// closed table (menu-only session) cannot send.
export function CartScreen({
  cart,
  currency,
  canSend,
  waitSeconds,
  sending,
  payment,
  method,
  onMethod,
  onQuantity,
  onSend,
}: {
  cart: CartLine[];
  currency: string;
  canSend: boolean;
  waitSeconds: number;
  sending: boolean;
  payment?: GuestMenu['payment'];
  method: 'vietqr' | 'counter' | null;
  onMethod: (method: 'vietqr' | 'counter') => void;
  onQuantity: (key: string, quantity: number) => void;
  onSend: () => void;
}) {
  const { t, i18n } = useTranslation();
  const problem = cartProblem(cart);
  const prepay = payment?.timing === 'pay_before';
  const validMethod = isValidPrepayMethod(payment, method);
  const vietqrOnlyUnavailable = Boolean(
    prepay &&
      payment.methods.length > 0 &&
      payment.methods.every((choice) => choice === 'vietqr') &&
      !payment.vietqr_available,
  );

  if (cart.length === 0) return <p className="muted">{t('cartEmpty')}</p>;
  return (
    <section aria-label={t('tabCart')}>
      <ul className="cart-lines">
        {cart.map((line) => (
          <li key={line.key} data-testid="cart-line">
            <div>
              <strong>{line.name}</strong>
              {line.size ? ` (${line.size})` : ''}
              {line.options.length > 0 ? <small>{line.options.join(', ')}</small> : null}
              {line.note ? <small>{line.note}</small> : null}
            </div>
            <div className="stepper">
              <button
                type="button"
                aria-label={`${t('less')} ${line.name}`}
                onClick={() => onQuantity(line.key, line.quantity - 1)}
              >
                −
              </button>
              <span>{line.quantity}</span>
              <button
                type="button"
                aria-label={`${t('more')} ${line.name}`}
                disabled={line.quantity >= MAX_LINE_QUANTITY}
                onClick={() => onQuantity(line.key, line.quantity + 1)}
              >
                +
              </button>
            </div>
            <button type="button" className="link" onClick={() => onQuantity(line.key, 0)}>
              {t('remove')}
            </button>
          </li>
        ))}
      </ul>
      <p className="total">
        {t('cartTotal')}:{' '}
        <strong data-testid="cart-total">
          {formatMoney(cartTotal(cart), currency, i18n.language)}
        </strong>
      </p>
      <p className="muted">{t('cartPriceNote')}</p>
      {problem ? (
        <p className="error" role="alert">
          {problem === 'too_many_lines'
            ? t('cartTooManyLines', { max: MAX_LINES })
            : t('cartTooManyItems', { max: MAX_ITEMS })}
        </p>
      ) : null}
      {prepay && payment ? (
        <fieldset className="pay-methods">
          <legend>{t('payBefore')}</legend>
          {payment.methods.map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name="pay-method"
                checked={validMethod && method === choice}
                disabled={choice === 'vietqr' && !payment.vietqr_available}
                onChange={() => onMethod(choice)}
              />
              {t(choice === 'vietqr' ? 'payVietqr' : 'payCounter')}
            </label>
          ))}
          {vietqrOnlyUnavailable ? (
            <p className="error" role="alert" data-testid="vietqr-unavailable">
              {t('error_vietqr_unavailable')}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <button
        type="button"
        className="primary block"
        disabled={!canSend || sending || problem !== null || (prepay && !validMethod)}
        data-testid="send-order"
        onClick={onSend}
      >
        {sending
          ? t('sending')
          : waitSeconds > 0
            ? t('sendWait', { seconds: waitSeconds })
            : t('send')}
      </button>
    </section>
  );
}
