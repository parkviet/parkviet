import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateTemplate } from '../receipt-template/validate';
import { defaultProductLabel } from './defaults';
import { PRODUCT_LABEL_PAPERS } from './presets';
import { validateProductLabelConfig } from './validate';

// The server's cases: both validators must give the same answer to each.
type Case = {
  name: string;
  path: (string | number)[] | null;
  value?: unknown;
  delete?: boolean;
  errors: { pointer: string; code: string }[];
};

const fixture = new URL(
  '../../../../../server/spec/fixtures/product_label_schema_cases.json',
  import.meta.url,
);
const { cases } = JSON.parse(readFileSync(fixture, 'utf8')) as { cases: Case[] };

const caseValue = (raw: unknown): unknown =>
  typeof raw === 'object' && raw !== null && '$repeat' in raw
    ? String((raw as { $repeat: string }).$repeat).repeat(
        (raw as unknown as { count: number }).count,
      )
    : raw;

// Applies a case's edit to a copy of the built-in config.
function edited(spec: Case): unknown {
  if (spec.path === null) return defaultProductLabel();
  if (spec.path.length === 0) return caseValue(spec.value);
  const config = defaultProductLabel() as unknown as Record<string, unknown>;
  const parent = spec.path
    .slice(0, -1)
    .reduce<unknown>((node, step) => (node as Record<string | number, unknown>)[step], config) as
    | Record<string | number, unknown>
    | unknown[];
  const last = spec.path[spec.path.length - 1] as string | number;
  if (spec.delete) {
    if (Array.isArray(parent)) parent.splice(last as number, 1);
    else delete parent[last];
  } else (parent as Record<string | number, unknown>)[last] = caseValue(spec.value);
  return config;
}

const summary = (issues: { pointer: string; code: string }[]) =>
  issues.map(({ pointer, code }) => `${pointer} ${code}`).sort();

describe('product label validation', () => {
  it('has cases to compare', () => {
    expect(cases.length).toBeGreaterThan(40);
  });

  it.each(cases)('$name', (spec) => {
    expect(summary(validateProductLabelConfig(edited(spec)))).toEqual(summary(spec.errors));
  });

  it.each(PRODUCT_LABEL_PAPERS)('accepts the built-in template of %s', (paper) => {
    expect(validateProductLabelConfig(defaultProductLabel(paper))).toEqual([]);
  });

  it('reports pointers under a custom root', () => {
    const config = defaultProductLabel();
    config.page.font_size = 30;
    expect(validateProductLabelConfig(config, '/body/config')).toEqual([
      { pointer: '/body/config/page/font_size', code: 'invalid_value' },
    ]);
  });
});

describe('product label drafts', () => {
  it('checks the name, the label stock and the config', () => {
    const config = defaultProductLabel();
    expect(
      validateTemplate({ name: 'Tem', paper: 'sheet_a5_40', config }, 'product_label'),
    ).toEqual([]);
    expect(validateTemplate({ name: ' ', paper: 'roll_50x30', config }, 'product_label')).toEqual([
      { pointer: '/name', code: 'blank' },
    ]);
    expect(validateTemplate({ name: 'Tem', paper: '80mm', config }, 'product_label')).toEqual([
      { pointer: '/paper', code: 'invalid_value' },
    ]);
    config.fields[2] = { key: 'product_name', enabled: true, max_lines: 7 };
    expect(validateTemplate({ name: 'Tem', paper: 'roll_50x30', config }, 'product_label')).toEqual(
      [{ pointer: '/config/fields/2/max_lines', code: 'invalid_value' }],
    );
  });
});
