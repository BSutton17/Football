import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// [keep awake] "While a game is being played, ping the server every 10 minutes." Heroku eco dynos
// sleep after 30 minutes without HTTP traffic, and the game's socket does not count.
describe('keeping the server awake', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))) })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('pings at once, then every 10 minutes, and stops when told', async () => {
    const { startKeepAwake, KEEP_AWAKE_MS } = await import('../socket/keepAwake')
    expect(KEEP_AWAKE_MS).toBe(10 * 60 * 1000)
    const stop = startKeepAwake()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String((fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0])).toMatch(/\/ping$/)
    vi.advanceTimersByTime(KEEP_AWAKE_MS * 3)
    expect(fetch).toHaveBeenCalledTimes(4)            // well inside every 30-minute sleep window
    stop()
    vi.advanceTimersByTime(KEEP_AWAKE_MS * 3)
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})
