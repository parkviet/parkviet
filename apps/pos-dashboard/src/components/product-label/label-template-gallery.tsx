import { productLabelPreset } from '@parkviet/pos-shared/product-label/presets'
import { sampleLabelItems } from '@parkviet/pos-shared/product-label/sample-data'
import type { ProductLabelPaper } from '@parkviet/pos-shared/product-label/types'
import {
  MAX_ACTIVE_TEMPLATES,
  MAX_NAME_LENGTH,
} from '@parkviet/pos-shared/receipt-template/validate'
import { describeFailure, posFailureKey } from '@parkviet/pos-shared/request-failure'
import { useStore } from '@spree/dashboard-core'
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  SearchInput,
  SectionTitle,
  useConfirm,
} from '@spree/dashboard-ui'
import { PlusIcon, TagIcon } from '@spree/dashboard-ui/icons'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  createProductLabelTemplate,
  disableProductLabelTemplate,
  enableProductLabelTemplate,
  duplicateProductLabelTemplate,
  makeDefaultProductLabelTemplate,
  type ProductLabelTemplate,
  useProductLabelTemplates,
} from '../../hooks/use-product-label-templates'
import { refreshReceiptTemplates } from '../../hooks/use-receipt-templates'
import { templateFailure } from '../../lib/template-failure'
import type { ReceiptTemplateSearch } from '../../schemas/list-search'
import { PageSkeleton } from '../page-skeleton'
import { Choice, Notice, PageState } from '../receipt-template/controls'
import { TemplateCardShell } from '../receipt-template/template-card'
import { buildLabelPreview, LabelFrame, rowPreset } from './label-card-preview'
import { LABEL_PAPER_GROUPS, LabelPaperPicker, labelPaperGroup } from './label-paper-picker'

const THUMB_HEIGHT = 216

// The "Tem sản phẩm" tab: the store's label templates as cards.
export function LabelTemplateGallery({
  access,
  search,
  timeZone,
  storeInfo,
  onSearch,
}: {
  access: { read: boolean; write: boolean }
  search: ReceiptTemplateSearch
  timeZone: string
  storeInfo: { name: string | null; address: string | null }
  onSearch: (patch: Partial<ReceiptTemplateSearch>) => void
}) {
  const { t } = useTranslation('pos')
  const navigate = useNavigate()
  const { storeId } = useStore()
  const confirm = useConfirm()
  const templates = useProductLabelTemplates(access.read, true)
  const [creating, setCreating] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)

  const queryText = (search.search ?? '').trim().toLowerCase()
  const group = search.group ?? 'all'
  const status = search.status ?? 'all'
  const hasFilters = queryText !== '' || group !== 'all' || status !== 'all'

  const rows = templates.data ?? []
  const activeCount = rows.filter((row) => row.status === 'active').length
  const full = activeCount >= MAX_ACTIVE_TEMPLATES
  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (group !== 'all' && labelPaperGroup(row.paper) !== group) return false
        if (status !== 'all' && row.status !== status) return false
        if (queryText !== '' && !row.name.toLowerCase().includes(queryText)) return false
        return true
      }),
    [rows, group, status, queryText],
  )

  const previewContext = useMemo(() => ({ store: storeInfo, timeZone }), [storeInfo, timeZone])
  const sample = useMemo(() => sampleLabelItems()[0], [])

  const open = (template: ProductLabelTemplate) =>
    void navigate({
      to: '/$storeId/settings/receipt-templates/$templateId',
      params: { storeId, templateId: template.id },
    })

  async function act(
    template: ProductLabelTemplate,
    run: (id: string) => Promise<{ data: ProductLabelTemplate }>,
    done: string,
  ) {
    if (!access.write || pendingId) return
    setPendingId(template.id)
    setNotice(null)
    try {
      const result = await run(template.id)
      setNotice({ text: t(done, { name: result.data.name }), failed: false })
    } catch (error) {
      setNotice({ text: templateFailure(error, t), failed: true })
    } finally {
      setPendingId(null)
      await refreshReceiptTemplates()
    }
  }

  async function disable(template: ProductLabelTemplate) {
    if (!access.write || pendingId) return
    if (
      await confirm({
        title: t('receiptTemplates.disable'),
        message: t('receiptTemplates.confirmDisable', { name: template.name }),
        confirmLabel: t('receiptTemplates.disable'),
        cancelLabel: t('adminCancel'),
        variant: 'destructive',
      })
    )
      await act(template, disableProductLabelTemplate, 'receiptTemplates.disabled')
  }

  if (templates.isPending) return <PageSkeleton />
  if (templates.isError)
    return (
      <PageState
        title={t(posFailureKey(templates.error))}
        error={describeFailure(templates.error, t)}
        retry={() => void templates.refetch()}
        retryLabel={t('retry')}
      />
    )

  return (
    <div className="space-y-6" data-testid="label-template-gallery">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-base text-muted-foreground">{t('productLabels.listHint')}</p>
        {access.write ? (
          <Button
            type="button"
            disabled={Boolean(pendingId) || full}
            onClick={() => {
              setNotice(null)
              setCreating(true)
            }}
          >
            <PlusIcon />
            {t('productLabels.create')}
          </Button>
        ) : null}
      </div>

      {notice ? <Notice {...notice} /> : null}
      {access.write && full ? (
        <p className="text-sm text-muted-foreground">
          {t('receiptTemplates.limitNote', { count: MAX_ACTIVE_TEMPLATES })}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
        <SearchInput
          value={search.search ?? ''}
          placeholder={t('receiptTemplates.searchPlaceholder')}
          aria-label={t('receiptTemplates.searchPlaceholder')}
          clearLabel={t('receiptTemplates.clearFilters')}
          className="h-9"
          onValueChange={(value) => onSearch({ search: value || undefined })}
        />
        <Choice
          label={t('productLabels.paper.label')}
          hideLabel
          value={group}
          options={[
            { value: 'all', label: t('productLabels.allGroups') },
            ...LABEL_PAPER_GROUPS.map((value) => ({
              value,
              label: t(`productLabels.group.${value}`),
            })),
          ]}
          onChange={(next) =>
            onSearch({
              group: next === 'all' ? undefined : (next as ReceiptTemplateSearch['group']),
            })
          }
        />
        <Choice
          label={t('adminStatus')}
          hideLabel
          value={status}
          options={[
            { value: 'all', label: t('receiptTemplates.allStatuses') },
            { value: 'active', label: t('statusActive') },
            { value: 'disabled', label: t('statusDisabled') },
          ]}
          onChange={(next) =>
            onSearch({ status: next === 'all' ? undefined : (next as 'active' | 'disabled') })
          }
        />
      </div>

      <section aria-labelledby="pl-group-title" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <SectionTitle id="pl-group-title">
            <TagIcon />
            {t('productLabels.title')}
          </SectionTitle>
          <Badge variant="outline" className="font-normal">
            {t('receiptTemplates.activeQuota', { count: activeCount, max: MAX_ACTIVE_TEMPLATES })}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <div
            role="status"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-10 text-center"
          >
            <p className="text-muted-foreground">
              {hasFilters ? t('productLabels.filterEmpty') : t('receiptTemplates.groupEmpty')}
            </p>
            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onSearch({ search: undefined, group: undefined, status: undefined })}
              >
                {t('receiptTemplates.clearFilters')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template) => {
              const preset = productLabelPreset(template.paper)
              const paperName = t(`productLabels.paperName.${template.paper}`)
              const thumbnail = (zoom: 'fit' | '100' | '75', crop: boolean) => {
                if (!sample) return null
                const shown = buildLabelPreview(
                  template.config,
                  rowPreset(preset),
                  sample,
                  previewContext,
                  t('receiptTemplates.previewName', { name: template.name }),
                )
                return (
                  <LabelFrame
                    document={shown}
                    title={t('receiptTemplates.previewName', { name: template.name })}
                    testId={
                      crop ? `product-label-thumb-${template.id}` : 'product-label-dialog-preview'
                    }
                    zoom={zoom}
                    maxScale={crop ? 3 : 6}
                    maxHeightPx={crop ? THUMB_HEIGHT - 24 : undefined}
                  />
                )
              }
              return (
                <TemplateCardShell
                  key={template.id}
                  template={template}
                  paperLabel={paperName}
                  thumbnail={
                    <div
                      style={{ height: THUMB_HEIGHT }}
                      className="flex w-full items-center overflow-hidden bg-muted/50 px-3"
                    >
                      <div className="w-full">{thumbnail('fit', true)}</div>
                    </div>
                  }
                  renderPreview={(zoom) => thumbnail(zoom, false)}
                  timeZone={timeZone}
                  canWrite={access.write}
                  isFull={full}
                  busy={Boolean(pendingId)}
                  onOpen={() => open(template)}
                  onDuplicate={() =>
                    void act(template, duplicateProductLabelTemplate, 'receiptTemplates.duplicated')
                  }
                  onMakeDefault={() =>
                    void act(
                      template,
                      makeDefaultProductLabelTemplate,
                      'receiptTemplates.madeDefault',
                    )
                  }
                  onDisable={() => void disable(template)}
                  onEnable={() =>
                    void act(template, enableProductLabelTemplate, 'receiptTemplates.enabled')
                  }
                />
              )
            })}
          </div>
        )}
      </section>

      {creating ? (
        <CreateLabelDialog
          full={full}
          onClose={() => setCreating(false)}
          onCreated={async (template) => {
            await refreshReceiptTemplates()
            setCreating(false)
            await navigate({
              to: '/$storeId/settings/receipt-templates/$templateId',
              params: { storeId, templateId: template.id },
            })
          }}
        />
      ) : null}
    </div>
  )
}

function CreateLabelDialog({
  full,
  onClose,
  onCreated,
}: {
  full: boolean
  onClose: () => void
  onCreated: (template: ProductLabelTemplate) => Promise<void>
}) {
  const { t } = useTranslation('pos')
  const [paper, setPaper] = useState<ProductLabelPaper>('roll_50x30')
  const nameFor = (value: ProductLabelPaper) =>
    t('productLabels.defaultName', { paper: t(`productLabels.paperName.${value}`) })
  const [name, setName] = useState(() => nameFor('roll_50x30'))
  const [named, setNamed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const blank = name.trim() === ''
  const close = () => {
    if (!busy && (!named || window.confirm(t('adminDiscard')))) onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || full || blank) return
    setBusy(true)
    setError('')
    try {
      const result = await createProductLabelTemplate({ name: name.trim(), paper })
      await onCreated(result.data)
    } catch (failure) {
      setError(templateFailure(failure, t))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent showCloseButton={!busy} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('productLabels.createTitle')}</DialogTitle>
          <DialogDescription>{t('productLabels.createHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <DialogBody>
            <fieldset className="grid gap-4" disabled={busy}>
              {full ? (
                <Notice
                  failed
                  text={t('receiptTemplates.limitNote', { count: MAX_ACTIVE_TEMPLATES })}
                />
              ) : null}
              <LabelPaperPicker
                value={paper}
                disabled={busy}
                onChange={(next) => {
                  setPaper(next)
                  if (!named) setName(nameFor(next))
                }}
              />
              <div className="grid gap-2">
                <Label htmlFor="pl-create-name">{t('receiptTemplates.name')}</Label>
                <Input
                  id="pl-create-name"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  required
                  onChange={(event) => {
                    setName(event.target.value)
                    setNamed(true)
                  }}
                />
              </div>
            </fieldset>
            {error ? <Notice failed text={error} /> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('adminCancel')}
            </Button>
            <Button type="submit" disabled={busy || full || blank}>
              {busy ? t('waiting') : t('receiptTemplates.createSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
