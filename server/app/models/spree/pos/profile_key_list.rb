# frozen_string_literal: true

module Spree
  module Pos
    # Ordered industry keys. The first is the primary and is mirrored into
    # profile_key so callers that still read one key keep working.
    module ProfileKeyList
      extend ActiveSupport::Concern

      included do
        before_validation :keep_profile_keys
        validate :profile_keys_well_formed
      end

      def resolved_keys
        keys = Array(profile_keys).map(&:to_s).reject(&:blank?)
        keys.presence || [profile_key].compact
      end

      private

      def keep_profile_keys
        if profile_keys_changed? && Array(profile_keys).any?
          keys = Array(profile_keys).map(&:to_s)
          self.profile_keys = keys
          self.profile_key = keys.first
          return
        end
        return unless profile_key_changed? || Array(profile_keys).empty?

        self.profile_keys = [profile_key].compact
      end

      def profile_keys_well_formed
        keys = Array(profile_keys)
        format = Branch::PROFILE_KEY_FORMAT
        well = keys.size >= 1 && keys.uniq.size == keys.size && keys.all? { |key| key.is_a?(String) && key.match?(format) }
        errors.add(:profile_keys, :invalid) unless well
        errors.add(:profile_key, :invalid) if well && profile_key != keys.first
      end
    end
  end
end
