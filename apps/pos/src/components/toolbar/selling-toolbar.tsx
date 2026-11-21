import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dashboardPages } from '../../lib/dashboard-pages';
import type { PosContext } from '../../lib/pos-context';
import { posDashboardUrl } from '../../lib/pos-dashboard-url';
import { savedToolbarCollapsed, saveToolbarCollapsed } from '../../lib/selling-toolbar';
import { PosIcon } from '../pos-icon';
import { PrinterPopover } from './printer-popover';
import { QuickSettingsPopover } from './quick-settings-popover';
import { ToolbarPopover } from './toolbar-popover';

type PopoverId = 'help' | 'printer' | 'quick';

// The shortcuts the selling screens really bind.
const SHORTCUTS: readonly { keys: string; label: string }[] = [
  { keys: '/', label: 'toolbarHelpSearchTiles' },
  { keys: 'F2', label: 'toolbarHelpSearchCatalog' },
  { keys: 'F1', label: 'toolbarHelpPayCash' },
  { keys: 'F2', label: 'toolbarHelpPayQr' },
  { keys: 'F3', label: 'toolbarHelpPayOther' },
  { keys: 'Esc', label: 'toolbarHelpClose' },
];

// The tools of the selling screen, kept at the right of the header: help, the
// customer display, the printer and the quick settings of this device. The
// toolbar folds to its « button, and stays folded on this device.
export function SellingToolbar({
  data,
  branchId,
  registerId,
  onCalibrate,
}: {
  data: PosContext | undefined;
  branchId: string | null;
  registerId: string | null | undefined;
  onCalibrate: () => void;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(savedToolbarCollapsed);
  const [openId, setOpenId] = useState<PopoverId | null>(null);
  const toggle = (id: PopoverId) => (open: boolean) => setOpenId(open ? id : null);

  // The branch settings open in a new tab, listed only for staff who may open them.
  const settingsPage = dashboardPages(data, branchId).find(
    (page) => page.key === 'settings' || page.key === 'branch-features',
  );
  const settingsUrl = settingsPage
    ? posDashboardUrl(data?.store.id, settingsPage.path, branchId)
    : null;

  return (
    <section className="selling-toolbar" data-collapsed={collapsed} aria-label={t('toolbarLabel')}>
      <button
        type="button"
        className="toolbar-fold"
        aria-expanded={!collapsed}
        aria-label={t(collapsed ? 'toolbarExpand' : 'toolbarCollapse')}
        title={t(collapsed ? 'toolbarExpand' : 'toolbarCollapse')}
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          saveToolbarCollapsed(next);
          setOpenId(null);
        }}
      >
        <PosIcon name="collapse" />
      </button>
      {collapsed ? null : (
        <>
          <ToolbarPopover
            icon="help"
            label={t('toolbarHelp')}
            title={t('toolbarHelpTitle')}
            open={openId === 'help'}
            onOpenChange={toggle('help')}
          >
            <ul className="toolbar-shortcuts">
              {SHORTCUTS.map((shortcut) => (
                <li key={shortcut.label}>
                  <kbd>{shortcut.keys}</kbd>
                  <span>{t(shortcut.label)}</span>
                </li>
              ))}
            </ul>
          </ToolbarPopover>
          {/* The customer display pairs with a code from the order screen, so it opens in its own tab. */}
          <a
            className="toolbar-button"
            href={`${import.meta.env.BASE_URL}display`}
            target="_blank"
            rel="noopener"
          >
            <PosIcon name="monitor" />
            <span className="toolbar-button-label">{t('toolbarCustomerDisplay')}</span>
          </a>
          <PrinterPopover
            data={data}
            branchId={branchId}
            settingsUrl={settingsUrl}
            open={openId === 'printer'}
            onOpenChange={toggle('printer')}
          />
          <QuickSettingsPopover
            data={data}
            registerId={registerId}
            settingsUrl={settingsUrl}
            open={openId === 'quick'}
            onOpenChange={toggle('quick')}
            onCalibrate={onCalibrate}
          />
        </>
      )}
    </section>
  );
}
