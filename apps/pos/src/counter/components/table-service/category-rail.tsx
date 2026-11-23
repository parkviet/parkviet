import { categoriesWithProducts, productsInCategory } from '@shared/pos-menu';
import { useTranslation } from 'react-i18next';
import type { PosMenu } from '../../lib/pos-context';

// The menu's categories down the left edge, "All" first: every category
// with a product attached directly, and how many products each holds. A
// product without a category shows under "All" only.
export function CategoryRail({
  menu,
  value,
  onChange,
}: {
  menu: PosMenu;
  value: string | null;
  onChange: (categoryId: string | null) => void;
}) {
  const { t } = useTranslation();
  const rows = [
    { id: null, name: t('menuAll'), count: menu.items.length },
    ...categoriesWithProducts(menu.categories, menu.items).map((category) => ({
      id: category.id,
      name: category.name,
      count: productsInCategory(menu.items, category.id).length,
    })),
  ];
  return (
    <nav className="category-rail" aria-label={t('menuTabs')}>
      {rows.map((row) => (
        <button
          key={row.id ?? 'all'}
          type="button"
          aria-pressed={value === row.id}
          onClick={() => onChange(row.id)}
        >
          <span className="category-rail-name">{row.name}</span>
          <small>{t('menuDishCount', { count: row.count })}</small>
        </button>
      ))}
    </nav>
  );
}
