import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenShift } from '../hooks/use-shift';
import { writesLocked } from '../lib/pos-context';
import { posFailureKey } from '../lib/request-failure';
import { usePosSelection } from './pos-selection';

// Whether this cashier may open a shift here now: a complete selection, the
// right to open one, no shift yet and writes not locked.
export function useCanOpenShift() {
  const { selection, context, selectionComplete } = usePosSelection();
  const data = context.data;
  return Boolean(
    selectionComplete &&
      selection.branchId &&
      data?.capabilities.includes('pos.shift.open') &&
      !data.shift &&
      !writesLocked(data, selection),
  );
}

// The open-shift form as a modal, opened on demand from the header shift
// button or the banner that tells selling waits for a shift.
export function OpenShiftDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { selection } = usePosSelection();
  const openShift = useOpenShift();
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState('0');
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selection.branchId) return;
    setError('');
    try {
      await openShift.mutateAsync({
        ...(selection.registerId
          ? { register_id: selection.registerId }
          : { branch_id: selection.branchId }),
        opening_float: amount.trim(),
      });
      onClose();
    } catch (caught) {
      setError(t(posFailureKey(caught)));
    }
  }

  return (
    <dialog
      className="open-shift-dialog"
      ref={dialog}
      aria-labelledby="open-shift-title"
      onClose={onClose}
    >
      <h2 id="open-shift-title">{t('openShiftTitle')}</h2>
      <form className="open-shift-form" onSubmit={submit}>
        <label>
          {t('openingFloat')}
          <input
            autoFocus
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('contextCancel')}
          </button>
          <button type="submit" className="primary-button" disabled={openShift.isPending}>
            {openShift.isPending ? t('waiting') : t('openShift')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
