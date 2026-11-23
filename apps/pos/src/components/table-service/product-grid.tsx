import { formatMoney } from '@parkviet/pos-shared/money';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMenuDensity } from '../../hooks/use-selling-layout';
import { usePreferencesChanged } from '../../lib/device-preferences';
import {
  MENU_DENSITIES,
  type MenuDensity,
  savedMenuImages,
  saveMenuDensity,
} from '../../lib/menu-density';
import { addsInOneTap, visibleItems } from '../../lib/menu-selection';
import type { PosMenu, PosMenuProduct } from '../../lib/pos-context';
import { popupOpen, typingTarget } from '../menu-grid';
import { PosIcon } from '../pos-icon';

const DENSITY_LABELS: Record<MenuDensity, string> = {
  airy: 'menuDensityAiry',
  regular: 'menuDensityRegular',
  dense: 'menuDensityDense',
};

// The products of the order screen as tiles: the search box (`/` jumps to
// it) and the density of this device, and per product its picture area when
// this device shows pictures (the picture, or a plain placeholder), its
// code when it has exactly one, its price, how many the open order already
// has, and a dimmed "sold out".
export function ProductGrid({
  menu,
  categoryId,
  quantities,
  disabled,
  disabledReason,
  canSetSoldOut,
  imagesByDefault = false,
  onPick,
  onToggleSoldOut,
}: {
  menu: PosMenu;
  // Search looks through every category.
  categoryId: string | null;
  // Units of each product (by product id) on the open order.
  quantities: ReadonlyMap<string, number>;
  disabled: boolean;
  disabledReason?: string;
  canSetSoldOut: boolean;
  // Pictures until this device says otherwise (the quick counter shows them).
  imagesByDefault?: boolean;
  onPick: (item: PosMenuProduct) => void;
  onToggleSoldOut: (item: PosMenuProduct) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const density = useMenuDensity();
  const [images, setImages] = useState(() => savedMenuImages(imagesByDefault));
  // The toolbar's quick settings change the same two choices (the density
  // here too); whether pictures show is set there only.
  usePreferencesChanged(() => {
    setImages(savedMenuImages(imagesByDefault));
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const items = visibleItems(menu, query.trim() ? null : categoryId, query);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (typingTarget(event.target) || popupOpen()) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="menu-item-area">
      <div className="menu-item-top">
        <div className="search-input-wrap menu-item-search">
          <PosIcon name="search" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            aria-label={t('menuSearchDish')}
            placeholder={t('menuSearchDish')}
            aria-keyshortcuts="/"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
                return;
              }
              if (event.key !== 'Enter') return;
              event.preventDefault();
              const only = items.length === 1 ? items[0] : undefined;
              if (only && !disabled) onPick(only);
            }}
          />
          <kbd>/</kbd>
        </div>
        <fieldset className="menu-density">
          <legend className="visually-hidden">{t('menuDensity')}</legend>
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
      </div>
      {disabled && disabledReason ? (
        <p className="muted" role="status">
          {disabledReason}
        </p>
      ) : null}
      {items.length === 0 ? <p className="muted menu-item-empty">{t('menuEmpty')}</p> : null}
      <ul
        className="menu-items"
        data-density={density}
        data-images={images}
        aria-label={t('menuTitle')}
      >
        {items.map((item) => {
          const price = item.variants.map((variant) => variant.price).find((row) => row !== null);
          // A time-of-day menu prices this dish now.
          const scheduled = item.variants.find(
            (variant) => variant.schedule_id && variant.price !== variant.list_price,
          );
          const quantity = quantities.get(item.product_id) ?? 0;
          // One code only when the product has a single variant: another
          // variant's code would be a wrong label for the tile.
          const sku = item.variants.length === 1 ? item.variants[0]?.sku?.trim() : undefined;
          return (
            <li key={item.product_id} className="menu-item" data-sold-out={item.sold_out}>
              <button
                type="button"
                className="menu-item-pick"
                disabled={disabled || item.sold_out}
                title={item.sold_out ? t('menuSoldOut') : disabledReason}
                aria-label={item.sold_out ? `${item.name} · ${t('menuSoldOutTile')}` : item.name}
                aria-description={quantity > 0 ? t('menuInOrder', { count: quantity }) : undefined}
                onClick={() => onPick(item)}
              >
                {images ? (
                  <span className="menu-item-media">
                    {item.image_url ? (
                      <img className="menu-item-image" src={item.image_url} alt="" loading="lazy" />
                    ) : (
                      <span className="menu-item-placeholder" aria-hidden="true">
                        {item.name.trim().slice(0, 1)}
                      </span>
                    )}
                    {item.sold_out ? (
                      <span className="menu-item-chip" data-tone="out">
                        {t('menuSoldOutShort')}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <strong className="menu-item-name">{item.name}</strong>
                {sku || images ? <span className="menu-item-sku">{sku}</span> : null}
                <span className="menu-item-price">
                  {item.sold_out
                    ? t('menuSoldOutTile')
                    : `${price ? formatMoney(price, menu.currency) : '—'}${item.variants.length > 1 ? '+' : ''}`}
                  {scheduled && !item.sold_out ? (
                    <small className="menu-item-schedule">
                      {scheduled.price_label || t('menuScheduledPrice')}
                    </small>
                  ) : null}
                </span>
                {!item.sold_out && !addsInOneTap(menu, item) ? (
                  <small className="menu-item-options">{t('menuHasOptions')}</small>
                ) : null}
              </button>
              {quantity > 0 ? (
                <span className="menu-item-quantity" aria-hidden="true">
                  {quantity}
                </span>
              ) : null}
              {canSetSoldOut ? (
                <button
                  type="button"
                  className="menu-item-sold-out-toggle"
                  aria-label={`${t(item.sold_out ? 'menuBackOnSale' : 'menuMarkSoldOut')}: ${item.name}`}
                  onClick={() => onToggleSoldOut(item)}
                >
                  {t(item.sold_out ? 'menuBackOnSale' : 'menuMarkSoldOut')}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
