import type {
  PaperSize,
  ReceiptDocumentType,
  TemplateConfig,
} from '@shared/receipt-template/types'
import {
  editableConfig,
  type IssueArea,
  issueTarget,
  type TemplateIssue,
  validateTemplate,
} from '@shared/receipt-template/validate'
import type { PosContext } from '@shared/types/pos-context'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBranchSelection } from '../../hooks/use-branch-selection'
import type { ReceiptTemplate } from '../../hooks/use-receipt-templates'
import { useBranches, useMemberships, useRegisters } from '../../hooks/use-topology'
import type { BlockProblems } from './block-editor'
import { type KeyedBlock, keyBlocks } from './block-list'
import type { EditorSectionId } from './editor-sections'
import { type PreviewSource, usePreviewData } from './template-preview'

export type Draft = {
  name: string
  paper: PaperSize
  config: TemplateConfig
  header: KeyedBlock[]
  footer: KeyedBlock[]
}

export type Conflict = {
  current: number
  action: { kind: 'save' } | { kind: 'restore'; version: number }
}

const BLOCK_FIELDS = [
  'value',
  'label',
  'size',
  'width_pct',
  'mm',
  'fields',
  'field',
  'caption',
  'parties',
  'labels',
]

export const SECTION_OF: Record<IssueArea, EditorSectionId> = {
  name: 'info',
  paper: 'info',
  page: 'appearance',
  config: 'appearance',
  header: 'header',
  meta: 'meta',
  lines: 'lines',
  totals: 'totals',
  payments: 'payments',
  einvoice: 'einvoice',
  footer: 'footer',
}

export function buildDraft(
  name: string,
  paper: PaperSize,
  source: TemplateConfig,
  type: ReceiptDocumentType,
): Draft {
  const config = editableConfig(source, type)
  return { name, paper, config, header: keyBlocks(config.header), footer: keyBlocks(config.footer) }
}

export const draftOf = (template: ReceiptTemplate): Draft =>
  buildDraft(template.name, template.paper, template.config, template.document_type)

export type StoredDraft = { name: string; paper: PaperSize; config: TemplateConfig }

export const configOf = (draft: Draft): TemplateConfig => ({
  ...draft.config,
  header: draft.header.map((item) => item.block),
  footer: draft.footer.map((item) => item.block),
})

export const storedDraftOf = (draft: Draft): StoredDraft => ({
  name: draft.name,
  paper: draft.paper,
  config: configOf(draft),
})

export const parseStoredDraft =
  (type: ReceiptDocumentType) =>
  (value: unknown): Draft | null => {
    if (value === null || typeof value !== 'object') return null
    const { name, paper, config } = value as Partial<Record<keyof StoredDraft, unknown>>
    if (typeof name !== 'string' || typeof paper !== 'string') return null
    if (config === null || typeof config !== 'object' || Array.isArray(config)) return null
    return buildDraft(name, paper as PaperSize, config as TemplateConfig, type)
  }

export const fingerprint = (draft: Draft) =>
  JSON.stringify({ name: draft.name.trim(), paper: draft.paper, config: configOf(draft) })

export const exactSnapshot = (draft: Draft) =>
  JSON.stringify({ name: draft.name, paper: draft.paper, config: configOf(draft) })

export function useLocatedIssues(
  draft: Draft,
  config: TemplateConfig,
  type: ReceiptDocumentType,
  serverProblems: TemplateIssue[],
) {
  const { t } = useTranslation('pos')
  const issues = useMemo(
    () => [...serverProblems, ...validateTemplate({ ...draft, config }, type)],
    [serverProblems, draft, config, type],
  )
  const message = (issue: TemplateIssue) =>
    t(`receiptTemplates.errors.${issue.code}`, {
      defaultValue: issue.message ?? t('receiptTemplates.errors.invalid_value'),
    })
  const located = issues.map((issue) => ({ issue, ...issueTarget(issue.pointer) }))
  const problemCount = (section: EditorSectionId) =>
    located.filter((item) => SECTION_OF[item.area] === section).length
  const fieldProblem = (area: IssueArea, key: string) => {
    const found = located.find((item) => {
      if (item.area !== area) return false
      const parts = item.issue.pointer.split('/')
      if (area === 'name' || area === 'paper') return parts[1] === key
      return parts.slice(3).join('/') === key || parts[3] === key
    })
    return found ? message(found.issue) : null
  }
  const blockProblems = (place: 'header' | 'footer') => (index: number) => {
    const problems: BlockProblems = {}
    for (const item of located) {
      if (item.area !== place || item.index !== index) continue
      const key = item.issue.pointer.split('/')[4] ?? ''
      problems[BLOCK_FIELDS.includes(key) ? key : ''] ??= message(item.issue)
    }
    return problems
  }
  const listProblem = (place: 'header' | 'footer') => {
    const found = located.find((item) => item.area === place && item.index === null)
    return found ? message(found.issue) : null
  }
  const sectionFieldProblem =
    (section: 'meta' | 'totals' | 'payments' | 'einvoice') =>
    (field: string): string | null => {
      const fields = (config[section]?.fields ?? []) as string[]
      const found = located.find((item) => {
        if (item.area !== section) return false
        const [, , , kind, key] = item.issue.pointer.split('/')
        return kind === 'labels'
          ? key === field
          : kind === 'fields' && fields[Number(key)] === field
      })
      return found ? message(found.issue) : null
    }
  const configErrorText = located
    .filter((item) => item.area === 'config')
    .map((item) => message(item.issue))
    .join(' ')

  return {
    issues,
    problemCount,
    fieldProblem,
    blockProblems,
    listProblem,
    sectionFieldProblem,
    configErrorText,
  }
}

export function useEditorPreviewScope(type: ReceiptDocumentType, context: PosContext | undefined) {
  const branches = useBranches(true)
  const registers = useRegisters(true)
  const memberships = useMemberships(true)
  const { selection } = useBranchSelection(branches.data?.data ?? [])
  const [source, setSource] = useState<PreviewSource>('sample')
  const [branchId, setBranchId] = useState('')
  const [registerId, setRegisterId] = useState('')

  const activeBranches = (branches.data?.data ?? []).filter((row) => row.status === 'active')
  const memberBranchIds = new Set(
    (memberships.data?.data ?? [])
      .filter((row) => row.staff_id === context?.staff.id && row.status === 'active')
      .map((row) => row.branch_id),
  )
  const memberBranches = activeBranches.filter((row) => memberBranchIds.has(row.id))
  const branchRows = source === 'latest' ? memberBranches : activeBranches
  const registerRows = (registers.data?.data ?? []).filter((row) => row.status === 'active')
  const branch =
    branchRows.find((row) => row.id === branchId) ??
    branchRows.find((row) => row.id === selection.branchId) ??
    branchRows[0] ??
    null
  const register =
    registerRows.find((row) => row.id === registerId && row.branch_id === branch?.id) ?? null
  const preview = usePreviewData({
    documentType: type,
    source,
    context,
    branch,
    register,
  })

  return {
    source,
    setSource,
    branchRows,
    canReadReceipts: memberBranches.length > 0,
    registerRows,
    branchId: branch?.id ?? '',
    registerId: register?.id ?? '',
    onBranch: (id: string) => {
      setBranchId(id)
      setRegisterId('')
    },
    onRegister: setRegisterId,
    preview,
  }
}
