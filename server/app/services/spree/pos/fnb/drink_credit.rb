# frozen_string_literal: true

module Spree
  module Pos
    module Fnb
      # The drink credit of door tickets. A door ticket is a `cover` line of a
      # product whose operating settings carry a `drink_credit`; every ticket
      # sold adds that much to the order's credit. The credit pays for menu
      # lines of the ticket's allowed kitchen categories (any menu line when a
      # ticket names none), in the order they were added, until it runs out. Each paid drink carries a line
      # discount intent of source `cover_credit` for what the credit covers;
      # the manual discount adjuster turns it into the line's discount like
      # any item discount. A drink the cashier discounted by hand keeps that
      # discount and takes no credit. Credit left unused is never refunded.
      #
      # Runs at the start of every money recalculation, so the intents always
      # follow the lines.
      module DrinkCredit
        SOURCE = 'cover_credit'
        REASON = 'Drink credit'
        COVER_KIND = Workspaces::TableLines::COVER_KIND

        module_function

        def sync!(workspace)
          lines = SaleLine.where(workspace_id: workspace.id).includes(:line_item, :line_discount_intent, :variant).order(:id).to_a
          existing = lines.filter_map(&:line_discount_intent).select { |intent| intent.source == SOURCE }
          plan = plan(workspace, lines)
          return if plan.empty? && existing.empty?

          existing.reject { |intent| plan.key?(intent.sale_line_id) }.each { |intent| remove!(workspace, intent) }
          actor_id = workspace.shift.owner_id
          plan.each do |sale_line_id, amount|
            intent = existing.find { |row| row.sale_line_id == sale_line_id } ||
                     LineDiscountIntent.new(sale_line_id: sale_line_id, source: SOURCE)
            intent.assign_attributes(workspace_id: workspace.id, actor_id: intent.actor_id || actor_id, value_type: 'item_flat',
                                     value: amount.to_i.to_s, reason: REASON)
            intent.save! if intent.changed?
          end
        end

        # { sale line id => credit it takes }, drinks in the order they were added.
        def plan(workspace, lines)
          covers = lines.select { |line| line.kind == COVER_KIND }
          return {} if covers.empty?

          settings = ProductSetting.for_store(workspace.store).where(product_id: lines.map { |line| line.variant.product_id }.uniq).
                     index_by(&:product_id)
          tickets = covers.filter_map do |line|
            setting = settings[line.variant.product_id]
            setting&.door_ticket? ? [setting, line] : nil
          end
          return {} if tickets.empty?

          left = tickets.sum { |setting, line| (setting.drink_credit * line.sale_quantity).floor }
          categories = tickets.map { |setting, _| Array(setting.drink_credit_categories) }
          any_drink = categories.any?(&:empty?)
          allowed = categories.flatten.to_set
          lines.each_with_object({}) do |line, plan|
            break plan unless left.positive?
            next if line.kind == COVER_KIND
            next if line.line_discount_intent && line.line_discount_intent.source != SOURCE

            # A drink is a menu line; without settings it has no kitchen category.
            next unless line.kind == SaleLineKinds::Menu::KIND
            next if !any_drink && !allowed.include?(settings[line.variant.product_id]&.kitchen_category)

            take = [left, BigDecimal(line.line_item.amount.to_s).floor].min
            next unless take.positive?

            plan[line.id] = take
            left -= take
          end
        end

        def remove!(workspace, intent)
          discount_ids = intent.allocations.pluck(:discount_id)
          DiscountAllocation.where(line_discount_intent_id: intent.id).delete_all
          workspace.order.discounts.where(id: discount_ids).destroy_all
          intent.destroy!
        end

        # The order's credit and what of it the drinks used, or nil without door tickets.
        def to_pos(workspace, sale_lines)
          covers = sale_lines.select { |line| line.kind == COVER_KIND }
          return nil if covers.empty?

          credits = ProductSetting.for_store(workspace.store).where(product_id: covers.map { |line| line.variant.product_id }).
                    where.not(drink_credit: nil).pluck(:product_id, :drink_credit).to_h
          total = covers.sum(BigDecimal('0')) do |line|
            credit = credits[line.variant.product_id]
            credit ? (credit * line.sale_quantity).floor : 0
          end
          return nil unless total.positive?

          intents = LineDiscountIntent.where(workspace_id: workspace.id, source: SOURCE).select(:id)
          used = DiscountAllocation.where(line_discount_intent_id: intents).joins(:discount).sum('spree_discounts.amount').abs
          { total: workspace.money(total), used: workspace.money(used), remaining: workspace.money([total - used, 0].max) }
        end
      end
    end
  end
end
