import { defaultProductLabel } from '@parkviet/pos-shared/product-label/defaults'
import { isProductLabelPaper, productLabelPreset } from '@parkviet/pos-shared/product-label/presets'
import { sampleLabelItems } from '@parkviet/pos-shared/product-label/sample-data'
import type {
  ProductLabelConfig,
  ProductLabelMargins,
  ProductLabelPaper,
} from '@parkviet/pos-shared/product-label/types'
import {
  LABEL_FONT_SIZE_RANGE,
  LABEL_MARGIN_RANGE,
  LABEL_MARGIN_SIDES,
  validateProductLabelConfig,
} from '@parkviet/pos-shared/product-label/validate'
import {
  MAX_NAME_LENGTH,
  serverIssues,
  type TemplateIssue,
} from '@parkviet/pos-shared/receipt-template/validate'
import {
  conflictReason,
  describeFailure,
  posFailureKey,
} from '@parkviet/pos-shared/request-failure'
import { useAuth, useStore } from '@spree/dashboard-core'
import { Accordion, Button, Input, Label } from '@spree/dashboard-ui'
import { AlertTriangleIcon, ArrowLeftIcon, EyeIcon } from '@spree/dashboard-ui/icons'
import { Link, useBlocker, useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import {
  buildLabelPreview,
  buildLabelPrintHtml,
  LabelFrame,
  useLabelPrint,
} from '../components/product-label/label-card-preview'
import { fieldsGroupToggle, LabelFieldList } from '../components/product-label/label-field-list'
import { LabelPaperPicker } from '../components/product-label/label-paper-picker'
import {
  Notice,
  PageState,
  Problem,
  SegmentedChoice,
} from '../components/receipt-template/controls'
import {
  ConflictBanner,
  EditorActionBar,
  EditorToolbar,
} from '../components/receipt-template/editor-action-bar'
import type { Conflict } from '../components/receipt-template/editor-model'
import { EditorSection } from '../components/receipt-template/editor-sections'
import { StepperInput } from '../components/receipt-template/stepper-input'
import { type PreviewZoom, PreviewZoomBar } from '../components/receipt-template/template-preview'
import { VersionHistoryDrawer } from '../components/receipt-template/version-drawer'
import { ModelCard } from '../components/setup/model-ui'
import { usePosContext } from '../hooks/use-pos-context'
import {
  isProductLabelTemplate,
  makeDefaultProductLabelTemplate,
  type ProductLabelTemplate,
  restoreProductLabelTemplate,
  updateProductLabelTemplate,
  useStoredTemplate,
} from '../hooks/use-product-label-templates'
import { refreshReceiptTemplates } from '../hooks/use-receipt-templates'
import {
  clearEditorDraft,
  editorDraftKey,
  readEditorDraft,
  sessionDraftStorage,
  writeEditorDraft,
} from '../lib/editor-draft'
import { templateFailure } from '../lib/template-failure'
import { shouldIgnoreUndoShortcut, useUndoableState } from '../lib/undo-history'

type LabelDraft = { name: string; paper: ProductLabelPaper; config: ProductLabelConfig }

const FONT_SIZES = [6, 7, 8, 9, 10, 11, 12, 14] as const

const draftOf = (template: ProductLabelTemplate): LabelDraft => ({
  name: template.name,
  paper: template.paper,
  config: structuredClone(template.config),
})
const snapshot = (draft: LabelDraft) => JSON.stringify(draft)

function parseStoredDraft(value: unknown): LabelDraft | null {
  if (typeof value !== 'object' || value === null) return null
  const { name, paper, config } = value as Record<string, unknown>
  if (typeof name !== 'string' || !isProductLabelPaper(paper)) return null
  if (validateProductLabelConfig(config).length > 0) return null
  return { name, paper, config: config as ProductLabelConfig }
}

function draftIssues(draft: LabelDraft): TemplateIssue[] {
  const issues = validateProductLabelConfig(draft.config)
  const name = draft.name.trim()
  if (name === '') issues.push({ pointer: '/name', code: 'missing' })
  else if (name.length > MAX_NAME_LENGTH) issues.push({ pointer: '/name', code: 'too_long' })
  return issues
}

export function ProductLabelEditorPage() {
  const { t } = useTranslation('pos')
  const { storeId } = useStore()
  const context = usePosContext()
  const access = context.data?.administration ?? { read: false, write: false }
  const templateId = useParams({ strict: false }).templateId ?? ''
  const query = useStoredTemplate(templateId, access.read)
  const template = isProductLabelTemplate(query.data) ? query.data : null
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4 p-4 md:p-6">
      <header className="grid gap-1.5">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link
            to="/$storeId/settings/receipt-templates"
            params={{ storeId }}
            search={{ tab: 'labels' }}
          >
            <ArrowLeftIcon />
            {t('productLabels.backToList')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {template
            ? `${t('productLabels.editorTitle')} · ${template.name}`
            : t('productLabels.editorTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('productLabels.editorIntro')}</p>
      </header>
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
      ) : (
        <>
          {query.isPending ? <PageState title={t('waiting')} /> : null}
          {query.isError ? (
            <PageState
              title={t(posFailureKey(query.error))}
              error={describeFailure(query.error, t)}
              retry={() => void query.refetch()}
              retryLabel={t('retry')}
            />
          ) : null}
          {template ? (
            <LabelEditor
              key={`${storeId}-${template.id}`}
              template={template}
              canWrite={access.write}
              reload={async () => {
                const fresh = (await query.refetch()).data
                return isProductLabelTemplate(fresh) ? fresh : null
              }}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function LabelEditor({
  template: loaded,
  canWrite,
  reload,
}: {
  template: ProductLabelTemplate
  canWrite: boolean
  reload: () => Promise<ProductLabelTemplate | null>
}) {
  const { t } = useTranslation('pos')
  const context = usePosContext()
  const { storeId } = useStore()
  const { user } = useAuth()
  const draftKey = editorDraftKey('product-label', String(user?.id ?? ''), storeId, loaded.id)
  const [restored] = useState(() =>
    canWrite && loaded.status === 'active'
      ? readEditorDraft(sessionDraftStorage(), draftKey, loaded.current_version, parseStoredDraft)
      : null,
  )
  const [base, setBase] = useState(loaded)
  const history = useUndoableState<LabelDraft>(
    () => restored ?? draftOf(loaded),
    (a, b) => snapshot(a) === snapshot(b),
  )
  const draft = history.value
  const [savedPrint, setSavedPrint] = useState(() => snapshot(draftOf(loaded)))
  const [serverProblems, setServerProblems] = useState<TemplateIssue[]>([])
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(() =>
    restored ? { text: t('receiptTemplates.draftRestored'), failed: false } : null,
  )
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string[]>(['info', 'lines'])
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [zoom, setZoom] = useState<PreviewZoom>('fit')
  const [showHistory, setShowHistory] = useState(false)
  const [sampleId, setSampleId] = useState('sample-1')
  const [overflow, setOverflow] = useState(false)

  const readOnly = !canWrite || base.status !== 'active'
  const dirty = snapshot(draft) !== savedPrint
  const zone = context.data?.store.timezone ?? 'Asia/Ho_Chi_Minh'
  const issues = useMemo(() => [...draftIssues(draft), ...serverProblems], [draft, serverProblems])
  const preset = productLabelPreset(draft.paper)
  const store = useMemo(
    () => ({
      name: context.data?.store.name ?? null,
      address: context.data?.store.profile?.address ?? null,
    }),
    [context.data],
  )
  const samples = useMemo(() => sampleLabelItems(), [])
  const sample = samples.find((item) => item.variant_id === sampleId) ?? samples[0]
  const previewContext = useMemo(() => ({ store, timeZone: zone }), [store, zone])
  const preview = useMemo(
    () =>
      sample
        ? buildLabelPreview(
            draft.config,
            preset,
            sample,
            previewContext,
            t('productLabels.preview.title'),
          )
        : null,
    [draft.config, preset, sample, previewContext, t],
  )

  useEffect(() => {
    const storage = sessionDraftStorage()
    if (dirty && !readOnly) writeEditorDraft(storage, draftKey, base.current_version, draft)
    else clearEditorDraft(storage, draftKey)
  }, [dirty, readOnly, draft, draftKey, base.current_version])

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy || shouldIgnoreUndoShortcut(event.target)) return
      const mod = event.ctrlKey || event.metaKey
      if (!mod || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey && history.canUndo) {
        event.preventDefault()
        setServerProblems([])
        history.undo()
      } else if (
        ((key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)) &&
        history.canRedo
      ) {
        event.preventDefault()
        setServerProblems([])
        history.redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly, busy, history])

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false
      if (!window.confirm(t('receiptTemplates.leaveUnsaved'))) return true
      clearEditorDraft(sessionDraftStorage(), draftKey)
      return false
    },
    enableBeforeUnload: () => dirty,
  })

  const edit = (change: (current: LabelDraft) => LabelDraft, coalesceKey?: string) => {
    history.set(change, coalesceKey)
    setServerProblems([])
  }
  const editPage = (page: Partial<ProductLabelConfig['page']>, coalesceKey?: string) =>
    edit(
      (current) => ({
        ...current,
        config: { ...current.config, page: { ...current.config.page, ...page } },
      }),
      coalesceKey,
    )
  const editMargin = (side: keyof ProductLabelMargins, value: number | undefined) => {
    if (value === undefined) return
    edit(
      (current) => ({
        ...current,
        config: {
          ...current.config,
          page: {
            ...current.config.page,
            margins: { ...current.config.page.margins, [side]: value },
          },
        },
      }),
      `margin-${side}`,
    )
  }

  const applyServerTemplate = (next: ProductLabelTemplate, undoable: boolean) => {
    const nextDraft = draftOf(next)
    setBase(next)
    if (undoable) history.set(nextDraft)
    else history.syncPresent(nextDraft)
    setSavedPrint(snapshot(nextDraft))
    setServerProblems([])
    setConflict(null)
  }

  function handleFailure(error: unknown, action: Conflict['action']) {
    const problems = serverIssues(error)
    if (problems.length > 0) {
      setServerProblems(problems)
      setOpen((current) => [...new Set([...current, 'info', 'appearance', 'lines'])])
      setNotice({ text: t('receiptTemplates.serverRejected'), failed: true })
      return
    }
    if (conflictReason(error) === 'template_version_conflict') {
      const current = (error as { details?: { current_version?: unknown } }).details
        ?.current_version
      setConflict({ current: typeof current === 'number' ? current : base.current_version, action })
      setNotice(null)
      return
    }
    setNotice({ text: templateFailure(error, t), failed: true })
  }

  async function save(expected = base.current_version, makeDefault = false) {
    if (busy || readOnly) return
    if (draftIssues(draft).length > 0) {
      setOpen((current) => [...new Set([...current, 'info', 'appearance', 'lines'])])
      setNotice({ text: t('receiptTemplates.fixProblems'), failed: true })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const savedDirty = dirty
      let updated = base
      if (savedDirty || !makeDefault) {
        updated = (
          await updateProductLabelTemplate(base.id, {
            expected_version: expected,
            name: draft.name.trim(),
            paper: draft.paper,
            config: draft.config,
          })
        ).data
      }
      if (makeDefault) updated = (await makeDefaultProductLabelTemplate(updated.id)).data
      applyServerTemplate(updated, false)
      setNotice({
        text: makeDefault
          ? savedDirty
            ? t('receiptTemplates.savedAndDefault', {
                version: updated.current_version,
                name: updated.name,
              })
            : t('receiptTemplates.madeDefault', { name: updated.name })
          : t('receiptTemplates.saved', { version: updated.current_version }),
        failed: false,
      })
      await refreshReceiptTemplates()
    } catch (error) {
      handleFailure(error, { kind: 'save' })
    } finally {
      setBusy(false)
    }
  }

  async function reloadLatest() {
    if (dirty && !window.confirm(t('adminDiscard'))) return
    setBusy(true)
    try {
      const fresh = await reload()
      if (fresh) {
        applyServerTemplate(fresh, true)
        setNotice({ text: t('receiptTemplates.reloaded'), failed: false })
      }
    } catch (error) {
      setNotice({ text: describeFailure(error, t), failed: true })
    } finally {
      setBusy(false)
    }
  }

  async function restoreVersion(version: number, expected?: number) {
    if (busy || readOnly) return
    if (expected === undefined && dirty && !window.confirm(t('adminDiscard'))) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await restoreProductLabelTemplate(
        base.id,
        version,
        expected ?? base.current_version,
      )
      applyServerTemplate(result.data, true)
      setShowHistory(false)
      setNotice({
        text: t('receiptTemplates.restored', { version, current: result.data.current_version }),
        failed: false,
      })
      await refreshReceiptTemplates()
    } catch (error) {
      setShowHistory(false)
      handleFailure(error, { kind: 'restore', version })
    } finally {
      setBusy(false)
    }
  }

  function loadDefaults() {
    edit((current) => ({ ...current, config: defaultProductLabel(current.paper) }))
    setNotice({ text: t('productLabels.defaultsLoaded'), failed: false })
  }

  const onPrintFailed = useCallback(
    () => setNotice({ text: t('receiptPrintFailed'), failed: true }),
    [t],
  )
  const testPrint = useLabelPrint(onPrintFailed)

  const issueAt = (pointer: RegExp) => issues.find((issue) => pointer.test(issue.pointer))
  const problemText = (issue: TemplateIssue | undefined) =>
    issue
      ? t(`productLabels.problems.${issue.code}`, {
          defaultValue: t('productLabels.problems.invalid'),
        })
      : null
  const nameProblem = problemText(issueAt(/^\/name$/))
  const sectionProblems = (pattern: RegExp) =>
    issues.filter((issue) => pattern.test(issue.pointer)).length
  const barcodeWarning = preview?.warnings.includes('barcode_too_wide') ?? false

  return (
    <div className="grid gap-4" data-pane={pane}>
      <EditorToolbar
        documentTypeLabel={t('productLabels.title')}
        currentVersion={base.current_version}
        isDefault={base.is_default}
        isActive={base.status === 'active'}
        canWrite={canWrite}
        readOnly={readOnly}
        busy={busy}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => {
          setServerProblems([])
          history.undo()
        }}
        onRedo={() => {
          setServerProblems([])
          history.redo()
        }}
        onOpenHistory={() => setShowHistory(true)}
        onLoadDefaults={loadDefaults}
      />

      {conflict ? (
        <ConflictBanner
          conflict={conflict}
          dirty={dirty}
          busy={busy}
          onReload={() => void reloadLatest()}
          onOverwrite={(expected) => void save(expected)}
          onRestore={(version, expected) => void restoreVersion(version, expected)}
        />
      ) : null}

      {notice ? <Notice {...notice} /> : null}
      {base.status !== 'active' ? (
        <p className="text-sm text-muted-foreground">{t('receiptTemplates.disabledReadOnly')}</p>
      ) : null}

      <fieldset className="flex gap-2 lg:hidden">
        <legend className="sr-only">{t('receiptTemplates.panes')}</legend>
        {(['edit', 'preview'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={pane === value ? 'default' : 'outline'}
            aria-pressed={pane === value}
            onClick={() => setPane(value)}
          >
            {t(`receiptTemplates.pane.${value}`)}
          </Button>
        ))}
      </fieldset>

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <fieldset
          className={`${pane === 'preview' ? 'hidden lg:block' : ''} min-w-0`}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          <Accordion
            multiple
            value={open}
            onValueChange={(value) => setOpen(value as string[])}
            className="grid gap-3"
          >
            <EditorSection
              id="info"
              title={t('receiptTemplates.section.info')}
              problems={sectionProblems(/^\/(name|paper)$/)}
            >
              <div className="grid gap-2">
                <Label htmlFor="pl-template-name">{t('receiptTemplates.name')}</Label>
                <Input
                  id="pl-template-name"
                  value={draft.name}
                  maxLength={MAX_NAME_LENGTH}
                  disabled={readOnly}
                  aria-invalid={Boolean(nameProblem)}
                  onChange={(event) =>
                    edit((current) => ({ ...current, name: event.target.value }), 'name')
                  }
                />
                <Problem>{nameProblem}</Problem>
              </div>
              <LabelPaperPicker
                value={draft.paper}
                disabled={readOnly}
                onChange={(paper) => edit((current) => ({ ...current, paper }))}
              />
            </EditorSection>

            <EditorSection
              id="appearance"
              title={t('receiptTemplates.section.appearance')}
              problems={sectionProblems(/^\/config\/page/)}
            >
              <SegmentedChoice
                label={t('productLabels.appearance.fontSize')}
                value={String(draft.config.page.font_size)}
                disabled={readOnly}
                options={fontSizeOptions(draft.config.page.font_size).map((size) => ({
                  value: String(size),
                  label: t('productLabels.appearance.points', { size }),
                }))}
                onChange={(size) => editPage({ font_size: Number(size) })}
              />
              <fieldset className="grid gap-3">
                <legend className="mb-2 font-medium text-sm">
                  {t('productLabels.appearance.margins')}
                </legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {LABEL_MARGIN_SIDES.map((side) => (
                    <StepperInput
                      key={side}
                      label={t(`receiptTemplates.page.margin_${side}`)}
                      value={draft.config.page.margins[side]}
                      min={LABEL_MARGIN_RANGE[0]}
                      max={LABEL_MARGIN_RANGE[1]}
                      step={0.5}
                      disabled={readOnly}
                      onChange={(value) => editMargin(side, value)}
                    />
                  ))}
                </div>
              </fieldset>
              <Problem>
                {problemText(issueAt(/^\/config\/page\/font_size$/)) ??
                  problemText(issueAt(/^\/config\/page\/margins/))}
              </Problem>
            </EditorSection>

            <EditorSection
              id="lines"
              title={t('productLabels.section.fields')}
              problems={sectionProblems(/^\/config\/(fields|schema)/)}
              group={fieldsGroupToggle(draft.config.fields, readOnly || busy, (fields) =>
                edit((current) => ({ ...current, config: { ...current.config, fields } })),
              )}
            >
              <LabelFieldList
                fields={draft.config.fields}
                readOnly={readOnly}
                storeHints={{ name: store.name ?? '', address: store.address ?? '' }}
                problemAt={(index) =>
                  problemText(issueAt(new RegExp(`^/config/fields/${index}(/|$)`)))
                }
                onChange={(fields, coalesceKey) =>
                  edit(
                    (current) => ({ ...current, config: { ...current.config, fields } }),
                    coalesceKey,
                  )
                }
              />
              <Problem>{problemText(issueAt(/^\/config\/fields$/))}</Problem>
            </EditorSection>
          </Accordion>
        </fieldset>

        <ModelCard
          title={t('productLabels.preview.title')}
          id="label-preview"
          icon={<EyeIcon />}
          action={<PreviewZoomBar value={zoom} onChange={setZoom} />}
          className={`${pane === 'edit' ? 'hidden lg:flex' : ''} min-w-0 lg:sticky lg:top-4`}
        >
          <div className="grid gap-3">
            <SegmentedChoice
              label={t('productLabels.preview.sample')}
              value={sampleId}
              options={samples.map((item) => ({
                value: item.variant_id,
                label: t(`productLabels.sample.${item.variant_id}`),
              }))}
              onChange={setSampleId}
            />
            <small className="text-xs text-muted-foreground">
              {t(
                preset.kind === 'roll'
                  ? 'productLabels.preview.rollNote'
                  : 'productLabels.preview.sheetNote',
                { paper: t(`productLabels.paperName.${preset.code}`) },
              )}
            </small>
            {overflow ? (
              <div
                role="alert"
                data-testid="label-overflow-warning"
                className="flex items-start gap-2 rounded-md border border-amber-300/80 bg-amber-50/70 px-2.5 py-2 text-amber-900 text-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                {t('productLabels.preview.overflow')}
              </div>
            ) : null}
            {barcodeWarning ? (
              <div
                role="status"
                data-testid="label-barcode-warning"
                className="rounded-md border border-amber-300/80 bg-amber-50/70 px-2.5 py-1.5 text-amber-900 text-xs dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
              >
                {t('productLabels.preview.barcodeTooWide')}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-xl border bg-muted/60 p-2">
              {preview ? (
                <LabelFrame
                  document={preview}
                  title={t('productLabels.preview.title')}
                  testId="product-label-preview"
                  zoom={zoom}
                  onMeasured={setOverflow}
                />
              ) : null}
            </div>
          </div>
        </ModelCard>
      </div>

      <EditorActionBar
        dirty={dirty}
        problemCount={issues.length}
        currentVersion={base.current_version}
        readOnly={readOnly}
        isDefault={base.is_default}
        hasConflict={conflict !== null}
        busy={busy}
        testPrinting={testPrint.printing}
        onTestPrint={() => {
          if (sample)
            testPrint.start(
              buildLabelPrintHtml(
                draft.config,
                preset,
                sample,
                previewContext,
                t('productLabels.testPrintTitle', { name: draft.name }),
              ),
            )
        }}
        onSave={() => void save()}
        onSaveAndDefault={() => void save(base.current_version, true)}
      />

      {testPrint.frame}

      {showHistory ? (
        <VersionHistoryDrawer
          template={base}
          timeZone={zone}
          busy={busy}
          onRestore={(version) => void restoreVersion(version)}
          onClose={() => setShowHistory(false)}
          renderPreview={(version) => {
            // The versions endpoint serves every kind of template; a stored
            // version is shown only when it is a valid label config.
            const config = version.config as unknown
            if (validateProductLabelConfig(config).length > 0 || !sample) return null
            const shown = buildLabelPreview(
              config as ProductLabelConfig,
              preset,
              sample,
              previewContext,
              t('productLabels.preview.title'),
            )
            return (
              <LabelFrame
                document={shown}
                title={t('productLabels.preview.title')}
                testId="product-label-version-preview"
              />
            )
          }}
        />
      ) : null}
    </div>
  )
}

// The size buttons: the usual steps, plus the template's own when it is between them.
function fontSizeOptions(current: number): number[] {
  const sizes = new Set<number>(
    [...FONT_SIZES].filter(
      (size) => size >= LABEL_FONT_SIZE_RANGE[0] && size <= LABEL_FONT_SIZE_RANGE[1],
    ),
  )
  sizes.add(current)
  return [...sizes].sort((a, b) => a - b)
}
