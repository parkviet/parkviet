import { formatMoney } from '@parkviet/pos-shared/money'
import { useTranslation } from 'react-i18next'
import { encode } from 'uqr'
import type { EmenuCategoryDraft, EmenuSettings } from '../hooks/use-emenu'

// What a dish looks like on the guest page: its name, the lowest price and
// a picture when the product has one, plus whether the counter sells it.
export type EmenuDish = {
  id: string
  name: string
  price: string | null
  image_url: string | null
  atCounter?: boolean
}

export type EmenuPreviewMode = 'phone' | 'sticker'

const HEX = /^#[0-9a-f]{6}$/i

// Black or white, whichever reads better on the colour.
export function readableOn(hex: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return '#ffffff'
  const value = Number.parseInt(match[1], 16)
  const channel = (shift: number) => {
    const c = ((value >> shift) & 255) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0)
  return luminance > 0.45 ? '#1d1d1f' : '#ffffff'
}

export function stickerWidthMm(settings: EmenuSettings) {
  return settings.sticker_size === 'custom'
    ? settings.sticker_custom_mm
    : Number(settings.sticker_size)
}

// The preview column: the guest page on a phone, or the printed table sticker.
export function EmenuPreview({
  mode,
  onMode,
  settings,
  menu,
  dishes,
  promotions,
  currency,
  sampleTable,
}: {
  mode: EmenuPreviewMode
  onMode: (mode: EmenuPreviewMode) => void
  settings: EmenuSettings
  menu: EmenuCategoryDraft[]
  dishes: Map<string, EmenuDish>
  promotions: Map<string, string>
  currency: string
  sampleTable?: string
}) {
  const { t } = useTranslation()
  return (
    <aside aria-label={t('emenu.preview')} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('emenu.preview')}</h3>
        <div role="tablist" className="flex rounded-full border p-0.5 text-xs">
          {(['phone', 'sticker'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`rounded-full px-3 py-1 ${mode === key ? 'bg-foreground text-background' : 'text-muted-foreground'}`}
              onClick={() => onMode(key)}
            >
              {t(key === 'phone' ? 'emenu.previewMenu' : 'emenu.previewSticker')}
            </button>
          ))}
        </div>
      </div>
      {mode === 'phone' ? (
        <PhonePreview
          settings={settings}
          menu={menu}
          dishes={dishes}
          promotions={promotions}
          currency={currency}
          sampleTable={sampleTable}
        />
      ) : (
        <StickerPreview settings={settings} sampleTable={sampleTable} />
      )}
    </aside>
  )
}

function PhonePreview({
  settings,
  menu,
  dishes,
  promotions,
  currency,
  sampleTable,
}: {
  settings: EmenuSettings
  menu: EmenuCategoryDraft[]
  dishes: Map<string, EmenuDish>
  promotions: Map<string, string>
  currency: string
  sampleTable?: string
}) {
  const { t } = useTranslation()
  const onBrand = readableOn(settings.brand_color)
  const onButton = readableOn(settings.button_color)
  const name = settings.store_name || t('emenu.previewStore')
  const tableLabel = sampleTable || t('emenu.previewTable')
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const dish = dishes.get(id)
      return dish ? [dish] : []
    })
  const best =
    settings.best_sellers_source === 'auto'
      ? pick(settings.best_sellers_auto_ids).slice(0, settings.best_sellers_limit)
      : pick(settings.best_seller_item_ids)
  const fresh = pick(settings.new_item_ids)
  const banners = settings.banner_promotion_ids.flatMap((id) => {
    const label = promotions.get(id)
    return label ? [{ id, label }] : []
  })
  const categories = menu.filter((category) => category.items.length > 0)
  const price = (dish: EmenuDish) => formatMoney(dish.price, currency)
  const cartDish = pick(categories[0]?.items ?? []).slice(0, 2)
  const cartTotal = cartDish.reduce((sum, dish) => sum + Number(dish.price ?? 0), 0)
  const paymentNote =
    settings.payment_timing === 'pay_before'
      ? t('emenu.previewPayBefore')
      : t('emenu.previewPayAfter')

  return (
    <div className="mx-auto w-[300px] rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-xl">
      <div
        className="relative h-[600px] overflow-hidden rounded-[1.9rem] bg-neutral-50"
        style={{ color: settings.text_color }}
        data-testid="emenu-phone"
      >
        <div className="absolute left-1/2 top-1.5 z-20 h-4 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
        {settings.paused ? (
          <div className="flex h-full flex-col">
            <header
              className="px-4 pb-4 pt-8"
              style={{ background: settings.brand_color, color: onBrand }}
            >
              <div className="flex items-center gap-3">
                {settings.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt=""
                    className="h-10 w-10 rounded-full bg-white object-cover"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-semibold"
                    aria-hidden
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="text-xs opacity-80">{tableLabel}</p>
                </div>
              </div>
            </header>
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-semibold text-neutral-900">{t('emenu.previewPaused')}</p>
              <p className="text-xs text-neutral-500">{t('emenu.previewPausedBody')}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-full overflow-y-auto pb-20">
              <header
                className="px-4 pb-4 pt-8"
                style={{ background: settings.brand_color, color: onBrand }}
              >
                <div className="flex items-center gap-3">
                  {settings.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt=""
                      className="h-10 w-10 rounded-full bg-white object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-base font-semibold"
                      aria-hidden
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="text-xs opacity-80">{tableLabel}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-full bg-white px-3 py-1.5 text-xs text-neutral-400">
                  {t('emenu.previewSearch')}
                </div>
              </header>
              <p className="px-4 pt-3 text-[11px] opacity-70">{paymentNote}</p>
              {settings.banner_enabled ? (
                <div className="px-4 pt-3">
                  {banners.length > 0 ? (
                    <div className="flex snap-x gap-2 overflow-x-auto">
                      {banners.map((banner) => (
                        <div
                          key={banner.id}
                          className="flex h-20 w-full shrink-0 snap-start items-end rounded-xl p-3 text-sm font-semibold"
                          style={{
                            background: `linear-gradient(135deg, ${settings.brand_color}, ${settings.button_color})`,
                            color: onBrand,
                          }}
                        >
                          {banner.label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Placeholder text={t('emenu.previewNoBanner')} />
                  )}
                </div>
              ) : null}
              {settings.best_sellers_enabled ? (
                <Rail
                  title={t('emenu.bestSellers')}
                  dishes={best}
                  price={price}
                  accent={settings.button_color}
                  empty={
                    settings.best_sellers_source === 'auto'
                      ? t('emenu.previewNoSales')
                      : t('emenu.previewPickItems')
                  }
                />
              ) : null}
              {settings.new_items_enabled ? (
                <Rail
                  title={t('emenu.newItems')}
                  dishes={fresh}
                  price={price}
                  accent={settings.button_color}
                  empty={t('emenu.previewPickItems')}
                />
              ) : null}
              {categories.length === 0 ? (
                <div className="px-4 pt-4">
                  <Placeholder text={t('emenu.previewEmptyMenu')} />
                </div>
              ) : (
                <>
                  <nav className="flex gap-2 overflow-x-auto px-4 pt-4 text-xs">
                    {categories.map((category, index) => {
                      const catColor = HEX.test(category.color) ? category.color : null
                      const activeBg = catColor ?? settings.button_color
                      return (
                        <span
                          key={category.id ?? `${category.name}-${index}`}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1"
                          style={
                            index === 0
                              ? {
                                  background: activeBg,
                                  borderColor: activeBg,
                                  color: readableOn(activeBg),
                                }
                              : {
                                  borderColor: catColor ?? '#e5e5e5',
                                  background: '#fff',
                                }
                          }
                        >
                          {category.image_url ? (
                            <img
                              src={category.image_url}
                              alt=""
                              className="h-4 w-4 rounded-full object-cover"
                            />
                          ) : catColor && index !== 0 ? (
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: catColor }}
                              aria-hidden
                            />
                          ) : null}
                          {category.name}
                        </span>
                      )
                    })}
                  </nav>
                  {categories.map((category, index) => {
                    const catColor = HEX.test(category.color) ? category.color : null
                    return (
                      <section
                        key={category.id ?? `${category.name}-${index}`}
                        className="px-4 pt-4"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          {category.image_url ? (
                            <img
                              src={category.image_url}
                              alt=""
                              className="h-6 w-6 rounded-md object-cover"
                            />
                          ) : catColor ? (
                            <span
                              className="h-3.5 w-1 shrink-0 rounded-full"
                              style={{ background: catColor }}
                              aria-hidden
                            />
                          ) : null}
                          <h4 className="text-sm font-semibold">{category.name}</h4>
                        </div>
                        <ul className="space-y-2">
                          {pick(category.items).map((dish) => (
                            <li
                              key={dish.id}
                              className="flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm"
                            >
                              <DishImage dish={dish} className="h-14 w-14" />
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-2 text-xs font-medium">{dish.name}</p>
                                <p className="mt-1 text-xs font-semibold">{price(dish)}</p>
                              </div>
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none"
                                style={{ background: settings.button_color, color: onButton }}
                                aria-hidden
                              >
                                +
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-white/95 p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                tabIndex={-1}
                className="flex w-full items-center justify-between rounded-full px-4 py-2.5 text-xs font-semibold"
                style={{ background: settings.button_color, color: onButton }}
                data-testid="emenu-preview-order"
              >
                <span>{t('emenu.previewCart', { count: cartDish.length })}</span>
                <span>
                  {cartDish.length > 0 ? formatMoney(String(cartTotal), currency) : ''}{' '}
                  {settings.payment_timing === 'pay_before'
                    ? t('emenu.previewPayNow')
                    : t('emenu.previewOrder')}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Rail({
  title,
  dishes,
  price,
  accent,
  empty,
}: {
  title: string
  dishes: EmenuDish[]
  price: (dish: EmenuDish) => string
  accent: string
  empty: string
}) {
  return (
    <section className="pt-4">
      <h4 className="mb-2 px-4 text-sm font-semibold">{title}</h4>
      {dishes.length === 0 ? (
        <div className="px-4">
          <Placeholder text={empty} />
        </div>
      ) : (
        <ul className="flex gap-2 overflow-x-auto px-4">
          {dishes.map((dish) => (
            <li
              key={dish.id}
              className="w-28 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm"
            >
              <DishImage dish={dish} className="h-20 w-full rounded-none" />
              <div className="p-2">
                <p className="line-clamp-2 text-[11px] font-medium leading-tight">{dish.name}</p>
                <p className="mt-1 text-[11px] font-semibold" style={{ color: accent }}>
                  {price(dish)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DishImage({ dish, className }: { dish: EmenuDish; className: string }) {
  return dish.image_url ? (
    <img
      src={dish.image_url}
      alt=""
      loading="lazy"
      className={`shrink-0 rounded-lg bg-neutral-100 object-cover ${className}`}
    />
  ) : (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-lg font-semibold text-neutral-400 ${className}`}
      aria-hidden
    >
      {dish.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

function Placeholder({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-4 text-center text-[11px] text-neutral-500">
      {text}
    </p>
  )
}

// The sticker drawn to scale, as it prints on paper or on the receipt
// printer. Every size is relative to the width, so the same face serves the
// preview (pixels) and the printed sheet (millimetres).
function StickerPreview({
  settings,
  sampleTable,
}: {
  settings: EmenuSettings
  sampleTable?: string
}) {
  const { t } = useTranslation()
  const widthMm = stickerWidthMm(settings)
  const scale = Math.min(3.6, 280 / widthMm)
  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-neutral-200 p-4">
        <StickerFace
          settings={settings}
          tableName={sampleTable || t('emenu.previewStickerTable')}
          url={SAMPLE_URL}
          width={`${Math.round(widthMm * scale)}px`}
          className="mx-auto shadow-md"
          testId="emenu-sticker"
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {t('emenu.previewStickerNote', { width: widthMm })}
      </p>
    </div>
  )
}

export function StickerFace({
  settings,
  tableName,
  url,
  width,
  className = '',
  testId,
}: {
  settings: EmenuSettings
  tableName: string
  url: string
  // A CSS length: "280px" on screen, "80mm" on paper.
  width: string
  className?: string
  testId?: string
}) {
  const { t } = useTranslation()
  const name = settings.sticker_store_name || settings.store_name || t('emenu.previewStore')
  return (
    <div
      className={`break-inside-avoid bg-white text-center text-black ${className}`}
      style={{ width, fontSize: `calc(${width} / 19)`, padding: '1.1em 0.9em' }}
      data-testid={testId}
    >
      {settings.sticker_show_logo && settings.logo_url ? (
        <img
          src={settings.logo_url}
          alt=""
          className="mx-auto object-contain grayscale"
          style={{ width: '40%', maxHeight: `calc(${width} * 0.3)`, marginBottom: '0.5em' }}
        />
      ) : null}
      {settings.sticker_show_name ? (
        <p className="font-bold uppercase leading-tight" style={{ fontSize: '1.3em' }}>
          {name}
        </p>
      ) : null}
      <p className="font-bold leading-tight" style={{ fontSize: '1.6em', marginTop: '0.15em' }}>
        {tableName}
      </p>
      <div className="mx-auto" style={{ width: '62%', marginTop: '0.8em' }}>
        <QrSvg url={url} />
      </div>
      {settings.sticker_greeting ? (
        <p className="leading-snug" style={{ marginTop: '0.5em' }}>
          {settings.sticker_greeting}
        </p>
      ) : null}
      {settings.sticker_wifi_enabled && settings.sticker_wifi_name ? (
        <div
          className="border-t border-dashed border-black leading-snug"
          style={{ marginTop: '0.8em', paddingTop: '0.5em' }}
        >
          <p>Wi-Fi: {settings.sticker_wifi_name}</p>
          {settings.sticker_wifi_password ? (
            <p>
              {t('emenu.wifiPasswordLabel')}: {settings.sticker_wifi_password}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const SAMPLE_URL = 'https://example.com/table/?t=preview-sample-code-0000000000'

// Drawn locally as SVG; a table link never goes to a remote QR service.
function QrSvg({ url }: { url: string }) {
  const { size, data } = encode(url, { ecc: 'M', border: 1 })
  const path = data
    .flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : [])))
    .join('')
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="block h-auto w-full"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <path d={path} fill="#000" />
    </svg>
  )
}
