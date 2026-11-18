# frozen_string_literal: true

module Spree
  module Pos
    # What a store's tax declaration needs beyond its store details. The
    # taxpayer's name, tax code, address and description are read from and
    # written to StoreInfo; business locations are the branches' BranchInfo
    # rows (location code, head office).
    class TaxProfile < Record
      self.table_name = 'spree_pos_tax_profiles'
      has_prefix_id :postaxprofile

      PERIODS = %w[month quarter].freeze
      # A tax code issued before personal identification numbers replaced it.
      LEGACY_TAX_CODE = /\A\d{10}(-\d{3})?\z/
      TEXT_FIELDS = %w[store_code legacy_tax_code declaration_period tax_authority_code industry_code
                       signer_name preparer_name storekeeper_name cashier_name].freeze
      FIELDS = (TEXT_FIELDS + ['business_area_m2']).freeze
      AREA_MAX = BigDecimal('99999999.99')

      # Fields the declaration needs, in the order the form shows them.
      # Taxpayer name, tax code and address come from StoreInfo; the head
      # office must have its location code.
      REQUIRED = %w[taxpayer_name tax_code business_address declaration_period tax_authority_code
                    industry_code business_area_m2 signer_name head_office_location].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :changed_by, class_name: staff_class_name, optional: true

      before_validation :normalize_text
      validates :store_id, uniqueness: true
      validates :store_code, length: { maximum: 32 }, allow_nil: true
      validates :legacy_tax_code, format: { with: LEGACY_TAX_CODE }, allow_nil: true
      validates :declaration_period, inclusion: { in: PERIODS }, allow_nil: true
      validates :business_area_m2, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: AREA_MAX },
                                   allow_nil: true
      validates :signer_name, :preparer_name, :storekeeper_name, :cashier_name, length: { maximum: 120 }, allow_nil: true
      validate :codes_in_catalog

      def self.for_store(store)
        find_by(store_id: store.id)
      end

      # Which required fields are filled. `info` is the store's StoreInfo
      # (nil before it is saved) and `head_office` the head office's
      # BranchInfo (nil when no branch is marked).
      def readiness(info:, head_office:)
        checks = {
          'taxpayer_name' => info&.name.present?,
          'tax_code' => info&.tax_code.present?,
          'business_address' => info.present? && info.province_code.present? && info.ward_code.present? && info.street.present?,
          'declaration_period' => declaration_period.present?,
          'tax_authority_code' => tax_authority_code.present?,
          'industry_code' => industry_code.present?,
          'business_area_m2' => !business_area_m2.nil?,
          'signer_name' => signer_name.present?,
          'head_office_location' => head_office&.tax_location_code.present?
        }
        missing = REQUIRED.reject { |field| checks.fetch(field) }
        { filled: REQUIRED.size - missing.size, total: REQUIRED.size, missing: missing }
      end

      private

      def normalize_text
        TEXT_FIELDS.each do |field|
          value = self[field]
          self[field] = value.is_a?(String) ? value.strip.presence : value
        end
      end

      def codes_in_catalog
        errors.add(:tax_authority_code, :inclusion) if tax_authority_code && !VnTaxCatalog.tax_authority?(tax_authority_code)
        errors.add(:industry_code, :inclusion) if industry_code && !VnTaxCatalog.industry?(industry_code)
      end
    end
  end
end
