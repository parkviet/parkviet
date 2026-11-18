# frozen_string_literal: true

RSpec.describe Spree::Pos::ReceiptTemplate, type: :model do
  let(:store) { create(:store, default_currency: 'VND', supported_currencies: 'VND') }

  it 'seeds every paper of each document type once, with the default paper active' do
    described_class.ensure_defaults!(store)
    described_class.ensure_defaults!(store)
    templates = described_class.for_store(store)
    expect(templates.count).to eq(39)
    expect(templates.pluck(:document_type).uniq).to match_array(described_class::DOCUMENT_TYPES)
    described_class::DOCUMENT_TYPES.each do |type|
      group = templates.where(document_type: type)
      expect(group.pluck(:paper)).to match_array(described_class.papers_for(type))
      expect(group.where(is_default: true).pluck(:paper)).to eq([described_class.default_paper_for(type)])
    end
    sale = templates.find_by(document_type: 'sale', is_default: true)
    expect(sale.name).to eq('Phiếu bán hàng')
    expect(sale.current_config).to eq(described_class.default_config('sale'))
    sale_a4 = templates.find_by(document_type: 'sale', paper: 'a4')
    expect(sale_a4.name).to eq('Phiếu bán hàng (A4)')
    expect(sale_a4.current_config).to eq(described_class.default_config('sale', paper: 'a4'))
    expect(described_class.for_store(create(:store))).to be_empty
  end

  it 'seeds nine label stocks for product labels, each with a name and a config of its own' do
    described_class.ensure_defaults!(store)
    labels = described_class.for_store(store).where(document_type: 'product_label')
    expect(labels.count).to eq(9)
    default = labels.find_by(is_default: true)
    expect(default).to have_attributes(paper: 'roll_50x30', name: 'Tem sản phẩm (50×30mm)')
    expect(labels.find_by(paper: 'sheet_a4_100').name).to eq('Tem sản phẩm (A4 · 100 tem)')

    narrow = labels.find_by(paper: 'roll_110x22_3').current_config
    expect(narrow['fields'].find { |field| field['key'] == 'variant_options' }['enabled']).to be(false)
    expect(narrow['fields'].find { |field| field['key'] == 'product_name' }['max_lines']).to eq(1)
    wide = labels.find_by(paper: 'roll_75x25_2').current_config
    expect(wide['fields'].find { |field| field['key'] == 'variant_options' }['enabled']).to be(true)
    expect(wide['fields'].find { |field| field['key'] == 'product_name' }['max_lines']).to eq(2)
    expect(wide['page']).not_to include('copies')
  end

  it 'keeps label stocks and receipt papers apart' do
    expect(described_class.papers_for('sale')).to eq(described_class::PAPERS)
    expect(described_class.papers_for('product_label')).to eq(described_class::LABEL_PAPERS)
    label = described_class.new(store: store, document_type: 'product_label', paper: '80mm', name: 'Tem')
    receipt = described_class.new(store: store, document_type: 'sale', paper: 'roll_50x30', name: 'Phiếu')
    expect(label).not_to be_valid
    expect(receipt).not_to be_valid
    expect(label.errors.attribute_names).to eq([:paper])
    expect(described_class.new(store: store, document_type: 'product_label', paper: 'sheet_a5_40', name: 'Tem'))
      .to be_valid
  end

  it 'hands a missing default to the oldest active template instead of adding another' do
    described_class.ensure_defaults!(store)
    sales = described_class.for_store(store).where(document_type: 'sale').order(:id).to_a
    sale = sales.first
    second = sales.second
    sale.update!(status: 'disabled', is_default: false)
    described_class.ensure_defaults!(store)
    expect(second.reload.is_default).to be(true)
    expect(described_class.for_store(store).where(document_type: 'sale').count).to eq(5)
  end

  it 'keeps one active default per document type in the database' do
    described_class.ensure_defaults!(store)
    sale = described_class.for_store(store).find_by(document_type: 'sale', is_default: true)
    expect do
      described_class.create_with_version!(store: store, document_type: 'sale', name: 'Hai', paper: '80mm',
                                           config: sale.current_config, actor: nil, default: true)
    end.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it 'adds an immutable version on every revision' do
    described_class.ensure_defaults!(store)
    template = described_class.for_store(store).find_by(document_type: 'refund', is_default: true)
    changed = template.current_config.merge('footer' => [{ 'type' => 'divider' }])
    template.revise!(config: changed, actor: nil, name: 'Hoàn tiền')
    expect(template.reload).to have_attributes(current_version: 2, name: 'Hoàn tiền')
    expect(template.version_record(1).config).to eq(described_class.default_config('refund'))
    expect(template.current_config).to eq(changed)
    expect { template.version_record(1).update!(config: {}) }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it 'limits active templates per document type' do
    described_class.ensure_defaults!(store)
    config = described_class.default_config('sale')
    5.times do |index|
      described_class.create_with_version!(store: store, document_type: 'sale', name: "M#{index}", paper: '80mm', config: config, actor: nil)
    end
    expect { described_class.ensure_room!(store, 'sale') }.to raise_error(Spree::Pos::Conflict) { |error|
      expect(error.reason).to eq('template_limit_reached')
    }
    expect { described_class.ensure_room!(store, 'prebill') }.not_to raise_error
  end

  it 'validates its attributes and maps return supplements to the return template' do
    template = described_class.new(store: store, document_type: 'invoice', paper: '100mm', name: 'x' * 61, status: 'gone')
    expect(template).not_to be_valid
    expect(template.errors.attribute_names).to include(:document_type, :paper, :name, :status)
    expect(described_class.document_type_for('return_supplement')).to eq('return')
    expect(described_class.document_type_for('sale')).to eq('sale')
  end
end
