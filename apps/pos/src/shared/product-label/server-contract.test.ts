import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PRODUCT_LABEL, defaultProductLabel } from './defaults';
import { buildLabelDocument } from './document';
import {
  DEFAULT_PRODUCT_LABEL_PAPER,
  labelsPerPage,
  PRODUCT_LABEL_PAPERS,
  PRODUCT_LABEL_PRESETS,
  productLabelPreset,
} from './presets';
import type { RollLabelPreset } from './types';

// The server seeds stores with the same label stocks and built-in template
// the client knows. Both copies must stay identical.

const serverConfig = new URL('../../../../../server/config/pos/', import.meta.url);
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, serverConfig), 'utf8'));

describe('server product label contract', () => {
  it('ships the same label stocks as the client', () => {
    expect(readJson('product_label_presets.json')).toEqual(PRODUCT_LABEL_PRESETS);
  });

  it('ships the same built-in template as the client', () => {
    expect(readJson('receipt_templates/product_label.json')).toEqual(DEFAULT_PRODUCT_LABEL);
  });
});

describe('label stocks', () => {
  it('lists nine stocks with the roll of 50 x 30 first and as the default', () => {
    expect(PRODUCT_LABEL_PAPERS).toHaveLength(9);
    expect(PRODUCT_LABEL_PAPERS[0]).toBe(DEFAULT_PRODUCT_LABEL_PAPER);
    expect(DEFAULT_PRODUCT_LABEL_PAPER).toBe('roll_50x30');
  });

  it('gives every sheet as many stickers as its code names', () => {
    const counts = Object.fromEntries(
      PRODUCT_LABEL_PRESETS.filter((preset) => preset.kind === 'sheet').map((preset) => [
        preset.code,
        labelsPerPage(preset),
      ]),
    );
    expect(counts).toEqual({
      sheet_a4_100: 100,
      sheet_a4_65: 65,
      sheet_a4_180: 180,
      sheet_a5_40: 40,
    });
  });

  it('gives every roll as many stickers per row as its code names', () => {
    const rolls = PRODUCT_LABEL_PRESETS.filter((preset) => preset.kind === 'roll');
    expect(rolls.map((preset) => labelsPerPage(preset))).toEqual([1, 1, 2, 2, 3]);
  });

  it('fits every grid on its paper', () => {
    for (const preset of PRODUCT_LABEL_PRESETS) {
      const { label_mm: label, gap_mm: gap } = preset;
      const width = preset.columns * label.width + (preset.columns - 1) * gap.x;
      if (preset.kind === 'roll') {
        expect(width, preset.code).toBeLessThanOrEqual(preset.roll_width_mm);
      } else {
        const height = preset.rows * label.height + (preset.rows - 1) * gap.y;
        expect(width + preset.sheet_margin_mm.left, preset.code).toBeLessThanOrEqual(
          preset.sheet_mm.width,
        );
        expect(height + preset.sheet_margin_mm.top, preset.code).toBeLessThanOrEqual(
          preset.sheet_mm.height,
        );
      }
    }
  });

  it('marks the narrow stocks and turns off their variant options', () => {
    const compact = PRODUCT_LABEL_PRESETS.filter((preset) => preset.compact).map(
      (preset) => preset.code,
    );
    expect(compact).toEqual(['roll_72x22_2', 'roll_110x22_3', 'sheet_a4_180']);
    for (const paper of PRODUCT_LABEL_PAPERS) {
      const fields = defaultProductLabel(paper).fields;
      const variant = fields.find((field) => field.key === 'variant_options');
      const name = fields.find((field) => field.key === 'product_name');
      expect(variant?.enabled, paper).toBe(!productLabelPreset(paper).compact);
      expect(name && 'max_lines' in name ? name.max_lines : null, paper).toBe(
        productLabelPreset(paper).compact ? 1 : 2,
      );
    }
  });

  it('does not change the shared built-in template when a copy is edited', () => {
    const copy = defaultProductLabel('roll_72x22_2');
    copy.page.font_size = 14;
    expect(DEFAULT_PRODUCT_LABEL.page.font_size).toBe(9);
    expect(DEFAULT_PRODUCT_LABEL.fields[3]).toEqual({ key: 'variant_options', enabled: true });
  });
});

// The station document is built on both sides from the same inputs.
const fixtureDir = new URL('../../../../../server/spec/fixtures/product_labels/', import.meta.url);

describe('server product label document contract', () => {
  const files = readdirSync(fixtureDir).filter((name) => name.endsWith('.json'));

  it('has fixtures', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)('builds the document of %s the way the server does', (name) => {
    const fixture = JSON.parse(readFileSync(new URL(name, fixtureDir), 'utf8'));
    const preset = productLabelPreset(fixture.paper) as RollLabelPreset;
    const document = buildLabelDocument(fixture.config, preset, fixture.items, {
      now: new Date(fixture.now),
      timeZone: fixture.time_zone,
      store: fixture.store,
    });
    expect(JSON.parse(JSON.stringify(document))).toEqual(fixture.document);
  });
});
