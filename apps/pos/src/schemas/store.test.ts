import { describe, expect, it } from 'vitest'
import { EMPTY_NEW_STORE, newStorePayload, withStore } from './store'

describe('newStorePayload', () => {
  it('trims the name and leaves blank emails out so the API copies the current store', () => {
    expect(newStorePayload({ ...EMPTY_NEW_STORE, name: '  Nhà hàng  ' })).toEqual({
      name: 'Nhà hàng',
      country_code: 'VN',
    })
  })

  it('sends emails that were filled in', () => {
    expect(
      newStorePayload({
        name: 'Quán',
        country_code: 'VN',
        mail_from_address: ' shop@example.test ',
        customer_support_email: 'help@example.test',
      }),
    ).toEqual({
      name: 'Quán',
      country_code: 'VN',
      mail_from_address: 'shop@example.test',
      customer_support_email: 'help@example.test',
    })
  })
})

describe('withStore', () => {
  it('adds the new store in name order without duplicating it', () => {
    const stores = [
      { id: 'b', name: 'Bida', code: 'bida' },
      { id: 'c', name: 'Cafe', code: 'cafe' },
    ]
    const created = { id: 'a', name: 'An', code: 'an' }
    expect(withStore(stores, created).map((store) => store.id)).toEqual(['a', 'b', 'c'])
    expect(withStore([...stores, created], created)).toHaveLength(3)
  })
})
