import { Badge, Button } from '@spree/dashboard-ui'
import {
  CheckIcon,
  HistoryIcon,
  PrinterIcon,
  RedoIcon,
  RotateCcwIcon,
  StarIcon,
  Undo2Icon,
} from '@spree/dashboard-ui/icons'
import { useTranslation } from 'react-i18next'

export function EditorToolbar({
  documentTypeLabel,
  currentVersion,
  isDefault,
  isActive,
  canWrite,
  readOnly,
  busy,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHistory,
  onLoadDefaults,
}: {
  documentTypeLabel: string
  currentVersion: number
  isDefault: boolean
  isActive: boolean
  canWrite: boolean
  readOnly: boolean
  busy: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onOpenHistory: () => void
  onLoadDefaults: () => void
}) {
  const { t } = useTranslation('pos')
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-sm font-semibold">{documentTypeLabel}</strong>
        <span className="text-xs text-muted-foreground">
          {t('receiptTemplates.versionShort', { version: currentVersion })}
        </span>
        {isDefault ? <Badge variant="secondary">{t('receiptTemplates.default')}</Badge> : null}
        {!isActive ? <Badge variant="outline">{t('statusDisabled')}</Badge> : null}
        {!canWrite ? <Badge variant="secondary">{t('adminReadAccess')}</Badge> : null}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={busy || !canUndo}
            title={t('receiptTemplates.undoShortcut')}
            aria-label={t('receiptTemplates.undo')}
            onClick={onUndo}
          >
            <Undo2Icon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={busy || !canRedo}
            title={t('receiptTemplates.redoShortcut')}
            aria-label={t('receiptTemplates.redo')}
            onClick={onRedo}
          >
            <RedoIcon className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onLoadDefaults}>
            <RotateCcwIcon className="size-3.5" />
            {t('receiptTemplates.loadDefaults')}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onOpenHistory}>
            <HistoryIcon className="size-3.5" />
            {t('receiptTemplates.history.open')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function EditorActionBar({
  dirty,
  problemCount,
  currentVersion,
  readOnly,
  isDefault,
  hasConflict,
  busy,
  testPrinting,
  onTestPrint,
  onSave,
  onSaveAndDefault,
}: {
  dirty: boolean
  problemCount: number
  currentVersion: number
  readOnly: boolean
  isDefault: boolean
  hasConflict: boolean
  busy: boolean
  testPrinting: boolean
  onTestPrint: () => void
  onSave: () => void
  onSaveAndDefault: () => void
}) {
  const { t } = useTranslation('pos')
  const showSaveAndDefault = !readOnly && !isDefault

  return (
    <div
      data-testid="receipt-editor-action-bar"
      className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-sm backdrop-blur-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        {problemCount > 0 ? (
          <Badge variant="destructive">
            {t('receiptTemplates.problemCount', { count: problemCount })}
          </Badge>
        ) : null}
        {dirty ? (
          <Badge variant="outline">{t('receiptTemplates.unsaved')}</Badge>
        ) : !readOnly ? (
          <span className="text-xs text-muted-foreground">
            {t('receiptTemplates.savedClean', { version: currentVersion })}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={testPrinting} onClick={onTestPrint}>
          <PrinterIcon />
          {t('receiptTemplates.testPrint')}
        </Button>

        {!readOnly ? (
          <>
            <Button
              type="button"
              variant={showSaveAndDefault ? 'outline' : 'default'}
              disabled={busy || !dirty}
              onClick={onSave}
            >
              <CheckIcon />
              {busy ? t('waiting') : t('save')}
            </Button>

            {showSaveAndDefault ? (
              <Button
                type="button"
                variant="default"
                disabled={busy || hasConflict}
                onClick={onSaveAndDefault}
              >
                <StarIcon />
                {busy ? t('waiting') : t('receiptTemplates.saveAndDefault')}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

export function ConflictBanner({
  conflict,
  dirty,
  busy,
  onReload,
  onOverwrite,
  onRestore,
}: {
  conflict: { current: number; action: { kind: 'save' } | { kind: 'restore'; version: number } }
  dirty: boolean
  busy: boolean
  onReload: () => void
  onOverwrite: (expected: number) => void
  onRestore: (version: number, expected: number) => void
}) {
  const { t } = useTranslation('pos')
  return (
    <div
      role="alert"
      className="grid gap-3 rounded-lg border border-destructive bg-destructive/5 p-4"
    >
      <p>{t('receiptTemplates.conflict')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
          {t('receiptTemplates.conflictReload')}
        </Button>
        {conflict.action.kind === 'restore' ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (conflict.action.kind === 'restore')
                onRestore(conflict.action.version, conflict.current)
            }}
          >
            {t('receiptTemplates.conflictRestore', { version: conflict.action.version })}
          </Button>
        ) : dirty ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => onOverwrite(conflict.current)}
          >
            {t('receiptTemplates.conflictOverwrite')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
