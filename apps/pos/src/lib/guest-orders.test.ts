import { describe, expect, it } from 'vitest';
import {
  normalizeGuestOrders,
  normalizeGuestRequests,
  pendingGuestOrders,
  RECENT_PREPAID_WINDOW_MS,
  recentPrepaidOrders,
  waitingCount,
} from './guest-orders';

describe('guest orders from the table QR', () => {
  it('reads orders with their options, outcomes and defaults, skipping rows without an id', () => {
    const [order, ...rest] = normalizeGuestOrders([
      {
        id: 'posguestorder_1',
        workspace_id: 'ws_1',
        resource_id: 'res_1',
        table_name: 'Bàn 4',
        area_id: 'area_1',
        status: 'pending',
        automatic: false,
        quoted_total: '75000.0',
        currency: 'VND',
        items: [
          {
            name: 'Trà đào',
            size: 'L',
            quantity: 2,
            amount: '70000.0',
            note: 'ít đá',
            modifiers: [
              { name: 'Trân châu', quantity: 1 },
              { name: 'Thạch', quantity: 2 },
            ],
          },
          {
            name: 'Bánh',
            quantity: 1,
            amount: '5000.0',
            outcome: 'left_out',
            reason: 'item_sold_out',
          },
          { quantity: 3 },
        ],
        created_at: '2026-11-12T03:00:00Z',
      },
      { status: 'pending' },
      'nonsense',
    ]);
    expect(rest).toEqual([]);
    expect(order.items).toHaveLength(2);
    expect(order.items[0]).toMatchObject({
      options: ['Trân châu', 'Thạch x2'],
      outcome: null,
      note: 'ít đá',
    });
    expect(order.items[1]).toMatchObject({
      outcome: 'left_out',
      reason: 'item_sold_out',
      size: null,
    });
    expect(normalizeGuestOrders(undefined)).toEqual([]);
  });

  it('counts pending orders and open requests as waiting for staff, excluding awaiting_payment and accepted', () => {
    const orders = normalizeGuestOrders([
      { id: 'a', status: 'pending' },
      { id: 'b', status: 'accepted', prepaid: true },
      { id: 'c', status: 'awaiting_payment', pay_method: 'vietqr' },
    ]);
    const requests = normalizeGuestRequests([
      { id: 'r1', kind: 'call_staff', status: 'open' },
      { id: 'r2', kind: 'request_bill', status: 'done' },
      { kind: 'call_staff', status: 'open' },
    ]);
    expect(requests).toHaveLength(2);
    expect(waitingCount(orders, requests)).toBe(2);
  });

  it('keeps pay_before counter orders with null workspace_id and parses pay_method', () => {
    const orders = normalizeGuestOrders([
      {
        id: 'posguestorder_counter',
        workspace_id: null,
        resource_id: 'res_2',
        table_name: 'Bàn 2',
        status: 'pending',
        pay_method: 'counter',
      },
      {
        id: 'posguestorder_other',
        workspace_id: 'ws_2',
        status: 'pending',
        pay_method: 'unknown',
      },
    ]);
    expect(orders[0]).toMatchObject({
      id: 'posguestorder_counter',
      workspace_id: null,
      pay_method: 'counter',
      prepaid: false,
    });
    expect(orders[1]).toMatchObject({
      id: 'posguestorder_other',
      workspace_id: 'ws_2',
      pay_method: null,
    });
    expect(pendingGuestOrders(orders).map((row) => row.id)).toEqual([
      'posguestorder_counter',
      'posguestorder_other',
    ]);
  });

  it('filters pending and recent prepaid accepted orders while excluding awaiting_payment', () => {
    const now = Date.parse('2026-11-18T03:30:00Z');
    const orders = normalizeGuestOrders([
      {
        id: 'wait_qr',
        status: 'awaiting_payment',
        prepaid: false,
        pay_method: 'vietqr',
        created_at: '2026-11-18T03:29:00Z',
      },
      {
        id: 'pending_counter',
        workspace_id: null,
        status: 'pending',
        pay_method: 'counter',
        created_at: '2026-11-18T03:28:00Z',
      },
      {
        id: 'paid_recent',
        status: 'accepted',
        automatic: true,
        prepaid: true,
        pay_method: 'vietqr',
        decided_at: '2026-11-18T03:20:00Z',
        created_at: '2026-11-18T03:19:00Z',
      },
      {
        id: 'paid_old',
        status: 'accepted',
        automatic: true,
        prepaid: true,
        pay_method: 'vietqr',
        decided_at: new Date(now - RECENT_PREPAID_WINDOW_MS - 1000).toISOString(),
        created_at: '2026-11-18T02:00:00Z',
      },
      {
        id: 'accepted_unpaid',
        status: 'accepted',
        automatic: false,
        prepaid: false,
        decided_at: '2026-11-18T03:25:00Z',
        created_at: '2026-11-18T03:24:00Z',
      },
    ]);

    expect(pendingGuestOrders(orders).map((row) => row.id)).toEqual(['pending_counter']);
    expect(recentPrepaidOrders(orders, now).map((row) => row.id)).toEqual(['paid_recent']);
    expect(recentPrepaidOrders(orders, now, new Set(['paid_recent']))).toEqual([]);
  });
});
