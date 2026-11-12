import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../api/client'
import type { District, SeriesResponse, StateResponse, StateRow } from '../api/types'
import { PALETTE } from '../lib/chart'
import { crore, fy, num, pct } from '../lib/format'
import { BarChart, LineChart } from './charts'
import { ChartPanel } from './Modal'
import { ErrorBox, Loading } from './ui'

const REFERENCE = 'District Domestic Product estimates (dsa_gddp), nominal'

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return <button type="button" role="tab" aria-selected={on} className={`tab ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>
}

/** Full-screen view of a district's GDDP: its own trend, or all districts in its division. */
export function DistrictGddpExpanded({ district, districts, trend }: { district: District; districts: District[]; trend: SeriesResponse | null }) {
  const [tab, setTab] = useState<'self' | 'division'>('self')
  const peers = districts.filter((d) => d.division === district.division)
  const compare = useApi<SeriesResponse>(tab === 'division' ? `/gddp/series?districts=${peers.map((p) => p.id).join(',')}&metric=dist` : null)

  const title = tab === 'self' ? `Nominal GDDP of ${district.name}` : `Nominal GDDP – districts within ${district.division} division`
  return (
    <ChartPanel
      title={title} reference={REFERENCE}
      tabs={<>
        <Tab on={tab === 'self'} onClick={() => setTab('self')}>{district.name}</Tab>
        <Tab on={tab === 'division'} onClick={() => setTab('division')}>{`Districts in ${district.division} division`}</Tab>
      </>}
    >
      {tab === 'self' ? (
        !trend ? <Loading /> : (
          <LineChart
            labels={trend.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
            series={[{ label: district.name, data: trend.series[0]?.values ?? [], color: PALETTE[1], emphasis: true }]}
          />
        )
      ) : compare.error ? <ErrorBox message={compare.error} /> : !compare.data ? <Loading /> : (
        <LineChart
          labels={compare.data.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
          series={compare.data.series.map((s, i) => ({
            label: peers.find((p) => p.id === s.districtId)?.name ?? String(s.districtId),
            data: s.values, color: PALETTE[i % PALETTE.length], emphasis: s.districtId === district.id,
          }))}
        />
      )}
    </ChartPanel>
  )
}

type SortKey = 'name' | 'division' | 'dist' | 'per_cap_dist' | 'perc_dis_state' | 'perc_lastyr'

function RankingTable({ state }: { state: StateResponse }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'dist', dir: -1 })
  const rows = useMemo(() => {
    const list = [...state.districts]
    list.sort((a: StateRow, b: StateRow) => {
      const x = a[sort.key], y = b[sort.key]
      if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * sort.dir
      return ((x ?? -Infinity) - (y ?? -Infinity)) * sort.dir
    })
    return list
  }, [state.districts, sort])

  const th = (key: SortKey, label: string, numeric = true) => (
    <th scope="col" className={numeric ? 'num' : ''} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' || key === 'division' ? 1 : -1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col" className="num">#</th>
            {th('name', 'District', false)}{th('division', 'Division', false)}
            {th('dist', 'GDDP (₹ crore)')}{th('per_cap_dist', 'Per capita (₹)')}
            {th('perc_dis_state', 'Share of state (%)')}{th('perc_lastyr', 'Growth (%)')}
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => (
            <tr key={d.id}>
              <td className="num muted">{i + 1}</td>
              <th scope="row"><Link to={`/dashboard/${d.id}`}>{d.name}</Link></th>
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
  )
}

/** Full-screen view of the state GSDP: trend, GDDP by division, and the district ranking. */
export function StateGddpExpanded({ state }: { state: StateResponse }) {
  const [tab, setTab] = useState<'trend' | 'division' | 'ranking'>('trend')
  const byDivision = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of state.districts) if (!d.combinedWithOther) m.set(d.division, (m.get(d.division) ?? 0) + (d.dist ?? 0))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [state.districts])

  const title = tab === 'trend' ? 'Nominal GSDP of Maharashtra' : tab === 'division' ? `GDDP by division – ${fy(state.year)}` : `District ranking – ${fy(state.year)}`
  return (
    <ChartPanel
      title={title} reference={REFERENCE} canDownload={tab !== 'ranking'} plain={tab === 'ranking'}
      tabs={<>
        <Tab on={tab === 'trend'} onClick={() => setTab('trend')}>State trend</Tab>
        <Tab on={tab === 'division'} onClick={() => setTab('division')}>By division</Tab>
        <Tab on={tab === 'ranking'} onClick={() => setTab('ranking')}>District ranking</Tab>
      </>}
    >
      {tab === 'trend' ? (
        <LineChart
          labels={state.trend.map((t) => fy(t.year))} yTitle="GSDP (₹ crore)" format={(v) => crore(v)}
          series={[{ label: 'Maharashtra', data: state.trend.map((t) => t.gddp), color: PALETTE[1], emphasis: true }]}
        />
      ) : tab === 'division' ? (
        <BarChart horizontal labels={byDivision.map(([d]) => d)} values={byDivision.map(([, v]) => v)} format={crore} unit="₹ crore" color={PALETTE[1]} />
      ) : <RankingTable state={state} />}
    </ChartPanel>
  )
}
