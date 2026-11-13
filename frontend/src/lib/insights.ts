import type { CardColumn, CardData, Mix, Overview, StateResponse, StateRow } from '../api/types'
import { decimalsOf, fixed, fmt, inr, num, withUnit } from './format'

/**
 * Plain-language findings for the printed abstract. Everything here is computed from the figures already on the page
 * (nothing is estimated) and states a comparison only when both sides are present.
 */

export function ordinal(n: number): string {
  const v = n % 100
  return `${n}${['th', 'st', 'nd', 'rd'][(v - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][v] ?? 'th'}`
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '')
const startYear = (y: string) => Number(y.slice(0, 4))

/** Compound annual growth, in %, between two values `years` apart. */
export function cagr(first: number | null | undefined, last: number | null | undefined, years: number): number | null {
  return first && last && first > 0 && last > 0 && years > 0 ? (Math.pow(last / first, 1 / years) - 1) * 100 : null
}

/** First and last non-empty points of a series, with the whole years between them. */
function span(years: string[], values: (number | null)[]) {
  const idx = values.flatMap((v, i) => (v === null || v === undefined ? [] : [i]))
  if (idx.length < 2) return null
  const a = idx[0]!, b = idx.at(-1)!
  return { from: years[a]!, to: years[b]!, first: values[a]!, last: values[b]!, gap: startYear(years[b]!) - startYear(years[a]!) }
}

/** Each value as an index of the first one (= 100): shows relative growth of series of different size on one chart. */
export function growthIndex(values: (number | null)[]): (number | null)[] {
  const base = values.find((v): v is number => v !== null && v !== undefined && v > 0)
  return values.map((v) => (v === null || v === undefined || !base ? null : (v / base) * 100))
}

/** Year-on-year growth of the State series at `year`, in %. */
export function stateGrowth(st: StateResponse): number | null {
  const i = st.trend.findIndex((t) => t.year === st.year)
  const cur = st.trend[i]?.gddp, prev = st.trend[i - 1]?.gddp
  return i > 0 && cur != null && prev ? Math.round((cur / prev - 1) * 10000) / 100 : null
}

/** Districts counted once (the source repeats Mumbai City's figures for Mumbai Suburban). */
export const distinctDistricts = (st: StateResponse): StateRow[] => st.districts.filter((d) => !d.combinedWithOther)

/** "Palghar & Thane": districts the source reports with identical figures are named together, since ranking one over the other would be arbitrary. */
const groupName = (st: StateResponse, d: StateRow) => {
  const twins = st.districts.filter((x) => x.id !== d.id && x.division === d.division && x.dist === d.dist && x.per_cap_dist === d.per_cap_dist && x.perc_lastyr === d.perc_lastyr)
  return [d.name, ...twins.map((x) => x.name)].sort().join(' & ')
}

const rankDesc = (rows: StateRow[], id: number, key: 'per_cap_dist' | 'perc_lastyr') => {
  const v = rows.find((d) => d.id === id)?.[key]
  return v == null ? null : rows.filter((d) => d[key] != null && d[key]! > v).length + 1
}

const rel = (a: number, b: number) => (a > b ? 'above' : a < b ? 'below' : 'equal to')
const val = (card: CardData | undefined, key: string) => card?.total?.[key] ?? null

export interface DistrictInsightInput {
  name: string
  distUnit?: string
  overview: Overview
  state: StateResponse
  trendYears: string[]
  trend: (number | null)[]
  mix: { district: Mix | null; state: Mix | null } | null
  profile?: CardData
  stateProfile?: CardData
}

const share = (m: Mix | null, k: keyof Mix) => {
  if (!m) return null
  const t = (m.primary ?? 0) + (m.secondary ?? 0) + (m.tertiary ?? 0)
  return t && m[k] != null ? (m[k]! / t) * 100 : null
}

export function districtInsights(i: DistrictInsightInput): string[] {
  const { name, overview: o, state: st } = i
  const out: string[] = []
  const unit = i.distUnit ? ` ${i.distUnit}` : ''

  if (o.gddp_rank && o.district_count && o.dist != null) {
    out.push(`${name} ranks ${ordinal(o.gddp_rank)} among ${o.district_count} districts by GDDP (${num(o.dist, 0)}${unit})${o.perc_dis_state != null ? ` and contributes ${fixed(o.perc_dis_state, 1)}% of the State's GSDP` : ''}.`)
  }

  const sg = stateGrowth(st)
  if (o.perc_lastyr != null) {
    out.push(`GDDP grew by ${fixed(o.perc_lastyr, 1)}% over the previous year${sg != null ? `, ${rel(o.perc_lastyr, sg)} the State's ${fixed(sg, 1)}%` : ''}.`)
  }
  const d = span(i.trendYears, i.trend)
  const s = span(st.trend.map((t) => t.year), st.trend.map((t) => t.gddp))
  const dg = d && cagr(d.first, d.last, d.gap)
  if (d && dg != null) {
    const sgc = s && s.from === d.from && s.to === d.to ? cagr(s.first, s.last, s.gap) : null
    out.push(`Between FY ${d.from} and FY ${d.to} GDDP grew at a compound ${fixed(dg, 1)}% a year${sgc != null ? ` (State: ${fixed(sgc, 1)}%)` : ''}.`)
  }

  if (o.per_cap_dist != null && o.per_cap_state) {
    const rank = rankDesc(st.districts, st.districts.find((x) => x.name === name)?.id ?? -1, 'per_cap_dist')
    out.push(`Per capita income of ${inr(o.per_cap_dist)} is ${fixed((o.per_cap_dist / o.per_cap_state) * 100, 1)}% of the State average (${inr(o.per_cap_state)})${rank ? ` and ranks ${ordinal(rank)} among districts` : ''}.`)
  }

  const t = share(i.mix?.district ?? null, 'tertiary'), p = share(i.mix?.district ?? null, 'primary'), sec = share(i.mix?.district ?? null, 'secondary')
  const ts = share(i.mix?.state ?? null, 'tertiary'), ps = share(i.mix?.state ?? null, 'primary')
  if (t != null && p != null && sec != null) {
    out.push(`Services (tertiary sector) account for ${fixed(t, 1)}% of gross value added${ts != null ? ` (State: ${fixed(ts, 1)}%)` : ''}, industry for ${fixed(sec, 1)}% and the primary sector (agriculture, forestry, fishing, mining) for ${fixed(p, 1)}%${ps != null ? `, which is ${rel(p, ps)} the State's ${fixed(ps, 1)}%` : ''}.`)
  }

  const col = (c: CardData | undefined, key: string) => c?.columns.find((x) => x.key === key)
  const compare = (label: string, key: string, text: (v: number, s: number) => string) => {
    const v = val(i.profile, key), sv = val(i.stateProfile, key)
    if (v != null && sv != null) out.push(`${label}${text(v, sv)}`)
    return v
  }
  compare('Literacy rate is ', 'lit_tot', (v, sv) => `${fmt(v, col(i.profile, 'lit_tot'))}%, ${rel(v, sv)} the State's ${fmt(sv, col(i.profile, 'lit_tot'))}%.`)
  compare('The urban population share is ', 'area_pop_prop_urban', (v, sv) => `${fixed(v, 1)}% (State: ${fixed(sv, 1)}%).`)
  compare('The sex ratio is ', 'area_pop_gen_ratio', (v, sv) => `${fmt(v, col(i.profile, 'area_pop_gen_ratio'))} females per 1,000 males, ${rel(v, sv)} the State's ${fmt(sv, col(i.profile, 'area_pop_gen_ratio'))}.`)
  const tal = val(i.profile, 'area_pop_tot_taluka'), vil = val(i.profile, 'area_pop_vill_pop'), cit = val(i.profile, 'area_pop_city')
  if (tal != null && vil != null) out.push(`The district has ${num(tal, 0)} ${tal === 1 ? 'taluka' : 'talukas'}, ${num(vil, 0)} inhabited villages${cit != null ? ` and ${num(cit, 0)} ${cit === 1 ? 'town' : 'towns and cities'}` : ''}.`)
  return out
}

export function stateInsights(st: StateResponse, trendUnit: string | undefined, mix: Mix | null, profile?: CardData): string[] {
  const out: string[] = []
  const unit = trendUnit ? ` ${trendUnit}` : ''
  const gsdp = st.state?.state
  const sg = stateGrowth(st)
  if (gsdp != null) out.push(`Maharashtra's GSDP is ${num(gsdp, 0)}${unit} in FY ${st.year}${sg != null ? `, ${fixed(sg, 1)}% higher than the previous year` : ''}.`)
  const s = span(st.trend.map((t) => t.year), st.trend.map((t) => t.gddp))
  const g = s && cagr(s.first, s.last, s.gap)
  if (s && g != null) out.push(`Between FY ${s.from} and FY ${s.to} GSDP grew at a compound ${fixed(g, 1)}% a year.`)

  const rows = distinctDistricts(st).filter((d) => d.dist != null)
  const total = rows.reduce((a, d) => a + (d.dist ?? 0), 0)
  if (rows.length >= 5 && total) {
    const top = [...rows].sort((a, b) => b.dist! - a.dist!).slice(0, 5)
    out.push(`The five largest district economies (${top.map((d) => groupName(st, d)).join(', ')}) account for ${fixed((top.reduce((a, d) => a + d.dist!, 0) / total) * 100, 1)}% of the sum of district GDDP.`)
  }
  const pc = rows.filter((d) => d.per_cap_dist != null).sort((a, b) => b.per_cap_dist! - a.per_cap_dist!)
  if (pc.length >= 2) {
    const hi = pc[0]!, lo = pc.at(-1)!
    out.push(`Per capita income ranges from ${inr(lo.per_cap_dist)} in ${groupName(st, lo)} to ${inr(hi.per_cap_dist)} in ${groupName(st, hi)}, a ${fixed(hi.per_cap_dist! / lo.per_cap_dist!, 1)}-fold difference.`)
  }
  const gr = rows.filter((d) => d.perc_lastyr != null).sort((a, b) => b.perc_lastyr! - a.perc_lastyr!)
  if (gr.length >= 2) out.push(`Year-on-year GDDP growth was highest in ${groupName(st, gr[0]!)} (${fixed(gr[0]!.perc_lastyr, 1)}%) and lowest in ${groupName(st, gr.at(-1)!)} (${fixed(gr.at(-1)!.perc_lastyr, 1)}%).`)

  const byDiv = new Map<string, number>()
  for (const d of rows) byDiv.set(d.division, (byDiv.get(d.division) ?? 0) + d.dist!)
  const divs = [...byDiv.entries()].sort((a, b) => b[1] - a[1])
  if (divs.length >= 2 && total) out.push(`${divs[0]![0]} division is the largest, with ${fixed((divs[0]![1] / total) * 100, 1)}% of district GDDP; ${divs.at(-1)![0]} division is the smallest at ${fixed((divs.at(-1)![1] / total) * 100, 1)}%.`)

  const t = share(mix, 'tertiary'), p = share(mix, 'primary'), sec = share(mix, 'secondary')
  if (t != null && p != null && sec != null) out.push(`Services account for ${fixed(t, 1)}% of the State's gross value added, industry for ${fixed(sec, 1)}% and the primary sector for ${fixed(p, 1)}%.`)

  const col = (key: string) => profile?.columns.find((c) => c.key === key)
  const lit = val(profile, 'lit_tot'), urb = val(profile, 'area_pop_prop_urban'), sr = val(profile, 'area_pop_gen_ratio')
  if (lit != null && urb != null) out.push(`The literacy rate is ${fmt(lit, col('lit_tot'))}% and ${fixed(urb, 1)}% of the population lives in urban areas${sr != null ? `; the sex ratio is ${fmt(sr, col('area_pop_gen_ratio'))} females per 1,000 males` : ''}.`)
  const tal = val(profile, 'area_pop_tot_taluka'), vil = val(profile, 'area_pop_vill_pop')
  if (tal != null && vil != null) out.push(`It has ${num(tal, 0)} talukas and ${num(vil, 0)} inhabited villages.`)
  return out
}

/** How the district's figure sits against the State's: points difference for rates, share of the State for counts and totals. */
export function compareCell(col: CardColumn, v: number | null | undefined, sv: number | null | undefined): string {
  if (v == null || sv == null) return '–'
  if (col.agg === 'avg') {
    const diff = v - sv, dec = decimalsOf(col) ?? 1
    return `${sign(Number(diff.toFixed(dec)))}${fixed(Math.abs(diff), dec)}${col.unit === '%' ? ' pp' : ''}`
  }
  return sv ? `${fixed((v / sv) * 100, 1)}% of State` : '–'
}

/** One or two observations about a card's figures. `compare` is the State's version of the same card (district documents). */
export function cardHighlights(card: CardData, split: 'taluka' | 'district', name: string, compare?: CardData | null): string[] {
  const out: string[] = []
  const place = split === 'district' ? 'district' : 'taluka'

  if (card.kind === 'taluka' && card.rows.length >= 3) {
    const col = card.columns.find((c) => c.total) ?? card.columns[0]!
    const ranked = card.rows.filter((r) => r.values[col.key] != null).sort((a, b) => b.values[col.key]! - a.values[col.key]!)
    if (ranked.length >= 3) {
      const hi = ranked[0]!, lo = ranked.at(-1)!
      const f = (v: number) => withUnit(fmt(v, col), col.unit)
      out.push(`${col.label}: highest in ${hi.taluka} (${f(hi.values[col.key]!)}), lowest in ${lo.taluka} (${f(lo.values[col.key]!)}).`)
      if (col.agg !== 'avg') {
        const total = card.total?.[col.key] ?? ranked.reduce((a, r) => a + r.values[col.key]!, 0)
        if (total) out.push(`${hi.taluka} accounts for ${fixed((hi.values[col.key]! / total) * 100, 1)}% of the ${split === 'district' ? 'State' : 'district'} total${compare?.total?.[col.key] ? `; the district as a whole accounts for ${fixed((total / compare.total[col.key]!) * 100, 1)}% of the State total` : ''}.`)
      } else {
        const gap = hi.values[col.key]! - lo.values[col.key]!
        out.push(`The gap between the highest and lowest ${place} is ${fixed(gap, decimalsOf(col) ?? 1)}${col.unit === '%' ? ' percentage points' : col.unit ? ` ${col.unit}` : ''}.`)
      }
    }
  } else if (card.kind === 'breakdown' && card.total) {
    const cols = card.columns.filter((c) => card.total![c.key] != null)
    const allRates = cols.length >= 2 && cols.every((c) => c.agg === 'avg')
    if (allRates) {
      const sorted = [...cols].sort((a, b) => card.total![b.key]! - card.total![a.key]!)
      const hi = sorted[0]!, lo = sorted.at(-1)!
      out.push(`Highest: ${hi.label} (${withUnit(fmt(card.total![hi.key], hi), hi.unit)}); lowest: ${lo.label} (${withUnit(fmt(card.total![lo.key], lo), lo.unit)}).`)
      if (compare?.total) {
        const both = cols.filter((c) => compare.total![c.key] != null)
        const above = both.filter((c) => card.total![c.key]! > compare.total![c.key]!).length
        if (both.length > 1) out.push(above === both.length ? `${name} is above the State figure on all ${both.length} measures.` : above === 0 ? `${name} is below the State figure on all ${both.length} measures.` : `${name} is above the State figure on ${above} of ${both.length} measures.`)
      }
    } else if (card.stackable && cols.length >= 3) {
      const total = cols.reduce((a, c) => a + card.total![c.key]!, 0)
      const big = [...cols].sort((a, b) => card.total![b.key]! - card.total![a.key]!)[0]!
      if (total) out.push(`${big.label} is the largest component, at ${fixed((card.total![big.key]! / total) * 100, 1)}% of the total.`)
    }
  }
  return out
}
