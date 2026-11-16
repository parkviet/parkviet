---
name: kitchen-send-requires-editing
description: Kitchen send is refused once an order is completed (except lease-free table orders); any client flow that completes an order on a `manual` kitchen_send_trigger branch must gate on pendingKitchenUnits first
metadata:
  type: project
---

`Kitchen::Send.command` goes through `Deliveries::Assign.validate_editing!`, which raises unless `operational_status == 'editing'` (lease-free table orders and tabs go through `AppendItems.validate_append!`, which also accepts `parked`). Only `on_complete` branches get an automatic send inside `Workspaces::Complete`. So on a branch with `kitchen_send_trigger: manual`, completing an order with unsent dishes means the kitchen is never told.

**Why:** found in the 2026-11-14 quick-counter review: F1 cash completed and cleared the ticket without the `unsent > 0` guard that `table-service/payment-screen.tsx` has.

**How to apply:** when reviewing any one-tap / shortcut payment path in apps/pos, check it refuses or sends first when `kitchenOn && pendingKitchenUnits(active) > 0`. Related: [[table-orders-outside-register-list]].
