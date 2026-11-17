# frozen_string_literal: true

module Spree
  module Pos
    module Reservations
      # When a branch takes bookings, in its time zone. A period is
      # `{ "start" => "HH:MM", "end" => "HH:MM" }`, the same every day; an end
      # before the start runs past midnight. A booking starts inside a period,
      # after its first `open_buffer` minutes and no later than `close_buffer`
      # minutes before its end, and at least `min_lead` minutes from now. No
      # periods (and no opening hours) means any time.
      #
      # Staff bookings are only warned about: the reasons go in the audit.
      # `strict` refuses them, for a channel where guests book themselves.
      module Window
        MAX_PERIODS = 4
        DAY = 24 * 60
        REASONS = %w[outside_periods before_open after_close too_soon].freeze

        module_function

        def reasons(branch, starts_at:, now: Workspace.database_now, strict: false)
          rules = { periods: effective_periods(branch), timezone: branch.timezone, open_buffer: branch.reservation_open_buffer_minutes,
                    close_buffer: branch.reservation_close_buffer_minutes, min_lead: branch.reservation_min_lead_minutes }
          found = check(rules, starts_at: starts_at, now: now)
          if strict && found.any?
            raise Conflict.new('Bookings are not taken at this time.', reason: 'reservation_outside_rules', details: { reasons: found })
          end

          found
        end

        # `rules`: periods, timezone, open_buffer, close_buffer and min_lead.
        def check(rules, starts_at:, now:)
          found = []
          periods = Array(rules[:periods])
          if periods.any?
            zone = ActiveSupport::TimeZone[rules[:timezone].to_s] || Time.zone
            local = starts_at.in_time_zone(zone)
            minute = (local.hour * 60) + local.min
            period = periods.map { |row| span(row) }.find { |from, to| inside?(minute, from, to) }
            if period.nil?
              found << 'outside_periods'
            else
              from, to = period
              offset = (minute - from) % DAY
              found << 'before_open' if offset < rules[:open_buffer].to_i
              found << 'after_close' if offset > to - from - rules[:close_buffer].to_i
            end
          end
          found << 'too_soon' if starts_at < now + rules[:min_lead].to_i.minutes
          found
        end

        # The branch's periods, or its opening hours as one period.
        def effective_periods(branch)
          own = Array(branch.reservation_periods)
          return own if own.any?

          hours = StoreInfo.effective(branch)[:opening_hours]
          opening = hours[:opening]
          closing = hours[:closing]
          return [] if opening.blank? || closing.blank? || opening == closing

          [{ 'start' => opening, 'end' => closing }]
        end

        def source(branch)
          return 'branch' if Array(branch.reservation_periods).any?

          effective_periods(branch).any? ? 'opening_hours' : 'none'
        end

        # [from, to] in minutes after midnight; `to` passes DAY past midnight.
        def span(row)
          from = OperatingHours.minute_of(row['start'])
          to = OperatingHours.minute_of(row['end'])
          to += DAY if to <= from
          [from, to]
        end

        def inside?(minute, from, to)
          (minute >= from && minute < to) || (minute + DAY >= from && minute + DAY < to)
        end

        # The periods in their stored form, sorted from the business day's
        # cutoff, or raises Conflict. Each must leave time for bookings after
        # both buffers.
        def normalize!(rows, open_buffer:, close_buffer:, cutoff:)
          invalid = lambda do |index = nil|
            raise Conflict.new('The service periods are invalid.', reason: 'reservation_periods_invalid', details: { index: index }.compact)
          end
          invalid.call unless rows.is_a?(Array) && rows.size <= MAX_PERIODS
          periods = rows.each_with_index.map do |row, index|
            row = row.to_unsafe_h if row.respond_to?(:to_unsafe_h)
            invalid.call(index) unless row.is_a?(Hash)
            row = row.stringify_keys
            from = row['start'].to_s
            to = row['end'].to_s
            invalid.call(index) unless from.match?(clock) && to.match?(clock) && from != to

            { 'start' => from, 'end' => to }
          end
          periods.each_with_index do |row, index|
            from, to = span(row)
            if to - from <= open_buffer.to_i + close_buffer.to_i
              raise Conflict.new('A service period has no time left for bookings.', reason: 'reservation_window_empty', details: { index: index })
            end

            periods.each_with_index do |other, position|
              invalid.call(index) if position > index && overlap?(span(row), span(other))
            end
          end
          start = OperatingHours.minute_of(cutoff)
          periods.sort_by { |row| (span(row).first - start) % DAY }
        end

        def overlap?(one, other)
          [-DAY, 0, DAY].any? { |shift| one.first < other.last + shift && other.first + shift < one.last }
        end

        def clock
          /\A([01]\d|2[0-3]):[0-5]\d\z/
        end
      end
    end
  end
end
