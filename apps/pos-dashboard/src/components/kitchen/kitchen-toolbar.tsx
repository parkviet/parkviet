import { Button, Label, Switch, Tabs, TabsList, TabsTrigger } from '@spree/dashboard-ui'
import { StarIcon } from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'
import type { KitchenStation } from '../../hooks/use-kitchen'

// Station chips, the all/urgent switch, the view switch and the voided toggle.
export function KitchenToolbar({
  stations,
  stationIds,
  onStations,
  priorityOnly,
  priorityCount,
  onPriorityOnly,
  view,
  onView,
  showVoided,
  onShowVoided,
}: {
  stations: KitchenStation[]
  // Empty means every station.
  stationIds: string[]
  onStations: (ids: string[]) => void
  priorityOnly: boolean
  priorityCount: number
  onPriorityOnly: (value: boolean) => void
  view: 'tickets' | 'dishes'
  onView: (view: 'tickets' | 'dishes') => void
  showVoided: boolean
  onShowVoided: (value: boolean) => void
}) {
  const { t } = useTranslation()
  const toggle = (id: string) =>
    onStations(
      stationIds.includes(id) ? stationIds.filter((row) => row !== id) : [...stationIds, id],
    )
  return (
    <div className="flex flex-wrap items-center gap-3">
      <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0">
        <legend className="sr-only">{t('kitchenBoard.stations')}</legend>
        <Button
          type="button"
          size="sm"
          variant={stationIds.length === 0 ? 'default' : 'outline'}
          aria-pressed={stationIds.length === 0}
          onClick={() => onStations([])}
        >
          {t('kitchenBoard.allStations')}
        </Button>
        {stations.map((station) => (
          <Button
            key={station.id}
            type="button"
            size="sm"
            variant={stationIds.includes(station.id) ? 'default' : 'outline'}
            aria-pressed={stationIds.includes(station.id)}
            onClick={() => toggle(station.id)}
          >
            {station.name}
          </Button>
        ))}
      </fieldset>
      <Tabs
        value={priorityOnly ? 'priority' : 'all'}
        onValueChange={(value) => onPriorityOnly(value === 'priority')}
      >
        <TabsList>
          <TabsTrigger value="all">{t('kitchenBoard.filterAll')}</TabsTrigger>
          <TabsTrigger value="priority">
            <StarIcon className="size-3.5" />
            {t('kitchenBoard.filterPriority', { count: priorityCount })}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs
        value={view}
        onValueChange={(value) => onView(value === 'dishes' ? 'dishes' : 'tickets')}
      >
        <TabsList>
          <TabsTrigger value="tickets">{t('kitchenBoard.viewTickets')}</TabsTrigger>
          <TabsTrigger value="dishes">{t('kitchenBoard.viewDishes')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === 'tickets' && (
        <div className="flex items-center gap-2">
          <Switch id="kitchen-voided" checked={showVoided} onCheckedChange={onShowVoided} />
          <Label htmlFor="kitchen-voided">{t('kitchenBoard.showVoided')}</Label>
        </div>
      )}
    </div>
  )
}
