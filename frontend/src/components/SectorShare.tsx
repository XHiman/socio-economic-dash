import { useState } from 'react'
import type { SectorMixResponse } from '../api/types'
import { sectorColors } from '../lib/chart'
import { fy, num } from '../lib/format'
import { DoughnutChart } from './charts'
import { ChartPanel, ICON, Icon } from './Modal'

const LABELS = ['Primary', 'Secondary', 'Tertiary']
const shares = (m: SectorMixResponse['district']) => [m?.primary ?? null, m?.secondary ?? null, m?.tertiary ?? null]

export const sectorLegend = () => LABELS.map((label, i) => ({ label, color: sectorColors()[i]! }))

/** Text alternative: each sector's percentage for the state and (if shown) the district. */
export function describeSectorMix(mix: SectorMixResponse, districtName: string | null): string {
  const text = (name: string, m: SectorMixResponse['district']) => {
    const v = shares(m)
    const total = v.reduce<number>((a, x) => a + (x ?? 0), 0)
    return total ? `${name}: ${LABELS.map((l, i) => `${l} ${num(((v[i] ?? 0) / total) * 100, 1)}%`).join(', ')}.` : `${name}: no data.`
  }
  return [text('Maharashtra', mix.state), districtName ? text(districtName, mix.district) : ''].filter(Boolean).join(' ')
}

/** State and district sector shares as doughnuts. Callouts (the % on each segment) are off in the card, on in full screen. */
export function SectorCharts({ mix, districtName, callouts, names = false }: {
  mix: SectorMixResponse; districtName: string | null; callouts: boolean; names?: boolean
}) {
  const colors = sectorColors()
  return (
    <>
      <div className="doughnuts">
        <figure>
          <div className="pie"><DoughnutChart labels={LABELS} values={shares(mix.state)} colors={colors} callouts={callouts} names={names} /></div>
          <figcaption>Maharashtra</figcaption>
        </figure>
        {districtName && (
          <figure>
            <div className="pie"><DoughnutChart labels={LABELS} values={shares(mix.district)} colors={colors} callouts={callouts} names={names} /></div>
            <figcaption>{districtName}</figcaption>
          </figure>
        )}
      </div>
      <ul className="legend" aria-label="Sector legend">
        {LABELS.map((l, i) => <li key={l}><span style={{ background: colors[i] }} />{l}</li>)}
      </ul>
    </>
  )
}

export function SectorExpanded({ mix, districtName, year }: { mix: SectorMixResponse; districtName: string | null; year: string | null }) {
  const [callouts, setCallouts] = useState(true)
  return (
    <ChartPanel
      title={`Sector share – ${fy(year)}`} description={describeSectorMix(mix, districtName)}
      reference="District Domestic Product estimates (dsa_gddp), share of GVA (%)" legend={sectorLegend()}
      tabs={<span className="muted small">Share of GVA by sector (%)</span>}
      tools={
        <button type="button" className={`btn-tool ${callouts ? 'on' : ''}`} aria-pressed={callouts} onClick={() => setCallouts((c) => !c)} title="Show or hide the percentage on each segment">
          <Icon d={ICON.flip} />Callouts
        </button>
      }
    >
      <SectorCharts mix={mix} districtName={districtName} callouts={callouts} names={callouts} />
    </ChartPanel>
  )
}
