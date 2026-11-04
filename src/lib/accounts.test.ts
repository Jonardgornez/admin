import { describe, expect, it } from 'vitest'
import { accounts } from '../data/accounts'
import { filterAccounts } from './accounts'

describe('filterAccounts', () => {
  it('returns all accounts for an empty or blank query', () => {
    expect(filterAccounts(accounts, '')).toHaveLength(8)
    expect(filterAccounts(accounts, '  ')).toHaveLength(8)
  })

  it('matches username case-insensitively', () => {
    expect(filterAccounts(accounts, 'LAB-PC03').map((a) => a.username)).toEqual(['lab-pc03'])
  })

  it('matches assigned PC', () => {
    expect(filterAccounts(accounts, 'pc-07').map((a) => a.username)).toEqual(['lab-pc07'])
  })

  it('matches several accounts by a shared fragment', () => {
    expect(filterAccounts(accounts, 'lab-pc0')).toHaveLength(8)
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterAccounts(accounts, 'nobody')).toEqual([])
  })
})
