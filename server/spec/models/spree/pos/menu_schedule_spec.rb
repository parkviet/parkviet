# frozen_string_literal: true

require 'rails_helper'

# A time-of-day menu runs in the branch timezone; a window past midnight
# belongs to the day it starts on.
RSpec.describe Spree::Pos::MenuSchedule do
  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }

  it 'reads a time window past midnight on the day it starts' do
    schedule = described_class.new(store: store, name: 'Đêm', starts_at: '22:00', ends_at: '02:00', days_of_week: [5])
    zone = ActiveSupport::TimeZone['Asia/Ho_Chi_Minh']
    expect(schedule).to be_valid
    expect(schedule.running_at?(zone.local(2026, 11, 13, 22, 0), 'Asia/Ho_Chi_Minh')).to be(true)
    expect(schedule.running_at?(zone.local(2026, 11, 14, 1, 59), 'Asia/Ho_Chi_Minh')).to be(true)
    expect(schedule.running_at?(zone.local(2026, 11, 14, 22, 0), 'Asia/Ho_Chi_Minh')).to be(false)
    expect(described_class.new(store: store, name: 'x', starts_at: '10:00', ends_at: '10:00')).not_to be_valid
    expect(described_class.new(store: store, name: 'x', starts_at: '10:00', ends_at: '11:00', days_of_week: [7])).not_to be_valid
  end
end
