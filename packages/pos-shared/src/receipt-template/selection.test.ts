import { describe, expect, it } from 'vitest';
import {
  initialChoice,
  type ListedTemplate,
  ORIGINAL_CHOICE,
  originalLayout,
  printChoices,
} from './selection';

const template = (
  overrides: Partial<ListedTemplate> & Pick<ListedTemplate, 'id'>,
): ListedTemplate => ({
  document_type: 'sale',
  name: overrides.id,
  paper: '80mm',
  status: 'active',
  is_default: false,
  current_version: 1,
  ...overrides,
});

const k80 = template({
  id: 'postpl_a',
  name: 'Bán hàng K80',
  is_default: true,
  current_version: 3,
});
const a4 = template({ id: 'postpl_b', name: 'Bán hàng A4', paper: 'a4', current_version: 2 });
const prebill = template({ id: 'postpl_c', document_type: 'prebill', is_default: true });
const off = template({ id: 'postpl_d', status: 'disabled' });

describe('print choices', () => {
  it('offers the active templates of the document type, default first, at their current version', () => {
    const choices = printChoices([a4, prebill, off, k80], 'sale');
    expect(choices).toEqual([
      {
        key: 'postpl_a',
        templateId: 'postpl_a',
        version: 3,
        paper: '80mm',
        name: 'Bán hàng K80',
        original: false,
      },
      {
        key: 'postpl_b',
        templateId: 'postpl_b',
        version: 2,
        paper: 'a4',
        name: 'Bán hàng A4',
        original: false,
      },
    ]);
  });

  it('puts the original first with its own version and paper, in place of its template', () => {
    const choices = printChoices([k80, a4], 'sale', {
      template_id: 'postpl_a',
      template_version: 1,
      paper: '58mm',
    });
    expect(choices.map((choice) => [choice.key, choice.version, choice.paper])).toEqual([
      [ORIGINAL_CHOICE, 1, '58mm'],
      ['postpl_b', 2, 'a4'],
    ]);
    expect(choices[0]).toMatchObject({ name: 'Bán hàng K80', original: true });
  });

  it('keeps an original whose template was disabled since, name unknown until loaded', () => {
    const choices = printChoices([k80], 'sale', {
      template_id: 'postpl_d',
      template_version: 4,
      paper: 'a5',
    });
    expect(choices[0]).toEqual({
      key: ORIGINAL_CHOICE,
      templateId: 'postpl_d',
      version: 4,
      paper: 'a5',
      name: null,
      original: true,
    });
    expect(choices).toHaveLength(2);
  });

  it('ignores an original recorded before templates existed', () => {
    expect(originalLayout({ template_id: null, template_version: null, paper: null })).toBeNull();
    expect(
      printChoices([k80], 'sale', { template_id: null, template_version: null, paper: null }),
    ).toHaveLength(1);
  });

  it('starts from the original, then the remembered template, then the default', () => {
    const fresh = printChoices([k80, a4], 'sale');
    expect(initialChoice(fresh, [k80, a4])).toBe('postpl_a');
    expect(initialChoice(fresh, [k80, a4], 'postpl_b')).toBe('postpl_b');
    // A remembered template that is no longer offered is ignored.
    expect(initialChoice(fresh, [k80, a4], 'postpl_d')).toBe('postpl_a');
    const reprint = printChoices([k80, a4], 'sale', {
      template_id: 'postpl_b',
      template_version: 1,
      paper: 'a4',
    });
    expect(initialChoice(reprint, [k80, a4], 'postpl_a')).toBe(ORIGINAL_CHOICE);
    expect(initialChoice([], [])).toBeNull();
  });

  it("prefers the branch's default over the store default, after a remembered template", () => {
    const branchA4 = { ...a4, branch_default: true };
    const storeK80 = { ...k80, branch_default: false };
    const choices = printChoices([storeK80, branchA4], 'sale');
    expect(choices.map((choice) => choice.key)).toEqual(['postpl_b', 'postpl_a']);
    expect(initialChoice(choices, [storeK80, branchA4])).toBe('postpl_b');
    expect(initialChoice(choices, [storeK80, branchA4], 'postpl_a')).toBe('postpl_a');
    // Read without a branch: the store default.
    expect(initialChoice(printChoices([k80, a4], 'sale'), [k80, a4])).toBe('postpl_a');
  });

  it('hides sheet templates and ignores remembered sheets when allowSheetReceipts is false, except an explicit branch template or original', () => {
    const a5 = template({ id: 'postpl_a5', name: 'Bán hàng A5', paper: 'a5' });
    const k58 = template({ id: 'postpl_k58', name: 'Bán hàng K58', paper: '58mm' });
    const storeK80 = { ...k80, branch_default: true };
    const choices = printChoices([storeK80, k58, a4, a5], 'sale', null, {
      allowSheetReceipts: false,
    });
    expect(choices.map((choice) => choice.key)).toEqual(['postpl_a', 'postpl_k58']);
    // Remembered A4 is ignored; falls back to the branch/store roll default.
    expect(
      initialChoice(choices, [storeK80, k58, a4, a5], 'postpl_b', { allowSheetReceipts: false }),
    ).toBe('postpl_a');

    // Administrator explicitly assigned A4 to this branch (even when A4 is also store default).
    const sameStoreAndBranchA4 = {
      ...a4,
      is_default: true,
      branch_default: true,
      branch_override: true,
    };
    const nonDefaultK80 = {
      ...k80,
      is_default: false,
      branch_default: false,
      branch_override: false,
    };
    const withBranchSheet = printChoices([nonDefaultK80, sameStoreAndBranchA4, a5], 'sale', null, {
      allowSheetReceipts: false,
    });
    expect(withBranchSheet.map((choice) => choice.key)).toEqual(['postpl_b', 'postpl_a']);
    expect(
      initialChoice(withBranchSheet, [nonDefaultK80, sameStoreAndBranchA4, a5], 'postpl_b', {
        allowSheetReceipts: false,
      }),
    ).toBe('postpl_b');

    // When every active template is a sheet template, keep the top active template
    // rather than returning an empty choice list.
    const onlySheet = printChoices([a4, a5], 'sale', null, { allowSheetReceipts: false });
    expect(onlySheet.map((choice) => choice.key)).toEqual(['postpl_b']);

    // Reprinting an earlier A4 receipt keeps the original choice.
    const reprint = printChoices(
      [storeK80, a4],
      'sale',
      { template_id: 'postpl_b', template_version: 2, paper: 'a4' },
      { allowSheetReceipts: false },
    );
    expect(reprint.map((choice) => choice.key)).toEqual([ORIGINAL_CHOICE, 'postpl_a']);
    expect(initialChoice(reprint, [storeK80, a4], null, { allowSheetReceipts: false })).toBe(
      ORIGINAL_CHOICE,
    );
  });
});
