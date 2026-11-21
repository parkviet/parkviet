import {
  type PosTableSurface,
  sellingLayoutOf,
  TABLE_SURFACES,
  tableSurfaceOf,
} from '@parkviet/pos-shared/pos-modules';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenuDensity } from '../../hooks/use-selling-layout';
import { usePreferencesChanged } from '../../lib/device-preferences';
import {
  MENU_DENSITIES,
  type MenuDensity,
  savedMenuImages,
  saveMenuDensity,
  saveMenuImages,
} from '../../lib/menu-density';
import type { PosContext } from '../../lib/pos-context';
import { scanSoundsEnabled, setScanSounds } from '../../lib/scan-sounds';
import { savedTableSurface, saveTableSurface } from '../../lib/tables';
import { TIMED_MODULE } from '../../lib/timed-clock';
import { ToolbarPopover } from './toolbar-popover';

const DENSITY_LABELS: Record<MenuDensity, string> = {
  airy: 'menuDensityAiry',
  regular: 'menuDensityRegular',
  dense: 'menuDensityDense',
};

// The choices this device keeps for itself, in one place. Each one is the same
// stored setting the screens read, so a change shows at once (see
// device-preferences). A choice is offered only where it has an effect.
export function QuickSettingsPopover({
  data,
  registerId,
  settingsUrl,
  open,
  onOpenChange,
  onCalibrate,
}: {
  data: PosContext | undefined;
  registerId: string | null | undefined;
  // The branch settings of the POS dashboard, when this person may open them.
  settingsUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCalibrate: () => void;
}) {
  const { t } = useTranslation();
  const menuTiles = data?.modules?.['fnb.menu'] === true;
  // The quick counter shows pictures until this device says otherwise.
  const imagesByDefault = data ? sellingLayoutOf(data) === 'quick_counter' : false;
  const density = useMenuDensity();
  const [images, setImages] = useState(() => savedMenuImages(imagesByDefault));
  const [sounds, setSounds] = useState(() => scanSoundsEnabled());
  const [savedSurface, setSavedSurface] = useState(() => savedTableSurface());
  usePreferencesChanged(() => {
    setImages(savedMenuImages(imagesByDefault));
    setSounds(scanSoundsEnabled());
    setSavedSurface(savedTableSurface());
  });
  const timedOn = data?.modules?.[TIMED_MODULE] === true;
  const surface = data ? tableSurfaceOf(data, savedSurface) : null;
  const surfaces = TABLE_SURFACES.filter((value) => value !== 'resource_board' || timedOn);
  const staffed = Boolean(data && data.capabilities.length > 0);

  return (
    <ToolbarPopover
      icon="settings"
      label={t('toolbarQuickSettings')}
      title={t('toolbarQuickSettingsTitle')}
      open={open}
      onOpenChange={onOpenChange}
    >
      {menuTiles ? (
        <>
          <fieldset className="toolbar-segment">
            <legend>{t('menuDensity')}</legend>
            {MENU_DENSITIES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={density === value}
                onClick={() => {
                  saveMenuDensity(value);
                }}
              >
                {t(DENSITY_LABELS[value])}
              </button>
            ))}
          </fieldset>
          <label className="toolbar-switch">
            <input
              type="checkbox"
              checked={images}
              onChange={(event) => {
                setImages(event.target.checked);
                saveMenuImages(event.target.checked);
              }}
            />
            <span>{t('menuImages')}</span>
          </label>
        </>
      ) : null}
      {surface ? (
        <fieldset className="toolbar-segment">
          <legend>{t('tableSurface')}</legend>
          {surfaces.map((value: PosTableSurface) => (
            <button
              key={value}
              type="button"
              aria-pressed={surface === value}
              onClick={() => {
                setSavedSurface(value);
                saveTableSurface(value);
              }}
            >
              {t(`tableSurface_${value}`)}
            </button>
          ))}
        </fieldset>
      ) : null}
      <label className="toolbar-switch">
        <input
          type="checkbox"
          checked={sounds}
          onChange={(event) => {
            setSounds(event.target.checked);
            setScanSounds(event.target.checked);
          }}
        />
        <span>{t('toolbarQuickScanSounds')}</span>
      </label>
      {staffed && registerId ? (
        <button
          type="button"
          className="toolbar-link"
          onClick={() => {
            onOpenChange(false);
            onCalibrate();
          }}
        >
          {t('scannerCalibrationOpen')}
        </button>
      ) : null}
      {settingsUrl ? (
        <a
          className="toolbar-link"
          href={settingsUrl}
          target="_blank"
          rel="noopener"
          onClick={() => onOpenChange(false)}
        >
          {t('toolbarQuickBranchSettings')}
        </a>
      ) : null}
      <p className="muted toolbar-note">{t('toolbarQuickDeviceNote')}</p>
    </ToolbarPopover>
  );
}
