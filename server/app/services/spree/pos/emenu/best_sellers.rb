# frozen_string_literal: true

module Spree
  module Pos
    module Emenu
      # The best-selling electronic-menu items of the last seven business days:
      # completed sales at the branch, minus quantities already returned.
      # Cached for an hour. An empty result means the section stays hidden.
      module BestSellers
        module_function

        def ids(branch, settings = EmenuSettings.of(branch))
          return [] unless settings['best_sellers_enabled'] && settings['best_sellers_source'] == 'auto'

          limit = settings['best_sellers_limit'].to_i
          on_menu = GuestMenu.allowed_item_ids(branch)
          return [] if on_menu.empty? || limit <= 0

          Rails.cache.fetch(cache_key(branch, on_menu, limit), expires_in: 1.hour) do
            rank(branch, on_menu, limit)
          end
        end

        def cache_key(branch, on_menu, limit)
          today = BusinessDay.for(branch, Time.current)
          digest = Digest::SHA256.hexdigest(on_menu.sort.join(','))[0, 12]
          "pos-emenu-best-v2-#{branch.id}-#{today}-#{limit}-#{digest}"
        end

        def rank(branch, on_menu, limit)
          today = BusinessDay.for(branch, Time.current)
          since_date = today - 6.days
          sold = SaleLine.joins(:workspace).
                 where(spree_pos_workspaces: { branch_id: branch.id, operational_status: 'completed', business_date: since_date..today }).
                 group(:variant_id).sum(:sale_quantity)
          return [] if sold.empty?

          returned = ReturnReservation.where(status: 'posted').joins(sale_line: :workspace).
                     where(spree_pos_workspaces: { branch_id: branch.id, business_date: since_date..today }).
                     group('spree_pos_sale_lines.variant_id').sum(:quantity)
          net = sold.each_with_object(Hash.new(0)) do |(variant_id, quantity), totals|
            totals[variant_id] = BigDecimal(quantity.to_s) - BigDecimal((returned[variant_id] || 0).to_s)
          end
          variants = Spree::Variant.where(id: net.keys).pluck(:id, :product_id).to_h
          items = MenuItem.for_store(branch.store).where(product_id: variants.values).pluck(:product_id, :id).to_h
          sold_out = MenuAvailability.sold_out_ids(branch, today).to_set
          allowed = on_menu.to_set
          scores = Hash.new(0)
          net.each do |variant_id, quantity|
            next unless quantity.positive?

            item_id = items[variants[variant_id]]
            next if item_id.nil? || sold_out.include?(item_id)

            prefixed = MenuItem.prefixed_for(item_id)
            next unless allowed.include?(prefixed)

            scores[item_id] += quantity
          end
          scores.sort_by { |id, quantity| [-quantity, id] }.first(limit).map do |id, _|
            MenuItem.prefixed_for(id)
          end
        end
      end
    end
  end
end
