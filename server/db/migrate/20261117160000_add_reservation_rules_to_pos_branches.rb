# frozen_string_literal: true

# When a branch takes bookings: up to four service periods ("HH:MM" start and
# end, an end before the start runs past midnight; empty uses the opening
# hours), minutes after a period opens and before it closes when no booking
# starts, and how far ahead a booking must be made.
class AddReservationRulesToPosBranches < ActiveRecord::Migration[8.1]
  def change
    change_table :spree_pos_branches, bulk: true do |t|
      t.jsonb :reservation_periods, null: false, default: []
      t.integer :reservation_open_buffer_minutes, null: false, default: 0
      t.integer :reservation_close_buffer_minutes, null: false, default: 0
      t.integer :reservation_min_lead_minutes, null: false, default: 0
    end
    add_check_constraint :spree_pos_branches,
                         'reservation_open_buffer_minutes BETWEEN 0 AND 999 AND reservation_close_buffer_minutes BETWEEN 0 AND 999 ' \
                         'AND reservation_min_lead_minutes BETWEEN 0 AND 999',
                         name: 'chk_pos_branches_reservation_rules'
  end
end
