import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  isHexColor,
  lowestVariantPrice,
  RAIL_PREVIEW_LIMIT,
  resolveSectionItems,
  sortItems,
} from '../lib/emenu';
import { formatMoney } from '../lib/money';
import type { GuestItem, GuestMenu } from '../lib/types';

// The menu by category; a sold-out dish stays listed but cannot be opened.
export function MenuScreen({
  menu,
  onPick,
}: {
  menu: GuestMenu;
  onPick: (item: GuestItem) => void;
}) {
  const { t, i18n } = useTranslation();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const categories = [...menu.categories].sort((a, b) => a.position - b.position);
  const needle = query.trim().toLocaleLowerCase(i18n.language);
  const isHome = needle === '' && categoryId === null;
  const banners = menu.sections?.banner ?? [];
  const bestSellers = resolveSectionItems(menu.items, menu.sections?.best_sellers);
  const newItems = resolveSectionItems(menu.items, menu.sections?.new_items);
  const items = sortItems(menu.items, categories, categoryId).filter(
    (item) => !needle || item.name.toLocaleLowerCase(i18n.language).includes(needle),
  );
  const showExploreHeading =
    needle === '' &&
    (categories.length > 1 || banners.length > 0 || bestSellers.length > 0 || newItems.length > 0);

  if (menu.items.length === 0) return <p className="muted">{t('menuEmpty')}</p>;

  return (
    <section aria-label={t('tabMenu')}>
      <input
        className="search"
        type="search"
        value={query}
        placeholder={t('search')}
        aria-label={t('search')}
        onChange={(event) => setQuery(event.target.value)}
      />
      {isHome && banners.length > 0 ? (
        <ul className="banner-list" data-testid="banners">
          {banners.map((banner) => (
            <li key={banner.id}>{banner.name}</li>
          ))}
        </ul>
      ) : null}
      {isHome ? (
        <>
          <ItemRail
            title={t('bestSellers')}
            testId="best-sellers"
            items={bestSellers}
            currency={menu.currency}
            language={i18n.language}
            onPick={onPick}
          />
          <ItemRail
            title={t('newItems')}
            testId="new-items"
            items={newItems}
            currency={menu.currency}
            language={i18n.language}
            onPick={onPick}
          />
        </>
      ) : null}
      {showExploreHeading ? <h2>{t('exploreCategories')}</h2> : null}
      {categories.length > 1 ? (
        <nav className="chips" aria-label={t('exploreCategories')}>
          <button
            type="button"
            className="chip"
            aria-pressed={categoryId === null}
            onClick={() => setCategoryId(null)}
          >
            {t('allCategories')}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="chip"
              aria-pressed={categoryId === category.id}
              onClick={() => setCategoryId(category.id)}
            >
              {category.image_url ? (
                <img
                  className="chip-thumb"
                  src={category.image_url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : isHexColor(category.color) ? (
                <span
                  className="chip-dot"
                  style={{ backgroundColor: category.color }}
                  aria-hidden="true"
                />
              ) : null}
              <span>{category.name}</span>
            </button>
          ))}
        </nav>
      ) : null}
      <ul className="menu-items">
        {items.map((item) => (
          <li key={`${item.category_ids[0] ?? 'none'}-${item.id}`}>
            <button
              type="button"
              className="menu-item"
              disabled={item.sold_out}
              data-testid={`menu-item-${item.id}`}
              onClick={() => onPick(item)}
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : null}
              <span className="menu-item-text">
                <strong>{item.name}</strong>
                {item.components.length > 0 ? (
                  <small>
                    {t('combo', {
                      items: item.components
                        .map((part) => `${part.quantity} ${part.name}`)
                        .join(', '),
                    })}
                  </small>
                ) : null}
                <span className="price">
                  {item.sold_out
                    ? t('soldOut')
                    : formatMoney(lowestVariantPrice(item), menu.currency, i18n.language)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemRail({
  title,
  testId,
  items,
  currency,
  language,
  onPick,
}: {
  title: string;
  testId: string;
  items: GuestItem[];
  currency: string;
  language: string;
  onPick: (item: GuestItem) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const canExpand = items.length > RAIL_PREVIEW_LIMIT;
  const visible = expanded ? items : items.slice(0, RAIL_PREVIEW_LIMIT);

  return (
    <section className="rail-section" data-testid={testId}>
      <div className="rail-head">
        <h2>{title}</h2>
        {canExpand ? (
          <button type="button" className="link" onClick={() => setExpanded((value) => !value)}>
            {t(expanded ? 'showLess' : 'seeAll')}
          </button>
        ) : null}
      </div>
      <ul className={expanded ? 'rail-list expanded' : 'rail-list'}>
        {visible.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="rail-card"
              disabled={item.sold_out}
              onClick={() => onPick(item)}
            >
              {item.image_url ? (
                <img src={item.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : null}
              <strong className="rail-name">{item.name}</strong>
              <span className="price">
                {item.sold_out
                  ? t('soldOut')
                  : formatMoney(lowestVariantPrice(item), currency, language)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
