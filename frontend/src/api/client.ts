import { useEffect, useState } from 'react'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const cache = new Map<string, unknown>()

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`/api${path}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    let message = 'Request failed'
    try { message = ((await res.json()) as { error?: string }).error ?? message } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

export interface ApiState<T> { data: T | null; error: string | null; loading: boolean }

/** GET /api{path}; pass null to skip. Responses are memoised per session. */
export function useApi<T>(path: string | null): ApiState<T> {
  const [state, setState] = useState<{ path: string | null } & ApiState<T>>({
    path: null, data: null, error: null, loading: path !== null,
  })

  useEffect(() => {
    if (path === null) return
    const hit = cache.get(path) as T | undefined
    if (hit !== undefined) {
      setState({ path, data: hit, error: null, loading: false })
      return
    }
    const ctl = new AbortController()
    getJson<T>(path, ctl.signal)
      .then((data) => {
        cache.set(path, data)
        setState({ path, data, error: null, loading: false })
      })
      .catch((e: unknown) => {
        if (ctl.signal.aborted) return
        setState({ path, data: null, error: e instanceof Error ? e.message : 'Request failed', loading: false })
      })
    return () => ctl.abort()
  }, [path])

  if (path === null) return { data: null, error: null, loading: false }
  // Until the effect catches up with a new path, report loading instead of stale data.
  if (state.path !== path) return { data: null, error: null, loading: true }
  return { data: state.data, error: state.error, loading: state.loading }
}
