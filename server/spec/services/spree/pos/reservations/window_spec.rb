# frozen_string_literal: true

require 'rails_helper'
require_relative '../../../../support/pos_kitchen_helpers'

RSpec.describe Spree::Pos::Reservations::Window do
  include PosKitchenHelpers

  let(:periods) { [{ 'start' => '10:00', 'end' => '14:00' }, { 'start' => '17:00', 'end' => '22:00' }] }
  let(:zone) { ActiveSupport::TimeZone['Asia/Ho_Chi_Minh'] }
  let(:now) { zone.parse('2026-11-17 06:00') }

  def reasons(clock, at: now, list: periods, open_buffer: 30, close_buffer: 60, min_lead: 0, timezone: 'Asia/Ho_Chi_Minh')
    starts_at = clock.is_a?(String) ? zone.parse("2026-11-17 #{clock}") : clock
    rules = { periods: list, timezone: timezone, open_buffer: open_buffer, close_buffer: close_buffer, min_lead: min_lead }
    described_class.check(rules, starts_at: starts_at, now: at)
  end

  it 'takes a booking after the opening buffer and up to the closing one' do
    expect(reasons('10:30')).to eq([])
    expect(reasons('21:00')).to eq([])
  end

  it 'names each broken rule' do
    expect(reasons('15:00')).to eq(['outside_periods'])
    expect(reasons('10:10')).to eq(['before_open'])
    expect(reasons('21:30')).to eq(['after_close'])
    expect(reasons('11:00', at: zone.parse('2026-11-17 10:50'), min_lead: 30)).to eq(['too_soon'])
  end

  it 'follows a period past midnight, in the branch time zone' do
    late = [{ 'start' => '22:00', 'end' => '02:00' }]
    expect(reasons('23:30', list: late, open_buffer: 0, close_buffer: 0)).to eq([])
    expect(reasons(zone.parse('2026-11-18 01:00'), list: late, open_buffer: 0, close_buffer: 0)).to eq([])
    expect(reasons(zone.parse('2026-11-18 02:00'), list: late, open_buffer: 0, close_buffer: 0)).to eq(['outside_periods'])
    expect(reasons('10:30', timezone: 'UTC')).to eq(['outside_periods'])
  end

  it 'takes any time without periods' do
    expect(reasons('15:00', list: [])).to eq([])
  end

  describe '.normalize!' do
    def normalize(rows, open_buffer: 0, close_buffer: 0)
      described_class.normalize!(rows, open_buffer: open_buffer, close_buffer: close_buffer, cutoff: '04:00')
    end

    it 'sorts the periods from the business day cutoff and lets them touch' do
      rows = [{ start: '21:00', end: '02:00' }, { start: '10:00', end: '14:00' }, { start: '17:00', end: '21:00' }]
      expect(normalize(rows).pluck('start')).to eq(%w[10:00 17:00 21:00])
    end

    it 'refuses overlaps, bad clocks, too many periods and a period the buffers fill' do
      invalid = [[{ start: '22:00', end: '03:00' }, { start: '02:00', end: '05:00' }],
                 [{ start: '10:00', end: '10:00' }], [{ start: '24:00', end: '10:00' }],
                 Array.new(5) { |index| { start: format('%02d:00', index * 2), end: format('%02d:30', index * 2) } }]
      invalid.each do |rows|
        expect { normalize(rows) }.to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('reservation_periods_invalid') }
      end
      expect { normalize([{ start: '10:00', end: '11:00' }], open_buffer: 30, close_buffer: 30) }.
        to raise_error(Spree::Pos::Conflict) { |error| expect(error.reason).to eq('reservation_window_empty') }
    end
  end

  describe '.effective_periods' do
    let(:store) { menu_store }
    let(:branch) { kitchen_branch(store) }

    it "uses the branch's periods, else the opening hours, else none" do
      expect(described_class.effective_periods(branch)).to eq([])
      expect(described_class.source(branch)).to eq('none')

      Spree::Pos::StoreInfo.create!(store: store, name: 'POS', phone: '0901111111', business_day_cutoff: '04:00',
                                    opening_time: '08:00', closing_time: '22:00')
      expect(described_class.effective_periods(branch)).to eq([{ 'start' => '08:00', 'end' => '22:00' }])
      expect(described_class.source(branch)).to eq('opening_hours')

      branch.update!(reservation_periods: [{ 'start' => '11:00', 'end' => '14:00' }])
      expect(described_class.effective_periods(branch)).to eq([{ 'start' => '11:00', 'end' => '14:00' }])
      expect(described_class.source(branch)).to eq('branch')
    end
  end
end
