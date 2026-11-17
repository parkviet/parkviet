# frozen_string_literal: true

module Spree
  module Pos
    # The POS store's own details. Ecommerce fields on Spree::Store stay
    # where they are; this row is what receipts, the guest page and the
    # counter use, falling back to the ecommerce store when it is still blank.
    class StoreInfo < Record
      self.table_name = 'spree_pos_store_infos'
      has_prefix_id :posstoreinfo

      include InfoFields

      # What a filled store-info form counts. Profile lives on the store profile.
      FILLED = %i[logo name phone admin_email contact_email tax_code representative_id_number profile hours address description].freeze
      CONTACT = %w[name phone admin_email contact_email tax_code representative_id_number opening_time closing_time
                   business_day_cutoff province_code ward_code street description].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :changed_by, class_name: staff_class_name, optional: true

      validates :store_id, uniqueness: true
      validates :name, :phone, :business_day_cutoff, presence: true

      def self.for_store(store)
        find_by(store_id: store.id)
      end

      # One field at a time: branch override, then this row, then Spree::Store.
      def self.effective(branch, reveal_identity: false)
        store = branch.store
        info = for_store(store)
        override = BranchInfo.find_by(branch_id: branch.id)
        fields = {}
        %i[name phone admin_email contact_email tax_code opening_time closing_time province_code ward_code province_name ward_name street description].each do |field|
          fields[field] = layer(override, info, field)
        end
        fields[:name] = ecommerce_layer(store, :name, store.name.to_s.presence) if fields[:name][:value].blank?
        phone = store.respond_to?(:contact_phone) ? store.contact_phone.to_s.strip.presence : nil
        fields[:phone] = ecommerce_layer(store, :phone, phone) if fields[:phone][:value].blank?
        email = store.respond_to?(:customer_support_email) ? store.customer_support_email.to_s.strip.presence : nil
        fields[:contact_email] = ecommerce_layer(store, :contact_email, email) if fields[:contact_email][:value].blank?
        fields[:representative_id_number] = identity_layer(override, info, reveal_identity)
        fields[:logo] = logo_layer(override, info, store)
        fields[:address] = address_layer(fields, store)
        fields[:business_day_cutoff] = cutoff_layer(branch, info)
        fields[:opening_hours] = hours_layer(override, info)
        fields
      end

      # Header facts for a receipt or a guest page. Without a POS row this
      # matches what Spree::Store printed before.
      def self.printable(branch)
        return nil unless customized?(branch)

        view = effective(branch)
        {
          'name' => view[:name][:value].to_s,
          'address' => view[:address][:value].to_s,
          'contact_phone' => view[:phone][:value].to_s,
          'customer_support_email' => view[:contact_email][:value].to_s,
          'tax_code' => view[:tax_code][:value].to_s
        }
      end

      def self.customized?(branch)
        exists?(store_id: branch.store_id) || BranchInfo.exists?(branch_id: branch.id)
      end

      def self.logo_url(record)
        return unless record.respond_to?(:logo) && record.logo.attached?

        Rails.application.routes.url_helpers.cdn_image_url(record.logo)
      rescue ArgumentError => e
        Rails.error.report(e, handled: true)
        nil
      end

      def filled_count(profile_keys)
        checks = {
          logo: logo.attached?,
          name: name.present?,
          phone: phone.present?,
          admin_email: admin_email.present?,
          contact_email: contact_email.present?,
          tax_code: tax_code.present?,
          representative_id_number: representative_id_number.present?,
          profile: Array(profile_keys).any?,
          hours: opening_time.present? && closing_time.present?,
          address: province_code.present? && ward_code.present? && street.present?,
          description: description.present?
        }
        checks.values.count(true)
      end

      def self.layer(override, info, field)
        if override && !override[field].nil?
          { value: present(override, field), source: 'branch' }
        elsif info && !info[field].nil?
          { value: present(info, field), source: 'store' }
        else
          { value: nil, source: nil }
        end
      end

      def self.present(record, field)
        value = record.public_send(field)
        %i[opening_time closing_time].include?(field) ? record.clock(value) : value
      end

      def self.ecommerce_layer(_store, _field, value)
        { value: value, source: value.present? ? 'ecommerce' : nil }
      end

      def self.identity_layer(override, info, reveal)
        layer = layer(override, info, :representative_id_number)
        number = layer[:value]
        shown = reveal ? number : nil
        { value: shown, source: layer[:source], set: number.present? }
      end

      def self.logo_layer(override, info, store)
        if override&.logo&.attached?
          { value: logo_url(override), source: 'branch' }
        elsif info&.logo&.attached?
          { value: logo_url(info), source: 'store' }
        elsif store.respond_to?(:logo) && store.logo.attached?
          { value: logo_url(store), source: 'ecommerce' }
        else
          { value: nil, source: nil }
        end
      end

      def self.address_layer(fields, store)
        structured = [fields[:street][:value], fields[:ward_name][:value], fields[:province_name][:value]].compact_blank
        if structured.any?
          source = [fields[:street], fields[:ward_code], fields[:province_code]].map { |row| row[:source] }.compact.first
          return { value: "#{structured.join(', ')}, Việt Nam", source: source || 'store' }
        end

        fallback = store.respond_to?(:address) ? store.address.to_s.strip.presence : nil
        { value: fallback, source: fallback ? 'ecommerce' : nil }
      end

      def self.hours_layer(override, info)
        opening = layer(override, info, :opening_time)
        closing = layer(override, info, :closing_time)
        source = opening[:source] || closing[:source]
        { opening: opening[:value], closing: closing[:value], source: source }
      end

      def self.cutoff_layer(branch, info)
        if branch.business_day_cutoff.present?
          { value: branch.cutoff_clock, source: 'branch' }
        elsif info&.business_day_cutoff.present?
          { value: info.clock(info.business_day_cutoff), source: 'store' }
        else
          { value: '04:00', source: 'store' }
        end
      end
    end
  end
end
