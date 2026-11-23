// Pure helpers for the POS store-info form. The server remains the source of
// truth for what is stored; these only count a draft and suggest a cutoff.

export const STORE_INFO_TOTAL = 11;

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export type StoreInfoDraft = {
  logo: boolean;
  name: string;
  phone: string;
  adminEmail: string;
  contactEmail: string;
  taxCode: string;
  identityNumber: string;
  profileKeys: string[];
  opening: string;
  closing: string;
  provinceCode: string;
  wardCode: string;
  street: string;
  description: string;
};

export function suggestedCutoff(closing: string): string | null {
  const clock = closing.trim();
  return CLOCK.test(clock) ? clock : null;
}

export function storeInfoFilled(draft: StoreInfoDraft): number {
  const filled = [
    draft.logo,
    draft.name.trim() !== '',
    draft.phone.trim() !== '',
    draft.adminEmail.trim() !== '',
    draft.contactEmail.trim() !== '',
    draft.taxCode.trim() !== '',
    draft.identityNumber.trim() !== '',
    draft.profileKeys.length > 0,
    draft.opening.trim() !== '' && draft.closing.trim() !== '',
    draft.provinceCode.trim() !== '' && draft.wardCode.trim() !== '' && draft.street.trim() !== '',
    draft.description.trim() !== '',
  ];
  return filled.filter(Boolean).length;
}

export function addressLine(parts: {
  street: string;
  wardName: string;
  provinceName: string;
}): string {
  const pieces = [parts.street, parts.wardName, parts.provinceName]
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return pieces.length ? `${pieces.join(', ')}, Việt Nam` : '';
}
