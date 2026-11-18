# frozen_string_literal: true

module Spree
  module Pos
    # How a store is taxed, kept as a history: each save writes a new row
    # and the latest row is in force. The defaults are the store's tax
    # options (TaxCategory rows whose tax_code is a VnTaxCatalog key) for
    # goods, for the service charge and surcharges, and for shipping.
    #
    # `item_option`, `service_fee_option` and `shipping_option` carry the
    # catalog keys of a regime being saved, before its categories exist;
    # once saved the keys are read from the categories.
    class TaxRegime < Record
      self.table_name = 'spree_pos_tax_regimes'
      has_prefix_id :postaxregime

      METHODS = VnTaxCatalog::METHODS
      PIT_METHODS = VnTaxCatalog::PIT_METHODS
      ROLES = %w[item service_fee shipping].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :changed_by, class_name: staff_class_name, optional: true
      ROLES.each do |role|
        belongs_to :"default_#{role}_tax_category", -> { with_deleted }, class_name: 'Spree::TaxCategory', optional: true
      end

      attr_writer(*ROLES.map { |role| :"#{role}_option" })

      validates :enabled, :prices_include_tax, :apply_reduction, :threshold_warning, inclusion: { in: [true, false] }
      validate :catalog_combination

      scope :for_store, ->(store) { where(store_id: store.id) }

      def self.current(store)
        for_store(store).order(:id).last
      end

      def direct?
        tax_method == 'direct'
      end

      def deduction?
        tax_method == 'deduction'
      end

      def pit_on_revenue?
        pit_method == 'revenue'
      end

      ROLES.each do |role|
        define_method(:"#{role}_option") do
          instance_variable_get(:"@#{role}_option") || public_send(:"default_#{role}_tax_category")&.tax_code
        end
      end

      def option_keys
        ROLES.to_h { |role| [role, public_send(:"#{role}_option")] }
      end

      # The fields that make one regime differ from another, for audits and
      # for skipping a save that changes nothing.
      def settings
        {
          'enabled' => enabled, 'method' => tax_method, 'revenue_group' => revenue_group, 'pit_method' => pit_method,
          'pit_income_rate' => pit_income_rate&.to_s('F'), 'prices_include_tax' => prices_include_tax,
          'apply_reduction' => apply_reduction, 'threshold_warning' => threshold_warning
        }.merge(option_keys.transform_keys { |role| "#{role}_option" })
      end

      def to_pos
        defaults = ROLES.to_h do |role|
          category = public_send(:"default_#{role}_tax_category")
          [:"default_#{role}", { tax_category_id: category&.prefixed_id, option: public_send(:"#{role}_option") }]
        end
        {
          id: prefixed_id, enabled: enabled, method: tax_method, revenue_group: revenue_group, pit_method: pit_method,
          pit_income_rate: pit_income_rate&.to_s('F'), prices_include_tax: prices_include_tax, apply_reduction: apply_reduction,
          threshold_warning: threshold_warning, **defaults, changed_by_id: changed_by&.prefixed_id,
          changed_by_name: StaffName.call(changed_by), created_at: created_at&.iso8601
        }
      end

      # Errors are keyed `method`, the API's name for `tax_method`;
      # Object#method must never be read as an attribute.
      def read_attribute_for_validation(key)
        key.to_s == 'method' ? tax_method : super
      end

      private

      # The catalog decides which combinations exist: a group's methods and
      # income tax methods, and each default being an option of the method
      # in force today.
      def catalog_combination
        return errors.add(:method, :inclusion) unless METHODS.include?(tax_method)

        group = VnTaxCatalog.revenue_group(revenue_group)
        return errors.add(:revenue_group, :inclusion) if group.nil?

        errors.add(:method, :inclusion) unless group[:methods].include?(tax_method)
        errors.add(:pit_method, :inclusion) unless group[:pit_methods].include?(pit_method)
        valid = VnTaxCatalog.options(tax_method).map { |option| option[:code] }
        ROLES.each do |role|
          errors.add(:"#{role}_option", :inclusion) unless valid.include?(public_send(:"#{role}_option"))
        end
      end
    end
  end
end
