# frozen_string_literal: true

module Spree
  module Pos
    # One category of a branch's electronic menu. Items inside it are the
    # store's products, in this category's own order.
    class EmenuCategory < Record
      self.table_name = 'spree_pos_emenu_categories'
      has_prefix_id :posemenucat

      COLOR = /\A#[0-9A-Fa-f]{6}\z/

      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      has_many :emenu_items, -> { order(:position, :id) }, class_name: 'Spree::Pos::EmenuItem', dependent: :destroy,
                                                           inverse_of: :emenu_category
      has_one_attached :image

      validates :name, presence: true, length: { maximum: 80 }
      validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
      validates :color, format: { with: COLOR }, allow_nil: true

      def to_pos
        {
          id: prefixed_id, name: name, position: position, color: color, image_url: image_url,
          items: emenu_items.map(&:to_pos)
        }
      end

      def image_url
        return unless image.attached?

        Rails.application.routes.url_helpers.rails_blob_path(image, only_path: true)
      rescue StandardError
        nil
      end
    end
  end
end
