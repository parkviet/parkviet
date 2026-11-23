import type { ReceiptDocumentType } from '@shared/receipt-template/types';

export const rememberedTemplateKey = (documentType: ReceiptDocumentType) =>
  `parkviet-pos:receipt-template:${documentType}`;
// Paper was chosen per device before templates carried it.
export const LEGACY_PAPER_KEYS = ['parkviet-pos:receipt-paper', 'parkviet-pos:ticket-paper'];

export function rememberedTemplate(documentType: ReceiptDocumentType): string | null {
  try {
    return window.localStorage.getItem(rememberedTemplateKey(documentType));
  } catch {
    return null;
  }
}

export function rememberTemplate(documentType: ReceiptDocumentType, templateId: string) {
  try {
    window.localStorage.setItem(rememberedTemplateKey(documentType), templateId);
    for (const key of LEGACY_PAPER_KEYS) window.localStorage.removeItem(key);
  } catch {
    // A preference only: the print itself is recorded on the server.
  }
}

// Printing sale receipts as soon as they are issued is a setting of this
// device (its printer and driver), off until turned on here.
export const AUTO_PRINT_KEY = 'parkviet-pos:auto-print:sale';

// A stored "on" or "off" is this register's choice. Nothing stored follows
// the branch default (off when the caller does not pass one).
export function autoPrintEnabled(branchDefault = false): boolean {
  try {
    const stored = window.localStorage.getItem(AUTO_PRINT_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
    return branchDefault;
  } catch {
    return branchDefault;
  }
}

export function setAutoPrint(on: boolean | null) {
  try {
    if (on === null) window.localStorage.removeItem(AUTO_PRINT_KEY);
    else window.localStorage.setItem(AUTO_PRINT_KEY, on ? 'on' : 'off');
  } catch {
    // Storage unavailable: the cashier prints by hand.
  }
}
