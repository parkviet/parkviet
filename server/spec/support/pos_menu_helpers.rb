# frozen_string_literal: true

require_relative 'pos_credit_helpers'

# Menu fixtures built on the real models, and a draft at a branch running
# `fnb.menu`, for workflow and request specs of the menu. What the menu sells
# is Spree products; their POS data hangs off the product.
module PosMenuHelpers
  include PosCreditHelpers

  def menu_store
    create(:store, default_currency: 'VND', supported_currencies: 'VND')
  end

  def menu_branch(store, enabled: true)
    branch = credit_branch(store)
    set_pos_module(branch, 'fnb.menu', enabled)
    branch
  end

  # The store's "Sản phẩm chế biến" product type, created once.
  def prepared_type!(store)
    Spree::ProductType.where(store_id: store.id).to_a.find { |type| Spree::Pos::ProductKinds.kind_of(type.name) == 'prepared' } ||
      Spree::ProductType.create!(store: store, name: Spree::Pos::ProductKinds::NAMES['prepared'])
  end

  # A top-level Spree category of the store: the menu tab a product shows in.
  def menu_category!(store, name)
    Spree::Category.create!(store: store, name: name)
  end

  # A prepared product the branch sells at the till. `sizes`
  # ({ 'M' => 30_000, 'L' => 35_000 }) gives one variant per size, labelled by
  # an option value, the product's default variant being the first; without
  # sizes the default variant sells at `price`. `category` is a Spree
  # category; `settings` ({ kitchen_category:, cup_label:, drink_credit:, ... })
  # writes the product's POS operating settings; `type` replaces the prepared
  # product type (nil for none).
  def prepared_product!(store, branch, name:, price:, sizes: {}, category: nil, settings: nil, type: prepared_type!(store))
    product = create(:product, store: store, status: 'active', name: name, product_type: type)
    product.default_variant.set_price(store.default_currency, price)
    if sizes.any?
      size_type = create(:option_type, name: "size-#{SecureRandom.hex(4)}", presentation: 'Size')
      sizes.each_with_index do |(label, amount), index|
        value = create(:option_value, option_type: size_type, name: label.downcase, presentation: label)
        sku = "#{name.parameterize}-#{label.downcase}-#{SecureRandom.hex(3)}"
        variant = if index.zero?
                    product.default_variant.tap { |first| first.update!(sku: sku, option_values: [value]) }
                  else
                    create(:variant, product: product, sku: sku, option_values: [value])
                  end
        variant.set_price(store.default_currency, amount)
      end
    end
    product.reload
    product.variants.each { |variant| branch.stock_location.restock(variant, 100) }
    Spree::Pos::BranchProduct.find_or_create_by!(branch: branch, product: product)
    product.product_categories.create!(category: category) if category
    Spree::Pos::ProductSetting.create!(store: store, product: product, **settings) if settings
    product.reload
  end

  # Makes `combo` a combo of `variants` ({ variant => quantity }).
  def combo_of!(combo, variants)
    variants.each { |variant, quantity| combo.pos_combo_components.create!(variant: variant, quantity: quantity) }
    combo.reload
  end

  def size(product, index = 0)
    product.reload.pos_sizes[index]
  end

  # A group of `options` ({ 'Trân châu' => 5_000 }) offered on `product`.
  def modifier_group!(store, product, name:, options:, min: 0, max: 1, allow_quantity: false, defaults: [])
    group = Spree::Pos::ModifierGroup.create!(store: store, name: name, min_select: min, max_select: max, allow_quantity: allow_quantity)
    options.each_with_index do |(label, delta), index|
      group.modifier_options.create!(name: label, price_delta: delta, position: index, default_selected: defaults.include?(label))
    end
    Spree::Pos::ProductModifierGroup.create!(product: product, modifier_group: group,
                                             position: product.pos_product_modifier_groups.count)
    product.reload
    group.reload
  end

  def option(group, name)
    group.modifier_options.find_by!(name: name)
  end

  # `[[option, quantity], ...]` as the API takes it.
  def picks(*rows)
    rows.map { |picked, quantity = 1| { 'option_id' => picked.prefixed_id, 'quantity' => quantity } }
  end

  # An open draft with no lines yet, on the cashier's open shift.
  def menu_sale(store, branch)
    cashier = credit_staff(store, branch, PosCreditHelpers::CASHIER)
    editor_id = SecureRandom.uuid
    register = open_drawer(store, branch, cashier)
    created = Spree::Pos::Workspaces::Create.call(store: store, staff: cashier, register_id: register.prefixed_id,
                                                  key: SecureRandom.uuid, editor_id: editor_id)
    PosCreditHelpers::Sale.new(workspace: Spree::Pos::Workspace.find_by_prefix_id!(created['id']), cashier: cashier,
                               editor_id: editor_id, product: nil)
  end

  def add_menu(sale, variant, quantity: 1, modifiers: nil, note: nil, merge: true)
    Spree::Pos::Workspaces::ManageLineItem.add(**editing_args(sale), variant_id: variant.prefixed_id, quantity: quantity,
                                                                     modifiers: modifiers, note: note, merge: merge)
  end

  def menu_lines(sale)
    Spree::Pos::SaleLine.where(workspace_id: sale.workspace.id).order(:id).to_a
  end
end
