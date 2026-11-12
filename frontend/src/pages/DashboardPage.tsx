import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../api/client'
import { prefetchDistrictData } from '../api/prefetch'
import type { District, Meta, OverviewResponse, SectionResponse, SectorMixResponse, SeriesResponse, StateResponse, StateRow } from '../api/types'
import { LineChart } from '../components/charts'
import { DsaSections } from '../components/DsaSections'
import { ProfileCard } from '../components/ProfileCard'
import { describeSectorMix, SectorCharts, SectorExpanded, sectorLegend } from '../components/SectorShare'
import { ChartCard, Empty, ErrorBox, Kpi, Skeleton } from '../components/ui'
import { DEFAULT_SECTION_ID } from '../config'
import { describeTrend } from '../lib/a11y'
import { seriesColor } from '../lib/chart'
import { crore, fy, inr, num, pct } from '../lib/format'
import { sameYear } from '../lib/years'

// Full-screen GDDP views load on demand.
const DistrictGddpExpanded = lazy(() => import('../components/GddpExpanded').then((m) => ({ default: m.DistrictGddpExpanded })))
const StateGddpExpanded = lazy(() => import('../components/GddpExpanded').then((m) => ({ default: m.StateGddpExpanded })))

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export default function DashboardPage() {
  const params = useParams()
  const isState = params.id === undefined || params.id === 'state'
  const districtId = isState ? 0 : Number(params.id)
  const validId = isState || (Number.isInteger(districtId) && districtId > 0)
  const navigate = useNavigate()
  const [pickedYear, setPickedYear] = useState<string | null>(null)

  const districts = useApi<District[]>('/districts')
  const meta = useApi<Meta>('/meta')
  // `year` is what the page displays. Requests carry the year only when the user picked one: without it the API serves the
  // latest, so they can start immediately instead of waiting for /meta to say which year that is.
  const year = pickedYear ?? meta.data?.latestYear ?? null
  const yq = pickedYear ? `?year=${pickedYear}` : ''
  const district = isState ? undefined : districts.data?.find((d) => d.id === districtId)

  const overview = useApi<OverviewResponse>(!isState && validId ? `/districts/${districtId}/overview${yq}` : null)
  const stateData = useApi<StateResponse>(isState ? `/state${yq}` : null)
  const mix = useApi<SectorMixResponse>(!isState && validId ? `/districts/${districtId}/sector-mix${yq}` : null)
  // State Profile = the profile card of the People section, aggregated over all districts (same request the Abstract below makes).
  const people = useApi<SectionResponse>(isState ? `/state/sections/${DEFAULT_SECTION_ID}${yq}` : null)
  const profile = people.data?.cards.find((c) => c.id === 'profile')
  const trend = useApi<SeriesResponse>(!isState && validId ? `/gddp/series?districts=${districtId}&metric=dist` : null)
  const [failedMaps, setFailedMaps] = useState<string[]>([])

  // Once the page has settled, load every district's key figures in the background so switching districts is instant.
  const idsKey = districts.data?.map((d) => d.id).join(',') ?? ''
  useEffect(() => {
    if (!idsKey) return
    const t = setTimeout(() => { prefetchDistrictData(yq, idsKey.split(',').map(Number)).catch(() => { /* optional optimisation: pages fetch on demand */ }) }, 300)
    return () => clearTimeout(t)
  }, [yq, idsKey])

  if (!validId) return <Navigate to="/" replace />
  if (districts.error) return <ErrorBox message={districts.error} />
  if (!isState && districts.data && !district) return <Empty>District not found.</Empty>

  const name = isState ? 'Maharashtra' : district?.name ?? ''
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
  const mapSrc = district ? `${import.meta.env.BASE_URL}maps/${slugOf(district.name)}.svg` : ''
  const loadError = isState ? stateData.error : overview.error
  const gddpYear = isState ? st?.year : overview.data?.year

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <p className="eyebrow">{isState ? 'State · all districts' : district ? `${district.division} division` : 'District'}</p>
          <h1>{name || <span className="skeleton skeleton-title" aria-label="Loading…" />}</h1>
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
                {(districts.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
        <p className="note">GDDP estimates for {fy(year)} are not up yet, so GDDP, income, population and sector figures show {fy(gddpYear)}. DSA Data Available only for FY 2020-21 to FY 2024-25</p>
      )}
      <h2 className="sr-only">Key figures</h2>
      <div className="kpis">
        {mapSrc && !failedMaps.includes(mapSrc) && (
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

      <h2 className="sr-only">Economy and profile</h2>
      <div className="grid-2">
        <ChartCard
          key={params.id ?? 'state'}
          title={isState ? 'Nominal GSDP of Maharashtra' : `Nominal GDDP of ${name}`} subtitle="₹ crore"
          description={isState
            ? (st ? describeTrend(stateTrend.map((t) => fy(t.year)), stateTrend.map((t) => t.gddp), crore) : undefined)
            : (trend.data ? describeTrend(trend.data.years.map(fy), trend.data.series[0]?.values ?? [], crore) : undefined)}
          expanded={() => (
            <Suspense fallback={<Skeleton height={320} />}>
              {isState
                ? (st ? <StateGddpExpanded state={st} /> : <Skeleton height={320} />)
                : (district && districts.data ? <DistrictGddpExpanded district={district} districts={districts.data} trend={trend.data} /> : <Skeleton height={320} />)}
            </Suspense>
          )}
        >
          {isState ? (
            stateData.error ? <ErrorBox message={stateData.error} /> : !st ? <Skeleton /> : (
              <LineChart
                labels={stateTrend.map((t) => fy(t.year))} yTitle="GSDP (₹ crore)" format={(v) => crore(v)}
                series={[{ label: name, data: stateTrend.map((t) => t.gddp), color: seriesColor(1), emphasis: true }]}
              />
            )
          ) : trend.error ? <ErrorBox message={trend.error} /> : !trend.data ? <Skeleton /> : (
            <LineChart
              labels={trend.data.years.map(fy)} yTitle="GDDP (₹ crore)" format={(v) => crore(v)}
              series={[{ label: name, data: trend.data.series[0]?.values ?? [], color: seriesColor(1), emphasis: true }]}
            />
          )}
        </ChartCard>
        {isState ? (
          <section className="card" aria-labelledby="state-profile-h">
            <header className="card-head"><h3 id="state-profile-h">State Profile</h3></header>
            {people.error ? <ErrorBox message={people.error} /> : !profile ? <Skeleton height={260} /> : <ProfileCard card={profile} />}
          </section>
        ) : (
        <ChartCard
          title={`Sector share – ${fy(mix.data?.year ?? year)}`} subtitle="Share of GVA by sector (%)" legend={sectorLegend()}
          description={mix.data ? describeSectorMix(mix.data, name) : undefined}
          expanded={() => (mix.data ? <SectorExpanded mix={mix.data} districtName={name} year={year} /> : <Skeleton height={320} />)}
        >
          {mix.error ? <ErrorBox message={mix.error} /> : !mix.data ? <Skeleton /> : <SectorCharts mix={mix.data} districtName={name} callouts={false} />}
        </ChartCard>
        )}
      </div>

      <DsaSections key={isState ? 'state' : districtId} districtId={isState ? null : districtId} year={year} yearQuery={yq} />
    </>
  )
}
