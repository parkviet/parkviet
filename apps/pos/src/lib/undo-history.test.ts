import { describe, expect, it } from 'vitest'
import {
  COALESCE_MS,
  createUndoHistory,
  MAX_UNDO_STEPS,
  pushUndoStep,
  redoStep,
  replacePresent,
  shouldIgnoreUndoShortcut,
  undoStep,
} from './undo-history'

describe('undo history', () => {
  it('pushes steps and undoes / redoes in order', () => {
    let state = createUndoHistory({ name: 'A', paper: '80mm' })
    state = pushUndoStep(state, { name: 'B', paper: '80mm' }, { now: 1000 })
    state = pushUndoStep(state, { name: 'B', paper: '58mm' }, { now: 2000 })
    expect(state.past).toHaveLength(2)
    expect(state.present).toEqual({ name: 'B', paper: '58mm' })

    state = undoStep(state)
    expect(state.present).toEqual({ name: 'B', paper: '80mm' })
    expect(state.future).toHaveLength(1)

    state = undoStep(state)
    expect(state.present).toEqual({ name: 'A', paper: '80mm' })
    expect(undoStep(state)).toBe(state)

    state = redoStep(state)
    expect(state.present).toEqual({ name: 'B', paper: '80mm' })
    state = redoStep(state)
    expect(state.present).toEqual({ name: 'B', paper: '58mm' })
    expect(redoStep(state)).toBe(state)
  })

  it('coalesces continuous typing in the same field within 500ms', () => {
    let state = createUndoHistory('Phiếu')
    state = pushUndoStep(state, 'Phiếu ', { coalesceKey: 'name', now: 1000 })
    state = pushUndoStep(state, 'Phiếu b', { coalesceKey: 'name', now: 1200 })
    state = pushUndoStep(state, 'Phiếu bá', { coalesceKey: 'name', now: 1200 + COALESCE_MS })
    expect(state.past).toEqual(['Phiếu'])
    expect(state.present).toBe('Phiếu bá')

    // Pausing longer than 500ms starts a new undo step.
    state = pushUndoStep(state, 'Phiếu bán hàng', {
      coalesceKey: 'name',
      now: 1200 + COALESCE_MS + COALESCE_MS + 1,
    })
    expect(state.past).toEqual(['Phiếu', 'Phiếu bá'])

    // Switching to another field immediately also starts a new undo step.
    state = pushUndoStep(state, 'Cảm ơn', {
      coalesceKey: 'footer-0',
      now: 1200 + COALESCE_MS + COALESCE_MS + 50,
    })
    expect(state.past).toEqual(['Phiếu', 'Phiếu bá', 'Phiếu bán hàng'])
  })

  it('clears the redo branch when a new edit follows an undo', () => {
    let state = createUndoHistory(1)
    state = pushUndoStep(state, 2, { now: 100 })
    state = pushUndoStep(state, 3, { now: 800 })
    state = undoStep(state)
    expect(state.future).toEqual([3])

    state = pushUndoStep(state, 4, { now: 1500 })
    expect(state.present).toBe(4)
    expect(state.future).toEqual([])
    expect(state.past).toEqual([1, 2])
  })

  it('caps history at MAX_UNDO_STEPS and preserves history across replacePresent', () => {
    let state = createUndoHistory(0)
    for (let index = 1; index <= MAX_UNDO_STEPS + 10; index += 1) {
      state = pushUndoStep(state, index, { now: index * 1000 })
    }
    expect(state.past).toHaveLength(MAX_UNDO_STEPS)
    expect(state.past[0]).toBe(10)
    expect(state.present).toBe(MAX_UNDO_STEPS + 10)

    const saved = replacePresent(state, 999)
    expect(saved.present).toBe(999)
    expect(saved.past).toHaveLength(MAX_UNDO_STEPS)
    expect(undoStep(saved).present).toBe(MAX_UNDO_STEPS + 9)
  })

  it('skips duplicate states when isEqual returns true', () => {
    const state = createUndoHistory({ text: 'Hello' })
    const next = pushUndoStep(state, { text: 'Hello' }, { isEqual: (a, b) => a.text === b.text })
    expect(next).toBe(state)
  })

  it('ignores shortcuts inside text inputs and textareas but allows checkboxes and buttons', () => {
    expect(shouldIgnoreUndoShortcut({ tagName: 'INPUT', type: 'text' })).toBe(true)
    expect(shouldIgnoreUndoShortcut({ tagName: 'INPUT', type: 'number' })).toBe(true)
    expect(shouldIgnoreUndoShortcut({ tagName: 'TEXTAREA' })).toBe(true)
    expect(shouldIgnoreUndoShortcut({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(shouldIgnoreUndoShortcut({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
    expect(shouldIgnoreUndoShortcut({ tagName: 'INPUT', type: 'radio' })).toBe(false)
    expect(shouldIgnoreUndoShortcut({ tagName: 'BUTTON' })).toBe(false)
    expect(shouldIgnoreUndoShortcut(null)).toBe(false)
  })
})
