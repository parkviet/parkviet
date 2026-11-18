# frozen_string_literal: true

module Spree
  module Api
    module V3
      module Admin
        module Pos
          # Modifier groups of the store with their options. Saving a group
          # replaces its option list; lines already sold keep their copies.
          # Option costs are read by the people who change the menu or stock,
          # as recipe costs are.
          class ModifierGroupsController < MenuResourcesController
            private

            def present(record)
              @costs = cost_reader? if @costs.nil?
              record.to_pos(costs: @costs)
            end

            def cost_reader?
              Spree::Pos::Recipes.read!(current_store, current_user)
              true
            rescue CanCan::AccessDenied
              false
            end

            def model
              Spree::Pos::ModifierGroup
            end

            def scope
              super.includes(modifier_options: :variant)
            end

            def save(key, record)
              attributes = params.permit(*Spree::Pos::Menu::Save::GROUP_FIELDS,
                                         options: [:id, :variant_id, *Spree::Pos::Menu::Save::OPTION_FIELDS]).to_h
              menu_save.modifier_group(store: current_store, staff: current_user, key: key, attributes: attributes, group: record)
            end
          end
        end
      end
    end
  end
end
