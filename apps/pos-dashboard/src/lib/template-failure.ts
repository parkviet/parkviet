import { conflictReason, describeFailure } from '@parkviet/pos-shared/request-failure'

// The message for a failed template write: the conflicts the template store
// reports by reason, otherwise the generic request failure.
export function templateFailure(error: unknown, t: (key: string) => string): string {
  switch (conflictReason(error)) {
    case 'template_version_conflict':
      return t('receiptTemplates.conflict')
    case 'template_limit_reached':
      return t('receiptTemplates.limitReached')
    case 'template_disabled':
      return t('receiptTemplates.disabledConflict')
    case 'template_default_required':
      return t('receiptTemplates.defaultRequired')
    default:
      return describeFailure(error, t)
  }
}
