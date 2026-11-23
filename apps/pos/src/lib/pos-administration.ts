import type { PosContext } from '@shared/types/pos-context'

export function administrationAccess(context?: PosContext) {
  return context?.administration ?? { read: false, write: false }
}
