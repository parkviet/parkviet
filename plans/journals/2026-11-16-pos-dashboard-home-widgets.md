# 2026-11-16: POS dashboard home becomes a widget overview

Plan: `plans/261116-0856-pos-dashboard-home-widgets/plan.md`. Commits dc18a1a, 49196c1, ecc02e1, 5d56a04, 14214d0.

## What landed
- Home page renamed "Tổng quan": `react-grid-layout` 2.3 grid, 12 columns, edit mode (hide, drag grip, resize, reset, cancel, confirm), add-widget sheet, one column under 480px of content width.
- `GET /pos/overview` reuses `Reports::Sales`, the order list status rules and the stock alert board, so numbers and access match the reports. It accepts only date filters, so the previous period always matches the current one.
- `spree_pos_dashboard_layouts` + `GET/PUT/DELETE /pos/dashboard_layout`, one layout per store and admin user; widget names are checked by shape, not a fixed list.
- Charts use `recharts` 3.10.1, the same copy `@spree/dashboard-ui` ships.

## Decisions worth remembering
- Customer visits = distinct registered customers + every walk-in order. Daily counts do not add up to the period total.
- While editing, a drag onto another widget pushes it down and the grid floats widgets back up; widgets hidden at a branch are static items, so they keep their slot. View mode packs visible widgets upward for display only. Refusing collisions was tried first and froze the dragged widget on a full board: the grid redraws an item only when its cell changes.
- A tab change on the default layout stays in memory, so users on the default keep following future default changes.
- Previous period = the same number of days just before, labelled as such.

## Friction
- Playwright refuses to reuse the developer's dev server on 5176; agents used a temporary `reuseExistingServer` config and deleted it.
- Migrating the test database has no CLI command; `pnpm spree exec sh -c 'RAILS_ENV=test bin/rails db:migrate'` was used, and the schema dump again broke `where: "active = true"` into `where: "ctiv"`, fixed by hand.
- The regenerated staff API client also carried model changes from earlier contract edits that had never been regenerated.

## Deferred
Order statuses "chờ xác nhận" / "đang xử lý"; "Bán theo sản phẩm" and "Bán theo khách" reports (links point to Doanh số for now); a check of the page with real branch data.
