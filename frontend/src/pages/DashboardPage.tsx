import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../api/client'
import type { District, Meta, OverviewResponse, SectionResponse, SectionSummary, SectorMixResponse, SeriesResponse, StateResponse, StateRow } from '../api/types'
import { DoughnutChart, LineChart } from '../components/charts'
import { DsaCard } from '../components/DsaCard'
import { ProfileCard } from '../components/ProfileCard'
import { Masonry } from '../components/Masonry'
import { DistrictGddpExpanded, StateGddpExpanded } from '../components/GddpExpanded'
import { ChartPanel, ICON, Icon } from '../components/Modal'
import { ChartCard, Empty, ErrorBox, Kpi, Loading } from '../components/ui'
import { sectorColors, seriesColor } from '../lib/chart'
import { crore, fy, inr, num, pct } from '../lib/format'
import { sameYear } from '../lib/years'

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const SECTOR_LABELS = ['Primary', 'Secondary', 'Tertiary']
const sectorLegend = () => SECTOR_LABELS.map((label, i) => ({ label, color: sectorColors()[i]! }))

function SectorCharts({ mix, districtName, callouts, names = false }: { mix: SectorMixResponse; districtName: string | null; callouts: boolean; names?: boolean }) {
  const SECTOR_COLORS = sectorColors()
  const vals = (m: SectorMixResponse['district']) => [m?.primary ?? null, m?.secondary ?? null, m?.tertiary ?? null]
  return (
    <>
      <div className="doughnuts">
        <figure><div className="pie"><DoughnutChart labels={SECTOR_LABELS} values={vals(mix.state)} colors={SECTOR_COLORS} callouts={callouts} names={names} /></div><figcaption>Maharashtra</figcaption></figure>
        {districtName && <figure><div className="pie"><DoughnutChart labels={SECTOR_LABELS} values={vals(mix.district)} colors={SECTOR_COLORS} callouts={callouts} names={names} /></div><figcaption>{districtName}</figcaption></figure>}
      </div>
      <ul className="legend" aria-label="Sector legend">
        {SECTOR_LABELS.map((l, i) => <li key={l}><span style={{ background: SECTOR_COLORS[i] }} />{l}</li>)}
      </ul>
    </>
  )
}

/** Full-screen sector share, with the on-ring percentage callouts switchable. */
function SectorExpanded({ mix, districtName, year }: { mix: SectorMixResponse; districtName: string | null; year: string | null }) {
  const [callouts, setCallouts] = useState(true)
  return (
    <ChartPanel
      title={`Sector share – ${fy(year)}`} reference="District Domestic Product estimates (dsa_gddp), share of GVA (%)" legend={sectorLegend()}
      tabs={<span className="muted small">Share of GVA by sector (%)</span>}
      tools={
        <button type="button" className={`btn-tool ${callouts ? 'on' : ''}`} aria-pressed={callouts} onClick={() => setCallouts((c) => !c)} title="Show or hide the percentage callouts">
          <Icon d={ICON.flip} />Callouts
        </button>
      }
    >
      <SectorCharts mix={mix} districtName={districtName} callouts={callouts} names={callouts} />
    </ChartPanel>
  )
}

/** districtId null = whole state: cards aggregate all districts and are split by district. */
function DsaSections({ districtId, year }: { districtId: number | null; year: string | null }) {
  const sections = useApi<SectionSummary[]>('/sections')
  const [chosen, setChosen] = useState<string | null>(null)
  const active = chosen ?? sections.data?.[0]?.id ?? null
  const base = districtId === null ? '/state' : `/districts/${districtId}`
  const data = useApi<SectionResponse>(active && year ? `${base}/sections/${active}?year=${year}` : null)

  if (sections.error) return <ErrorBox message={sections.error} />
  if (!sections.data) return <Loading />
  const current = sections.data.find((s) => s.id === active)

  return (
    <section aria-labelledby="dsa-heading" className="dsa">
      <h2 id="dsa-heading">{districtId === null ? 'State' : 'District'} Statistical Abstract</h2>
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
        {data.data && <Masonry className="dsa-grid">{data.data.cards.filter((c) => districtId !== null || !c.static).map((c) => <DsaCard key={c.id} card={c} split={districtId === null ? 'district' : 'taluka'} historyPath={`${base}/cards/${c.id}/history`} selectedYear={year} />)}</Masonry>}
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const params = useParams()
  const isState = params.id === undefined || params.id === 'state'
  const districtId = isState ? 0 : Number(params.id)
  const validId = isState || (Number.isInteger(districtId) && districtId > 0)
  const navigate = useNavigate()
  const [pickedYear, setPickedYear] = useState<string | null>(null)

  const districts = useApi<District[]>('/districts')
  const meta = useApi<Meta>('/meta')
  const year = pickedYear ?? meta.data?.latestYear ?? null
  const district = isState ? undefined : districts.data?.find((d) => d.id === districtId)

  const overview = useApi<OverviewResponse>(!isState && year ? `/districts/${districtId}/overview?year=${year}` : null)
  const stateData = useApi<StateResponse>(isState && year ? `/state?year=${year}` : null)
  const mix = useApi<SectorMixResponse>(year && !isState ? `/districts/${districtId}/sector-mix?year=${year}` : null)
  // State Profile = the profile card of the People section, aggregated over all districts (same request the Abstract below makes).
  const people = useApi<SectionResponse>(isState && year ? `/state/sections/people?year=${year}` : null)
  const profile = people.data?.cards.find((c) => c.id === 'profile')
  const trend = useApi<SeriesResponse>(!isState && validId ? `/gddp/series?districts=${districtId}&metric=dist` : null)
  const [failedMaps, setFailedMaps] = useState<string[]>([])

  if (!validId) return <Navigate to="/" replace />
  if (districts.error) return <ErrorBox message={districts.error} />
  if (!districts.data) return <Loading />
  if (!isState && !district) return <Empty>District not found.</Empty>

  const name = isState ? 'Maharashtra' : district!.name
  const o = overview.data?.overview
  const st = stateData.data
  const stateTrend = st?.trend ?? []
  const stateGrowth = (() => {
    const i = stateTrend.findIndex((t) => t.year === st?.year)
    const cur = stateTrend[i]?.gddp
    const prev = stateTrend[i - 1]?.gddp
    return i > 0 && cur != null && prev ? Math.round((cur / prev - 1) * 10000) / 100 : null
  })()
  const statePop = st ? st.districts.reduce((a, d) => a + (d.combinedWithOther ? 0 : d.pop ?? 0), 0) : null
  const fastest = st?.districts.reduce<StateRow | null>(
    (best, d) => (d.perc_lastyr !== null && (!best || d.perc_lastyr > (best.perc_lastyr ?? -Infinity)) ? d : best), null)
  const growth = isState ? stateGrowth : o?.perc_lastyr
  const mapSrc = isState ? '' : `${import.meta.env.BASE_URL}maps/${slugOf(district!.name)}.svg`
  const loadError = isState ? stateData.error : overview.error
  const gddpYear = isState ? st?.year : overview.data?.year

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <p className="eyebrow">{isState ? 'State · all districts' : `${district!.division} division`}</p>
          <h1>{name}</h1>
        </div>
        <div className="controls">
          <div className="location-selector" role="group" aria-label="Region">
            <span className="field-caption">Region</span>
            <div className="location-row">
              <button type="button" className={`state-button ${isState ? 'active' : ''}`} aria-pressed={isState} onClick={() => navigate('/')}>
                Maharashtra (State)
              </button>
              <select
                aria-label="District" value={isState ? '' : districtId}
                onChange={(e) => { if (e.target.value) navigate(`/dashboard/${e.target.value}`) }}
              >
                <option value="" disabled>Select district</option>
                {districts.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <label>
            <span>Financial year</span>
            <select value={year ?? ''} onChange={(e) => setPickedYear(e.target.value)} disabled={!meta.data}>
              {[...(meta.data?.years ?? [])].reverse().map((y) => <option key={y} value={y}>{fy(y)}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loadError && <ErrorBox message={loadError} />}
      {gddpYear && year && !sameYear(gddpYear, year) && (
        <p className="note">GDDP estimates for {fy(year)} are not up yet, so GDDP, income, population and sector figures show {fy(gddpYear)}.</p>
      )}
      <div className="kpis">
        {!isState && !failedMaps.includes(mapSrc) && (
          <img
            className="district-map" src={mapSrc} alt={`Map of ${name} district`}
            onError={() => setFailedMaps((f) => [...f, mapSrc])}
          />
        )}
        {isState ? (
          <>
            <Kpi label="GSDP (nominal)" value={crore(st?.state?.state)} hint="₹ crore" />
            <Kpi label="Per capita income" value={inr(st?.state?.per_cap_state)} hint="₹ per annum" />
            <Kpi label="Largest district economy" value={st?.districts[0]?.name ?? ''} hint={crore(st?.districts[0]?.dist)} />
            <Kpi label="Fastest-growing district" value={fastest?.name ?? ''} hint={fastest ? `${pct(fastest.perc_lastyr)} over previous year` : undefined} tone="up" />
          </>
        ) : (
          <>
            <Kpi label="GDDP (nominal)" value={crore(o?.dist)} hint={o?.gddp_rank ? `Rank ${o.gddp_rank} of ${o.district_count}` : undefined} />
            <Kpi label="Per capita income" value={inr(o?.per_cap_dist)} hint={o?.per_cap_state ? `State: ${inr(o.per_cap_state)}` : '₹ per annum'} />
            <Kpi label="Share in state GSDP" value={pct(o?.perc_dis_state)} />
          </>
        )}
        <Kpi
          label="Growth over previous year" value={pct(growth)}
          hint={growth === null || growth === undefined ? undefined : growth >= 0 ? '▲ nominal' : '▼ nominal'}
          tone={growth === null || growth === undefined ? undefined : growth >= 0 ? 'up' : 'down'}
        />
        <Kpi label="Population" value={num(isState ? statePop : o?.pop, 0)} hint="persons" />
      </div>

      <div className="grid-2">
        <ChartCard
          key={params.id ?? 'state'}
          title={isState ? 'Nominal GSDP of Maharashtra' : `Nominal GDDP of ${name}`} subtitle="₹ crore"
          expanded={() => (isState
            ? (st ? <StateGddpExpanded state={st} /> : <Loading />)
            : <DistrictGddpExpanded district={district!} districts={districts.data!} trend={trend.data} />)}
        >
          {isState ? (
            stateData.error ? <ErrorBox message={stateData.error} /> : !st ? <Loading /> : (
              <LineChart
                labels={stateTrend.map((t) => fy(t.year))} yTitle="GSDP (₹ crore)" format={(v) => crore(v)}
                series={[{ label: name, data: stateTrend.map((t) => t.gddp), color: seriesColor(1), emphasis: true }]}
              />
            )
          ) : trend.error ? <ErrorBox message={trend.error} /> : !trend.data ? <Loading /> : (
            <LineChart
              labels={trend.data.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
              series={[{ label: name, data: trend.data.series[0]?.values ?? [], color: seriesColor(1), emphasis: true }]}
            />
          )}
        </ChartCard>
        {isState ? (
          <section className="card" aria-labelledby="state-profile-h">
            <header className="card-head"><h3 id="state-profile-h">State Profile</h3></header>
            {people.error ? <ErrorBox message={people.error} /> : !profile ? <Loading /> : <ProfileCard card={profile} />}
          </section>
        ) : (
        <ChartCard
          title={`Sector share – ${fy(mix.data?.year ?? year)}`} subtitle="Share of GVA by sector (%)" legend={sectorLegend()}
          expanded={() => (mix.data ? <SectorExpanded mix={mix.data} districtName={name} year={year} /> : <Loading />)}
        >
          {mix.error ? <ErrorBox message={mix.error} /> : !mix.data ? <Loading /> : <SectorCharts mix={mix.data} districtName={name} callouts={false} />}
        </ChartCard>
        )}
      </div>

      <DsaSections key={isState ? 'state' : districtId} districtId={isState ? null : districtId} year={year} />
    </>
  )
}
