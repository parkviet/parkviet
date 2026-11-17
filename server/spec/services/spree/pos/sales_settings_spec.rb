# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::SalesSettings do
  describe '.normalize' do
    it 'fills defaults and ignores a bad value' do
      expect(described_class.normalize(nil)).to eq(described_class::DEFAULTS)
      expect(described_class.normalize('allow_oversell' => false, 'cart_order' => 'nope', 'extra' => true)).to include(
        'allow_oversell' => false, 'cart_order' => 'oldest_first', 'show_stock' => true
      )
      expect(described_class.normalize('allow_oversell' => false)).not_to have_key('extra')
    end
  end

  describe '.merge' do
    it 'rejects an unknown key and a value of the wrong type' do
      expect { described_class.merge({}, 'nope' => true) }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'allow_oversell' => 'yes') }.to raise_error(described_class::Invalid)
    end

    it 'keeps keys that were not sent' do
      merged = described_class.merge({ 'show_stock' => false }, 'payment_chime' => 'off')
      expect(merged).to include('show_stock' => false, 'payment_chime' => 'off', 'allow_oversell' => true)
    end

    it 'accepts the four selling switches and rejects a value that is not boolean' do
      expect(described_class.normalize(nil)).to include(
        'inline_variants' => false, 'scheduled_delivery' => false, 'auto_print_prebill' => false, 'print_void_tickets' => true
      )
      merged = described_class.merge({}, 'inline_variants' => true, 'scheduled_delivery' => true,
                                          'auto_print_prebill' => true, 'print_void_tickets' => false)
      expect(merged).to include(
        'inline_variants' => true, 'scheduled_delivery' => true, 'auto_print_prebill' => true, 'print_void_tickets' => false,
        'allow_oversell' => true
      )
      expect { described_class.merge({}, 'print_void_tickets' => 'yes') }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'inline_variants' => 1) }.to raise_error(described_class::Invalid)
    end
  end
end
