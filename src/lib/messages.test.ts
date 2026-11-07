import { describe, expect, it } from 'vitest'
import type { PcMessageDelivery } from './messages-api'
import {
  describeDeliverySummary,
  describeMessageStatus,
  describeOfflineExclusion,
  getUndeliveredResults,
} from './messages'

const results: PcMessageDelivery[] = [
  { pcId: 1, pcName: 'PC-1', status: 'delivered' },
  { pcId: 2, pcName: 'PC-2', status: 'offline' },
  { pcId: 3, pcName: 'PC-3', status: 'delivered' },
]

describe('messages', () => {
  describe('describeMessageStatus', () => {
    it.each([
      ['failed', "Didn't confirm — the PC may need client 0.12.0"],
      ['offline', 'Offline'],
      ['not-found', 'No longer registered'],
      ['busy', 'Too many messages waiting'],
    ] as const)('describes the %s status', (status, label) => {
      expect(describeMessageStatus(status)).toBe(label)
    })
  })

  describe('getUndeliveredResults', () => {
    it('keeps only the results that were not delivered', () => {
      expect(getUndeliveredResults(results)).toEqual([results[1]])
    })

    it('returns nothing when every PC got the message', () => {
      expect(getUndeliveredResults([results[0]])).toEqual([])
    })
  })

  describe('describeDeliverySummary', () => {
    it('counts delivered PCs out of all results', () => {
      expect(describeDeliverySummary(results)).toBe('Delivered to 2 of 3 PCs.')
    })

    it('uses the singular for one PC', () => {
      expect(describeDeliverySummary([results[0]])).toBe('Delivered to 1 of 1 PC.')
    })
  })

  describe('describeOfflineExclusion', () => {
    it('returns nothing when no selected PC is offline', () => {
      expect(describeOfflineExclusion(0)).toBe('')
    })

    it('uses the singular for one offline PC', () => {
      expect(describeOfflineExclusion(1)).toBe("1 offline PC won't get it.")
    })

    it('uses the plural for several offline PCs', () => {
      expect(describeOfflineExclusion(2)).toBe("2 offline PCs won't get it.")
    })
  })
})
