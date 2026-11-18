# frozen_string_literal: true

module Spree
  # A variant that is an ingredient of an active POS recipe is not deleted:
  # sales would keep consuming a variant no one can see. The recipe has to
  # drop it first.
  #
  # A product write removes the variants its payload leaves out with
  # `destroy_all`, which ignores a destroy refused by `throw :abort`. The
  # guard raises instead, so that write fails and rolls back as a whole, and
  # `DELETE /products/:id/variants/:id` fails the same way; the Admin API
  # answers both with 422 carrying the message below.
  module VariantDecorator
    def self.prepended(base)
      base.before_destroy :ensure_not_in_active_recipes, prepend: true
    end

    private

    def ensure_not_in_active_recipes
      used = Spree::Pos::RecipeIngredient.joins(:recipe).where(spree_pos_recipes: { active: true }, ingredient_variant_id: id)
      return unless used.exists?

      errors.add(:base, :in_active_recipe, message: 'This variant is an ingredient of an active recipe. Remove it from the recipe first.')
      raise ActiveRecord::RecordNotSaved.new(errors.full_messages.to_sentence, self)
    end
  end

  Variant.prepend(VariantDecorator)
end
