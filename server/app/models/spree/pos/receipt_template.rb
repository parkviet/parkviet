# frozen_string_literal: true

module Spree
  module Pos
    # A store's print template for one document type. A branch may choose
    # one of them per document type instead of the store default
    # (BranchReceiptTemplate); branch and register details reach the print
    # through template variables. Every save adds an immutable version, and a template is
    # disabled, never deleted, because recorded prints point at it. Each
    # document type keeps exactly one active default, and every store starts
    # with built-in templates for every paper of the type: the five receipt
    # papers, or the nine label stocks of a product label.
    class ReceiptTemplate < Record
      self.table_name = 'spree_pos_receipt_templates'
      has_prefix_id :postpl

      DOCUMENT_TYPES = ReceiptTemplateSchema::DOCUMENT_TYPES
      PRODUCT_LABEL = ReceiptTemplateSchema::PRODUCT_LABEL
      # Receipt papers; a product label uses LABEL_PRESETS instead (papers_for).
      PAPERS = %w[58mm 80mm a4 a5 a6].freeze
      DEFAULT_PAPER = '80mm'
      SEEDED_PAPERS = %w[80mm 58mm a4 a5 a6].freeze
      # Label stocks, shared with the POS client (`product-label/presets.ts`).
      LABEL_PRESETS = JSON.parse(Rails.root.join('config/pos/product_label_presets.json').read).freeze
      LABEL_PAPERS = LABEL_PRESETS.map { |preset| preset.fetch('code') }.freeze
      DEFAULT_LABEL_PAPER = 'roll_50x30'
      WIDE_PAPERS = %w[a4 a5].freeze
      SHEET_SIGNATURE_TYPES = %w[sale return refund shift_closure].freeze
      MAX_ACTIVE = 10
      MAX_NAME_LENGTH = 60
      DEFAULT_NAMES = {
        'sale' => 'Phiếu bán hàng', 'prebill' => 'Phiếu tạm tính', 'payment_ticket' => 'Phiếu thanh toán',
        'return' => 'Phiếu trả hàng', 'refund' => 'Phiếu hoàn tiền', 'shift_closure' => 'Phiếu chốt ca',
        PRODUCT_LABEL => 'Tem sản phẩm'
      }.freeze
      PAPER_SUFFIXES = { '58mm' => '58mm', 'a4' => 'A4', 'a5' => 'A5', 'a6' => 'A6' }.merge(
        LABEL_PRESETS.to_h { |preset| [preset.fetch('code'), preset.fetch('suffix')] }
      ).freeze
      # The built-in configs, mirrored by the POS client's fallback templates.
      DEFAULT_CONFIGS = DOCUMENT_TYPES.index_with do |type|
        JSON.parse(Rails.root.join("config/pos/receipt_templates/#{type}.json").read).freeze
      end.freeze

      belongs_to :store, class_name: 'Spree::Store'
      belongs_to :created_by, class_name: staff_class_name, optional: true
      belongs_to :updated_by, class_name: staff_class_name, optional: true
      has_many :versions, class_name: 'Spree::Pos::ReceiptTemplateVersion', inverse_of: :receipt_template,
                          dependent: :restrict_with_error

      scope :for_store, ->(store) { where(store_id: store.id) }
      scope :active, -> { where(status: 'active') }

      validates :name, presence: true, length: { maximum: MAX_NAME_LENGTH }
      validates :document_type, inclusion: { in: DOCUMENT_TYPES }
      validates :paper, inclusion: { in: ->(template) { papers_for(template.document_type) } }
      validates :status, inclusion: { in: %w[active disabled] }
      validates :current_version, numericality: { only_integer: true, greater_than_or_equal_to: 1 }

      # Posted documents print with the template of their type; a return
      # supplement uses the return template.
      def self.document_type_for(source_type)
        source_type == 'return_supplement' ? 'return' : source_type
      end

      def self.papers_for(document_type)
        document_type == PRODUCT_LABEL ? LABEL_PAPERS : PAPERS
      end

      # The papers a store is seeded with, the default one first for labels.
      def self.seeded_papers_for(document_type)
        document_type == PRODUCT_LABEL ? LABEL_PAPERS : SEEDED_PAPERS
      end

      def self.default_paper_for(document_type)
        document_type == PRODUCT_LABEL ? DEFAULT_LABEL_PAPER : DEFAULT_PAPER
      end

      def self.default_name(document_type, paper = default_paper_for(document_type))
        base = DEFAULT_NAMES.fetch(document_type)
        suffix = PAPER_SUFFIXES[paper]
        suffix ? "#{base} (#{suffix})" : base
      end

      def self.default_config(document_type, paper: default_paper_for(document_type))
        config = DEFAULT_CONFIGS.fetch(document_type).deep_dup
        return label_config(config, paper) if document_type == PRODUCT_LABEL
        return config unless WIDE_PAPERS.include?(paper)

        if config['lines'].is_a?(Hash)
          columns = config['lines']['columns'].dup
          columns.unshift('index') unless columns.include?('index')
          config['lines'] = config['lines'].merge(
            'layout' => 'table',
            'columns' => columns,
            'ruling' => paper == 'a4' ? 'grid' : 'rows'
          )
        end

        footer = Array(config['footer'])
        if SHEET_SIGNATURE_TYPES.include?(document_type) &&
           footer.length < ReceiptTemplateSchema::MAX_BLOCKS &&
           footer.none? { |block| block['type'] == 'signatures' }
          parties = document_type == 'shift_closure' ? %w[cashier seller] : %w[buyer seller]
          config['footer'] = footer + [{ 'type' => 'signatures', 'parties' => parties }]
        end

        config
      end

      # Narrow label stocks drop the variant options and keep the name on one
      # line, so the barcode and price stay legible.
      def self.label_config(config, paper)
        preset = LABEL_PRESETS.find { |candidate| candidate['code'] == paper }
        return config unless preset&.fetch('compact')

        config['fields'].each do |field|
          field['enabled'] = false if field['key'] == 'variant_options'
          field['max_lines'] = 1 if field['key'] == 'product_name'
        end
        config
      end
      private_class_method :label_config

      # Gives every document type of the store an active default and built-in
      # templates for every paper of the type on first access. Disabled papers are
      # respected and never re-seeded. Safe to call concurrently.
      def self.ensure_defaults!(store)
        existing = for_store(store).select(:document_type, :paper, :status, :is_default).to_a.group_by(&:document_type)
        DOCUMENT_TYPES.each do |type|
          rows = existing.fetch(type, [])
          has_default = rows.any? { |row| row.status == 'active' && row.is_default }
          missing_papers = seeded_papers_for(type) - rows.map(&:paper)
          next if has_default && missing_papers.empty?

          seed_type!(store, type)
        rescue ActiveRecord::RecordNotUnique
          next
        end
      end

      def self.seed_type!(store, type)
        transaction(requires_new: true) do
          rows = for_store(store).where(document_type: type).order(:id).lock.to_a
          active_rows = rows.select { |row| row.status == 'active' }
          has_default = active_rows.any?(&:is_default)

          if !has_default && active_rows.any?
            active_rows.first.update!(is_default: true)
            has_default = true
          end

          present_papers = rows.map(&:paper)
          room = MAX_ACTIVE - active_rows.length
          (seeded_papers_for(type) - present_papers).first([room, 0].max).each do |paper|
            make_default = !has_default && paper == default_paper_for(type)
            create_with_version!(
              store: store, document_type: type, name: default_name(type, paper), paper: paper,
              config: default_config(type, paper: paper), actor: nil, default: make_default
            )
            has_default ||= make_default
          end

          unless has_default
            for_store(store).active.where(document_type: type).order(:id).first&.update!(is_default: true)
          end
        end
      end
      private_class_method :seed_type!

      # The template a branch prints `document_type` with: the branch's
      # chosen template while it is active, otherwise the store default.
      def self.effective_for(store, document_type, branch:)
        ensure_defaults!(store)
        assigned = branch && BranchReceiptTemplate.find_by(branch_id: branch.id, document_type: document_type)&.receipt_template
        return assigned if assigned && !assigned.disabled? && assigned.store_id == store.id

        for_store(store).active.find_by!(document_type: document_type, is_default: true)
      end

      # { document_type => template } for every type the branch prints with
      # its own active template.
      def self.branch_overrides(branch)
        BranchReceiptTemplate.where(branch_id: branch.id).includes(:receipt_template).
          reject { |row| row.receipt_template.disabled? }.to_h { |row| [row.document_type, row.receipt_template] }
      end

      def self.create_with_version!(store:, document_type:, name:, paper:, config:, actor:, default: false)
        template = create!(store: store, document_type: document_type, name: name, paper: paper, status: 'active',
                           is_default: default, current_version: 1, created_by: actor, updated_by: actor)
        template.versions.create!(version: 1, config: config, created_by: actor)
        template
      end

      # Locks the active templates of one document type so the active limit
      # and the single default hold under concurrent changes.
      def self.lock_type!(store, document_type)
        for_store(store).active.where(document_type: document_type).order(:id).lock.to_a
      end

      def self.ensure_room!(store, document_type)
        return if for_store(store).active.where(document_type: document_type).count < MAX_ACTIVE

        raise Conflict.new("At most #{MAX_ACTIVE} active templates per document type.", reason: 'template_limit_reached',
                                                                                        details: { limit: MAX_ACTIVE })
      end

      # The current version of each template, in one query.
      def self.current_versions(templates)
        ReceiptTemplateVersion.joins(:receipt_template).
          where(receipt_template_id: templates.map(&:id)).
          where('spree_pos_receipt_template_versions.version = spree_pos_receipt_templates.current_version').
          index_by(&:receipt_template_id)
      end

      def disabled?
        status == 'disabled'
      end

      def version_record(number = current_version)
        versions.find_by(version: number)
      end

      def current_config
        version_record.config
      end

      # A new version holding `config`, with any attribute changes.
      def revise!(config:, actor:, **attributes)
        self.current_version += 1
        assign_attributes(attributes.merge(updated_by: actor))
        save!
        versions.create!(version: current_version, config: config, created_by: actor)
      end

      def audit_metadata
        { id: prefixed_id, document_type: document_type, name: name, paper: paper, status: status,
          is_default: is_default, version: current_version }
      end

      # The template with the config of `version` (the current one unless given).
      def to_pos(version = nil)
        version ||= version_record
        {
          id: prefixed_id, document_type: document_type, name: name, paper: paper, status: status,
          is_default: is_default, current_version: current_version, version: version.version, config: version.config,
          updated_by: updated_by && { id: updated_by.prefixed_id, name: StaffName.call(updated_by) },
          created_at: created_at.iso8601, updated_at: updated_at.iso8601
        }
      end
    end
  end
end
