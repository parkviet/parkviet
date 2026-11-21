# POS selling app

This Vite + React app is the counter. It covers counter work only:

- selling (`/`), returns and exchanges (`/returns`), receipt reprint and lookup
  (`/receipts`) and the customer display (`/display`, no staff session);
- the cashier's own shift (`/shifts`): open it, request cash in/out, withdraw
  their own requests and close it with a blind count;
- collecting a debt payment into the cashier's open shift (`/collect`).

Back office lives in the POS dashboard (`apps/pos-dashboard`): orders,
deliveries, funds and payment attention, other people's shifts and cash request
confirmation, closures and late cash, receivables and reminders, credit
accounts and approvals, inventory traceability, reports and every setting. Do
not add those screens here. The account menu's "Quản trị" group links to them
(`src/lib/dashboard-pages.ts`, built with `posDashboardUrl` from
`src/lib/pos-dashboard-url.ts`), opening in a new tab and listed only for staff
with the capabilities the page needs. Counter screens that point at back-office
work link to the dashboard the same way.

Pure POS logic shared with the dashboard belongs in `packages/pos-shared`.
Modules in `src/lib` that only re-export it stay while this app imports them.

## Run and verify

Run the API through `pnpm spree dev --no-open` from the repository root. In this
directory: `pnpm dev` (port 5175), `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm test:e2e` (Playwright with mocked API routes; the real-API runs are
opt-in, see `e2e/support/live.ts`).

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
- Every resizable split stays between 1/3 and 2/3 and snaps to 1/3, 1/2 and 2/3
  within 0.02, by drag or by keyboard on the divider.
- F9 pays the order in whichever way the layout pays. Toolbar popovers list only
  settings that exist and apply at the branch: never add a control that does
  nothing.
- Covered by `e2e/selling-layout.spec.ts` and `e2e/selling-toolbar.spec.ts`.
