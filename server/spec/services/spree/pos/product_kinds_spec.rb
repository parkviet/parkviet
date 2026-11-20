# frozen_string_literal: true

require 'rails_helper'

# A product's POS kind is read from its product type's name, compared
# without case, spacing or Vietnamese marks, as the dashboard does.
RSpec.describe Spree::Pos::ProductKinds do
  it 'folds names the way the dashboard does' do
    expect(described_class.fold('  Sản   phẩm CHẾ biến ')).to eq('san pham che bien')
    expect(described_class.fold('Đồ uống')).to eq('do uong')
  end

  it 'recognises each kind, either accent placement and the legacy goods names' do
    expect(described_class.kind_of('Sản phẩm chế biến')).to eq('prepared')
    expect(described_class.kind_of('san pham che bien')).to eq('prepared')
    expect(described_class.kind_of('Nguyên liệu')).to eq('ingredient')
    expect(described_class.kind_of('Dịch vụ')).to eq('service')
    expect(described_class.kind_of('Sản phẩm thường')).to eq('goods')
    expect(described_class.kind_of('Hàng hoá')).to eq('goods')
    expect(described_class.kind_of('Hàng hóa')).to eq('goods')
    expect(described_class.kind_of('Sản phẩm')).to eq('goods')
    expect(described_class.kind_of('Đồ ăn')).to be_nil
    expect(described_class.kind_of(nil)).to be_nil
  end

  it 'finds the product types of a kind in one store or in all of them' do
    store = create(:store)
    other = create(:store)
    mine = Spree::ProductType.create!(store: store, name: 'Sản phẩm chế biến')
    theirs = Spree::ProductType.create!(store: other, name: 'san pham che bien')
    Spree::ProductType.create!(store: store, name: 'Nguyên liệu')

    expect(described_class.type_ids('prepared', store: store)).to eq([mine.id])
    expect(described_class.type_ids('prepared')).to contain_exactly(mine.id, theirs.id)
    expect { described_class.type_ids('combo') }.to raise_error(ArgumentError)
    expect(described_class.kind_for(create(:product, store: store, product_type: mine))).to eq('prepared')
    expect(described_class.kind_for(create(:product, store: store))).to be_nil
  end
end
