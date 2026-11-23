import type { LabelItem, LabelStoreInfo } from './render';

// Made-up items for the template editor's preview: one with an original
// price and an EAN-13 code, one with variant options and a Code 128 code,
// one with a SKU only, and one with a long name. The figures are fixed and
// never real goods.

export const SAMPLE_LABEL_STORE: LabelStoreInfo = {
  name: 'Cửa hàng Park Việt',
  address: '12 Lê Lợi, Quận 1',
};

export function sampleLabelItems(): LabelItem[] {
  return [
    {
      variant_id: 'sample-1',
      product_name: 'Sữa tươi tiệt trùng 1L',
      variant_options: null,
      sku: 'SP000101',
      barcode: '8934563138165',
      unit: 'Hộp',
      price: '32000.0',
      original_price: '36000.0',
      currency: 'VND',
      quantity: 1,
    },
    {
      variant_id: 'sample-2',
      product_name: 'Áo thun cổ tròn',
      variant_options: 'Đỏ / L',
      sku: 'AT-DO-L',
      barcode: 'AT-DO-L-0042',
      unit: 'Cái',
      price: '149000.0',
      original_price: null,
      currency: 'VND',
      quantity: 1,
    },
    {
      variant_id: 'sample-3',
      product_name: 'Gạo thơm ST25',
      variant_options: null,
      sku: 'SP000102',
      barcode: null,
      unit: 'Kg',
      price: '28000.0',
      original_price: null,
      currency: 'VND',
      quantity: 1,
    },
    {
      variant_id: 'sample-4',
      product_name: 'Nước giặt hương hoa oải hương dịu nhẹ can lớn tiết kiệm 3,8 lít',
      variant_options: '3,8 lít',
      sku: 'SP000103',
      barcode: '8934563138172',
      unit: 'Can',
      price: '189000.0',
      original_price: null,
      currency: 'VND',
      quantity: 1,
    },
  ];
}
