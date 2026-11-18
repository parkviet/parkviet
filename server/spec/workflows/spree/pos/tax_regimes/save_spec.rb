# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_credit_helpers'

# Saving a tax regime: the catalog decides which combinations exist, only
# sent keys change, a save that changes nothing writes nothing, and every
# change is a new history row.
RSpec.describe Spree::Pos::TaxRegimes::Save do
  include PosCreditHelpers

  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }
  let(:branch) { credit_branch(store) }
  let(:admin) { credit_staff(store, branch, [], extra_permissions: %w[write_pos_topology]) }

  before { Spree::Pos::TaxCategories.seed!(store) }

  def save!(**attributes)
    described_class.call(store: store, actor: admin, attributes: attributes)
  end

  def errors_of(**attributes)
    save!(**attributes)
    raise 'expected a refusal'
  rescue ActiveRecord::RecordInvalid => e
    e.record.errors.attribute_names.map(&:to_s)
  end

  it 'refuses combinations the catalog does not have' do
    expect(errors_of(method: 'deduction', revenue_group: 'group_1')).to eq(['method'])
    expect(errors_of(method: 'direct', revenue_group: 'group_1', pit_method: 'income')).to eq(['pit_method'])
    expect(errors_of(method: 'direct', revenue_group: 'group_3', pit_method: 'revenue')).to eq(['pit_method'])
    # The service charge follows the goods option, so both are named.
    expect(errors_of(method: 'direct', revenue_group: 'group_1', item_option: 'deduction.vat_10')).
      to contain_exactly('item_option', 'service_fee_option')
    expect(errors_of(revenue_group: 'group_9')).to eq(['revenue_group'])
    expect(errors_of(enabled: 'maybe')).to eq(['enabled'])
    expect(Spree::Pos::TaxRegime.for_store(store).count).to eq(1)
  end

  it 'lets group 2 choose how income tax is computed and fixes the rate on income' do
    save!(method: 'direct', revenue_group: 'group_2', pit_method: 'income')
    regime = Spree::Pos::TaxRegime.current(store)
    expect(regime).to have_attributes(pit_method: 'income', pit_income_rate: BigDecimal('0.15'))

    save!(pit_method: 'revenue')
    expect(Spree::Pos::TaxRegime.current(store)).to have_attributes(pit_method: 'revenue', pit_income_rate: nil)
    save!(revenue_group: 'group_4', method: 'deduction')
    expect(Spree::Pos::TaxRegime.current(store)).to have_attributes(pit_method: 'income', pit_income_rate: BigDecimal('0.2'))
  end

  it 'starts a new method from the profile defaults and keeps the service charge on the goods option' do
    Spree::Pos::StoreProfile.create!(store: store, profile_key: 'quan_an', profile_version: 1)
    data = save!(method: 'direct', revenue_group: 'group_1')
    expect(data[:regime].slice(:default_item, :default_service_fee, :default_shipping).transform_values { |row| row[:option] }).to eq(
      default_item: 'direct.production_transport_food', default_service_fee: 'direct.production_transport_food',
      default_shipping: 'direct.production_transport_food'
    )

    save!(item_option: 'direct.service')
    expect(Spree::Pos::TaxRegime.current(store).service_fee_option).to eq('direct.service')
    save!(service_fee_option: 'direct.other')
    save!(item_option: 'direct.goods')
    expect(Spree::Pos::TaxRegime.current(store).option_keys).to include('item' => 'direct.goods', 'service_fee' => 'direct.other')
  end

  it 'writes a history row and an audit for a change, and nothing for a save that changes nothing' do
    save!(threshold_warning: false)
    expect(Spree::Pos::TaxRegime.for_store(store).count).to eq(2)
    audit = Spree::Pos::AuditEntry.where(store_id: store.id, action: 'tax_regime.change').sole
    expect(audit.metadata['from']).to include('threshold_warning' => true)
    expect(audit.metadata['to']).to include('threshold_warning' => false)
    expect(Spree::Pos::TaxRegime.current(store).changed_by).to eq(admin)

    save!(threshold_warning: false)
    expect(Spree::Pos::TaxRegime.for_store(store).count).to eq(2)
    expect(Spree::Pos::AuditEntry.where(store_id: store.id, action: 'tax_regime.change').count).to eq(1)
  end

  it 'needs the topology write permission' do
    reader = credit_staff(store, branch, [], extra_permissions: %w[read_pos_topology])
    expect { described_class.call(store: store, actor: reader, attributes: { threshold_warning: false }) }.
      to raise_error(CanCan::AccessDenied)
  end
end
