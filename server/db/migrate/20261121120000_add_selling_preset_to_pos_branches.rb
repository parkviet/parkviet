# frozen_string_literal: true

# The sample selling screen a branch opens with (tables first, quick counter,
# one-step sale, big menu). Null derives the screen from the branch's modules.
class AddSellingPresetToPosBranches < ActiveRecord::Migration[8.1]
  def change
    add_column :spree_pos_branches, :selling_preset, :string, limit: 24
  end
end
