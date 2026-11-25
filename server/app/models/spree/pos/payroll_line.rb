# frozen_string_literal: true

module Spree
  module Pos
    class PayrollLine < Record
      self.table_name = 'spree_pos_payroll_lines'
      has_prefix_id :pospayline

      NUMERIC_FIELDS = %i[
        piece_quantity piece_amount work_days time_amount
        paid_leave_days paid_leave_amount payroll_allowance other_allowance bonus
        employee_bhxh employee_bhyt employee_bhtn other_deduction pit_tax
        employer_bhxh employer_bhyt employer_bhtn
      ].freeze

      belongs_to :payroll, class_name: 'Spree::Pos::Payroll', inverse_of: :lines
      belongs_to :staff, class_name: staff_class_name

      validates :staff_id, uniqueness: { scope: :payroll_id }
      validates :note, length: { maximum: 255 }, allow_nil: true

      before_validation :recalculate_amounts

      def recalculate_amounts
        NUMERIC_FIELDS.each do |field|
          self[field] = BigDecimal(self[field].presence || 0)
        end

        self.gross_amount = piece_amount + time_amount + paid_leave_amount + payroll_allowance + other_allowance + bonus
        self.total_deductions = employee_bhxh + employee_bhyt + employee_bhtn + other_deduction + pit_tax
        self.net_amount = gross_amount - total_deductions
      end

      def to_pos
        {
          id: prefixed_id,
          staff_id: staff.prefixed_id,
          staff: {
            id: staff.prefixed_id,
            email: staff.email,
            full_name: staff.full_name
          },
          position: position,
          piece_quantity: piece_quantity.to_s('F'),
          piece_amount: piece_amount.to_s('F'),
          work_days: work_days.to_s('F'),
          time_amount: time_amount.to_s('F'),
          paid_leave_days: paid_leave_days.to_s('F'),
          paid_leave_amount: paid_leave_amount.to_s('F'),
          payroll_allowance: payroll_allowance.to_s('F'),
          other_allowance: other_allowance.to_s('F'),
          bonus: bonus.to_s('F'),
          gross_amount: gross_amount.to_s('F'),
          employee_bhxh: employee_bhxh.to_s('F'),
          employee_bhyt: employee_bhyt.to_s('F'),
          employee_bhtn: employee_bhtn.to_s('F'),
          other_deduction: other_deduction.to_s('F'),
          pit_tax: pit_tax.to_s('F'),
          total_deductions: total_deductions.to_s('F'),
          net_amount: net_amount.to_s('F'),
          employer_bhxh: employer_bhxh.to_s('F'),
          employer_bhyt: employer_bhyt.to_s('F'),
          employer_bhtn: employer_bhtn.to_s('F'),
          note: note
        }
      end
    end
  end
end
