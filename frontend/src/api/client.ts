import { useEffect, useState } from 'react'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Finished responses by path (insertion-ordered, so the oldest is dropped first). */
const cache = new Map<string, unknown>()
const CACHE_LIMIT = 200
/** Requests still running, so two components asking for the same path share one request. */
const inflight = new Map<string, Promise<unknown>>()

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}api${path}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let message = 'Request failed'
    try { message = ((await res.json()) as { error?: string }).error ?? message } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

function load<T>(path: string): Promise<T> {
  let p = inflight.get(path) as Promise<T> | undefined
  if (!p) {
    p = getJson<T>(path)
      .then((data) => {
        cache.set(path, data)
        if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
        return data
      })
      .finally(() => inflight.delete(path))
    inflight.set(path, p)
  }
  return p
}

export interface ApiState<T> { data: T | null; error: string | null; loading: boolean }

/** GET /api{path}; pass null to skip. Responses are memoised per session and concurrent identical requests are shared. */
export function useApi<T>(path: string | null): ApiState<T> {
  const cached = path === null ? undefined : (cache.get(path) as T | undefined)
  const [state, setState] = useState<{ path: string | null; data: T | null; error: string | null }>({ path: null, data: null, error: null })

  useEffect(() => {
    if (path === null || cache.has(path)) return
    let live = true
    load<T>(path).then(
      (data) => { if (live) setState({ path, data, error: null }) },
      (e: unknown) => { if (live) setState({ path, data: null, error: e instanceof Error ? e.message : 'Request failed' }) },
    )
    return () => { live = false }
  }, [path])

  if (path === null) return { data: null, error: null, loading: false }
  if (cached !== undefined) return { data: cached, error: null, loading: false }
  // Until the effect catches up with a new path, report loading instead of stale data.
  if (state.path !== path) return { data: null, error: null, loading: true }
  return { data: state.data, error: state.error, loading: state.data === null && state.error === null }
}
