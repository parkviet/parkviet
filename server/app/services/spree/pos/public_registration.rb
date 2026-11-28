# frozen_string_literal: true

module Spree
  module Pos
    # Controls whether visitors may self-register an administrator account and
    # open their own store from the POS sign-in screen. Defaults to off in
    # production and test (single-shop self-hosted installs) and on in
    # development; setting PARKVIET_PUBLIC_REGISTRATION overrides both.
    module PublicRegistration
      module_function

      def enabled?
        raw = ENV['PARKVIET_PUBLIC_REGISTRATION']
        return ActiveModel::Type::Boolean.new.cast(raw) unless raw.nil? || raw.strip.empty?

        Rails.env.development?
      end
    end
  end
end
