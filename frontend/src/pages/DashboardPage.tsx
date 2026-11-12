import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../api/client'
import type { District, Meta, OverviewResponse, SectionResponse, SectionSummary, SectorMixResponse, SeriesResponse } from '../api/types'
import { DoughnutChart, LineChart } from '../components/charts'
import { DsaCard } from '../components/DsaCard'
import { ChartCard, Empty, ErrorBox, Kpi, Loading } from '../components/ui'
import { PALETTE, SECTOR_COLORS } from '../lib/chart'
import { crore, fy, inr, num, pct } from '../lib/format'

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function SectorCharts({ mix, districtName }: { mix: SectorMixResponse; districtName: string }) {
  const labels = ['Primary', 'Secondary', 'Tertiary']
  const vals = (m: SectorMixResponse['district']) => [m?.primary ?? null, m?.secondary ?? null, m?.tertiary ?? null]
  return (
    <>
      <div className="doughnuts">
        <figure><div className="pie"><DoughnutChart labels={labels} values={vals(mix.state)} colors={SECTOR_COLORS} /></div><figcaption>Maharashtra</figcaption></figure>
        <figure><div className="pie"><DoughnutChart labels={labels} values={vals(mix.district)} colors={SECTOR_COLORS} /></div><figcaption>{districtName}</figcaption></figure>
      </div>
      <ul className="legend" aria-label="Sector legend">
        {labels.map((l, i) => <li key={l}><span style={{ background: SECTOR_COLORS[i] }} />{l}</li>)}
      </ul>
    </>
  )
}

function DsaSections({ districtId }: { districtId: number }) {
  const sections = useApi<SectionSummary[]>('/sections')
  const [chosen, setChosen] = useState<string | null>(null)
  const active = chosen ?? sections.data?.[0]?.id ?? null
  const data = useApi<SectionResponse>(active ? `/districts/${districtId}/sections/${active}` : null)

  if (sections.error) return <ErrorBox message={sections.error} />
  if (!sections.data) return <Loading />
  const current = sections.data.find((s) => s.id === active)

  return (
    <section aria-labelledby="dsa-heading" className="dsa">
      <h2 id="dsa-heading">District Statistical Abstract</h2>
      <div className="tabs" role="tablist" aria-label="DSA sections">
        {sections.data.map((s) => (
          <button
            key={s.id} type="button" role="tab" id={`tab-${s.id}`} aria-selected={s.id === active}
            aria-controls="dsa-panel" className={`tab ${s.id === active ? 'on' : ''}`} onClick={() => setChosen(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div id="dsa-panel" role="tabpanel" aria-labelledby={active ? `tab-${active}` : undefined}>
        {current && <p className="muted">{current.description}</p>}
        {data.loading && <Loading />}
        {data.error && <ErrorBox message={data.error} />}
        {data.data && <div className="dsa-grid">{data.data.cards.map((c) => <DsaCard key={c.id} card={c} />)}</div>}
      </div>
    </section>
  )
}

export default function DistrictPage() {
  const params = useParams()
  const districtId = Number(params.id)
  const navigate = useNavigate()
  const [pickedYear, setPickedYear] = useState<string | null>(null)

  const districts = useApi<District[]>('/districts')
  const meta = useApi<Meta>('/meta')
  const year = pickedYear ?? meta.data?.latestYear ?? null
  const district = districts.data?.find((d) => d.id === districtId)

  const overview = useApi<OverviewResponse>(year ? `/districts/${districtId}/overview?year=${year}` : null)
  const mix = useApi<SectorMixResponse>(year ? `/districts/${districtId}/sector-mix?year=${year}` : null)
  const peers = district ? (districts.data ?? []).filter((d) => d.division === district.division) : []
  const peerIds = peers.map((p) => p.id).join(',')
  const trend = useApi<SeriesResponse>(Number.isInteger(districtId) && districtId > 0 ? `/gddp/series?districts=${districtId}&metric=dist` : null)
  const compare = useApi<SeriesResponse>(peerIds ? `/gddp/series?districts=${peerIds}&metric=dist` : null)
  const [failedMaps, setFailedMaps] = useState<string[]>([])

  if (!Number.isInteger(districtId) || districtId <= 0) return <Navigate to="/district" replace />
  if (districts.error) return <ErrorBox message={districts.error} />
  if (!districts.data) return <Loading />
  if (!district) return <Empty>District not found.</Empty>

  const o = overview.data?.overview
  const growth = o?.perc_lastyr
  const mapSrc = `${import.meta.env.BASE_URL}maps/${slugOf(district.name)}.svg`

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <p className="eyebrow">{district.division} division</p>
          <h1>{district.name}</h1>
        </div>
        <div className="controls">
          <label>
            <span>District</span>
            <select value={district.id} onChange={(e) => { setPickedYear(null); navigate(`/district/${e.target.value}`) }}>
              {districts.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label>
            <span>Financial year</span>
            <select value={year ?? ''} onChange={(e) => setPickedYear(e.target.value)} disabled={!meta.data}>
              {[...(meta.data?.years ?? [])].reverse().map((y) => <option key={y} value={y}>{fy(y)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {overview.error && <ErrorBox message={overview.error} />}
      <div className="kpis">
        {!failedMaps.includes(mapSrc) && (
          <img
            className="district-map" src={mapSrc} alt={`Map of ${district.name} district`}
            onError={() => setFailedMaps((f) => [...f, mapSrc])}
          />
        )}
        <Kpi label="GDDP (nominal)" value={crore(o?.dist)} hint={o?.gddp_rank ? `Rank ${o.gddp_rank} of ${o.district_count}` : undefined} />
        <Kpi label="Per capita income" value={inr(o?.per_cap_dist)} hint={o?.per_cap_state ? `State: ${inr(o.per_cap_state)}` : 'per annum'} />
        <Kpi label="Share in state GSDP" value={pct(o?.perc_dis_state)} />
        <Kpi
          label="Growth over previous year" value={pct(growth)}
          hint={growth === null || growth === undefined ? undefined : growth >= 0 ? '▲ nominal' : '▼ nominal'}
          tone={growth === null || growth === undefined ? undefined : growth >= 0 ? 'up' : 'down'}
        />
        <Kpi label="Population" value={num(o?.pop, 0)} hint={fy(year)} />
      </div>

      <div className="grid-2">
        <ChartCard title={`Nominal GDDP of ${district.name}`} subtitle="₹ crore">
          {trend.error ? <ErrorBox message={trend.error} /> : !trend.data ? <Loading /> : (
            <LineChart
              labels={trend.data.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
              series={[{ label: district.name, data: trend.data.series[0]?.values ?? [], color: PALETTE[1], emphasis: true }]}
            />
          )}
        </ChartCard>
        <ChartCard title={`Sector share – ${fy(year)}`} subtitle="Share of GVA by sector">
          {mix.error ? <ErrorBox message={mix.error} /> : !mix.data ? <Loading /> : <SectorCharts mix={mix.data} districtName={district.name} />}
        </ChartCard>
      </div>

      <ChartCard title={`Nominal GDDP – districts within ${district.division} division`} subtitle="₹ crore" height={360}>
        {compare.error ? <ErrorBox message={compare.error} /> : !compare.data ? <Loading /> : (
          <LineChart
            labels={compare.data.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
            series={compare.data.series.map((s, i) => {
              const d = peers.find((p) => p.id === s.districtId)
              return { label: d?.name ?? String(s.districtId), data: s.values, color: PALETTE[i % PALETTE.length], emphasis: s.districtId === districtId }
            })}
          />
        )}
      </ChartCard>

      <DsaSections key={districtId} districtId={districtId} />
    </>
  )
}
