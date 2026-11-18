import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultProductLabel } from './defaults';
import { productLabelPreset } from './presets';
import { type LabelItem, renderLabels } from './render';
import { renderLabelsHtml } from './render-html';
import golden from './render-html.golden.json';
import { SAMPLE_LABEL_STORE, sampleLabelItems } from './sample-data';
import type { ProductLabelPaper } from './types';

const options = {
  now: new Date('2026-11-18T03:00:00Z'),
  timeZone: 'Asia/Ho_Chi_Minh',
  store: SAMPLE_LABEL_STORE,
};

const html = (paper: ProductLabelPaper, items: LabelItem[], startCell?: number) => {
  const preset = productLabelPreset(paper);
  const config = defaultProductLabel(paper);
  return renderLabelsHtml(config, renderLabels(config, preset, items, { ...options, startCell }));
};

const samples = sampleLabelItems();

const cases: { name: string; html: () => string }[] = [
  { name: 'roll 50x30, one label', html: () => html('roll_50x30', [samples[0]]) },
  {
    name: 'roll 110x22, three labels on a row',
    html: () => html('roll_110x22_3', [{ ...samples[1], quantity: 2 }, samples[2]]),
  },
  {
    name: 'sheet A4 65 starting at cell 7',
    html: () => html('sheet_a4_65', [{ ...samples[0], quantity: 2 }, samples[3]], 7),
  },
];

describe('renderLabelsHtml golden', () => {
  it('matches the stored markup, case by case', () => {
    if (process.env.UPDATE_GOLDEN === '1') {
      const next = Object.fromEntries(cases.map((item) => [item.name, item.html()]));
      writeFileSync(
        new URL('./render-html.golden.json', import.meta.url),
        `${JSON.stringify(next, null, 2)}\n`,
      );
      return;
    }
    const expected = golden as Record<string, string>;
    expect(cases.map((item) => item.name).sort()).toEqual(Object.keys(expected).sort());
    for (const item of cases) expect(item.html(), item.name).toBe(expected[item.name]);
  });
});

describe('renderLabelsHtml', () => {
  it('sets the roll page to one row of stickers with no margin', () => {
    const out = html('roll_110x22_3', [{ ...samples[0], quantity: 4 }]);
    expect(out).toContain('@page{size:110mm 22mm;margin:0}');
    expect(out.match(/<section class="page">/g)).toHaveLength(2);
  });

  it('sets a sheet page to the paper size and places each sticker in millimetres', () => {
    const a4 = html('sheet_a4_65', [{ ...samples[0], quantity: 2 }], 7);
    expect(a4).toContain('@page{size:A4;margin:0}');
    // Cell 7 is column 1, row 1: left 4.7 + 40.6, top 10.7 + 21.2.
    expect(a4).toContain('left:45.3mm;top:31.9mm;width:38.1mm;height:21.2mm');
    expect(html('sheet_a5_40', [samples[0]])).toContain('@page{size:A5;margin:0}');
  });

  it('clamps the product name by its line setting', () => {
    const config = defaultProductLabel('roll_50x30');
    const field = config.fields.find((candidate) => candidate.key === 'product_name');
    if (field?.key === 'product_name') field.max_lines = 3;
    const preset = productLabelPreset('roll_50x30');
    const out = renderLabelsHtml(config, renderLabels(config, preset, [samples[3]], options));
    expect(out).toContain('-webkit-line-clamp:3');
  });

  it('draws the barcode as an SVG in millimetres', () => {
    const out = html('roll_50x30', [samples[0]]);
    expect(out).toMatch(/<svg class="bars"[^>]*viewBox="0 0 115 1"/);
    expect(out).toMatch(/width="\d+(\.\d+)?mm" height="\d+(\.\d+)?mm"/);
  });

  it('escapes text typed in by the store', () => {
    const hostile = { ...samples[0], product_name: '<img src=x onerror="alert(1)">', unit: '"&' };
    const out = html('roll_50x30', [hostile]);
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('is a self-contained document', () => {
    const out = html('roll_50x30', [samples[0]]);
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('<style>');
    expect(out).not.toMatch(/<link|<script|src="http/);
  });
});
