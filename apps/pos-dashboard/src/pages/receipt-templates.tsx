import { sampleData } from '@parkviet/pos-shared/receipt-template/sample-data'
import {
  type PaperSize,
  RECEIPT_DOCUMENT_TYPES,
  type ReceiptDocumentType,
} from '@parkviet/pos-shared/receipt-template/types'
import {
  MAX_ACTIVE_TEMPLATES,
  MAX_NAME_LENGTH,
} from '@parkviet/pos-shared/receipt-template/validate'
import { describeFailure, posFailureKey } from '@parkviet/pos-shared/request-failure'
import { PageHeader, useStore } from '@spree/dashboard-core'
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
  Tabs,
  TabsList,
  TabsTrigger,
  useConfirm,
} from '@spree/dashboard-ui'
import { PlusIcon, ReceiptTextIcon } from '@spree/dashboard-ui/icons'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { type FormEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { LabelTemplateGallery } from '../components/product-label/label-template-gallery'
import { Choice, Notice, PageState } from '../components/receipt-template/controls'
import { PaperPicker } from '../components/receipt-template/paper-picker'
import { TemplateCard } from '../components/receipt-template/template-card'
import { usePosContext } from '../hooks/use-pos-context'
import {
  createReceiptTemplate,
  disableReceiptTemplate,
  enableReceiptTemplate,
  duplicateReceiptTemplate,
  makeDefaultReceiptTemplate,
  type ReceiptTemplate,
  refreshReceiptTemplates,
  useReceiptTemplates,
} from '../hooks/use-receipt-templates'
import { templateFailure } from '../lib/template-failure'
import { type ReceiptTemplateSearch, receiptTemplateSearchSchema } from '../schemas/list-search'

const PAPER_FILTERS: readonly PaperSize[] = ['58mm', '80mm', 'a4', 'a5', 'a6']

export { templateFailure }

export function ReceiptTemplatesPage() {
  const { t } = useTranslation('pos')
  const navigate = useNavigate()
  const { storeId } = useStore()
  const context = usePosContext()
  const access = context.data?.administration ?? { read: false, write: false }
  const templates = useReceiptTemplates(access.read, true)
  const [creatingType, setCreatingType] = useState<ReceiptDocumentType | 'any' | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(null)
  const confirm = useConfirm()

  const searchParams = receiptTemplateSearchSchema.parse(useSearch({ strict: false }))
  const queryText = (searchParams.search ?? '').trim().toLowerCase()
  const selectedType = searchParams.type ?? 'all'
  const selectedPaper = searchParams.paper ?? 'all'
  const selectedStatus = searchParams.status ?? 'all'
  const tab = searchParams.tab ?? 'receipts'
  const hasFilters =
    queryText !== '' ||
    selectedType !== 'all' ||
    selectedPaper !== 'all' ||
    selectedStatus !== 'all'

  const updateSearch = (patch: Partial<ReceiptTemplateSearch>) => {
    void navigate({
      to: '/$storeId/settings/receipt-templates',
      params: { storeId },
      search: (prev: Record<string, unknown>) => {
        const next: ReceiptTemplateSearch = {
          ...receiptTemplateSearchSchema.parse(prev),
          ...patch,
        }
        if (!next.search) delete next.search
        if (!next.type) delete next.type
        if (!next.paper) delete next.paper
        if (!next.status) delete next.status
        if (!next.tab || next.tab === 'receipts') delete next.tab
        if (!next.group) delete next.group
        return next
      },
      replace: true,
    })
  }

  const rows = templates.data ?? []
  const zone = context.data?.store.timezone ?? 'Asia/Ho_Chi_Minh'
  const activeCount = (type: ReceiptDocumentType) =>
    rows.filter((row) => row.document_type === type && row.status === 'active').length
  const fullTypes = RECEIPT_DOCUMENT_TYPES.filter(
    (type) => activeCount(type) >= MAX_ACTIVE_TEMPLATES,
  )

  const samples = useMemo(() => {
    const place = {
      storeName: context.data?.store.name ?? null,
      storeProfile: context.data?.store.profile ?? null,
      branchName: context.data?.branches?.[0]?.name ?? null,
      branchCode: context.data?.branches?.[0]?.code ?? null,
      returnWindowDays: context.data?.branches?.[0]?.return_window_days ?? null,
      registerName: context.data?.registers?.[0]?.name ?? null,
      cashier: context.data?.staff.full_name || context.data?.staff.email || null,
      timeZone: zone,
    }
    const now = new Date()
    return Object.fromEntries(
      RECEIPT_DOCUMENT_TYPES.map((type) => [type, sampleData(type, place, t, now)]),
    ) as Record<ReceiptDocumentType, ReturnType<typeof sampleData>>
  }, [context.data, zone, t])

  const filteredRows = useMemo(
    () =>
      rows.filter((template) => {
        if (selectedType !== 'all' && template.document_type !== selectedType) return false
        if (selectedPaper !== 'all' && template.paper !== selectedPaper) return false
        if (selectedStatus !== 'all' && template.status !== selectedStatus) return false
        if (queryText !== '') {
          const haystack =
            `${template.name} ${t(`receiptTemplates.type.${template.document_type}`)}`.toLowerCase()
          if (!haystack.includes(queryText)) return false
        }
        return true
      }),
    [rows, selectedType, selectedPaper, selectedStatus, queryText, t],
  )

  const visibleTypes = useMemo(() => {
    const baseTypes = selectedType === 'all' ? RECEIPT_DOCUMENT_TYPES : [selectedType]
    if (!hasFilters) return baseTypes
    return baseTypes.filter((type) => filteredRows.some((row) => row.document_type === type))
  }, [selectedType, hasFilters, filteredRows])

  async function act(
    template: ReceiptTemplate,
    run: (id: string) => Promise<{ data: ReceiptTemplate }>,
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

  async function disable(template: ReceiptTemplate) {
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
      await act(template, disableReceiptTemplate, 'receiptTemplates.disabled')
  }

  const mainTabs = (
    <div className="w-full min-w-0 overflow-x-auto">
      <Tabs
        value={tab}
        onValueChange={(value) =>
          updateSearch({
            tab: value === 'labels' ? 'labels' : undefined,
            search: undefined,
            type: undefined,
            paper: undefined,
            status: undefined,
            group: undefined,
          })
        }
      >
        <TabsList>
          <TabsTrigger value="receipts">{t('productLabels.tab.receipts')}</TabsTrigger>
          <TabsTrigger value="labels">{t('productLabels.tab.labels')}</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )

  const open = (template: ReceiptTemplate) =>
    void navigate({
      to: '/$storeId/settings/receipt-templates/$templateId',
      params: { storeId, templateId: template.id },
    })

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('receiptTemplates.title')}
        actions={
          access.read && access.write && tab === 'receipts' ? (
            <Button
              type="button"
              disabled={Boolean(pendingId) || !templates.isSuccess}
              onClick={() => {
                setNotice(null)
                setCreatingType('any')
              }}
            >
              <PlusIcon />
              {t('receiptTemplates.create')}
            </Button>
          ) : undefined
        }
      />

      {context.isPending ? (
        <PageSkeleton />
      ) : context.isError ? (
        <PageState
          title={t(posFailureKey(context.error))}
          error={describeFailure(context.error, t)}
          retry={() => void context.refetch()}
          retryLabel={t('retry')}
        />
      ) : !access.read ? (
        <PageState title={t('forbidden')} error={t('adminAccessDenied')} />
      ) : tab === 'labels' ? (
        <div className="space-y-6">
          {mainTabs}
          <LabelTemplateGallery
            access={access}
            search={searchParams}
            timeZone={zone}
            storeInfo={{
              name: context.data?.store.name ?? null,
              address: context.data?.store.profile?.address ?? null,
            }}
            onSearch={updateSearch}
          />
        </div>
      ) : templates.isPending ? (
        <PageSkeleton />
      ) : templates.isError ? (
        <PageState
          title={t(posFailureKey(templates.error))}
          error={describeFailure(templates.error, t)}
          retry={() => void templates.refetch()}
          retryLabel={t('retry')}
        />
      ) : (
        <div className="space-y-6">
          {mainTabs}
          <p className="text-base text-muted-foreground">{t('receiptTemplates.listHint')}</p>

          {notice ? <Notice {...notice} /> : null}

          {access.write && fullTypes.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {fullTypes.map((type) => t(`receiptTemplates.type.${type}`)).join(', ')}:{' '}
              {t('receiptTemplates.limitNote', { count: MAX_ACTIVE_TEMPLATES })}
            </p>
          ) : null}

          <div className="space-y-3">
            <div className="w-full min-w-0 overflow-x-auto">
              <Tabs
                value={selectedType}
                onValueChange={(value) =>
                  updateSearch({
                    type: value === 'all' ? undefined : (value as ReceiptDocumentType),
                  })
                }
              >
                <TabsList>
                  <TabsTrigger value="all">{t('receiptTemplates.allTypes')}</TabsTrigger>
                  {RECEIPT_DOCUMENT_TYPES.map((type) => (
                    <TabsTrigger key={type} value={type}>
                      {t(`receiptTemplates.type.${type}`)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_200px]">
              <SearchInput
                value={searchParams.search ?? ''}
                placeholder={t('receiptTemplates.searchPlaceholder')}
                aria-label={t('adminSearchName')}
                clearLabel={t('receiptTemplates.clearFilters')}
                className="h-9"
                onValueChange={(value) => updateSearch({ search: value || undefined })}
              />
              <Choice
                label={t('receiptPaper')}
                hideLabel
                value={selectedPaper}
                options={[
                  { value: 'all', label: t('receiptTemplates.allPapers') },
                  ...PAPER_FILTERS.map((paper) => ({
                    value: paper,
                    label: t(`receiptPaper_${paper}`),
                  })),
                ]}
                onChange={(paper) =>
                  updateSearch({ paper: paper === 'all' ? undefined : (paper as PaperSize) })
                }
              />
              <Choice
                label={t('adminStatus')}
                hideLabel
                value={selectedStatus}
                options={[
                  { value: 'all', label: t('receiptTemplates.allStatuses') },
                  { value: 'active', label: t('statusActive') },
                  { value: 'disabled', label: t('statusDisabled') },
                ]}
                onChange={(status) =>
                  updateSearch({
                    status: status === 'all' ? undefined : (status as 'active' | 'disabled'),
                  })
                }
              />
            </div>
          </div>

          {visibleTypes.length === 0 ? (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-10 text-center"
            >
              <p className="text-muted-foreground">{t('receiptTemplates.filterEmpty')}</p>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateSearch({
                      search: undefined,
                      type: undefined,
                      paper: undefined,
                      status: undefined,
                    })
                  }
                >
                  {t('receiptTemplates.clearFilters')}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-8">
              {visibleTypes.map((type) => {
                const groupRows = filteredRows.filter((row) => row.document_type === type)
                const activeInGroup = activeCount(type)
                const full = activeInGroup >= MAX_ACTIVE_TEMPLATES
                const typeLabel = t(`receiptTemplates.type.${type}`)

                return (
                  <section
                    key={type}
                    aria-labelledby={`rt-group-${type}`}
                    data-document-type={type}
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <SectionTitle id={`rt-group-${type}`}>
                          <ReceiptTextIcon />
                          {typeLabel}
                        </SectionTitle>
                        <Badge variant="outline" className="font-normal">
                          {t('receiptTemplates.activeQuota', {
                            count: activeInGroup,
                            max: MAX_ACTIVE_TEMPLATES,
                          })}
                        </Badge>
                      </div>

                      {access.write ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={Boolean(pendingId) || full}
                          aria-label={t('receiptTemplates.createForType', { type: typeLabel })}
                          onClick={() => {
                            setNotice(null)
                            setCreatingType(type)
                          }}
                        >
                          <PlusIcon className="size-3.5" />
                          {t('receiptTemplates.create')}
                        </Button>
                      ) : null}
                    </div>

                    {groupRows.length === 0 ? (
                      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
                        {t('receiptTemplates.groupEmpty')}
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {groupRows.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            sample={samples[type]}
                            timeZone={zone}
                            canWrite={access.write}
                            isFull={full}
                            busy={Boolean(pendingId)}
                            onOpen={() => open(template)}
                            onDuplicate={() =>
                              void act(
                                template,
                                duplicateReceiptTemplate,
                                'receiptTemplates.duplicated',
                              )
                            }
                            onMakeDefault={() =>
                              void act(
                                template,
                                makeDefaultReceiptTemplate,
                                'receiptTemplates.madeDefault',
                              )
                            }
                            onDisable={() => void disable(template)}
                            onEnable={() =>
                              void act(template, enableReceiptTemplate, 'receiptTemplates.enabled')
                            }
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      {creatingType ? (
        <CreateTemplateDialog
          initialType={creatingType === 'any' ? undefined : creatingType}
          isFull={(type) => activeCount(type) >= MAX_ACTIVE_TEMPLATES}
          onClose={() => setCreatingType(null)}
          onCreated={async (template) => {
            await refreshReceiptTemplates()
            setCreatingType(null)
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

function CreateTemplateDialog({
  initialType,
  isFull,
  onClose,
  onCreated,
}: {
  initialType?: ReceiptDocumentType
  isFull: (type: ReceiptDocumentType) => boolean
  onClose: () => void
  onCreated: (template: ReceiptTemplate) => Promise<void>
}) {
  const { t } = useTranslation('pos')
  const firstOpen =
    initialType && !isFull(initialType)
      ? initialType
      : (RECEIPT_DOCUMENT_TYPES.find((type) => !isFull(type)) ?? initialType ?? 'sale')
  const [type, setType] = useState<ReceiptDocumentType>(firstOpen)
  const [paper, setPaper] = useState<PaperSize>('80mm')
  const [name, setName] = useState(() => t(`receiptTemplates.defaultName.${firstOpen}`))
  const [named, setNamed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const full = isFull(type)
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
      const result = await createReceiptTemplate({ from_default: type, name: name.trim(), paper })
      await onCreated(result.data)
    } catch (failure) {
      setError(templateFailure(failure, t))
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{t('receiptTemplates.createTitle')}</DialogTitle>
          <DialogDescription>{t('receiptTemplates.createHint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="contents">
          <DialogBody>
            <fieldset className="grid gap-4" disabled={busy}>
              <Choice
                label={t('receiptTemplates.documentType')}
                value={type}
                disabled={busy}
                options={RECEIPT_DOCUMENT_TYPES.map((value) => ({
                  value,
                  label: t(`receiptTemplates.type.${value}`),
                }))}
                onChange={(next) => {
                  setType(next)
                  if (!named) setName(t(`receiptTemplates.defaultName.${next}`))
                }}
              />
              {full ? (
                <Notice
                  failed
                  text={t('receiptTemplates.limitNote', { count: MAX_ACTIVE_TEMPLATES })}
                />
              ) : null}
              <PaperPicker value={paper} disabled={busy} onChange={setPaper} />
              <div className="grid gap-2">
                <Label htmlFor="rt-create-name">{t('receiptTemplates.name')}</Label>
                <Input
                  id="rt-create-name"
                  value={name}
                  maxLength={MAX_NAME_LENGTH}
                  required
                  onChange={(event) => {
                    setName(event.target.value)
                    setNamed(true)
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {t('receiptTemplates.fromSuggestion')}
              </p>
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
