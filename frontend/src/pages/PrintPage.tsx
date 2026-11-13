import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Chart } from 'chart.js'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useApi } from '../api/client'
import type {
  CardData, District, Meta, OverviewResponse, SectionResponse, SectionSummary, SectorMixResponse, SeriesResponse, StateResponse,
} from '../api/types'
import { CardTable, refLabel, stackParts, unitLine, type Split } from '../components/CardTable'
import { BarChart, LineChart, SeriesChart } from '../components/charts'
import { seriesColor } from '../lib/chart'
import { fixed, fmt, fy, inr, num } from '../lib/format'
import { cardHighlights, distinctDistricts, districtInsights, growthIndex, stateGrowth, stateInsights } from '../lib/insights'
import './print.css'

// Sharper charts on paper.
Chart.defaults.devicePixelRatio = Math.max(2, window.devicePixelRatio || 1)

const SOURCE = 'District Statistical Abstract (DSA) and District Domestic Product estimates, Government of Maharashtra. GDDP figures are nominal.'
const base = import.meta.env.BASE_URL

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="print-tile">
      <span className="print-tile-label">{label}</span>
      <strong>{value}</strong>
      {hint && <em>{hint}</em>}
    </div>
  )
}

function Insights({ items }: { items: string[] }) {
  return items.length ? <ul className="print-insights">{items.map((t, i) => <li key={i}>{t}</li>)}</ul> : null
}

/** One DSA card as a publication block: title, unit, source reference, observations, a static chart and the full table. */
function PrintCard({ card, split, name, compare }: { card: CardData; split: Split; name: string; compare: CardData | null }) {
  const unit = unitLine(card)
  const parts = stackParts(card)
  const labels = card.rows.map((r) => r.taluka.replace(/ \(synthetic\)$/, ''))
  const first = card.columns.find((c) => !c.total) ?? card.columns[0]!
  const sharedUnit = new Set(card.columns.map((c) => c.unit ?? '')).size === 1 ? card.columns[0]?.unit : undefined
  const notes = card.kind === 'kpis' ? [] : cardHighlights(card, split, name, compare)

  let chart = null
  if (card.kind === 'breakdown' && card.total) {
    chart = (
      <div className="print-chart" style={{ height: Math.max(110, card.columns.length * 26 + 30) }}>
        <BarChart
          horizontal showValues labels={card.columns.map((c) => c.label)} values={card.columns.map((c) => card.total![c.key] ?? null)}
          unit={sharedUnit} format={(v) => fmt(v, card.columns[0])} color={seriesColor(0)}
        />
      </div>
    )
  } else if (card.kind === 'taluka' && card.rows.length) {
    chart = (
      <div className="print-chart" style={{ height: 210 }}>
        {parts.length > 1 ? (
          <SeriesChart
            stacked animate={false} labels={labels} unit={new Set(parts.map((c) => c.unit ?? '')).size === 1 ? parts[0]?.unit : undefined}
            series={parts.map((c) => ({ label: c.label, data: card.rows.map((r) => r.values[c.key] ?? null), decimals: c.decimals }))}
          />
        ) : (
          <BarChart showValues labels={labels} values={card.rows.map((r) => r.values[first.key] ?? null)} unit={first.unit} format={(v) => fmt(v, first)} />
        )}
      </div>
    )
  }

  return (
    <article className="print-card">
      <header>
        <h3>{card.title}</h3>
        <p className="print-meta">{[unit, refLabel(card.table, [card.year])].filter(Boolean).join(' · ')}</p>
      </header>
      {notes.length > 0 && <ul className="print-notes">{notes.map((t, i) => <li key={i}>{t}</li>)}</ul>}
      {chart}
      <CardTable card={card} split={split} compare={compare} label={split === 'taluka' ? name : 'Value'} />
    </article>
  )
}

function PrintSection({ index, section, base: path, yq, split, name, compareState, onLoaded }: {
  index: number; section: SectionSummary; base: string; yq: string; split: Split; name: string; compareState: boolean; onLoaded: (id: string) => void
}) {
  const data = useApi<SectionResponse>(`${path}/sections/${section.id}${yq}`)
  const state = useApi<SectionResponse>(compareState ? `/state/sections/${section.id}${yq}` : null)
  const done = (!!data.data || !!data.error) && (!compareState || !!state.data || !!state.error)
  useEffect(() => { if (done) onLoaded(section.id) }, [done, onLoaded, section.id])
  return (
    <section className="print-section">
      <header className="print-section-head">
        <span className="print-badge" aria-hidden="true">{index}</span>
        <div><h2>{section.title}</h2><p className="print-lead">{section.description}</p></div>
      </header>
      {data.error && <p role="alert">This section could not be loaded ({data.error}).</p>}
      {!data.data && !data.error && <p role="status">Loading…</p>}
      {data.data?.cards.map((c) => (
        <PrintCard key={c.id} card={c} split={split} name={name} compare={state.data?.cards.find((x) => x.id === c.id) ?? null} />
      ))}
    </section>
  )
}

/**
 * Stand-alone, print-ready District / State Statistical Abstract. It loads its own data, so it does not depend on
 * the dashboard's state (which cards are expanded, which tab is open); the dashboard just links here.
 */
export default function PrintPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const isState = params.id === 'state'
  const districtId = Number(params.id)
  const validId = isState || (Number.isInteger(districtId) && districtId > 0)
  const pickedYear = search.get('year')
  const yq = pickedYear && /^\d{4}[_-]\d{2}$/.test(pickedYear) ? `?year=${pickedYear}` : ''
  const autoprint = search.get('autoprint') === '1'

  const meta = useApi<Meta>('/meta')
  const districts = useApi<District[]>('/districts')
  const sections = useApi<SectionSummary[]>('/sections')
  const overview = useApi<OverviewResponse>(!isState && validId ? `/districts/${districtId}/overview${yq}` : null)
  const mix = useApi<SectorMixResponse>(!isState && validId ? `/districts/${districtId}/sector-mix${yq}` : null)
  const trend = useApi<SeriesResponse>(!isState && validId ? `/gddp/series?districts=${districtId}&metric=dist` : null)
  const state = useApi<StateResponse>(validId ? `/state${yq}` : null) // the State itself, or the benchmark for a district
  const stateMix = useApi<SectorMixResponse>(isState ? `/state/sector-mix${yq}` : null)
  // The People section's profile card feeds the observations; the same requests the sections below make.
  const people = useApi<SectionResponse>(!isState && validId ? `/districts/${districtId}/sections/people${yq}` : null)
  const statePeople = useApi<SectionResponse>(validId ? `/state/sections/people${yq}` : null)

  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set())
  const markLoaded = useCallback((id: string) => setLoaded((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), [])
  const printed = useRef(false)
  const [generated] = useState(() => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))

  const district = districts.data?.find((d) => d.id === districtId)
  const name = isState ? 'Maharashtra' : district?.name ?? ''
  const kind = isState ? 'State' : 'District'
  const year = fy(pickedYear ?? meta.data?.latestYear)
  const unit = (key: string) => meta.data?.metrics[key]?.unit
  const topReady = !!(meta.data && districts.data && sections.data && state.data && statePeople.data
    && (isState ? stateMix.data : overview.data && mix.data && trend.data && people.data))
  const allLoaded = !!sections.data && sections.data.every((s) => loaded.has(s.id))

  useEffect(() => { if (name) document.title = `${kind} Statistical Abstract – ${name} – FY ${year}` }, [kind, name, year])

  // Open the print dialog once everything (including the charts) has drawn.
  useEffect(() => {
    if (!autoprint || !topReady || !allLoaded || printed.current) return
    const t = setTimeout(() => { printed.current = true; window.print() }, 1000)
    return () => clearTimeout(t)
  }, [autoprint, topReady, allLoaded])

  if (!validId) return <Navigate to="/" replace />
  const err = meta.error ?? districts.error ?? sections.error ?? overview.error ?? mix.error ?? trend.error ?? state.error ?? stateMix.error ?? people.error ?? statePeople.error
  if (err) return <p role="alert" className="print-error">The abstract could not be loaded ({err}).</p>
  if (!isState && districts.data && !district) return <p role="alert" className="print-error">District not found.</p>

  const o = overview.data?.overview
  const st = state.data
  const profile = people.data?.cards.find((c) => c.id === 'profile')
  const stateProfile = statePeople.data?.cards.find((c) => c.id === 'profile')
  const gddpYear = fy(isState ? st?.year : overview.data?.year)
  const years = isState ? (st?.trend.map((t) => t.year) ?? []) : trend.data?.years ?? []
  const series = isState ? (st?.trend.map((t) => t.gddp) ?? []) : trend.data?.series[0]?.values ?? []
  const stateSeries = years.map((y) => st?.trend.find((t) => t.year === y)?.gddp ?? null)
  const split: Split = isState ? 'district' : 'taluka'
  const apiBase = isState ? '/state' : `/districts/${districtId}`
  const distUnit = unit('dist')
  const sg = st ? stateGrowth(st) : null
  const sectorMix = isState ? stateMix.data : mix.data
  const pctOf = (m: SectorMixResponse['district'] | undefined, k: 'primary' | 'secondary' | 'tertiary') => {
    const t = (m?.primary ?? 0) + (m?.secondary ?? 0) + (m?.tertiary ?? 0)
    return m && t && m[k] != null ? (m[k]! / t) * 100 : null
  }
  const insights = !st ? [] : isState
    ? stateInsights(st, distUnit, stateMix.data?.state ?? null, stateProfile)
    : o ? districtInsights({ name, distUnit, overview: o, state: st, trendYears: years, trend: series, mix: mix.data, profile, stateProfile }) : []

  const ranked = st ? [...st.districts].filter((d) => d.dist != null).sort((a, b) => b.dist! - a.dist!) : []
  const byDivision = new Map<string, number>()
  for (const d of st ? distinctDistricts(st) : []) byDivision.set(d.division, (byDivision.get(d.division) ?? 0) + (d.dist ?? 0))
  const divisions = [...byDivision.entries()].sort((a, b) => b[1] - a[1])
  const lit = isState ? stateProfile?.total?.lit_tot : profile?.total?.lit_tot

  return (
    <div className="print-doc">
      <div className="print-toolbar">
        <span>{topReady && allLoaded ? 'Ready to print.' : 'Preparing the document…'} Use “Save as PDF” in the print dialog to keep a copy.</span>
        <span className="print-toolbar-actions">
          <button type="button" className="btn" onClick={() => window.print()} disabled={!topReady || !allLoaded}>Print / Save as PDF</button>
          <button type="button" className="btn btn-quiet" onClick={() => window.close()}>Close</button>
        </span>
      </div>

      {/* thead/tfoot of a table repeat on every printed page, giving a running header and footer in any browser. */}
      <table className="print-frame print-page">
        <thead>
          <tr><td>
            <div className="print-running-head">
              <span>Government of Maharashtra · MITRA</span><span>{kind} Statistical Abstract · {name} · FY {year}</span>
            </div>
          </td></tr>
        </thead>
        <tfoot>
          <tr><td><div className="print-running-foot">Source: {SOURCE}</div></td></tr>
        </tfoot>
        <tbody>
          <tr><td>
            <main>
              <header className="print-cover">
                <div className="print-masthead">
                  <img src={`${base}Seal_of_Maharashtra.svg`} alt="Government of Maharashtra seal" height="62" />
                  <div>
                    <p className="print-org">Government of Maharashtra</p>
                    <p className="print-org-sub">MITRA &mdash; Maharashtra Institution for Transformation</p>
                  </div>
                  <img src={`${base}MITRALogo.svg`} alt="MITRA" height="62" />
                </div>
                <div className="print-rule" aria-hidden="true" />
                <p className="print-kicker">Socio-economic profile</p>
                <h1>{kind} Statistical Abstract</h1>
                <p className="print-district">{name || '…'}</p>
                <p className="print-fy"><span>Financial year {year}</span></p>
                <dl className="print-facts">
                  {!isState && <><dt>Division</dt><dd>{district?.division ?? '–'}</dd></>}
                  {topReady && gddpYear !== year && <><dt>GDDP estimates</dt><dd>{gddpYear} (latest available)</dd></>}
                  <dt>Prepared on</dt><dd>{generated}</dd>
                </dl>

                {topReady && (
                  <div className="print-tiles">
                    {isState ? (
                      <>
                        <Tile label="GSDP (nominal)" value={num(st?.state?.state, 0)} hint={distUnit} />
                        <Tile label="Per capita income" value={inr(st?.state?.per_cap_state)} hint={unit('per_cap_dist')} />
                        <Tile label="Growth over previous year" value={sg == null ? '–' : `${fixed(sg, 1)}%`} hint="nominal" />
                        <Tile label="Literacy rate" value={lit == null ? '–' : `${fixed(lit, 1)}%`} />
                      </>
                    ) : (
                      <>
                        <Tile label="GDDP (nominal)" value={num(o?.dist, 0)} hint={distUnit} />
                        <Tile label="Rank by GDDP" value={o?.gddp_rank ? `${o.gddp_rank} of ${o.district_count}` : '–'} hint={o?.perc_dis_state != null ? `${fixed(o.perc_dis_state, 1)}% of State GSDP` : undefined} />
                        <Tile label="Per capita income" value={inr(o?.per_cap_dist)} hint={o?.per_cap_state ? `State: ${inr(o.per_cap_state)}` : unit('per_cap_dist')} />
                        <Tile label="Growth over previous year" value={o?.perc_lastyr == null ? '–' : `${fixed(o.perc_lastyr, 1)}%`} hint={sg == null ? 'nominal' : `State: ${fixed(sg, 1)}%`} />
                      </>
                    )}
                  </div>
                )}

                <div className="print-cover-foot">
                  {sections.data && (
                    <nav aria-label="Contents" className="print-contents">
                      <h2>Contents</h2>
                      <ol>
                        <li>Economy at a glance</li>
                        {sections.data.map((s) => <li key={s.id}>{s.title}</li>)}
                      </ol>
                    </nav>
                  )}
                  <aside className="print-about">
                    <h2>About this document</h2>
                    <ul>
                      <li>Figures are those of the District Statistical Abstract and the District Domestic Product estimates; each table names its source table and year.</li>
                      <li>GDDP and GSDP are at current (nominal) prices. They are published later than the abstract, so economic figures show FY {gddpYear}{gddpYear !== year ? `, while FY ${year} is the abstract year` : ''}.</li>
                      <li>Percentages are given to one decimal place and the sex ratio as females per 1,000 males. Shares, differences and growth rates in the observations are calculated from the published figures.</li>
                      {isState && <li>Mumbai City and Mumbai Suburban are reported together by the source and are counted once in State totals and shares.</li>}
                    </ul>
                  </aside>
                </div>
              </header>

              <section className="print-section print-first">
                <header className="print-section-head">
                  <span className="print-badge" aria-hidden="true">1</span>
                  <div><h2>Economy at a glance</h2><p className="print-lead">Output, income, growth and structure of the economy{isState ? '' : ', set against the State'}.</p></div>
                </header>

                {insights.length > 0 && (
                  <div className="print-callout">
                    <h3>Key observations</h3>
                    <Insights items={insights} />
                  </div>
                )}

                <div className="print-grid-2">
                  <figure className="print-fig">
                    <figcaption>Nominal {isState ? 'GSDP' : 'GDDP'}{distUnit ? ` (${distUnit})` : ''}</figcaption>
                    <div className="print-chart" style={{ height: 190 }}>
                      <LineChart
                        labels={years.map(fy)} yTitle={distUnit} showValues format={(v) => num(v, 0)}
                        series={[{ label: name, data: series, color: seriesColor(1), emphasis: true }]}
                      />
                    </div>
                  </figure>
                  {isState ? (
                    <figure className="print-fig">
                      <figcaption>GDDP by division – FY {fy(st?.year)}{distUnit ? ` (${distUnit})` : ''}</figcaption>
                      <div className="print-chart" style={{ height: 190 }}>
                        <BarChart horizontal showValues labels={divisions.map(([d]) => d)} values={divisions.map(([, v]) => v)} format={(v) => num(v, 0)} color={seriesColor(1)} />
                      </div>
                    </figure>
                  ) : (
                    <figure className="print-fig">
                      <figcaption>Growth compared with the State (first year = 100)</figcaption>
                      <div className="print-chart" style={{ height: 190 }}>
                        <LineChart
                          labels={years.map(fy)} yTitle="Index" showValues format={(v) => fixed(v, 1)} labelFormat={(v) => fixed(v, 0)}
                          series={[
                            { label: 'Maharashtra', data: growthIndex(stateSeries), color: seriesColor(7) },
                            { label: name, data: growthIndex(series), color: seriesColor(1), emphasis: true },
                          ]}
                        />
                      </div>
                    </figure>
                  )}
                </div>

                <table className="print-years">
                  <thead>
                    <tr><th scope="col">Financial year</th>{years.map((y) => <th key={y} scope="col" className="num">{fy(y)}</th>)}</tr>
                  </thead>
                  <tbody>
                    <tr><th scope="row">{isState ? 'GSDP' : 'GDDP'}{distUnit ? ` (${distUnit})` : ''}</th>{years.map((y, i) => <td key={y} className="num">{num(series[i], 0)}</td>)}</tr>
                    {!isState && <tr><th scope="row">State GSDP</th>{stateSeries.map((v, i) => <td key={years[i]} className="num">{num(v, 0)}</td>)}</tr>}
                  </tbody>
                </table>

                {sectorMix?.state && (
                  <figure className="print-fig">
                    <figcaption>Sector share of gross value added – FY {fy(sectorMix.year)} (%)</figcaption>
                    <div className="print-chart" style={{ height: isState ? 120 : 165 }}>
                      <SeriesChart
                        stacked horizontal animate={false} unit={unit('perc_dis_state') ?? '%'} yMax={100}
                        labels={isState ? ['Maharashtra'] : ['Maharashtra', name]}
                        series={(['primary', 'secondary', 'tertiary'] as const).map((k) => ({
                          label: { primary: 'Primary', secondary: 'Secondary', tertiary: 'Tertiary' }[k],
                          data: isState ? [pctOf(sectorMix.state, k)] : [pctOf(sectorMix.state, k), pctOf(sectorMix.district, k)],
                        }))}
                      />
                    </div>
                  </figure>
                )}

                {ranked.length > 0 && (
                  <div className="print-grid-2 print-ranking">
                    {([
                      { key: 'dist', caption: `${isState ? 'GDDP by district' : 'Where the district stands: GDDP'} – FY ${fy(st?.year)}${distUnit ? ` (${distUnit})` : ''}`, rows: ranked },
                      { key: 'per_cap_dist', caption: `Per capita income by district${unit('per_cap_dist') ? ` (${unit('per_cap_dist')})` : ''}`, rows: [...ranked].filter((d) => d.per_cap_dist != null).sort((a, b) => b.per_cap_dist! - a.per_cap_dist!) },
                    ] as const).map(({ key, caption, rows }) => (
                      <figure className="print-fig" key={key}>
                        <figcaption>{caption}</figcaption>
                        <div className="print-chart" style={{ height: rows.length * 17 + 40 }}>
                          <BarChart
                            horizontal dense labels={rows.map((d) => d.name)} values={rows.map((d) => d[key])} format={(v) => num(v, 0)}
                            colors={rows.map((d) => (!isState && d.id === districtId ? seriesColor(2) : seriesColor(key === 'dist' ? 0 : 1)))}
                          />
                        </div>
                      </figure>
                    ))}
                  </div>
                )}

                {isState && st && (
                  <>
                    <h3 className="print-h3">District-wise GDDP – FY {fy(st.year)}</h3>
                    <p className="print-meta">{distUnit ? `Unit: ${distUnit} · ` : ''}District Domestic Product estimates (dsa_gddp)</p>
                    <table className="print-kv">
                      <thead>
                        <tr>
                          <th scope="col" className="num">#</th><th scope="col">District</th><th scope="col">Division</th>
                          <th scope="col" className="num">GDDP{distUnit ? ` (${distUnit})` : ''}</th>
                          <th scope="col" className="num">Per capita{unit('per_cap_dist') ? ` (${unit('per_cap_dist')})` : ''}</th>
                          <th scope="col" className="num">Share (%)</th><th scope="col" className="num">Growth (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {st.districts.map((d, i) => (
                          <tr key={d.id}>
                            <td className="num">{i + 1}</td><th scope="row">{d.name}</th><td>{d.division}</td>
                            <td className="num">{num(d.dist, 0)}</td><td className="num">{num(d.per_cap_dist, 0)}</td>
                            <td className="num">{fixed(d.perc_dis_state, 1)}</td><td className="num">{fixed(d.perc_lastyr, 1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>

              {sections.data?.map((s, i) => (
                <PrintSection
                  key={s.id} index={i + 2} section={s} base={apiBase} yq={yq} split={split} name={name} compareState={!isState} onLoaded={markLoaded}
                />
              ))}

            </main>
          </td></tr>
        </tbody>
      </table>
    </div>
  )
}
