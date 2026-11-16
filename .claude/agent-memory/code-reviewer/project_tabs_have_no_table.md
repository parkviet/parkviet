---
name: tabs-have-no-table
description: Server bar tabs (service_mode tab) never carry a resource, so table-only signals (payment requests, table name) can never appear on a tab; e2e fixtures can fake it
metadata:
  type: project
---

`Tabs::Open` creates tabs without a resource; `Tables::Open` only allows `dine_in`/`timed`; `Tables::Move` and `Tables::RequestPayment` refuse orders with `resource_id nil`. So a real tab never has a table and can never have an open `PaymentRequest`. VIP table orders at a bar are `dine_in`, not tabs, and are absent from `/pos/workspaces?service_mode=tab`.

**Why:** found in the 2026-11-14 bar-tab review: the tab column's green "asked for the bill" row and table name were proven only by an e2e fixture (`apps/pos/e2e/support/retail-api.ts`) that serializes a sheet with both `tabName` and `table` as `service_mode: 'tab'`, and a server spec that calls `PaymentRequest.create!` directly.

**How to apply:** when a tab feature depends on a table or a payment request, check a server path actually produces that state; distrust fixtures combining `tabName` and `table`. Related: [[table-orders-outside-register-list]].
