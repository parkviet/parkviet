import { initialChoice, printChoices } from '@parkviet/pos-shared/receipt-template/selection';
import type { ReceiptDocumentType } from '@parkviet/pos-shared/receipt-template/types';
import { normalizeSalesSettings } from '@parkviet/pos-shared/sales-settings';
import { Link } from '@tanstack/react-router';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReceiptTemplates } from '../../hooks/use-receipt-templates';
import type { PosContext } from '../../lib/pos-context';
import {
  autoPrintEnabled,
  rememberedTemplate,
  rememberTemplate,
  setAutoPrint,
} from '../../lib/receipt-preferences';
import { ToolbarPopover } from './toolbar-popover';

// The templates a cashier may pick a default for on this device. The other
// document types print with the branch's template.
const PICKABLE_DOCUMENTS: readonly { type: ReceiptDocumentType; label: string }[] = [
  { type: 'sale', label: 'toolbarPrinterSale' },
  { type: 'prebill', label: 'toolbarPrinterPrebill' },
];

// Printing settings that exist today, and nothing else: whether this device
// prints a sale receipt by itself, the template it starts from, and the way
// to the print queue. Kitchen tickets and dish labels follow the branch's
// printer settings, so they are only pointed at.
export function PrinterPopover({
  data,
  branchId,
  settingsUrl,
  open,
  onOpenChange,
}: {
  data: PosContext | undefined;
  branchId: string | null;
  // The branch settings of the POS dashboard, when this person may open them.
  settingsUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const salesSettings = normalizeSalesSettings(data?.sales_settings);
  const [auto, setAuto] = useState(() => autoPrintEnabled(salesSettings.auto_print_receipt));
  const templates = useReceiptTemplates(open, branchId);
  const base = useId();
  const choicesOf = (type: ReceiptDocumentType) =>
    printChoices(templates.data ?? [], type, null, {
      allowSheetReceipts: salesSettings.allow_sheet_receipts,
    });
  const [, setRemembered] = useState(0);

  return (
    <ToolbarPopover
      icon="print"
      label={t('toolbarPrinter')}
      title={t('toolbarPrinterTitle')}
      open={open}
      onOpenChange={onOpenChange}
    >
      <label className="toolbar-switch">
        <input
          type="checkbox"
          checked={auto}
          onChange={(event) => {
            setAutoPrint(event.target.checked);
            setAuto(event.target.checked);
          }}
        />
        <span>
          {t('toolbarPrinterAuto')}
          <small className="muted">{t('toolbarPrinterAutoHint')}</small>
        </span>
      </label>
      <div className="toolbar-section">
        <h3 className="toolbar-section-title">{t('toolbarPrinterTemplates')}</h3>
        {templates.isError || (templates.isSuccess && (templates.data?.length ?? 0) === 0) ? (
          <p className="muted">{t('toolbarPrinterNoTemplates')}</p>
        ) : null}
        {PICKABLE_DOCUMENTS.map(({ type, label }) => {
          const choices = choicesOf(type);
          if (choices.length === 0) return null;
          const current = initialChoice(choices, templates.data ?? [], rememberedTemplate(type), {
            allowSheetReceipts: salesSettings.allow_sheet_receipts,
          });
          const id = `${base}-${type}`;
          return (
            <div className="toolbar-field" key={type}>
              <label htmlFor={id}>{t(label)}</label>
              <select
                id={id}
                value={current ?? ''}
                onChange={(event) => {
                  rememberTemplate(type, event.target.value);
                  setRemembered((count) => count + 1);
                }}
              >
                {choices.map((choice) => (
                  <option key={choice.key} value={choice.key}>
                    {choice.name ?? t('receiptTemplates.counter.loadingName')}
                    {` · ${t(`receiptPaper_${choice.paper}`)}`}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      <div className="toolbar-section">
        {/* Leaving the sale page would drop the open invoice tabs, so the queue opens in a new tab. */}
        <Link
          to="/receipts"
          className="toolbar-link"
          target="_blank"
          rel="noopener"
          onClick={() => onOpenChange(false)}
        >
          {t('toolbarPrinterQueue')}
        </Link>
      </div>
      <p className="muted toolbar-note">{t('toolbarPrinterKitchen')}</p>
      {settingsUrl ? (
        <a
          className="toolbar-link"
          href={settingsUrl}
          target="_blank"
          rel="noopener"
          onClick={() => onOpenChange(false)}
        >
          {t('toolbarQuickBranchSettings')}
        </a>
      ) : null}
    </ToolbarPopover>
  );
}
