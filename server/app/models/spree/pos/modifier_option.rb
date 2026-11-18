# frozen_string_literal: true

module Spree
  module Pos
    # One pick of a modifier group, with what it adds to the line price. It
    # may name the ingredient variant it uses, for stock deduction. An
    # inactive option is out of stock: the counter does not offer it.
    # `cost_price` is what one pick costs when nothing else counts it: an
    # option with an active recipe, or naming a stocked variant, costs what
    # it consumes instead.
    class ModifierOption < Record
      self.table_name = 'spree_pos_modifier_options'
      has_prefix_id :posmodopt

      belongs_to :modifier_group, class_name: 'Spree::Pos::ModifierGroup', inverse_of: :modifier_options
      belongs_to :variant, class_name: 'Spree::Variant', optional: true

      validates :name, presence: true, length: { maximum: 80 }
      validates :price_delta, numericality: { greater_than_or_equal_to: 0, less_than: 100_000_000 }
      validates :cost_price, numericality: { greater_than_or_equal_to: 0, less_than: 100_000_000 }, allow_nil: true
      validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
      validate :variant_belongs_to_store

      # `costs` adds the cost, for the people who manage the menu; the
      # counter's menu never carries it.
      def to_pos(costs: false)
        row = {
          id: prefixed_id, name: name, price_delta: price_delta.to_s('F'), variant_id: variant&.prefixed_id,
          default_selected: default_selected, position: position, active: active
        }
        row[:cost_price] = cost_price&.to_s('F') if costs
        row
      end

      # The cost a sold pick keeps, or nil when its recipe or stocked
      # variant already counts what it uses.
      def own_cost
        return if cost_price.nil? || variant&.track_inventory?
        return if Recipe.active.exists?(owner_type: self.class.name, owner_id: id)

        cost_price
      end

      private

      def variant_belongs_to_store
        return if variant.nil? || modifier_group.nil?

        errors.add(:variant, :invalid) if variant.product&.store_id != modifier_group.store_id
      end
    end
  end
end
