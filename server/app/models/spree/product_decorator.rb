# frozen_string_literal: true

module Spree
  # Two product-list filters the POS goods screens ask the Admin API for,
  # offered as Ransack scopes of `GET /api/v3/admin/products`:
  #
  # - `q[search_with_barcode]=<term>`: the back-office search (name, SKU,
  #   searchable custom fields) widened to variant barcodes, which the core
  #   `search` scope leaves out while every scanner at the counter types one.
  # - `q[not_in_channel]=<code>`: products the store's channel with that code
  #   does not carry. `channels_code_not_eq` cannot say it: a product on two
  #   channels still matches through the other one.
  #
  # Both take a text argument that must reach the scope as typed, so Ransack
  # does not turn "1" or "0" into a boolean first.
  #
  # A product whose variant is an ingredient of an active POS recipe is not
  # deleted (one at a time or in bulk): sales would keep consuming a variant
  # no one can see. The recipe has to drop it first.
  module ProductDecorator
    # Decorators are loaded again on every code reload.
    POS_SCOPES = %w[search_with_barcode not_in_channel].freeze unless const_defined?(:POS_SCOPES)

    module ClassMethods
      def ransackable_scopes_skip_sanitize_args
        super | ProductDecorator::POS_SCOPES.map(&:to_sym)
      end
    end

    def self.prepended(base)
      base.whitelisted_ransackable_scopes = (Array(base.whitelisted_ransackable_scopes).map(&:to_s) | POS_SCOPES)
      base.singleton_class.prepend(ClassMethods)
      base.before_destroy :ensure_not_in_active_recipes, prepend: true

      base.scope :search_with_barcode, lambda { |query|
        term = query.to_s.strip
        next none if term.empty?

        pattern = "%#{sanitize_sql_like(term)}%"
        barcoded = Spree::Variant.where('spree_variants.barcode ILIKE ?', pattern).select(:product_id)
        where(id: Spree::Product.search(term).pluck(:id)).or(where(id: barcoded))
      }

      base.scope :not_in_channel, lambda { |code|
        channels = Spree::Channel.where(store_id: Spree::Current.store&.id, code: code.to_s.strip)
        where.not(id: Spree::ProductPublication.where(channel_id: channels.select(:id)).select(:product_id))
      }
    end

    private

    def ensure_not_in_active_recipes
      used = Spree::Pos::RecipeIngredient.joins(:recipe).
             where(spree_pos_recipes: { active: true }, ingredient_variant_id: variants_including_master.select(:id))
      return unless used.exists?

      errors.add(:base, :in_active_recipe, message: 'This product is an ingredient of an active recipe. Remove it from the recipe first.')
      throw(:abort)
    end
  end

  Product.prepend(ProductDecorator)
end
