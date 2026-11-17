# frozen_string_literal: true

module Spree
  module Pos
    # Per-branch selling options stored on `branches.sales_settings`. A missing
    # key reads as its default, so branches created before the column (or
    # before a key) need no backfill. A write rejects an unknown key or a
    # value of the wrong type (422). These options do not need a reason:
    # they change what the counter shows, not money or stock already recorded.
    class SalesSettings
      class Invalid < StandardError
        attr_reader :field

        def initialize(field)
          @field = field
          super("Sales setting #{field} is invalid.")
        end
      end

      BOOLEAN = {
        'allow_oversell' => true,
        'warn_below_cost' => false,
        'show_stock' => true,
        'show_cost' => false,
        'order_note' => true,
        'coupons' => true,
        'auto_print_receipt' => false,
        'inline_variants' => false,
        'scheduled_delivery' => false,
        'auto_print_prebill' => false,
        'print_void_tickets' => true
      }.freeze
      ENUMS = {
        'cart_order' => %w[newest_first oldest_first],
        'payment_chime' => %w[off default]
      }.freeze
      DEFAULTS = BOOLEAN.merge(
        'cart_order' => 'oldest_first',
        'payment_chime' => 'default'
      ).freeze
      KEYS = DEFAULTS.keys.freeze

      class << self
        def for(branch)
          normalize(branch&.sales_settings)
        end

        def normalize(raw)
          source = raw.is_a?(Hash) ? raw.stringify_keys : {}
          DEFAULTS.each_with_object({}) do |(key, default), out|
            value = source[key]
            out[key] = valid?(key, value) ? value : default
          end
        end

        # Merges a partial update into the stored object. Unknown keys and
        # bad values raise Invalid. Returns the hash to persist (defaults
        # filled, so a later read does not depend on this normalizer).
        def merge(stored, patch)
          incoming = patch.is_a?(Hash) ? patch.stringify_keys : {}
          unknown = incoming.keys - KEYS
          raise Invalid, unknown.first if unknown.any?

          current = normalize(stored)
          incoming.each do |key, value|
            raise Invalid, key unless valid?(key, value)

            current[key] = value
          end
          current
        end

        def valid?(key, value)
          return BOOLEAN.key?(key) && [true, false].include?(value) if BOOLEAN.key?(key)
          return ENUMS[key].include?(value) if ENUMS.key?(key)

          false
        end
      end

      # Writes a partial set of selling options for one branch. Store topology
      # writers everywhere, and a branch's own manager (`pos.topology.manage`)
      # at that branch. No reason is required. Audited as
      # `branch_sales_settings.change` with `{ key => [from, to] }` only when
      # something actually changed.
      class Update
        STORE_PERMISSION = 'write_pos_topology'

        def self.call(store:, actor:, branch:, attributes:)
          authorize!(store, actor, branch)
          before = SalesSettings.for(branch)
          after = SalesSettings.merge(branch.sales_settings, attributes)
          changed = before.each_with_object({}) do |(key, from), diff|
            diff[key] = [from, after[key]] if from != after[key]
          end
          return after if changed.empty?

          ApplicationRecord.transaction do
            branch.lock!
            branch.update!(sales_settings: after)
            AuditEntry.record!(store: branch.store, actor: actor, action: 'branch_sales_settings.change', subject: branch,
                               metadata: { branch_id: branch.prefixed_id, changes: changed })
          end
          after
        end

        def self.authorize!(store, actor, branch)
          policy = AccessPolicy.new(store: store, staff: actor)
          return if policy.permission?(STORE_PERMISSION)
          return if policy.allows?(branch, Capabilities::MANAGE)

          raise CanCan::AccessDenied
        end
        private_class_method :authorize!
      end
    end
  end
end
