// The season API. Every failure is one of three things to a screen: you are signed out, the server
// could not be reached (try again), or the server refused this particular thing.

import { SERVER_URL } from '../socket/index.ts'
import type { AuthRecord, AuthUser } from './authStore.ts'
import type { SeasonHome, SeasonSettings, SeasonView } from './types.ts'

export class SignedOut extends Error {}
export class Unreachable extends Error {}
export class Refused extends Error {
  code: string
  constructor(code: string) { super(code); this.code = code }
}

// A Heroku dyno that has gone to sleep takes around ten seconds to answer its first request.
const TIMEOUT_MS = 25_000

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${SERVER_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch {
    throw new Unreachable('network')
  } finally {
    window.clearTimeout(timer)
  }
  if (res.status === 401) throw new SignedOut('signed_out')
  if (res.status === 503) throw new Unreachable('unavailable')
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Refused(body?.error ?? String(res.status))
  return body as T
}

const post = <T>(path: string, token: string | null, body?: unknown) =>
  request<T>(path, token, { method: 'POST', body: JSON.stringify(body ?? {}) })

export const api = {
  me: (token: string) => request<{ user: AuthUser }>('/auth/me', token),
  logout: (token: string) => post('/auth/logout', token),
  handoff: (id: string) => request<{ status: 'pending' } | ({ status: 'done' } & AuthRecord)>(`/auth/handoff/${id}`, null),
  devLogin: (name: string) => post<AuthRecord>('/auth/dev-login', null, { name }),

  home: (token: string) => request<SeasonHome>('/season/home', token),
  season: (token: string, id: string) => request<{ season: SeasonView }>(`/season/${id}`, token),
  newSeason: (token: string, body: { slot: number; teamId: string; settings: SeasonSettings; replace?: boolean }) =>
    post<{ season: SeasonView }>('/season/new', token, body),
  sim: (token: string, id: string) => post<{ season: SeasonView }>(`/season/${id}/sim`, token),
  ack: (token: string, id: string) => post<{ season: SeasonView }>(`/season/${id}/ack`, token),
  remove: (token: string, id: string) => request(`/season/${id}`, token, { method: 'DELETE' }),
}
