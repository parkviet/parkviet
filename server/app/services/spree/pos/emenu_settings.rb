# frozen_string_literal: true

module Spree
  module Pos
    # Per-branch electronic menu options stored on `branches.emenu_settings`.
    # A missing key reads as its default. A write rejects an unknown key or a
    # value of the wrong type (422). Item and promotion ids are checked
    # against the branch when those lists are saved.
    class EmenuSettings
      class Invalid < StandardError
        attr_reader :field

        def initialize(field)
          @field = field
          super("e-Menu setting #{field} is invalid.")
        end
      end

      COLOR = /\A#[0-9A-Fa-f]{6}\z/
      ID = /\A[a-z]+_[A-Za-z0-9]{1,40}\z/
      BOOLEANS = %w[banner_enabled best_sellers_enabled new_items_enabled paused sticker_show_logo sticker_show_name
                    sticker_wifi_enabled].freeze
      ID_LISTS = %w[banner_promotion_ids best_seller_item_ids new_item_ids].freeze
      STRINGS = {
        'sticker_store_name' => 80,
        'sticker_wifi_name' => 64,
        'sticker_wifi_password' => 64,
        'sticker_greeting' => 100
      }.freeze
      DEFAULTS = {
        'brand_color' => '#0b6e4f',
        'text_color' => '#1d1d1f',
        'button_color' => '#0b6e4f',
        'banner_enabled' => false,
        'banner_promotion_ids' => [],
        'best_sellers_enabled' => false,
        'best_sellers_source' => 'manual',
        'best_seller_item_ids' => [],
        'best_sellers_limit' => 8,
        'new_items_enabled' => false,
        'new_item_ids' => [],
        'min_order_interval_seconds' => 0,
        'paused' => false,
        'payment_timing' => 'pay_after',
        'pay_methods' => %w[vietqr counter],
        'prepay_timeout_minutes' => 10,
        'sticker_show_logo' => true,
        'sticker_show_name' => true,
        'sticker_store_name' => '',
        'sticker_wifi_enabled' => false,
        'sticker_wifi_name' => '',
        'sticker_wifi_password' => '',
        'sticker_greeting' => 'Quét mã để gọi món/gọi nhân viên',
        'sticker_size' => '80',
        'sticker_custom_mm' => 80
      }.freeze
      KEYS = DEFAULTS.keys.freeze

      class << self
        def of(branch)
          normalize(branch&.emenu_settings)
        end

        def normalize(raw)
          source = raw.is_a?(Hash) ? raw.stringify_keys : {}
          DEFAULTS.each_with_object({}) do |(key, default), out|
            value = source[key]
            out[key] = valid?(key, value) ? coerce(key, value) : default
          end
        end

        def merge(stored, patch)
          incoming = patch.is_a?(Hash) ? patch.stringify_keys : {}
          unknown = incoming.keys - KEYS
          raise Invalid, unknown.first if unknown.any?

          current = normalize(stored)
          incoming.each do |key, value|
            raise Invalid, key unless valid?(key, value)

            current[key] = coerce(key, value)
          end
          current
        end

        def valid?(key, value)
          return false unless KEYS.include?(key)
          return COLOR.match?(value.to_s) if key.end_with?('_color')
          return [true, false].include?(value) if BOOLEANS.include?(key)
          return id_list?(value) if ID_LISTS.include?(key)
          return %w[manual auto].include?(value) if key == 'best_sellers_source'
          return integer?(value, 1..20) if key == 'best_sellers_limit'
          return integer?(value, 0..3600) if key == 'min_order_interval_seconds'
          return %w[pay_after pay_before].include?(value) if key == 'payment_timing'
          return pay_methods?(value) if key == 'pay_methods'
          return integer?(value, 1..60) if key == 'prepay_timeout_minutes'
          return value.is_a?(String) && value.length <= STRINGS[key] if STRINGS.key?(key)
          return %w[60 80 100 custom].include?(value) if key == 'sticker_size'
          return integer?(value, 40..200) if key == 'sticker_custom_mm'

          false
        end

        def coerce(key, value)
          return value.to_i if %w[best_sellers_limit min_order_interval_seconds prepay_timeout_minutes sticker_custom_mm].include?(key)
          return value.map(&:to_s) if ID_LISTS.include?(key) || key == 'pay_methods'

          value
        end

        # Minutes a VietQR of this branch stays payable, from the payment
        # method when it says so, otherwise fifteen.
        def vietqr_timeout_minutes(branch)
          account = PayLater.receiving_account(branch.store, branch)
          method = account&.payment_method
          raw = method&.try(:preferred_payment_timeout_minutes) || method&.try(:payment_timeout_minutes)
          minutes = raw.to_i
          minutes.positive? ? minutes : 15
        end

        # The logo and the name guests see: the branch's own, else the store's.
        def brand(branch)
          effective = StoreInfo.effective(branch)
          {
            'logo_url' => effective.dig(:logo, :value),
            'store_name' => effective.dig(:name, :value).presence || branch.store.name
          }
        end

        # How long a prepay transfer may wait: the branch's minutes, and never
        # longer than the VietQR itself.
        def prepay_wait(branch, settings = of(branch))
          [settings['prepay_timeout_minutes'].to_i, vietqr_timeout_minutes(branch)].min.minutes
        end

        def id_list?(value)
          value.is_a?(Array) && value.size <= 20 && value.uniq.size == value.size &&
            value.all? { |id| id.is_a?(String) && id.match?(ID) }
        end

        def pay_methods?(value)
          value.is_a?(Array) && value.size.between?(1, 2) && value.uniq.size == value.size &&
            (value - %w[vietqr counter]).empty?
        end

        def integer?(value, range)
          number = if value.is_a?(Integer)
                     value
                   else
                     (value.to_s.match?(/\A\d{1,4}\z/) ? Integer(value.to_s, 10) : nil)
                   end
          !number.nil? && range.cover?(number)
        end
      end

      # Writes a partial update. Audited as `emenu.update` when something changed.
      class Update
        def self.call(store:, actor:, key:, branch:, attributes:)
          GuestOrders::Guard.codes!(store, actor, branch)
          incoming_keys = (attributes.is_a?(Hash) ? attributes.stringify_keys.keys : []).to_set
          payload = { 'command' => 'emenu.update', 'branch_id' => branch.prefixed_id, 'settings' => attributes }
          CommandExecutor.call(store: store, actor: actor, key: key, payload: payload, authorize: -> {}) do
            before = EmenuSettings.of(branch)
            after = EmenuSettings.merge(branch.emenu_settings, attributes)
            after = check_and_prune_references!(branch, after, incoming_keys)
            changed = before.each_with_object({}) do |(setting, from), diff|
              diff[setting] = [from, after[setting]] if from != after[setting]
            end
            unless changed.empty?
              branch.lock!
              branch.update!(emenu_settings: after)
              AuditEntry.record!(store: store, actor: actor, action: 'emenu.update', subject: branch,
                                 metadata: { branch_id: branch.prefixed_id, changes: redact(changed) })
            end
            present(branch)
          end
        end

        # Wi-Fi passwords are printed on the sticker. The audit keeps that
        # they changed, not the password itself.
        def self.redact(changed)
          changed.each_with_object({}) do |(setting, pair), out|
            out[setting] = setting == 'sticker_wifi_password' ? %w[redacted redacted] : pair
          end
        end

        # Validates reference lists explicitly sent in this patch, and prunes
        # stale references left in untouched lists so saving unrelated settings
        # (such as `paused` or colours) is never blocked.
        def self.check_and_prune_references!(branch, settings, incoming_keys)
          cleaned = settings.dup
          on_menu = GuestMenu.allowed_item_ids(branch).to_set
          %w[best_seller_item_ids new_item_ids].each do |field|
            next if cleaned[field].empty?

            if incoming_keys.include?(field)
              raise Invalid, field if cleaned[field].any? { |id| !on_menu.include?(id) }
            else
              cleaned[field] = cleaned[field].select { |id| on_menu.include?(id) }
            end
          end

          unless cleaned['banner_promotion_ids'].empty?
            known_promos = TimedPromotion.where(branch_id: branch.id).map(&:prefixed_id).to_set
            if incoming_keys.include?('banner_promotion_ids')
              raise Invalid, 'banner_promotion_ids' if cleaned['banner_promotion_ids'].any? { |id| !known_promos.include?(id) }
            else
              cleaned['banner_promotion_ids'] = cleaned['banner_promotion_ids'].select { |id| known_promos.include?(id) }
            end
          end
          cleaned
        end

        def self.present(branch)
          settings = EmenuSettings.of(branch)
          settings.merge(EmenuSettings.brand(branch)).merge(
            'vietqr_timeout_minutes' => EmenuSettings.vietqr_timeout_minutes(branch),
            'vietqr_available' => !PayLater.receiving_account(branch.store, branch).nil?,
            'best_sellers_auto_ids' => Emenu::BestSellers.ids(branch, settings)
          )
        end
      end
    end
  end
end
