# frozen_string_literal: true

module Spree
  module Pos
    # A store's POS revenue in one calendar year of business dates, against
    # the tax threshold. Completed sales add to it and returns take away,
    # under a row lock, so two counters never cross the threshold twice.
    # `crossed_on` is the business date revenue first went above the
    # threshold and `crossed_period` its declaration period ("2026-07" by
    # month, "2026-Q3" by quarter); a year brought back to or under the
    # threshold is unmarked.
    class TaxRevenueYear < Record
      self.table_name = 'spree_pos_tax_revenue_years'
      has_prefix_id :postaxyear

      QUARTER = /\A(\d{4})-Q([1-4])\z/
      MONTH = /\A(\d{4})-(\d{2})\z/

      belongs_to :store, class_name: 'Spree::Store'

      validates :year, numericality: { only_integer: true }

      # The row for `year`, created when missing and locked until the
      # transaction ends.
      def self.lock_for!(store, year)
        insert({ store_id: store.id, year: year, revenue: 0 }, unique_by: :idx_pos_tax_revenue_years_store_year)
        lock.find_by!(store_id: store.id, year: year)
      end

      def self.for(store, year)
        find_by(store_id: store.id, year: year) || new(store: store, year: year, revenue: 0)
      end

      # "2026-07" for a monthly declarer, "2026-Q3" otherwise.
      def self.period_label(day, period)
        return format('%<year>04d-%<month>02d', year: day.year, month: day.month) if period == 'month'

        "#{day.year}-Q#{((day.month - 1) / 3) + 1}"
      end

      def self.period_end(label)
        if (match = QUARTER.match(label.to_s))
          Date.new(match[1].to_i, match[2].to_i * 3, 1).end_of_month
        elsif (match = MONTH.match(label.to_s))
          Date.new(match[1].to_i, match[2].to_i, 1).end_of_month
        end
      end

      # Adds the revenue of one business date of this year (negative for a
      # return) and marks or unmarks the crossing.
      def add!(amount, on:, period:)
        threshold = VnTaxCatalog.threshold(on: on)[:amount]
        self.revenue = revenue + amount
        if revenue <= threshold
          self.crossed_on = nil
          self.crossed_period = nil
        elsif crossed_on.nil?
          self.crossed_on = on
          self.crossed_period = self.class.period_label(on, period)
        end
        save!
      end

      # The e-invoice must be registered by the end of the crossing period
      # plus the catalog's registration days.
      def einvoice_deadline
        last = self.class.period_end(crossed_period)
        last && (last + VnTaxCatalog.threshold(on: crossed_on)[:einvoice_registration_days])
      end
    end
  end
end
