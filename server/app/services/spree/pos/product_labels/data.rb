# frozen_string_literal: true

module Spree
  module Pos
    module ProductLabels
      # What a product label prints for a list of variants at one branch: the
      # name, code, selling unit and list price on the branch's POS channel,
      # plus the branch's store name and address. Built on the server so the
      # browser and the print station print the same values.
      #
      # The price is the list price of the variant's sale unit, the same
      # amount the till charges for one unit of it, so it is not scaled by the
      # unit ratio again. A compare-at price prints only when it is higher.
      class Data
        MAX_ITEMS = 200
        MAX_QUANTITY = 999
        MAX_LABELS = 2000

        Invalid = ReceiptTemplateSchema::Invalid

        def self.call(store:, branch:, items:, max_labels: MAX_LABELS)
          new(store: store, branch: branch, items: items, max_labels: max_labels).call
        end

        def initialize(store:, branch:, items:, max_labels: MAX_LABELS)
          @store = store
          @branch = branch
          @items = items
          @max_labels = max_labels
        end

        def call
          rows = normalize_items
          UnitDefinition.ensure_defaults!(@store)
          variants = load_variants(rows)
          units = load_units(variants.keys)
          product_ids = variants.values.map(&:product_id)
          assigned = BranchProduct.where(branch_id: @branch.id, product_id: product_ids).pluck(:product_id).to_set
          published = SalesChannel.products(@store).where(id: product_ids).pluck(:id).to_set
          fallback_unit = UnitDefinition.find_by!(store_id: @store.id, code: UnitDefinition::FALLBACK_CODE)

          data = rows.each_with_index.map do |row, index|
            variant = variants.fetch(row[:variant_id]) { raise Invalid.at("/items/#{index}/variant_id", 'not_found', 'Variant not found.') }
            unit = units[variant.id]&.sale_unit || fallback_unit
            check_unit!(row, unit, index)
            line(variant, unit, row[:quantity],
                 sold: assigned.include?(variant.product_id) && published.include?(variant.product_id))
          end
          { data: data, store: store_header }
        end

        private

        def normalize_items
          items = Array(@items)
          raise Invalid.at('/items', 'required', 'Choose at least one item.') if items.empty?
          raise Invalid.at('/items', 'too_many', "At most #{MAX_ITEMS} items.") if items.size > MAX_ITEMS

          rows = items.each_with_index.map do |item, index|
            item = item.respond_to?(:to_unsafe_h) ? item.to_unsafe_h : item.to_h
            item = item.with_indifferent_access
            quantity = Integer(item[:quantity].to_s, 10, exception: false)
            unless quantity&.between?(1, MAX_QUANTITY)
              raise Invalid.at("/items/#{index}/quantity", 'out_of_range', "Quantity must be 1 to #{MAX_QUANTITY}.")
            end

            variant_id = item[:variant_id].to_s
            decoded = variant_id.start_with?('variant_') ? Spree::PrefixedId.decode_prefixed_id(variant_id) : nil
            raise Invalid.at("/items/#{index}/variant_id", 'not_found', 'Variant not found.') if decoded.nil?

            { variant_id: decoded, unit_id: item[:unit_id].to_s.presence, quantity: quantity }
          end
          if rows.sum { |row| row[:quantity] } > @max_labels
            raise Invalid.at('/items', 'too_many_labels', "At most #{@max_labels} labels.")
          end

          rows
        end

        # Variants of this store only; another store's variant reads as missing.
        def load_variants(rows)
          Spree::Variant.joins(:product).where(id: rows.map { |row| row[:variant_id] }.uniq, spree_products: { store_id: @store.id })
                        .includes(:product, option_values: :option_type).index_by(&:id)
        end

        def load_units(variant_ids)
          VariantUnit.for_store(@store).where(variant_id: variant_ids, status: 'active').includes(:sale_unit).index_by(&:variant_id)
        end

        def check_unit!(row, unit, index)
          return if row[:unit_id].nil? || row[:unit_id] == unit.prefixed_id

          raise Invalid.at("/items/#{index}/unit_id", 'unit_mismatch', 'The unit is not the sale unit of this item.')
        end

        def line(variant, unit, quantity, sold:)
          price = SalesChannel.price(variant, store: @store, currency: @store.default_currency)
          amount = price&.amount
          amount = nil if amount.nil? || amount <= 0
          compare = price&.compare_at_amount
          code = variant.barcode.to_s.strip.presence
          sku = variant.sku.to_s.strip.presence
          warnings = []
          warnings << 'no_code' if code.nil? && sku.nil?
          warnings << 'no_price' if amount.nil?
          warnings << 'not_sold_in_branch' unless sold
          {
            variant_id: variant.prefixed_id, product_name: variant.product.name, variant_options: options(variant),
            sku: sku, barcode: code, unit: unit.name,
            price: amount && PrintDocuments::OrderFacts.money(amount),
            original_price: amount && compare && compare > amount ? PrintDocuments::OrderFacts.money(compare) : nil,
            currency: @store.default_currency, quantity: quantity, warnings: warnings
          }
        end

        def options(variant)
          return nil if variant.is_master?

          variant.option_values.sort_by { |value| [value.option_type&.position.to_i, value.position.to_i, value.id] }
                 .map(&:presentation).join(' / ').presence
        end

        def store_header
          view = StoreInfo.effective(@branch)
          { name: view[:name][:value].to_s, address: view[:address][:value].to_s }
        end
      end
    end
  end
end
