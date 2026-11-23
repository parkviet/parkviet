import { defaultTemplate } from '@shared/receipt-template/defaults'
import type { PageSettings, TemplateConfig } from '@shared/receipt-template/types'
import {
  charsPerLine,
  editableConfig,
  issueTarget,
  SECTION_RULES,
  serverIssues,
  type TemplateIssue,
  validateTemplate,
} from '@shared/receipt-template/validate'
import {
  conflictReason,
  describeFailure,
  posFailureKey,
} from '@shared/request-failure'
import { useAuth, useStore } from '@spree/dashboard-core'
import { Button } from '@spree/dashboard-ui'
import { ArrowLeftIcon } from '@spree/dashboard-ui/icons'
import { Link, useBlocker, useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../components/page-skeleton'
import { keyBlocks } from '../components/receipt-template/block-list'
import { Notice, PageState } from '../components/receipt-template/controls'
import {
  ConflictBanner,
  EditorActionBar,
  EditorToolbar,
} from '../components/receipt-template/editor-action-bar'
import {
  type Conflict,
  configOf,
  type Draft,
  draftOf,
  exactSnapshot,
  fingerprint,
  parseStoredDraft,
  SECTION_OF,
  storedDraftOf,
  useEditorPreviewScope,
  useLocatedIssues,
} from '../components/receipt-template/editor-model'
import { EditorSectionsAccordion } from '../components/receipt-template/editor-sections'
import {
  EditorPreviewCard,
  type PreviewZoom,
  ReceiptFrame,
  useTestPrint,
} from '../components/receipt-template/template-preview'
import { VersionDrawer } from '../components/receipt-template/version-drawer'
import { useActivePaymentMethods } from '../hooks/use-master-data'
import { usePosContext } from '../hooks/use-pos-context'
import {
  makeDefaultReceiptTemplate,
  type ReceiptTemplate,
  refreshReceiptTemplates,
  restoreReceiptTemplate,
  updateReceiptTemplate,
  useReceiptTemplate,
} from '../hooks/use-receipt-templates'
import {
  clearEditorDraft,
  editorDraftKey,
  readEditorDraft,
  sessionDraftStorage,
  writeEditorDraft,
} from '../lib/editor-draft'
import { shouldIgnoreUndoShortcut, useUndoableState } from '../lib/undo-history'
import { templateFailure } from './receipt-templates'

export function ReceiptTemplateEditorPage() {
  const { t } = useTranslation('pos')
  const { storeId } = useStore()
  const context = usePosContext()
  const access = context.data?.administration ?? { read: false, write: false }
  const templateId = useParams({ strict: false }).templateId ?? ''
  const query = useReceiptTemplate(templateId, access.read)
  const template = query.data
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-4 p-4 md:p-6">
      <header className="grid gap-1.5">
        <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
          <Link to="/$storeId/settings/receipt-templates" params={{ storeId }}>
            <ArrowLeftIcon />
            {t('receiptTemplates.backToList')}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {template
            ? `${t('receiptTemplates.editorTitle')} · ${template.name}`
            : t('receiptTemplates.editorTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('receiptTemplates.editorIntro')}</p>
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
            <TemplateEditor
              key={`${storeId}-${template.id}`}
              template={template}
              canWrite={access.write}
              reload={async () => (await query.refetch()).data ?? null}
            />
          ) : null}
        </>
      )}
    </div>
  )
}

function TemplateEditor({
  template: loaded,
  canWrite,
  reload,
}: {
  template: ReceiptTemplate
  canWrite: boolean
  reload: () => Promise<ReceiptTemplate | null>
}) {
  const { t } = useTranslation('pos')
  const context = usePosContext()
  const { storeId } = useStore()
  const { user } = useAuth()
  const draftKey = editorDraftKey('receipt-template', String(user?.id ?? ''), storeId, loaded.id)
  const [restored] = useState(() =>
    canWrite && loaded.status === 'active'
      ? readEditorDraft(
          sessionDraftStorage(),
          draftKey,
          loaded.current_version,
          parseStoredDraft(loaded.document_type),
        )
      : null,
  )
  const [base, setBase] = useState(loaded)
  const draftHistory = useUndoableState<Draft>(
    () => restored ?? draftOf(loaded),
    (a, b) => exactSnapshot(a) === exactSnapshot(b),
  )
  const draft = draftHistory.value
  const [savedPrint, setSavedPrint] = useState(() => fingerprint(draftOf(loaded)))
  const [serverProblems, setServerProblems] = useState<TemplateIssue[]>([])
  const [conflict, setConflict] = useState<Conflict | null>(null)
  const [notice, setNotice] = useState<{ text: string; failed: boolean } | null>(() =>
    restored ? { text: t('receiptTemplates.draftRestored'), failed: false } : null,
  )
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string[]>(['info'])
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [zoom, setZoom] = useState<PreviewZoom>('100')
  const [history, setHistory] = useState(false)

  const type = base.document_type
  const readOnly = !canWrite || base.status !== 'active'
  const config = useMemo(() => configOf(draft), [draft])
  const dirty = fingerprint(draft) !== savedPrint
  const zone = context.data?.store.timezone ?? 'Asia/Ho_Chi_Minh'
  const scope = useEditorPreviewScope(type, context.data)
  const paymentMethods = useActivePaymentMethods(Boolean(SECTION_RULES[type].payments))
  const hasVietqrAccount =
    paymentMethods.isPending ||
    paymentMethods.isError ||
    (paymentMethods.data ?? []).some(
      (method) => method.kind === 'vietqr' && method.status === 'active',
    )
  const {
    issues,
    problemCount,
    fieldProblem,
    blockProblems,
    listProblem,
    sectionFieldProblem,
    configErrorText,
  } = useLocatedIssues(draft, config, type, serverProblems)

  useEffect(() => {
    const storage = sessionDraftStorage()
    if (dirty && !readOnly)
      writeEditorDraft(storage, draftKey, base.current_version, storedDraftOf(draft))
    else clearEditorDraft(storage, draftKey)
  }, [dirty, readOnly, draft, draftKey, base.current_version])

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (busy || shouldIgnoreUndoShortcut(event.target)) return
      const mod = event.ctrlKey || event.metaKey
      if (!mod || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey && draftHistory.canUndo) {
        event.preventDefault()
        setServerProblems([])
        draftHistory.undo()
      } else if (
        ((key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)) &&
        draftHistory.canRedo
      ) {
        event.preventDefault()
        setServerProblems([])
        draftHistory.redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [readOnly, busy, draftHistory])

  useBlocker({
    shouldBlockFn: () => {
      if (!dirty) return false
      if (!window.confirm(t('receiptTemplates.leaveUnsaved'))) return true
      clearEditorDraft(sessionDraftStorage(), draftKey)
      return false
    },
    enableBeforeUnload: () => dirty,
  })

  const edit = (change: (current: Draft) => Draft, coalesceKey?: string) => {
    draftHistory.set(change, coalesceKey)
    setServerProblems([])
  }
  const editConfig = (change: Partial<TemplateConfig>, coalesceKey?: string) =>
    edit((current) => ({ ...current, config: { ...current.config, ...change } }), coalesceKey)
  const editPage = (change: Partial<PageSettings>, coalesceKey?: string) =>
    edit((current) => {
      const nextPage = { ...current.config.page, ...change } as Record<string, unknown>
      for (const [key, val] of Object.entries(change)) {
        if (val === undefined) delete nextPage[key]
      }
      return {
        ...current,
        config: { ...current.config, page: nextPage as PageSettings },
      }
    }, coalesceKey)

  const applyServerTemplate = (template: ReceiptTemplate, undoable: boolean) => {
    const next = draftOf(template)
    setBase(template)
    if (undoable) draftHistory.set(next)
    else draftHistory.syncPresent(next)
    setSavedPrint(fingerprint(next))
    setServerProblems([])
    setConflict(null)
  }

  const openSections = (list: TemplateIssue[]) =>
    setOpen((current) => [
      ...new Set([...current, ...list.map((issue) => SECTION_OF[issueTarget(issue.pointer).area])]),
    ])

  function handleFailure(error: unknown, action: Conflict['action']) {
    const problems = serverIssues(error)
    if (problems.length > 0) {
      setServerProblems(problems)
      openSections(problems)
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
    const local = validateTemplate({ ...draft, config }, type)
    if (local.length > 0) {
      openSections(local)
      setNotice({ text: t('receiptTemplates.fixProblems'), failed: true })
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      const savedDirty = dirty
      let updated = base
      if (savedDirty || !makeDefault) {
        const result = await updateReceiptTemplate(base.id, {
          expected_version: expected,
          name: draft.name.trim(),
          paper: draft.paper,
          config,
        })
        updated = result.data
      }
      if (makeDefault) {
        const defaulted = await makeDefaultReceiptTemplate(updated.id)
        updated = defaulted.data
      }
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
      const result = await restoreReceiptTemplate(
        base.id,
        version,
        expected ?? base.current_version,
      )
      applyServerTemplate(result.data, true)
      setHistory(false)
      setNotice({
        text: t('receiptTemplates.restored', { version, current: result.data.current_version }),
        failed: false,
      })
      await refreshReceiptTemplates()
    } catch (error) {
      setHistory(false)
      handleFailure(error, { kind: 'restore', version })
    } finally {
      setBusy(false)
    }
  }

  function loadDefaults() {
    const nextConfig = editableConfig(defaultTemplate(type, draft.paper), type)
    edit((current) => ({
      ...current,
      config: nextConfig,
      header: keyBlocks(nextConfig.header),
      footer: keyBlocks(nextConfig.footer),
    }))
    setNotice({ text: t('receiptTemplates.defaultsLoaded'), failed: false })
  }

  const onPrintFailed = useCallback(
    () => setNotice({ text: t('receiptPrintFailed'), failed: true }),
    [t],
  )
  const testPrint = useTestPrint(config, scope.preview.data, onPrintFailed)
  const widthLimit = charsPerLine(draft.paper, config.page.font_size, 'm', config.page.margins)

  return (
    <div className="grid gap-4" data-pane={pane}>
      <EditorToolbar
        documentTypeLabel={t(`receiptTemplates.type.${type}`)}
        currentVersion={base.current_version}
        isDefault={base.is_default}
        isActive={base.status === 'active'}
        canWrite={canWrite}
        readOnly={readOnly}
        busy={busy}
        canUndo={draftHistory.canUndo}
        canRedo={draftHistory.canRedo}
        onUndo={() => {
          setServerProblems([])
          draftHistory.undo()
        }}
        onRedo={() => {
          setServerProblems([])
          draftHistory.redo()
        }}
        onOpenHistory={() => setHistory(true)}
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
          <EditorSectionsAccordion
            storeId={storeId}
            open={open}
            onOpenChange={setOpen}
            documentType={type}
            name={draft.name}
            paper={draft.paper}
            config={config}
            header={draft.header}
            footer={draft.footer}
            previewData={scope.preview.data}
            hasVietqrAccount={hasVietqrAccount}
            readOnly={readOnly}
            busy={busy}
            problemCount={problemCount}
            fieldProblem={fieldProblem}
            sectionFieldProblem={sectionFieldProblem}
            listProblem={listProblem}
            blockProblems={blockProblems}
            onNameChange={(name) => edit((current) => ({ ...current, name }), 'name')}
            onPaperChange={(paper) => edit((current) => ({ ...current, paper }))}
            onPageChange={editPage}
            onConfigChange={editConfig}
            onHeaderChange={(header, coalesceKey) =>
              edit((current) => ({ ...current, header }), coalesceKey)
            }
            onFooterChange={(footer, coalesceKey) =>
              edit((current) => ({ ...current, footer }), coalesceKey)
            }
          />
          {configErrorText ? (
            <p className="pt-3 text-sm text-destructive">{configErrorText}</p>
          ) : null}
        </fieldset>

        <EditorPreviewCard
          documentType={type}
          paper={draft.paper}
          config={config}
          widthLimit={widthLimit}
          zoom={zoom}
          onZoomChange={setZoom}
          source={scope.source}
          status={scope.preview.status}
          latestReceipt={scope.preview.latestReceipt}
          branches={scope.branchRows}
          canReadReceipts={scope.canReadReceipts}
          registers={scope.registerRows}
          branchId={scope.branchId}
          registerId={scope.registerId}
          data={scope.preview.data}
          hiddenOnMobile={pane === 'edit'}
          onSource={scope.setSource}
          onBranch={scope.onBranch}
          onRegister={scope.onRegister}
        />
      </div>

      <EditorActionBar
        dirty={dirty}
        problemCount={issues.length}
        currentVersion={base.current_version}
        readOnly={readOnly}
        isDefault={base.is_default}
        hasConflict={conflict !== null}
        busy={busy}
        testPrinting={testPrint.testPrinting}
        onTestPrint={testPrint.startTestPrint}
        onSave={() => void save()}
        onSaveAndDefault={() => void save(base.current_version, true)}
      />

      {testPrint.testDocument ? (
        <div className="pointer-events-none fixed -left-[10000px] top-0" aria-hidden="true">
          <ReceiptFrame
            document={testPrint.testDocument}
            paper={draft.paper}
            title={t('receiptTemplates.testPrintTitle', { name: draft.name })}
            testId="receipt-template-test-print"
            onReady={testPrint.printReady}
          />
        </div>
      ) : null}

      {history ? (
        <VersionDrawer
          template={base}
          data={scope.preview.data}
          timeZone={zone}
          busy={busy}
          onRestore={(version) => void restoreVersion(version)}
          onClose={() => setHistory(false)}
        />
      ) : null}
    </div>
  )
}
