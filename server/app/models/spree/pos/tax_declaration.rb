# frozen_string_literal: true

module Spree
  module Pos
    # Saved tax declaration (01/CNKD, 01/GTGT, 04/GTGT, 05/KK-TNCN) with
    # period bounds, generation options, computed tax summary, and taxpayer
    # profile snapshot at calculation time.
    class TaxDeclaration < Record
      self.table_name = 'spree_pos_tax_declarations'
      has_prefix_id :postaxdecl

      DECLARATION_TYPES = %w[01_cnkd 01_gtgt 04_gtgt 05_kk_tncn].freeze
      PERIOD_TYPES = %w[month quarter].freeze
      STATUSES = %w[draft signed submitted accepted rejected].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :created_by, class_name: staff_class_name, optional: true
      belongs_to :updated_by, class_name: staff_class_name, optional: true

      validates :code, presence: true, length: { maximum: 48 }, uniqueness: { scope: :store_id }
      validates :declaration_type, inclusion: { in: DECLARATION_TYPES }
      validates :period_type, inclusion: { in: PERIOD_TYPES }
      validates :period_year, numericality: { only_integer: true, greater_than_or_equal_to: 2020, less_than_or_equal_to: 2100 }
      validates :period_number, numericality: { only_integer: true, greater_than_or_equal_to: 1, less_than_or_equal_to: 12 }
      validates :from_date, :to_date, presence: true
      validates :status, inclusion: { in: STATUSES }
      validate :valid_period_number_for_type

      scope :for_store, ->(store) { where(store_id: store.id) }

      def self.period_bounds(period_type, year, number)
        y = year.to_i
        n = number.to_i
        if period_type.to_s == 'month'
          from = Date.new(y, n.clamp(1, 12), 1)
          [from, from.end_of_month]
        else
          q = n.clamp(1, 4)
          from = Date.new(y, ((q - 1) * 3) + 1, 1)
          [from, (from + 2.months).end_of_month]
        end
      end

      def self.next_code(store, declaration_type, period_type, year, number)
        tag = case declaration_type.to_s
              when '01_cnkd' then 'CNKD'
              when '01_gtgt' then 'GTGT01'
              when '04_gtgt' then 'GTGT04'
              when '05_kk_tncn' then 'TNCN05'
              else 'TAX'
              end
        period_tag = period_type.to_s == 'month' ? format('%04dT%02d', year, number) : format('%04dQ%d', year, number)
        base = "TK-#{tag}-#{period_tag}"
        existing = for_store(store).where('code LIKE ?', "#{base}%").count
        existing.zero? ? base : "#{base}-BS#{existing}"
      end

      def period_label
        if period_type == 'month'
          "Tháng #{period_number}/#{period_year}"
        else
          "Quý #{period_number}/#{period_year}"
        end
      end

      def to_pos
        {
          id: prefixed_id,
          code: code,
          declaration_type: declaration_type,
          period_type: period_type,
          period_year: period_year,
          period_number: period_number,
          period_label: period_label,
          from_date: from_date&.iso8601,
          to_date: to_date&.iso8601,
          status: status,
          options: options || {},
          summary: summary || {},
          taxpayer_snapshot: taxpayer_snapshot || {},
          note: note.presence,
          submitted_at: submitted_at&.iso8601,
          accepted_at: accepted_at&.iso8601,
          created_by_name: StaffName.call(created_by),
          updated_by_name: StaffName.call(updated_by),
          created_at: created_at&.iso8601,
          updated_at: updated_at&.iso8601
        }
      end

      private

      def valid_period_number_for_type
        return if period_number.blank?

        max = period_type == 'month' ? 12 : 4
        errors.add(:period_number, :less_than_or_equal_to, count: max) if period_number > max
      end
    end
  end
end
