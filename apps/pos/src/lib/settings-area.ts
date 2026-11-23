// Some /settings URLs belong to the main Thiết lập sidebar instead of the
// settings rail. The shell pads those with its own container, while the
// settings layout pads rail pages with `SettingsContainer`. Both sides read
// this predicate so a page gets the padding exactly once — never twice,
// never not at all.
export function isSettingsRailPath(pathname: string) {
  return (
    pathname.includes('/settings') &&
    !pathname.includes('/settings/receipt-templates') &&
    !pathname.includes('/settings/store-info') &&
    !pathname.includes('/settings/tax-info') &&
    !pathname.includes('/settings/stores') &&
    !pathname.endsWith('/settings/tax')
  )
}
