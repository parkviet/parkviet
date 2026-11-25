# frozen_string_literal: true

module Spree
  module Pos
    # Multi-line inventory document for imports (PN), exports (PX), stock-taking counts (KK),
    # and opening balances (DK). Completing atomically updates Spree::StockLevel and creates
    # Spree::StockMovement records for the branch's stock location.
    class StockDocument < Record
      self.table_name = 'spree_pos_stock_documents'
      has_prefix_id :posstdoc

      KINDS = %w[import export count opening].freeze
      STATUSES = %w[draft completed canceled].freeze
      INVOICE_TYPES = %w[vat_invoice sales_invoice purchase_statement none].freeze
      EXPORT_REASONS = %w[damage internal_use return_supplier other].freeze
      PAYMENT_STATUSES = %w[unpaid partial paid].freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :branch, class_name: 'Spree::Pos::Branch'
      belongs_to :supplier, class_name: 'Spree::Pos::Supplier', optional: true
      belongs_to :customer_profile, class_name: 'Spree::Pos::CustomerProfile', optional: true
      belongs_to :actor, class_name: staff_class_name
      belongs_to :completed_by, class_name: staff_class_name, optional: true
      belongs_to :canceled_by, class_name: staff_class_name, optional: true
      has_many :lines, class_name: 'Spree::Pos::StockDocumentLine', dependent: :destroy
      has_many :supplier_payments, class_name: 'Spree::Pos::SupplierPayment', dependent: :nullify

      before_validation :assign_code, on: :create
      before_validation :normalize_defaults

      validates :code, presence: true, length: { maximum: 32 }, uniqueness: { scope: :store_id }
      validates :kind, inclusion: { in: KINDS }
      validates :status, inclusion: { in: STATUSES }
      validates :invoice_type, inclusion: { in: INVOICE_TYPES }, allow_blank: true
      validates :export_reason, inclusion: { in: EXPORT_REASONS }, allow_blank: true
      validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
      validates :occurred_at, presence: true

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :for_branch, ->(branch) { where(branch_id: branch.id) }

      def self.next_code(store, kind)
        prefix = case kind.to_s
                 when 'import' then 'PN'
                 when 'export' then 'PX'
                 when 'count' then 'KK'
                 else 'DK'
                 end
        last = for_store(store).where('code LIKE ?', "#{prefix}%").order(id: :desc).pick(:code)
        seq = last ? last.delete_prefix(prefix).to_i + 1 : 1
        format('%s%05d', prefix, seq)
      end

      def recalculate_totals!
        loaded_lines = lines.to_a
        self.subtotal = loaded_lines.sum(BigDecimal('0'), &:line_total)
        taxable = [subtotal - discount_amount, BigDecimal('0')].max
        self.tax_amount = (taxable * tax_rate / BigDecimal('100')).round(0)
        self.total_amount = [taxable + tax_amount + extra_cost, BigDecimal('0')].max
        self.payment_status = compute_payment_status
      end

      def compute_payment_status
        return 'paid' if total_amount <= 0 || paid_amount >= total_amount
        return 'partial' if paid_amount > 0

        'unpaid'
      end

      def complete!(actor:)
        raise ConflictError.new('already_completed') if status == 'completed'
        raise ConflictError.new('document_canceled') if status == 'canceled'
        raise ConflictError.new('empty_lines') if lines.empty?

        transaction do
          location = branch.stock_location
          lines.includes(:variant).each do |line|
            level = Spree::StockLevel.find_or_create_by!(stock_location_id: location.id, variant_id: line.variant_id)
            delta = stock_delta_for(line, level)
            if kind == 'count'
              line.update!(system_quantity: level.count_on_hand, quantity: delta, line_total: delta.abs * line.unit_cost)
            end
            next if delta.zero?

            Spree::StockMovement.create!(
              stock_level: level,
              quantity: delta,
              kind: spree_movement_kind(delta),
              action: movement_action,
              reason: "#{code}#{note.present? ? " · #{note.truncate(100)}" : ''}",
              unit_cost: line.unit_cost.positive? ? line.unit_cost : line.variant&.cost_price,
              originator: self
            )
            if %w[import opening].include?(kind) && line.unit_cost.positive? && line.variant
              line.variant.update_columns(cost_price: line.unit_cost, updated_at: Time.current)
            end
          end

          recalculate_totals!
          update!(status: 'completed', completed_by: actor, completed_at: Time.current)
        end
        self
      end

      def cancel!(actor:, reason: nil)
        raise ConflictError.new('document_canceled') if status == 'canceled'

        transaction do
          if status == 'completed'
            location = branch.stock_location
            lines.includes(:variant).each do |line|
              delta = -applied_delta_for(line)
              next if delta.zero?

              level = Spree::StockLevel.find_or_create_by!(stock_location_id: location.id, variant_id: line.variant_id)
              Spree::StockMovement.create!(
                stock_level: level,
                quantity: delta,
                kind: 'adjusted',
                action: "#{movement_action}_cancel",
                reason: "Hủy #{code}#{reason.present? ? " · #{reason.to_s.truncate(100)}" : ''}",
                unit_cost: line.unit_cost.positive? ? line.unit_cost : line.variant&.cost_price,
                originator: self
              )
            end
          end

          update!(status: 'canceled', canceled_by: actor, canceled_at: Time.current, cancel_reason: reason.to_s.strip.presence)
        end
        self
      end

      def to_pos(include_lines: false)
        loaded_lines = lines.includes(variant: :product).to_a
        data = {
          id: prefixed_id,
          code: code,
          kind: kind,
          status: status,
          branch_id: branch.prefixed_id,
          supplier_id: supplier&.prefixed_id,
          supplier_name: supplier&.name || counterparty_name.presence,
          customer_id: customer_profile&.prefixed_id,
          counterparty_name: counterparty_name.presence || supplier&.name || customer_profile&.name,
          invoice_type: invoice_type.presence,
          invoice_number: invoice_number.presence,
          export_reason: export_reason.presence,
          occurred_at: occurred_at&.iso8601,
          subtotal: subtotal.to_s('F'),
          discount_amount: discount_amount.to_s('F'),
          extra_cost: extra_cost.to_s('F'),
          tax_rate: tax_rate.to_s('F'),
          tax_amount: tax_amount.to_s('F'),
          total_amount: total_amount.to_s('F'),
          paid_amount: paid_amount.to_s('F'),
          payment_status: payment_status,
          note: note.presence,
          actor_name: actor&.email,
          completed_at: completed_at&.iso8601,
          canceled_at: canceled_at&.iso8601,
          cancel_reason: cancel_reason.presence,
          items_count: loaded_lines.size,
          total_quantity: loaded_lines.sum(&:quantity),
          variance_quantity: kind == 'count' ? loaded_lines.sum(&:quantity) : nil,
          created_at: created_at&.iso8601
        }
        data[:lines] = loaded_lines.map(&:to_pos) if include_lines
        data
      end

      private

      def assign_code
        self.code ||= self.class.next_code(store, kind) if store && kind.present?
      end

      def normalize_defaults
        self.occurred_at ||= Time.current
        self.invoice_type = 'sales_invoice' if kind == 'import' && invoice_type.blank?
        self.export_reason = 'other' if kind == 'export' && export_reason.blank?
        self.payment_status = compute_payment_status
      end

      def movement_action
        case kind
        when 'import' then 'pos_import'
        when 'export' then 'pos_export'
        when 'count' then 'pos_count'
        else 'pos_opening'
        end
      end

      def spree_movement_kind(delta)
        %w[import opening].include?(kind) && delta.positive? ? 'received' : 'adjusted'
      end

      def stock_delta_for(line, level)
        case kind
        when 'import', 'opening' then line.quantity.abs
        when 'export' then -line.quantity.abs
        when 'count' then (line.actual_quantity.nil? ? level.count_on_hand : line.actual_quantity) - level.count_on_hand
        else 0
        end
      end

      def applied_delta_for(line)
        case kind
        when 'import', 'opening' then line.quantity.abs
        when 'export' then -line.quantity.abs
        when 'count' then line.quantity
        else 0
        end
      end
    end
  end
end
