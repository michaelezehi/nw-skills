import { describe, expect, test } from 'claude-code/testing'

import { costOf, priceOf, windowOf } from '../hooks/pricing'

const usd = (n: number): number => Math.round(n * 1e6) / 1e6

const M = { input_tokens: 1e6, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

describe('pricing', () => {
  test('each current model has its own list price', async () => {
    expect(priceOf('claude-fable-5-1')).toEqual([10, 50, 0.25, 12.5])
    expect(priceOf('claude-fable-5')).toEqual([10, 50, 1, 12.5])
    expect(priceOf('claude-opus-5-5[1m]')).toEqual([4, 20, 0.2, 5])
    expect(priceOf('claude-opus-5')).toEqual([5, 25, 0.5, 6.25])
    expect(priceOf('claude-sonnet-5-5')).toEqual([2, 10, 0.2, 2.5])
    expect(priceOf('claude-sonnet-4-6')).toEqual([3, 15, 0.3, 3.75])
    expect(priceOf('claude-haiku-5-5')).toEqual([0.1, 0.5, 0.01, 0.125])
    expect(priceOf('claude-haiku-4-5-20251001')).toEqual([1, 5, 0.1, 1.25])
  })

  test('Haiku 5.5 charges 5x over a 100K prompt, Haiku 4.5 does not', async () => {
    const short = { ...M, input_tokens: 50_000 }
    expect(usd(costOf('claude-haiku-5-5', short))).toBe(0.005)
    expect(usd(costOf('claude-haiku-5-5', M))).toBe(0.5)
    expect(usd(costOf('claude-haiku-4-5', M))).toBe(1)
  })

  test('only Haiku 4.5 and older have a 200K window', async () => {
    expect(windowOf('claude-haiku-4-5')).toBe(200_000)
    expect(windowOf('claude-haiku-5-5')).toBe(1_000_000)
  })
})
