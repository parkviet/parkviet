import { useCallback, useRef, useState } from 'react'

export const MAX_UNDO_STEPS = 50
export const COALESCE_MS = 500

export type UndoHistory<T> = {
  past: T[]
  present: T
  future: T[]
  lastKey: string | null
  lastAt: number
}

export function createUndoHistory<T>(initial: T): UndoHistory<T> {
  return {
    past: [],
    present: initial,
    future: [],
    lastKey: null,
    lastAt: 0,
  }
}

export function pushUndoStep<T>(
  state: UndoHistory<T>,
  next: T,
  options?: {
    coalesceKey?: string
    now?: number
    maxSteps?: number
    isEqual?: (a: T, b: T) => boolean
  },
): UndoHistory<T> {
  const equal = options?.isEqual
    ? options.isEqual(state.present, next)
    : Object.is(state.present, next)
  if (equal) return state

  const now = options?.now ?? Date.now()
  const key = options?.coalesceKey ?? null
  const maxSteps = options?.maxSteps ?? MAX_UNDO_STEPS
  const coalesced =
    key !== null &&
    state.lastKey === key &&
    state.past.length > 0 &&
    now - state.lastAt <= COALESCE_MS

  if (coalesced) {
    return {
      past: state.past,
      present: next,
      future: [],
      lastKey: key,
      lastAt: now,
    }
  }

  const nextPast = [...state.past, state.present]
  if (nextPast.length > maxSteps) nextPast.splice(0, nextPast.length - maxSteps)

  return {
    past: nextPast,
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  }
}

export function undoStep<T>(state: UndoHistory<T>): UndoHistory<T> {
  if (state.past.length === 0) return state
  const previous = state.past[state.past.length - 1] as T
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
    lastKey: null,
    lastAt: 0,
  }
}

export function redoStep<T>(state: UndoHistory<T>): UndoHistory<T> {
  if (state.future.length === 0) return state
  const [next, ...rest] = state.future as [T, ...T[]]
  const nextPast = [...state.past, state.present]
  if (nextPast.length > MAX_UNDO_STEPS) nextPast.splice(0, nextPast.length - MAX_UNDO_STEPS)
  return {
    past: nextPast,
    present: next,
    future: rest,
    lastKey: null,
    lastAt: 0,
  }
}

// Replaces `present` after a server round-trip (e.g. saving) while keeping the
// session's undo/redo stack intact.
export function replacePresent<T>(state: UndoHistory<T>, present: T): UndoHistory<T> {
  return {
    ...state,
    present,
    lastKey: null,
    lastAt: 0,
  }
}

export function shouldIgnoreUndoShortcut(target: unknown): boolean {
  if (target === null || typeof target !== 'object') return false
  const element = target as {
    isContentEditable?: unknown
    tagName?: unknown
    type?: unknown
  }
  if (element.isContentEditable === true) return true
  const tag = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = typeof element.type === 'string' ? element.type.toLowerCase() : 'text'
    return !['button', 'checkbox', 'radio', 'submit', 'reset'].includes(type)
  }
  return false
}

export function useUndoableState<T>(initial: T | (() => T), isEqual?: (a: T, b: T) => boolean) {
  const equalRef = useRef(isEqual)
  equalRef.current = isEqual
  const [history, setHistory] = useState<UndoHistory<T>>(() =>
    createUndoHistory(typeof initial === 'function' ? (initial as () => T)() : initial),
  )

  const set = useCallback((change: T | ((current: T) => T), coalesceKey?: string) => {
    setHistory((current) => {
      const next =
        typeof change === 'function' ? (change as (value: T) => T)(current.present) : change
      return pushUndoStep(current, next, {
        coalesceKey,
        isEqual: equalRef.current,
      })
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => undoStep(current))
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => redoStep(current))
  }, [])

  const syncPresent = useCallback((present: T) => {
    setHistory((current) => replacePresent(current, present))
  }, [])

  return {
    value: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    set,
    undo,
    redo,
    syncPresent,
  }
}
