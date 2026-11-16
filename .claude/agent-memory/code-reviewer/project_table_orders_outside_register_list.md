---
name: table-orders-outside-register-list
description: Table orders live on the branch's table register, so they are often absent from the selected register's /pos/workspaces list; the hook's visible[0] fallback then picks an unrelated order
metadata:
  type: project
---

Table orders are booked on the branch's table register, which may differ from the register the cashier selected. `useWorkspaces` lists `/pos/workspaces?register_id=<selected>`, so those orders only reach `rows` via `pinned` (detail of `activeId`). `useSellingWorkspace` falls back to `visible[0]` and `useWorkspaces.detailId` falls back to the first list row, so any frame that assumes "active = the order I picked" can briefly or permanently act on another order.

**Why:** found in the 2026-11-13 table-service layout review (auto VietQR could be prepared on the wrong order; lease auto-claim on an unrelated draft).

**How to apply:** when reviewing anything in apps/pos that acts on `selling.active` automatically (auto tenders, auto claims, URL-driven frames), check that it verifies `active.id === activeId` and does not rely on the counter's fallback.
