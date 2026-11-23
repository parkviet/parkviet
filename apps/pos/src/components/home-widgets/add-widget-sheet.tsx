import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@spree/dashboard-ui'
import { PlusIcon } from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'
import type { WidgetDefinition } from './registry'

// The widgets the reader may see that are not on the page; choosing one
// places it in the first free spot.
export function AddWidgetSheet({
  open,
  widgets,
  onOpenChange,
  onAdd,
}: {
  open: boolean
  widgets: readonly WidgetDefinition[]
  onOpenChange: (open: boolean) => void
  onAdd: (widget: string) => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('homeWidgets.addTitle')}</SheetTitle>
          <SheetDescription>{t('homeWidgets.addHint')}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {widgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('homeWidgets.addEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label={t('homeWidgets.addTitle')}>
              {widgets.map((definition) => {
                const name = t(definition.titleKey)
                return (
                  <li
                    key={definition.widget}
                    className="flex items-center gap-3 rounded-lg border p-3 [&>svg:first-child]:box-content [&>svg:first-child]:size-4 [&>svg:first-child]:shrink-0 [&>svg:first-child]:rounded-lg [&>svg:first-child]:bg-accent-strong [&>svg:first-child]:p-1.5"
                  >
                    {definition.icon}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{name}</p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {t(definition.hintKey)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t('homeWidgets.addOne', { name })}
                      onClick={() => onAdd(definition.widget)}
                    >
                      <PlusIcon />
                      {t('homeWidgets.add')}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
