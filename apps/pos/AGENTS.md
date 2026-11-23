# Unified POS app

This Vite + React app combines POS administration (back office) and the selling
counter in a single SPA (strict port `5175` in dev; mounted at `/pos` in
production via `VITE_BASE_PATH=/pos/`):

- **Administration (`/$storeId/...`)**: built on `@spree/dashboard-core`,
  `@spree/dashboard-ui` and Tailwind CSS v4. Covers overview widgets, orders,
  goods, kitchen, deliveries, funds, shifts, receivables, reports, inventory,
  branches and settings inside `AppShell`.
- **Counter (`/$storeId/sell`, alias `/pos` and `/sell`)**: full-screen
  `PosShell` (wrapped in `.pos-app` so `src/counter/styles.css` never collides
  with Tailwind) covering selling (`/$storeId/sell`), returns/exchanges
  (`/$storeId/sell/returns`), receipts (`/$storeId/sell/receipts`), the
  cashier's shift (`/$storeId/sell/shifts`), debt collection
  (`/$storeId/sell/collect`), reservations, bottle-keeps, meal accounts,
  stored value, vehicle visits, tips and offline review, plus unauthenticated
  `/offline` and `/display`.
- **Shared POS logic (`src/shared/`, alias `@shared/*`)**: React-free domain
  modules (money, receipt templates, product labels, print commands, modules,
  features, locales, types).

## Run and verify

Run the API through `pnpm spree dev --no-open` from the repository root. In this
directory: `pnpm dev` (port 5175), `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm build`, `pnpm test:e2e` (Playwright specs under `e2e/admin/` and
`e2e/counter/`).

## Selling layout

The selling screen opens as one of four sample screens (`tables_first`, `quick`,
`one_step`, `big_menu`) plus options on top: the catalogue side, how payment is
shown (`popup`, `slide`, `below`, `column`) and the catalogue/payment splits.
Pure rules (presets, `clampSplit`, which preset a branch may use) are in
`packages/pos-shared/src/selling-layout.ts`; the frame is
`src/components/selling-layout/`.

- A sample is only a starting set of options. The base screen still comes from
  the branch's modules, and `tables_first` is locked unless the branch runs
  `fnb.tables`.
- The layout is per device and branch, in localStorage under
  `parkviet-pos:selling-layout:<branchId>` (`src/lib/selling-layout.ts`). A device
  that chose nothing starts from the branch's `selling_preset` in the context
  (set in the dashboard Features tab), else the one its modules point at. Tile
  size is not stored there; it is the device's menu density.
- Every resizable split stays between 1/5 and 4/5 and snaps to 1/5, 1/3, 1/2,
  2/3 and 4/5 within 0.02, by drag or by keyboard on the divider.
- The `classic` sample (catalogue over the order, payment in a full-height
  column on the right) is a device choice only; a branch default is one of
  `BRANCH_PRESETS`.
- The layout's `foot` is `full` (the bill above the buttons) or `compact`
  (`selling-layout/compact-order-foot.tsx`: chips for the order's extras, which
  a device hides under the cog in `parkviet-pos:order-foot-hidden`, and one bar
  with the total and the buttons). Chips open the editors the ticket already has.
- On screens 1100px and wider the counter's order tabs and new-order button sit
  in the header (`header-slot.tsx`); on a tablet or phone they keep their own
  row.
- F9 pays the order in whichever way the layout pays. Toolbar popovers list only
  settings that exist and apply at the branch: never add a control that does
  nothing.
- Covered by `e2e/selling-layout.spec.ts` and `e2e/selling-toolbar.spec.ts`.
