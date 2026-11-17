# frozen_string_literal: true

module Spree
  module Pos
    # Vietnam's two-level divisions after 01/07/2025 (34 provinces, wards
    # directly under them). Packaged in config/pos/vn_admin_units.json.
    module AdminUnits
      PATH = 'config/pos/vn_admin_units.json'
      Place = Data.define(:province_code, :province_name, :ward_code, :ward_name)

      class << self
        def catalog
          @catalog ||= load!
        end

        def reload!
          @catalog = load!
        end

        def etag
          catalog[:etag]
        end

        def provinces
          catalog[:provinces].map { |row| { code: row[:code], name: row[:name], kind: row[:kind] } }
        end

        # Nil when the province code is not in the catalog.
        def wards(province_code)
          province = find_province(province_code)
          return if province.nil?

          province[:wards].map { |row| { code: row[:code], name: row[:name], kind: row[:kind] } }
        end

        def place(province_code, ward_code)
          province = find_province(province_code)
          ward = province && province[:wards].find { |row| row[:code] == ward_code.to_s }
          return if ward.nil?

          Place.new(province_code: province[:code], province_name: province[:name], ward_code: ward[:code], ward_name: ward[:name])
        end

        private

        def find_province(code)
          catalog[:provinces].find { |row| row[:code] == code.to_s }
        end

        def load!
          raw = JSON.parse(Rails.root.join(PATH).read)
          provinces = Array(raw['provinces']).map do |province|
            { code: province['code'].to_s, name: province['name'].to_s, kind: province['kind'].to_s,
              wards: Array(province['wards']).map { |ward| { code: ward['code'].to_s, name: ward['name'].to_s, kind: ward['kind'].to_s } } }
          end
          { etag: Digest::SHA256.hexdigest(JSON.generate(raw))[0, 16], provinces: provinces }
        end
      end
    end
  end
end
