import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../api/client'
import type { Meta, StateResponse, StateRow } from '../api/types'
import { BarChart, LineChart } from '../components/charts'
import { ChartCard, ErrorBox, Kpi, Loading } from '../components/ui'
import { PALETTE } from '../lib/chart'
import { crore, fy, inr, num, pct } from '../lib/format'

type SortKey = 'name' | 'division' | 'dist' | 'per_cap_dist' | 'perc_dis_state' | 'perc_lastyr'

export default function StatePage() {
  const [pickedYear, setPickedYear] = useState<string | null>(null)
  const meta = useApi<Meta>('/meta')
  const year = pickedYear ?? meta.data?.latestYear ?? null
  const state = useApi<StateResponse>(year ? `/state?year=${year}` : null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'dist', dir: -1 })

  const rows = useMemo(() => {
    const list = [...(state.data?.districts ?? [])]
    list.sort((a: StateRow, b: StateRow) => {
      const x = a[sort.key], y = b[sort.key]
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sort.dir
      return ((x ?? -Infinity) - (y ?? -Infinity)) * sort.dir
    })
    return list
  }, [state.data, sort])

  const byDivision = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of state.data?.districts ?? []) if (!d.combinedWithOther) m.set(d.division, (m.get(d.division) ?? 0) + (d.dist ?? 0))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [state.data])

  if (meta.error) return <ErrorBox message={meta.error} />
  if (state.error) return <ErrorBox message={state.error} />

  const fastest = state.data?.districts.reduce<StateRow | null>(
    (best, d) => (d.perc_lastyr !== null && (!best || d.perc_lastyr > (best.perc_lastyr ?? -Infinity)) ? d : best), null)

  const th = (key: SortKey, label: string, numeric = true) => (
    <th scope="col" className={numeric ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' || key === 'division' ? 1 : -1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <p className="eyebrow">Socio-economic dashboard</p>
          <h1>Maharashtra</h1>
        </div>
        <div className="controls">
          <label>
            <span>Financial year</span>
            <select value={year ?? ''} onChange={(e) => setPickedYear(e.target.value)} disabled={!meta.data}>
              {[...(meta.data?.years ?? [])].reverse().map((y) => <option key={y} value={y}>{fy(y)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {!state.data ? <Loading /> : (
        <>
          <div className="kpis">
            <Kpi label="State GSDP (nominal)" value={crore(state.data.state?.state)} hint={fy(state.data.year)} />
            <Kpi label="Per capita income" value={inr(state.data.state?.per_cap_state)} hint="per annum" />
            <Kpi label="Districts" value={String(state.data.districts.length)} />
            <Kpi label="Largest district economy" value={state.data.districts[0]?.name ?? ''} hint={crore(state.data.districts[0]?.dist)} />
            <Kpi label="Fastest-growing district" value={fastest?.name ?? ''} hint={fastest ? `${pct(fastest.perc_lastyr)} over previous year` : undefined} tone="up" />
          </div>

          <div className="grid-2">
            <ChartCard title="State GSDP over time" subtitle="₹ crore">
              <LineChart
                labels={state.data.trend.map((t) => fy(t.year))} yTitle="GSDP (₹ crore)" format={crore}
                series={[{ label: 'Maharashtra', data: state.data.trend.map((t) => t.gddp), color: PALETTE[0], emphasis: true }]}
              />
            </ChartCard>
            <ChartCard title={`GDDP by division – ${fy(state.data.year)}`} subtitle="₹ crore">
              <BarChart horizontal labels={byDivision.map(([d]) => d)} values={byDivision.map(([, v]) => v)} format={crore} color={PALETTE[1]} />
            </ChartCard>
          </div>

          <section className="card" aria-labelledby="rank-h">
            <header className="card-head"><h3 id="rank-h">District ranking – {fy(state.data.year)}</h3></header>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col" className="num">#</th>
                    {th('name', 'District', false)}{th('division', 'Division', false)}
                    {th('dist', 'GDDP (₹ Cr)')}{th('per_cap_dist', 'Per capita (₹)')}
                    {th('perc_dis_state', 'Share of state')}{th('perc_lastyr', 'Growth')}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d, i) => (
                    <tr key={d.id}>
                      <td className="num muted">{i + 1}</td>
                      <th scope="row"><Link to={`/district/${d.id}`}>{d.name}</Link></th>
                      <td>{d.division}</td>
                      <td className="num">{num(d.dist, 0)}</td>
                      <td className="num">{num(d.per_cap_dist, 0)}</td>
                      <td className="num">{pct(d.perc_dis_state)}</td>
                      <td className={`num ${(d.perc_lastyr ?? 0) < 0 ? 'down' : 'up'}`}>{pct(d.perc_lastyr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
