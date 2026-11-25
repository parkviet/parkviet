# frozen_string_literal: true

module Spree
  module Pos
    class Payroll < Record
      self.table_name = 'spree_pos_payrolls'
      has_prefix_id :pospay

      STATUSES = %w[draft finalized].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch', optional: true
      belongs_to :created_by, class_name: staff_class_name, optional: true
      has_many :lines, -> { order(:position, :id) }, class_name: 'Spree::Pos::PayrollLine',
                                                    foreign_key: :payroll_id, inverse_of: :payroll, dependent: :destroy

      before_validation :assign_default_code, on: :create
      before_validation :normalize_fields

      validates :code, presence: true, length: { maximum: 32 }, uniqueness: { scope: :store_id, case_sensitive: false }
      validates :name, presence: true, length: { maximum: 255 }
      validates :period_start, :period_end, :payroll_date, presence: true
      validates :status, inclusion: { in: STATUSES }
      validate :period_range_valid

      scope :for_store, ->(store) { where(store_id: store.id) }

      def self.next_code_for(store)
        last = for_store(store).where("code ~ '^BL[0-9]+$'").order(Arel.sql("CAST(SUBSTRING(code FROM 3) AS INTEGER) DESC")).limit(1).pick(:code)
        seq = last ? last[2..].to_i + 1 : 1
        format('BL%04d', seq)
      end

      def draft?
        status == 'draft'
      end

      def finalized?
        status == 'finalized'
      end

      def recalculate_totals!
        loaded = lines.reload.to_a
        update!(
          total_gross: loaded.sum(&:gross_amount),
          total_deductions: loaded.sum(&:total_deductions),
          total_net: loaded.sum(&:net_amount),
          total_pit: loaded.sum(&:pit_tax),
          total_bhxh: loaded.sum(&:employee_bhxh),
          total_bhyt: loaded.sum(&:employee_bhyt),
          total_bhtn: loaded.sum(&:employee_bhtn),
          total_employer_cost: loaded.sum { |l| l.employer_bhxh + l.employer_bhyt + l.employer_bhtn }
        )
      end

      def to_pos(include_lines: false)
        payload = {
          id: prefixed_id,
          code: code,
          name: name,
          period_label: period_label,
          period_start: period_start.iso8601,
          period_end: period_end.iso8601,
          payroll_date: payroll_date.iso8601,
          status: status,
          note: note,
          branch_id: branch&.prefixed_id,
          branch_name: branch&.name,
          line_count: lines.size,
          total_gross: total_gross.to_s('F'),
          total_deductions: total_deductions.to_s('F'),
          total_net: total_net.to_s('F'),
          total_pit: total_pit.to_s('F'),
          total_bhxh: total_bhxh.to_s('F'),
          total_bhyt: total_bhyt.to_s('F'),
          total_bhtn: total_bhtn.to_s('F'),
          total_employer_cost: total_employer_cost.to_s('F'),
          finalized_at: finalized_at&.iso8601,
          created_at: created_at&.iso8601,
          updated_at: updated_at&.iso8601
        }
        payload[:lines] = lines.includes(:staff).map(&:to_pos) if include_lines
        payload
      end

      private

      def assign_default_code
        return if code.present? || store.nil?

        self.code = self.class.next_code_for(store)
      end

      def normalize_fields
        self.code = code.to_s.strip.upcase
        self.name = name.to_s.strip
        self.period_label = period_label.to_s.strip.presence
      end

      def period_range_valid
        return if period_start.blank? || period_end.blank?

        errors.add(:period_end, :greater_than_or_equal_to) if period_end < period_start
      end
    end
  end
end
