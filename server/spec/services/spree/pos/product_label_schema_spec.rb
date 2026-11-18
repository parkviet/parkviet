# frozen_string_literal: true

RSpec.describe Spree::Pos::ProductLabelSchema do
  cases = JSON.parse(Rails.root.join('spec/fixtures/product_label_schema_cases.json').read).fetch('cases')

  def built_in
    Spree::Pos::ReceiptTemplate.default_config('product_label')
  end

  def value_of(raw)
    return raw unless raw.is_a?(Hash) && raw.key?('$repeat')

    raw.fetch('$repeat') * raw.fetch('count')
  end

  # Applies one case's edit to a copy of the built-in config.
  def edited(spec)
    path = spec['path']
    return built_in if path.nil?
    return value_of(spec['value']) if path.empty?

    config = built_in
    parent = path[0...-1].inject(config) { |node, step| node[step] }
    last = path.last
    if spec['delete']
      parent.is_a?(Array) ? parent.delete_at(last) : parent.delete(last)
    else
      parent[last] = value_of(spec['value'])
    end
    config
  end

  def summary(errors)
    errors.map { |error| [error[:pointer] || error['pointer'], error[:code] || error['code']] }.sort
  end

  cases.each do |spec|
    it spec['name'] do
      expect(summary(described_class.validate(edited(spec)))).to eq(summary(spec['errors']))
    end
  end

  it 'accepts the built-in config of every label stock' do
    Spree::Pos::ReceiptTemplate::LABEL_PAPERS.each do |paper|
      config = Spree::Pos::ReceiptTemplate.default_config('product_label', paper: paper)
      expect(described_class.validate(config)).to eq([]), paper
    end
  end

  it 'reports pointers under a custom root' do
    config = built_in
    config['page']['font_size'] = 30
    expect(described_class.validate(config, root: '/body/config').map { |error| error[:pointer] })
      .to eq(['/body/config/page/font_size'])
  end

  it 'is the validator the template schema hands product labels to' do
    config = built_in
    config['page']['font_size'] = 30
    expect(Spree::Pos::ReceiptTemplateSchema.validate(config, 'product_label').map { |error| error[:pointer] })
      .to eq(['/config/page/font_size'])
    expect { Spree::Pos::ReceiptTemplateSchema.validate!(config, 'product_label') }
      .to raise_error(Spree::Pos::ReceiptTemplateSchema::Invalid)
  end

  it 'rejects a receipt config for a product label' do
    errors = Spree::Pos::ReceiptTemplateSchema.validate(Spree::Pos::ReceiptTemplate.default_config('sale'), 'product_label')
    expect(errors.map { |error| error[:code] }).to include('unknown_key', 'missing')
  end
end
