import { describe, expect, it } from 'vitest';
import { addressLine, type StoreInfoDraft, storeInfoFilled, suggestedCutoff } from './store-info';

const blank: StoreInfoDraft = {
  logo: false,
  name: '',
  phone: '',
  adminEmail: '',
  contactEmail: '',
  taxCode: '',
  identityNumber: '',
  profileKeys: [],
  opening: '',
  closing: '',
  provinceCode: '',
  wardCode: '',
  street: '',
  description: '',
};

describe('store info form', () => {
  it('suggests the closing time as the business-day cutoff, including overnight', () => {
    expect(suggestedCutoff('05:00')).toBe('05:00');
    expect(suggestedCutoff(' 14:30 ')).toBe('14:30');
    expect(suggestedCutoff('25:00')).toBeNull();
    expect(suggestedCutoff('')).toBeNull();
  });

  it('counts the eleven store-info items and ignores a half-filled address or shift', () => {
    expect(storeInfoFilled(blank)).toBe(0);
    expect(
      storeInfoFilled({
        ...blank,
        logo: true,
        name: ' Quán ',
        phone: '090',
        adminEmail: 'a@b.c',
        contactEmail: 'c@b.c',
        taxCode: '0100000000',
        identityNumber: '001',
        profileKeys: ['cafe_tra_sua'],
        opening: '14:00',
        closing: '',
        provinceCode: '01',
        street: '1 Lê Lợi',
        description: 'Mở cửa',
      }),
    ).toBe(9);
    expect(
      storeInfoFilled({
        ...blank,
        opening: '14:00',
        closing: '05:00',
        provinceCode: '01',
        wardCode: '00004',
        street: '1 Lê Lợi',
      }),
    ).toBe(2);
  });

  it('joins a structured address', () => {
    expect(addressLine({ street: '1 Lê Lợi', wardName: 'Ba Đình', provinceName: 'Hà Nội' })).toBe(
      '1 Lê Lợi, Ba Đình, Hà Nội, Việt Nam',
    );
    expect(addressLine({ street: '', wardName: '', provinceName: '' })).toBe('');
  });
});
