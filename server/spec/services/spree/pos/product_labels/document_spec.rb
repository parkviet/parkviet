# frozen_string_literal: true

require 'rails_helper'
require 'json'

# Each fixture holds the inputs and the document built from them.
# apps/pos/src/shared/product-label/server-contract.test.ts builds the
# same documents with the TypeScript renderer, so neither side can change
# alone.
RSpec.describe Spree::Pos::ProductLabels::Document do
  fixtures = Rails.root.join('spec/fixtures/product_labels').glob('*.json').sort
  presets = Spree::Pos::ReceiptTemplate::LABEL_PRESETS

  def build(fixture, presets)
    described_class.build(config: fixture['config'], preset: presets.find { |preset| preset['code'] == fixture['paper'] },
                          items: fixture['items'], store: fixture['store'], now: Time.zone.parse(fixture['now']), time_zone: fixture['time_zone'])
  end

  it 'has fixtures' do
    expect(fixtures.size).to be >= 5
  end

  fixtures.each do |path|
    it "builds the document of #{path.basename} the way the client does" do
      fixture = JSON.parse(path.read)

      expect(build(fixture, presets).as_json).to eq(fixture['document'])
    end
  end

  describe '.jobs' do
    let(:fixture) { JSON.parse(fixtures.first.read) }
    let(:preset) { presets.find { |candidate| candidate['code'] == fixture['paper'] } }

    def jobs(items, max_labels: 2000)
      described_class.jobs(config: fixture['config'], preset: preset, items: items, store: fixture['store'],
                           now: Time.zone.parse(fixture['now']), time_zone: fixture['time_zone'], max_labels: max_labels)
    end

    it 'keeps a short list in one document' do
      expect(jobs(fixture['items']).size).to eq(1)
    end

    it 'splits copies over documents of at most the limit, losing none' do
      items = [fixture['items'].first.merge('quantity' => 999), fixture['items'].last.merge('quantity' => 999),
               fixture['items'].first.merge('variant_id' => 'c', 'quantity' => 500)]
      documents = jobs(items)

      expect(documents.map { |document| document['labels'].sum { |label| label['copies'] } }).to eq([2000, 498])
      expect(documents.sum { |document| document['labels'].size }).to eq(4)
    end

    it 'splits an item across two documents' do
      documents = jobs([fixture['items'].first.merge('quantity' => 5)], max_labels: 3)

      expect(documents.map { |document| document['labels'].map { |label| label['copies'] } }).to eq([[3], [2]])
    end
  end
end
