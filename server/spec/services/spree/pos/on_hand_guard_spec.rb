# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::OnHandGuard do
  let(:branch) { instance_double(Spree::Pos::Branch, stock_location_id: 4, sales_settings: { 'allow_oversell' => false }, store_id: 1) }
  let(:variant) { instance_double(Spree::Variant, id: 9, prefixed_id: 'var_9', track_inventory?: true) }
  let(:workspace) { instance_double(Spree::Pos::Workspace, branch: branch, store_id: 1, order_source: 'counter', id: 3) }

  before { allow(Spree::Pos::StockIntegration).to receive(:tracked_mode).and_return('none') }

  it 'does nothing while oversell is allowed' do
    allow(branch).to receive(:sales_settings).and_return('allow_oversell' => true)
    expect(Spree::StockLevel).not_to receive(:find_by)
    described_class.ensure!(workspace, variant, 5)
  end

  it 'refuses a quantity the shelf cannot cover' do
    allow(Spree::StockLevel).to receive(:find_by).and_return(instance_double(Spree::StockLevel, count_on_hand: 1))
    expect { described_class.ensure!(workspace, variant, 3) }.to raise_error(Spree::Pos::Conflict) { |error|
      expect(error.reason).to eq('stock_insufficient')
      expect(error.details).to include(needed: 3, on_hand: 1)
    }
  end

  it 'skips a location with no stock level and a menu line' do
    allow(Spree::StockLevel).to receive(:find_by).and_return(nil)
    expect { described_class.ensure!(workspace, variant, 9) }.not_to raise_error
    expect { described_class.ensure!(workspace, variant, 9, kind: 'menu') }.not_to raise_error
  end

  it 'does not check a delivery platform order' do
    allow(workspace).to receive(:order_source).and_return('grabfood')
    expect(Spree::StockLevel).not_to receive(:find_by)
    described_class.ensure!(workspace, variant, 9)
  end
end