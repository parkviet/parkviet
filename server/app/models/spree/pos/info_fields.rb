# frozen_string_literal: true

module Spree
  module Pos
    # Shared shape of a store's public details and a branch override.
    # A branch leaves a column null to inherit the store.
    module InfoFields
      extend ActiveSupport::Concern

      PHONE = /\A(?:0\d{9,10}|\+84\d{9,10})\z/
      LOGO_TYPES = %w[image/png image/jpeg image/svg+xml image/x-icon image/vnd.microsoft.icon].freeze
      LOGO_LIMIT = 2.megabytes
      TEXT_FIELDS = %w[name phone admin_email contact_email tax_code representative_id_number street description
                       province_code ward_code].freeze

      included do
        has_one_attached :logo
        before_validation :normalize_contacts
        validates :name, length: { maximum: 120 }, allow_blank: true
        validates :phone, format: { with: PHONE }, allow_blank: true
        validates :admin_email, :contact_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
        validates :tax_code, format: { with: EinvoiceSetting::TAX_CODE }, allow_blank: true
        validates :representative_id_number, format: { with: /\A\d{12}\z/ }, allow_blank: true
        validates :street, length: { maximum: 200 }, allow_blank: true
        validates :description, length: { maximum: 1000 }, allow_blank: true
        validate :hours_are_a_pair
        validate :address_is_in_catalog
        validate :logo_is_acceptable
      end

      def clock(value)
        return if value.blank?
        return value.strftime('%H:%M') if value.respond_to?(:strftime)

        value.to_s[/\d{2}:\d{2}/]
      end

      private

      def normalize_contacts
        TEXT_FIELDS.each do |field|
          value = self[field]
          self[field] = value.is_a?(String) ? value.strip.presence : value
        end
        return if phone.blank?

        compact = phone.gsub(/[\s.\-]/, '')
        compact = "+#{compact}" if compact.start_with?('84') && !compact.start_with?('+')
        self.phone = compact
      end

      def hours_are_a_pair
        return if opening_time.present? == closing_time.present?

        errors.add(:opening_time, :invalid)
      end

      def address_is_in_catalog
        if province_code.blank? && ward_code.blank?
          self.province_name = nil
          self.ward_name = nil
          return
        end

        place = AdminUnits.place(province_code, ward_code)
        if place.nil?
          errors.add(province_code.blank? || ward_code.blank? ? :province_code : :ward_code, :invalid)
          return
        end

        self.province_code = place.province_code
        self.ward_code = place.ward_code
        self.province_name = place.province_name
        self.ward_name = place.ward_name
      end

      def logo_is_acceptable
        return unless logo.attached?

        blob = logo.blob
        errors.add(:logo, :invalid) if blob.byte_size > LOGO_LIMIT || LOGO_TYPES.exclude?(blob.content_type)
      end
    end
  end
end
