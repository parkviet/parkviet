import { formatDocumentTime, type TemplateData } from '@parkviet/pos-shared/receipt-template/data'
import {
  ActiveBadge,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  RelativeTime,
} from '@spree/dashboard-ui'
import {
  BanIcon,
  CheckIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PencilIcon,
  StarIcon,
} from '@spree/dashboard-ui/icons'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReceiptTemplate } from '../../hooks/use-receipt-templates'
import {
  type PreviewZoom,
  PreviewZoomBar,
  TemplatePreview,
  TemplateThumbnail,
} from './template-preview'

// The card of a receipt template: a thumbnail of the document with sample data.
export function TemplateCard({
  template,
  sample,
  ...rest
}: Omit<CardShellProps, 'template' | 'paperLabel' | 'thumbnail' | 'renderPreview'> & {
  template: ReceiptTemplate
  sample: TemplateData
}) {
  const { t } = useTranslation('pos')
  return (
    <TemplateCardShell
      {...rest}
      template={template}
      paperLabel={t(`receiptPaper_${template.paper}`)}
      thumbnail={
        <TemplateThumbnail
          config={template.config}
          data={sample}
          paper={template.paper}
          title={t('receiptTemplates.previewName', { name: template.name })}
          testId={`receipt-template-thumb-${template.id}`}
        />
      }
      renderPreview={(zoom) => (
        <TemplatePreview
          config={template.config}
          data={sample}
          paper={template.paper}
          zoom={zoom}
          testId="receipt-template-dialog-preview"
        />
      )}
    />
  )
}

// What a card shows of any kind of template.
export type CardTemplate = Pick<
  ReceiptTemplate,
  'id' | 'name' | 'status' | 'is_default' | 'current_version' | 'updated_at' | 'updated_by'
>

export type CardShellProps = {
  template: CardTemplate
  paperLabel: string
  thumbnail: ReactNode
  renderPreview: (zoom: PreviewZoom) => ReactNode
  timeZone: string
  canWrite: boolean
  isFull: boolean
  busy: boolean
  onOpen: () => void
  onDuplicate: () => void
  onMakeDefault: () => void
  onDisable: () => void
  onEnable: () => void
}

// The card frame shared by every template kind: preview, default badge,
// actions menu and the edit and make-default buttons.
export function TemplateCardShell({
  template,
  paperLabel,
  thumbnail,
  renderPreview,
  timeZone,
  canWrite,
  isFull,
  busy,
  onOpen,
  onDuplicate,
  onMakeDefault,
  onDisable,
  onEnable,
}: CardShellProps) {
  const { t } = useTranslation('pos')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [zoom, setZoom] = useState<PreviewZoom>('fit')
  const active = template.status === 'active'
  const editable = canWrite && active

  return (
    <>
      <article
        aria-label={template.name}
        data-testid={`template-card-${template.id}`}
        data-default={template.is_default ? 'true' : undefined}
        data-status={template.status}
        className={[
          'group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-sm',
          template.is_default ? 'border-blue-500/50 ring-1 ring-blue-500/25' : '',
          !active ? 'opacity-80' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="relative border-b">
          <button
            type="button"
            className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
            aria-label={t('receiptTemplates.previewName', { name: template.name })}
            onClick={() => setPreviewOpen(true)}
          >
            {thumbnail}
          </button>

          <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="size-7 rounded-full bg-background/90 shadow-xs backdrop-blur-xs"
              aria-label={t('receiptTemplates.previewName', { name: template.name })}
              onClick={() => setPreviewOpen(true)}
            >
              <EyeIcon className="size-3.5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="size-7 rounded-full bg-background/90 shadow-xs backdrop-blur-xs"
                  aria-label={t('receiptTemplates.actionsFor', { name: template.name })}
                >
                  <EllipsisVerticalIcon className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpen}>
                  {editable ? (
                    <>
                      <PencilIcon className="size-4" />
                      {t('receiptTemplates.edit')}
                    </>
                  ) : (
                    <>
                      <EyeIcon className="size-4" />
                      {t('receiptTemplates.view')}
                    </>
                  )}
                </DropdownMenuItem>
                {canWrite && active && !template.is_default ? (
                  <DropdownMenuItem disabled={busy} onClick={onMakeDefault}>
                    <StarIcon className="size-4" />
                    {t('receiptTemplates.makeDefault')}
                  </DropdownMenuItem>
                ) : null}
                {canWrite ? (
                  <DropdownMenuItem disabled={busy || isFull} onClick={onDuplicate}>
                    <CopyIcon className="size-4" />
                    {isFull ? t('receiptTemplates.limitReached') : t('receiptTemplates.duplicate')}
                  </DropdownMenuItem>
                ) : null}
                {canWrite && active ? (
                  <DropdownMenuItem variant="destructive" disabled={busy} onClick={onDisable}>
                    <BanIcon className="size-4" />
                    {t('receiptTemplates.disable')}
                  </DropdownMenuItem>
                ) : null}
                {canWrite && !active ? (
                  <DropdownMenuItem disabled={busy || isFull} onClick={onEnable}>
                    <CheckIcon className="size-4" />
                    {isFull ? t('receiptTemplates.limitReached') : t('receiptTemplates.enable')}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="grid gap-1.5">
            <div className="flex items-start justify-between gap-2">
              <h3
                className="min-w-0 truncate font-semibold text-base leading-snug"
                title={template.name}
              >
                {template.name}
              </h3>
              <Badge variant="outline" className="shrink-0 font-normal">
                {paperLabel}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {template.is_default ? (
                <Badge variant="secondary">{t('receiptTemplates.default')}</Badge>
              ) : null}
              {!active ? (
                <ActiveBadge
                  active={false}
                  activeLabel={t('statusActive')}
                  inactiveLabel={t('statusDisabled')}
                />
              ) : null}
              <span className="text-xs text-muted-foreground">
                {t('receiptTemplates.versionShort', { version: template.current_version })}
              </span>
            </div>

            <span
              className="truncate text-xs text-muted-foreground"
              title={formatDocumentTime(template.updated_at, timeZone)}
            >
              <RelativeTime iso={template.updated_at} />
              {template.updated_by ? ` · ${template.updated_by.name}` : ''}
            </span>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={!canWrite || !active ? 'col-span-2' : undefined}
              aria-label={t(editable ? 'receiptTemplates.editName' : 'receiptTemplates.viewName', {
                name: template.name,
              })}
              onClick={onOpen}
            >
              {editable ? <PencilIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
              {editable ? t('receiptTemplates.edit') : t('receiptTemplates.view')}
            </Button>

            {canWrite && active ? (
              template.is_default ? (
                <Button type="button" variant="outline" size="sm" disabled>
                  <CheckIcon className="size-3.5" />
                  {t('receiptTemplates.activeDefault')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={busy}
                  aria-label={t('receiptTemplates.makeDefaultName', { name: template.name })}
                  onClick={onMakeDefault}
                >
                  <StarIcon className="size-3.5" />
                  {t('receiptTemplates.makeDefault')}
                </Button>
              )
            ) : null}
          </div>
        </div>
      </article>

      {previewOpen ? (
        <Dialog open onOpenChange={(next) => !next && setPreviewOpen(false)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
                <DialogTitle>
                  {t('receiptTemplates.previewDialogTitle', { name: template.name })}
                </DialogTitle>
                <PreviewZoomBar value={zoom} onChange={setZoom} />
              </div>
            </DialogHeader>
            <DialogBody className="max-h-[70vh] overflow-auto">{renderPreview(zoom)}</DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
                {t('adminCancel')}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setPreviewOpen(false)
                  onOpen()
                }}
              >
                {editable ? t('receiptTemplates.edit') : t('receiptTemplates.view')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
