# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spree::Pos::EmenuSettings do
  describe '.normalize' do
    it 'fills defaults and ignores a bad value' do
      expect(described_class.normalize(nil)).to include('payment_timing' => 'pay_after', 'prepay_timeout_minutes' => 10, 'paused' => false)
      expect(described_class.normalize('brand_color' => 'nope', 'paused' => true)).to include('brand_color' => '#0b6e4f', 'paused' => true)
    end
  end

  describe '.merge' do
    it 'rejects an unknown key and a value of the wrong type' do
      expect { described_class.merge({}, 'nope' => true) }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'paused' => 'yes') }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'pay_methods' => []) }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'sticker_greeting' => 'x' * 101) }.to raise_error(described_class::Invalid)
      expect { described_class.merge({}, 'best_sellers_limit' => 0) }.to raise_error(described_class::Invalid)
    end

    it 'keeps keys that were not sent' do
      merged = described_class.merge({ 'paused' => true }, 'payment_timing' => 'pay_before', 'prepay_timeout_minutes' => '12')
      expect(merged).to include('paused' => true, 'payment_timing' => 'pay_before', 'prepay_timeout_minutes' => 12, 'pay_methods' => %w[vietqr counter])
    end
  end

  describe 'Emenu::Qr.guest_order_id' do
    it 'matches EM<id> on word boundaries case-insensitively and ignores unrelated words' do
      expect(Spree::Pos::Emenu::Qr.guest_order_id('PKV EM42')).to eq(42)
      expect(Spree::Pos::Emenu::Qr.guest_order_id('chuyen khoan em 108 nhe')).to eq(108)
      expect(Spree::Pos::Emenu::Qr.guest_order_id('THEM 5 LY')).to be_nil
      expect(Spree::Pos::Emenu::Qr.guest_order_id('XEM 12')).to be_nil
    end
  end
end
