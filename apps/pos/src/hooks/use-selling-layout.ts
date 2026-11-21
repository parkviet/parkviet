import {
  allowedPresets,
  clampSplit,
  defaultPreset,
  presetLayout,
  resolveSellingLayout,
  type SavedSellingLayout,
  type SellingLayout,
  type SellingPreset,
  type SellingTiles,
} from '@parkviet/pos-shared/selling-layout';
import { useState } from 'react';
import { usePosSelection } from '../components/pos-selection';
import { usePreferencesChanged } from '../lib/device-preferences';
import { chosenMenuDensity, saveMenuDensity } from '../lib/menu-density';
import {
  densityOfTiles,
  savedSellingLayout,
  saveSellingLayout,
  tilesOfDensity,
} from '../lib/selling-layout';

export type SellingLayoutControl = {
  // What the selling screen lays out now: the device's choice, else the
  // branch's default, else what the modules point at. Tiles follow the
  // device's menu density.
  layout: SellingLayout;
  // The device has its own choice for this branch (not following the default).
  chosen: boolean;
  // The sample the branch opens with when the device has chosen nothing.
  branchDefault: SellingPreset;
  allowed: readonly SellingPreset[];
  // Starts from another sample screen: its options replace the device's.
  choosePreset: (preset: SellingPreset) => void;
  // Changes some options of the layout shown, keeping the rest.
  change: (patch: Partial<Omit<SellingLayout, 'preset'>>) => void;
  // Back to the starting options of the sample in use.
  resetToPreset: () => void;
  // Forgets the device's choice: the branch default applies again.
  useBranchDefault: () => void;
  // One of the two shares back to its sample's value.
  resetShare: (key: 'split' | 'paySplit') => void;
};

// The selling layout of this device at the selected branch, kept in
// localStorage like the other device settings. Every screen showing it
// re-reads it when a setting is written, here or in another tab.
export function useSellingLayout(): SellingLayoutControl {
  const { context, selection } = usePosSelection();
  const branchId = selection.branchId;
  const [, setVersion] = useState(0);
  usePreferencesChanged(() => setVersion((version) => version + 1));

  const data = context.data;
  const saved = savedSellingLayout(branchId);
  const resolved = resolveSellingLayout(data, saved);
  const density = chosenMenuDensity();
  const layout: SellingLayout = {
    ...resolved,
    tiles: density ? tilesOfDensity(density) : resolved.tiles,
  };
  const allowed = allowedPresets(data);

  // The device's choice as stored: the layout shown, without its tiles.
  const stored = (): SavedSellingLayout => ({
    preset: layout.preset,
    side: layout.side,
    pay: layout.pay,
    split: layout.split,
    paySplit: layout.paySplit,
  });

  function setTiles(tiles: SellingTiles) {
    saveMenuDensity(densityOfTiles(tiles));
  }

  return {
    layout,
    chosen: saved !== null && allowed.includes(saved.preset),
    branchDefault: defaultPreset(data),
    allowed,
    choosePreset(preset) {
      if (!allowed.includes(preset)) return;
      const next = presetLayout(preset);
      saveSellingLayout(branchId, {
        preset,
        side: next.side,
        pay: next.pay,
        split: next.split,
        paySplit: next.paySplit,
      });
      setTiles(next.tiles);
    },
    change(patch) {
      const { tiles, ...rest } = patch;
      const next = { ...stored(), ...rest };
      saveSellingLayout(branchId, {
        ...next,
        split: clampSplit(next.split),
        paySplit: clampSplit(next.paySplit),
      });
      if (tiles) setTiles(tiles);
    },
    resetToPreset() {
      const base = presetLayout(layout.preset);
      saveSellingLayout(branchId, {
        preset: base.preset,
        side: base.side,
        pay: base.pay,
        split: base.split,
        paySplit: base.paySplit,
      });
      setTiles(base.tiles);
    },
    useBranchDefault() {
      saveSellingLayout(branchId, null);
      setTiles(presetLayout(defaultPreset(data)).tiles);
    },
    resetShare(key) {
      saveSellingLayout(branchId, { ...stored(), [key]: presetLayout(layout.preset)[key] });
    },
  };
}
