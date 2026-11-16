# frozen_string_literal: true

module Spree
  module Pos
    # One dashboard user's arrangement of the POS dashboard home widgets in a
    # store: a list of `{ id, widget, x, y, w, h, options? }` cells on a
    # 12-column grid. The widget registry lives in the dashboard and grows
    # without a server change, so a widget name is checked for its shape
    # only; the dashboard skips names it does not know.
    class DashboardLayout < Record
      self.table_name = 'spree_pos_dashboard_layouts'

      # Layout format; bump when the cell shape changes incompatibly.
      FORMAT_VERSION = 1
      COLUMNS = 12
      MAX_ITEMS = 50
      MAX_HEIGHT = 20
      MAX_ROW = 1000
      MAX_OPTIONS_BYTES = 2048
      ITEM_KEYS = %w[id widget x y w h options].freeze
      REQUIRED_KEYS = %w[id widget x y w h].freeze
      ID_FORMAT = /\A[A-Za-z0-9_:.-]{1,64}\z/
      WIDGET_FORMAT = /\A[a-z0-9_-]{1,64}\z/

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :user, class_name: staff_class_name

      validates :user_id, uniqueness: { scope: :store_id }
      validates :version, numericality: { only_integer: true, greater_than: 0 }
      validate :layout_shape

      def to_pos
        { layout: layout, version: version, updated_at: updated_at&.iso8601(3) }
      end

      private

      def layout_shape
        unless layout.is_a?(Array)
          errors.add(:layout, 'must be a list')
          return
        end
        errors.add(:layout, "must have at most #{MAX_ITEMS} widgets") if layout.length > MAX_ITEMS
        layout.each_with_index { |item, index| item_shape(item, index) }
        ids = layout.filter_map { |item| item['id'] if item.is_a?(Hash) }
        errors.add(:layout, 'has duplicate widget ids') if ids.uniq.length != ids.length
      end

      def item_shape(item, index)
        unless item.is_a?(Hash)
          errors.add(:layout, "item #{index} must be an object")
          return
        end
        missing = REQUIRED_KEYS - item.keys
        unknown = item.keys - ITEM_KEYS
        errors.add(:layout, "item #{index} is missing #{missing.join(', ')}") if missing.any?
        errors.add(:layout, "item #{index} has unknown keys #{unknown.join(', ')}") if unknown.any?
        return if missing.any? || unknown.any?

        errors.add(:layout, "item #{index} has an invalid id") unless format?(item['id'], ID_FORMAT)
        errors.add(:layout, "item #{index} has an invalid widget") unless format?(item['widget'], WIDGET_FORMAT)
        errors.add(:layout, "item #{index} is outside the grid") unless in_grid?(item)
        options_shape(item['options'], index) if item.key?('options')
      end

      def format?(value, pattern)
        value.is_a?(String) && value.match?(pattern)
      end

      def in_grid?(item)
        left, top, width, height = item.values_at('x', 'y', 'w', 'h')
        [left, top, width, height].all?(Integer) &&
          left.between?(0, COLUMNS - 1) && top.between?(0, MAX_ROW) &&
          width.between?(1, COLUMNS) && height.between?(1, MAX_HEIGHT) && left + width <= COLUMNS
      end

      def options_shape(options, index)
        if !options.is_a?(Hash)
          errors.add(:layout, "item #{index} options must be an object")
        elsif options.to_json.bytesize > MAX_OPTIONS_BYTES
          errors.add(:layout, "item #{index} options are too large")
        end
      end
    end
  end
end
