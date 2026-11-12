import { useState } from 'react'
import type { CardData } from '../api/types'
import { PALETTE } from '../lib/chart'
import { fy, num } from '../lib/format'
import { sameYear } from '../lib/years'
import { CardModal } from './CardModal'
import { Icon, ICON } from './Modal'
import { CardTable, refLabel, stackParts, unitOf, type Split } from './CardTable'
import { BarChart, SeriesChart } from './charts'
import { Empty } from './ui'

function Body({ card, split }: { card: CardData; split: Split }) {
  const [active, setActive] = useState(card.kind === 'taluka' && stackParts(card).length > 1 ? -1 : 0) // -1 = All (stacked)

  if (card.kind === 'kpis') {
    if (!card.total) return <Empty />
    return (
      <dl className="stat-grid">
        {card.columns.map((c) => (
          <div key={c.key} className="stat">
            <dt>{c.label}</dt>
            <dd>{num(card.total![c.key])}{c.unit && c.unit.length <= 2 ? <span className="unit">{c.unit}</span> : null}</dd>
            {c.unit && c.unit.length > 2 && <div className="unit-line">{c.unit}</div>}
          </div>
        ))}
      </dl>
    )
  }

  if (card.kind === 'breakdown') {
    if (!card.total) return <Empty />
    const units = new Set(card.columns.map((c) => c.unit ?? ''))
    const shared = units.size === 1 ? [...units][0] : ''
    return (
      <div className="split">
        <div className="chart-body" style={{ height: Math.max(180, card.columns.length * 38) }}>
          <BarChart
            horizontal
            labels={card.columns.map((c) => c.label)}
            values={card.columns.map((c) => card.total![c.key] ?? null)}
            unit={shared}
            color={PALETTE[0]}
          />
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {card.columns.map((c) => (
                <tr key={c.key}><th scope="row">{c.label}</th><td className="num">{num(card.total![c.key])}{shared ? ` ${shared}` : unitOf(c)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // taluka (or district, in the state view)
  if (!card.rows.length) return card.total ? <CardTable card={card} split={split} /> : <Empty />
  const parts = stackParts(card)
  const canAll = parts.length > 1
  const all = canAll && active === -1
  const col = card.columns[Math.max(active, 0)] ?? card.columns[0]!
  const labels = card.rows.map((r) => r.taluka.replace(/ \(synthetic\)$/, ''))
  return (
    <>
      {card.columns.length > 1 && (
        <div className="chips" role="tablist" aria-label="Metric">
          {card.columns.map((c, i) => (canAll && c.total ? null : (
            <button
              key={c.key} type="button" role="tab" aria-selected={i === active}
              className={`chip ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}
            >
              {c.label}
            </button>
          )))}
          {canAll && (
            <button type="button" role="tab" aria-selected={all} className={`chip ${all ? 'on' : ''}`} onClick={() => setActive(-1)}>
              All (stacked)
            </button>
          )}
        </div>
      )}
      <p className="small muted">
        {all ? `All measures by ${split}` : <>{col.label}{unitOf(col)} by {split}</>}
        {!all && card.total?.[col.key] != null && <> &middot; {split === 'district' ? 'state' : 'district'} total <strong>{num(card.total[col.key])}</strong></>}
      </p>
      <div className="chart-body" style={{ height: 260 }}>
        {all ? (
          <SeriesChart
            type="bar" stacked labels={labels} unit={parts.every((c) => c.unit === parts[0]!.unit) ? parts[0]!.unit : undefined}
            series={parts.map((c) => ({ label: c.label, data: card.rows.map((r) => r.values[c.key] ?? null) }))}
          />
        ) : (
          <BarChart
            labels={labels}
            values={card.rows.map((r) => r.values[col.key] ?? null)}
            unit={col.unit}
            color={PALETTE[active % PALETTE.length]}
          />
        )}
      </div>
    </>
  )
}

export function DsaCard({ card, split = 'taluka', historyPath, selectedYear }: {
  card: CardData; split?: Split; historyPath: string; selectedYear: string | null
}) {
  const [open, setOpen] = useState(false)
  // The year is picked in the page header, so only call it out when this card shows another year.
  const offYear = !!card.year && !!selectedYear && !sameYear(card.year, selectedYear)
  return (
    <section className={`card dsa-card kind-${card.kind}`}>
      <header className="card-head">
        <h3>{card.title}</h3>
        <div className="card-actions">
          {offYear && <span className="badge warn" title="No data for the selected year; showing the nearest earlier year">Data: {fy(card.year)}</span>}
          <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`View ${card.title} full screen`} title="Full screen">
            <Icon d={ICON.expand} />
          </button>
        </div>
      </header>
      <Body card={card} split={split} />
      <p className="card-ref small muted">{refLabel(card.table, [])}</p>
      {open && <CardModal card={card} split={split} historyPath={historyPath} selectedYear={selectedYear} onClose={() => setOpen(false)} />}
    </section>
  )
}
