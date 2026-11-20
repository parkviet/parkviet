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
  # does not turn "1" or "0" into a boolean first. Both are staff filters:
  # the Store API and the seller API may not use them.
  #
  # A product whose variant is an ingredient of an active POS recipe is not
  # deleted (one at a time or in bulk): sales would keep consuming a variant
  # no one can see. The recipe has to drop it first.
  #
  # What the POS sells is the product itself. Its POS operating data hangs off
  # `product_id`: the optional operating settings row (`pos_setting`), combo
  # contents, add-on groups, time-of-day menu rows, electronic-menu
  # placements, sold-out marks and favourites. Deleting the product (soft or
  # hard) takes all of them with it; Spree's duplicate and CSV import copy
  # none of them.
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
      private_scopes = base.private_ransackable_scopes || {}
      base.private_ransackable_scopes = private_scopes.merge(
        Spree::RansackableAttributes::RESTRICTED_AUDIENCES.to_h do |audience|
          [audience, Array(private_scopes[audience]).map(&:to_s) | POS_SCOPES]
        end
      )
      base.singleton_class.prepend(ClassMethods)
      base.before_destroy :ensure_not_in_active_recipes, prepend: true

      base.has_one :pos_setting, class_name: 'Spree::Pos::ProductSetting', inverse_of: :product, dependent: :delete
      base.has_many :pos_combo_components, -> { order(:id) }, class_name: 'Spree::Pos::ComboComponent',
                                                              inverse_of: :product, dependent: :delete_all
      base.has_many :pos_product_modifier_groups, -> { order(:position, :id) }, class_name: 'Spree::Pos::ProductModifierGroup',
                                                                                inverse_of: :product, dependent: :delete_all
      base.has_many :pos_modifier_groups, through: :pos_product_modifier_groups, source: :modifier_group
      base.has_many :pos_menu_schedule_items, class_name: 'Spree::Pos::MenuScheduleItem', inverse_of: :product,
                                              dependent: :delete_all
      base.has_many :pos_emenu_items, class_name: 'Spree::Pos::EmenuItem', inverse_of: :product, dependent: :delete_all
      base.has_many :pos_menu_availabilities, class_name: 'Spree::Pos::MenuAvailability', inverse_of: :product,
                                              dependent: :delete_all
      base.has_many :pos_menu_favorites, class_name: 'Spree::Pos::MenuFavorite', inverse_of: :product, dependent: :delete_all

      # Products of the "Sản phẩm chế biến" type (Spree::Pos::ProductKinds),
      # in one store or in every store.
      base.scope :pos_prepared, lambda { |store = nil|
        where(product_type_id: Spree::Pos::ProductKinds.type_ids('prepared', store: store))
      }

      base.scope :search_with_barcode, lambda { |query|
        term = query.to_s.strip
        next none if term.empty?

        pattern = "%#{sanitize_sql_like(term)}%"
        barcoded = Spree::Variant.where('spree_variants.barcode ILIKE ?', pattern).select(:product_id)
        named = Spree::Product.where(store_id: Spree::Current.store&.id).search(term).select(:id)
        where(id: named).or(where(id: barcoded))
      }

      base.scope :not_in_channel, lambda { |code|
        channels = Spree::Channel.where(store_id: Spree::Current.store&.id, code: code.to_s.strip)
        where.not(id: Spree::ProductPublication.where(channel_id: channels.select(:id)).select(:product_id))
      }
    end

    # The POS kind of the product ('goods', 'prepared', 'service',
    # 'ingredient') from its product type, or nil.
    def pos_kind
      Spree::Pos::ProductKinds.kind_for(self)
    end

    def pos_prepared?
      pos_kind == 'prepared'
    end

    # A combo is a product that lists what it contains.
    def combo?
      pos_combo_components.any?
    end

    # A door ticket: its operating settings carry a drink credit.
    def door_ticket?
      pos_setting&.door_ticket? || false
    end

    # The variants sold as sizes, by position. Spree 6 has no master: every
    # variant is sellable, except a legacy master left next to option
    # variants (the same rule as the catalog search). `now` drops sizes
    # discontinued by then.
    def pos_sizes(now: nil)
      sizes = variants.to_a
      sizes = sizes.reject { |variant| variant.discontinue_on.present? && variant.discontinue_on <= now } if now
      sizes = sizes.reject(&:is_master?) if sizes.any?(&:is_master?) && !sizes.all?(&:is_master?)
      sizes.sort_by { |variant| [variant.position.to_i, variant.id] }
    end

    private

    def ensure_not_in_active_recipes
      used = Spree::Pos::RecipeIngredient.joins(:recipe).
             where(spree_pos_recipes: { active: true }, ingredient_variant_id: variants.select(:id))
      return unless used.exists?

      errors.add(:base, :in_active_recipe, message: 'This product is an ingredient of an active recipe. Remove it from the recipe first.')
      throw(:abort)
    end
  end

  Product.prepend(ProductDecorator)
end
