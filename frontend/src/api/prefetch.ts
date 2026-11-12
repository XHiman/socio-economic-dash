import { prefetch, seed } from './client'
import type { Mix, Overview, SeriesResponse } from './types'

interface AllDistricts {
  year: string
  state: Mix
  districts: Record<string, { overview: Overview | null; mix: Mix | null }>
}

/**
 * Load the key figures of every district in two requests and file them under the per-district paths the page
 * reads, so picking a district renders from cache instead of waiting on the network. Safe to call repeatedly.
 * `yearQuery` is '' (server default: latest) or '?year=YYYY-YY', exactly as the page builds its own paths.
 */
export async function prefetchDistrictData(yearQuery: string, ids: number[]): Promise<void> {
  const [all, series] = await Promise.all([
    prefetch<AllDistricts>(`/overview/all${yearQuery}`),
    prefetch<SeriesResponse>(`/gddp/series?districts=${ids.join(',')}&metric=dist`),
  ])
  for (const id of ids) {
    const d = all.districts[id]
    if (d) {
      seed(`/districts/${id}/overview${yearQuery}`, { year: all.year, overview: d.overview })
      seed(`/districts/${id}/sector-mix${yearQuery}`, { year: all.year, district: d.mix, state: all.state })
    }
    const s = series.series.find((x) => x.districtId === id)
    if (s) seed(`/gddp/series?districts=${id}&metric=dist`, { metric: series.metric, years: series.years, series: [s] })
  }
}
