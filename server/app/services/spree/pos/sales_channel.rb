# frozen_string_literal: true

module Spree
  module Pos
    # The sales surface is owned by Spree; branch assortment narrows it further.
    # Never resolve through the default channel or a client-supplied channel ID.
    module SalesChannel
      CODE = 'pos'

      module_function

      def status(store)
        channel = store.channels.find_by(code: CODE)
        { id: channel&.prefixed_id, code: CODE, name: channel&.name,
          status: channel.nil? ? 'missing' : (channel.active? ? 'active' : 'inactive') }
      end

      def resolve!(store)
        channel = store.channels.find_by(code: CODE)
        raise Conflict.new('Create a sales channel with code pos in Spree Settings > Sales channels.', reason: 'pos_channel_missing') if channel.nil?
        raise Conflict.new('Activate the POS sales channel in Spree Settings > Sales channels.', reason: 'pos_channel_inactive') unless channel.active?

        channel
      end

      def products(store, channel: resolve!(store))
        publications = Spree::ProductPublication.published.where(channel_id: channel.id)
        Spree::Product.where(store_id: store.id, id: publications.select(:product_id))
      end

      def sellable_products(store, channel: resolve!(store))
        products(store, channel: channel).where(status: 'active')
          .where('spree_products.available_on IS NULL OR spree_products.available_on <= ?', Time.current)
          .where('spree_products.discontinue_on IS NULL OR spree_products.discontinue_on > ?', Time.current)
      end

      # The list price of one unit, or of a line of `quantity` units: price
      # lists with quantity breaks or a volume rule charge by the line's size.
      # The quantity is always explicit, so a line is never priced by the size
      # of another line of the same variant.
      def price(variant, store:, currency:, order: nil, quantity: 1)
        context = if order
                    Spree::Pricing::Context.from_order(variant, order, quantity: quantity)
                  else
                    Spree::Pricing::Context.new(variant: variant, store: store, currency: currency, channel: resolve!(store),
                                                quantity: quantity)
                  end
        variant.price_for(context)
      end

      # The quantity a sale line is priced by: its count when it sells whole
      # base units at the list price, nil for measured, packed, labelled and
      # server-priced lines, whose price is not the list's per-unit price.
      def line_quantity(sale_line)
        return nil unless sale_line && %w[ordinary tracked].include?(sale_line.kind) && sale_line.label_barcode.blank?
        return nil unless sale_line.sale_unit_code == sale_line.base_unit_code && sale_line.ratio_numerator == sale_line.ratio_denominator

        sale_line.base_quantity
      end

      # Re-prices a list-priced line at its quantity once the count changed.
      # `was` is the line's quantity before: only a line still charging the
      # list price for that quantity follows the list, so an overridden or
      # otherwise set price is never replaced.
      def reprice_line!(sale_line, was:)
        quantity = line_quantity(sale_line)
        # A whole base unit charges its own price per base unit; anything else
        # is not a list price this can follow.
        return if quantity.nil? || was.nil? || sale_line.unit_price != sale_line.line_price

        order = sale_line.order
        before = price(sale_line.variant, store: order.store, currency: order.currency, order: order, quantity: was)&.amount
        return if before.nil? || before != sale_line.unit_price

        now = price(sale_line.variant, store: order.store, currency: order.currency, order: order, quantity: quantity)&.amount
        return if now.nil? || now == sale_line.unit_price

        sale_line.line_item.update!(price: now)
        sale_line.update!(unit_price: now, line_price: now)
      end

      def validate_order!(workspace)
        channel = resolve!(workspace.store)
        unless workspace.order.channel_id == channel.id
          raise Conflict.new('This draft was not created on the POS channel. Start a new POS draft.', reason: 'pos_channel_mismatch')
        end
        product_ids = workspace.order.line_items.joins(:variant).reorder(nil).distinct.pluck('spree_variants.product_id')
        eligible = sellable_products(workspace.store, channel: channel)
          .where(id: BranchProduct.where(branch_id: workspace.branch_id).select(:product_id))
        return if (product_ids - eligible.where(id: product_ids).pluck(:id)).empty?

        raise Conflict.new('An item is no longer published on the POS channel or assigned to this branch.', reason: 'pos_product_unavailable')
      end

      # A tender commits the quote: channel changes must not strand already
      # prepared/received money or prevent split-payment completion/recovery.
      def validate_uncommitted_order!(workspace)
        validate_order!(workspace) unless workspace.snapshot_locked?
      end
    end
  end
end
