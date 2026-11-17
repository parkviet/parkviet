# frozen_string_literal: true

module Spree
  module Pos
    # A branch's overrides of the store's POS details. Null columns inherit.
    class BranchInfo < Record
      self.table_name = 'spree_pos_branch_infos'
      has_prefix_id :posbranchinfo

      include InfoFields

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :changed_by, class_name: staff_class_name, optional: true

      validates :branch_id, uniqueness: true
      validate :branch_of_store

      def self.for_branch(branch)
        find_by(branch_id: branch.id)
      end

      private

      def branch_of_store
        errors.add(:branch, :invalid) if branch && branch.store_id != store_id
      end
    end
  end
end
