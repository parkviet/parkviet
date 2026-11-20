import { describe, expect, it } from 'vitest';
import {
  kitchenSent,
  kitchenStates,
  priorityMarkable,
  sentUnits,
  unsentKitchenQuantity,
} from './kitchen';
import type { PosLineItem, PosWorkspace } from './pos-context';

const line = (overrides: Partial<PosLineItem>): PosLineItem =>
  ({ id: 'l', kind: 'menu', quantity: 1, ...overrides }) as PosLineItem;

describe('kitchen quantities', () => {
  it('counts the menu units the kitchen has not heard about', () => {
    const workspace = {
      line_items: [
        line({ quantity: 3, kitchen_sent_quantity: '2.0' }),
        line({ quantity: 2 }),
        line({ quantity: 1, kitchen_sent_quantity: '1.0' }),
        line({ kind: 'ordinary', quantity: 5 }),
      ],
    } as PosWorkspace;
    expect(unsentKitchenQuantity(workspace)).toBe(3);
  });

  it('reads a missing or bad sent quantity as nothing sent', () => {
    expect(kitchenSent(line({}))).toBe(0);
    expect(kitchenSent(line({ kitchen_sent_quantity: 'x' }))).toBe(0);
    expect(kitchenSent(line({ kitchen_sent_quantity: '1.5' }))).toBe(1.5);
  });

  it('lists the kitchen states of a table line in order, without the empty ones', () => {
    expect(
      kitchenStates(line({ kitchen_status: { served: '1.0', new: '2.0', ready: '0' } })),
    ).toEqual([
      { state: 'new', count: 2 },
      { state: 'served', count: 1 },
    ]);
    expect(kitchenStates(line({}))).toEqual([]);
  });
});

describe('priorityMarkable', () => {
  const open = { operational_status: 'editing' } as PosWorkspace;
  const markable = line({ sale_line_id: 'posline_1', row_version: 2 });

  it('allows a menu line with a version on an open order, paid or not', () => {
    expect(priorityMarkable(open, markable)).toBe(true);
    expect(priorityMarkable({ ...open, payments: true } as PosWorkspace, markable)).toBe(true);
    expect(priorityMarkable({ operational_status: 'parked' } as PosWorkspace, markable)).toBe(true);
  });

  it('refuses a closed order and a line that cannot take the mark', () => {
    expect(priorityMarkable({ operational_status: 'completed' } as PosWorkspace, markable)).toBe(
      false,
    );
    expect(priorityMarkable(open, { ...markable, kind: 'ordinary' })).toBe(false);
    expect(priorityMarkable(open, { ...markable, sale_line_id: null })).toBe(false);
    expect(priorityMarkable(open, { ...markable, row_version: undefined })).toBe(false);
  });
});

describe('sentUnits', () => {
  it('counts the items of the fire tickets a send answered with', () => {
    expect(
      sentUnits({
        tickets: [
          { kind: 'fire', items: [{ quantity: '2.0' }, { quantity: '1.0' }] },
          { kind: 'fire', items: [{ quantity: '1.0' }] },
          { kind: 'void', items: [{ quantity: '5.0' }] },
        ],
      }),
    ).toBe(4);
    expect(sentUnits({ tickets: [], ticket_count: 0 })).toBe(0);
  });

  it('says nothing for an answer without tickets', () => {
    expect(sentUnits(undefined)).toBeNull();
    expect(sentUnits({ ticket_count: 1 })).toBeNull();
  });
});
