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

      # The code the tax office gave this business location.
      TAX_LOCATION_CODE = /\A[0-9A-Za-z-]{1,20}\z/

      before_validation :normalize_tax_location
      validates :branch_id, uniqueness: true
      validates :tax_location_code, format: { with: TAX_LOCATION_CODE }, allow_nil: true
      validate :branch_of_store
      validate :single_head_office

      def self.for_branch(branch)
        find_by(branch_id: branch.id)
      end

      private

      def branch_of_store
        errors.add(:branch, :invalid) if branch && branch.store_id != store_id
      end

      def normalize_tax_location
        self.tax_location_code = tax_location_code.to_s.strip.presence
      end

      # The partial unique index is the real guard; this gives a field error.
      def single_head_office
        return unless tax_head_office

        others = self.class.where(store_id: store_id, tax_head_office: true)
        others = others.where.not(id: id) if persisted?
        errors.add(:tax_head_office, :taken) if others.exists?
      end
    end
  end
end
