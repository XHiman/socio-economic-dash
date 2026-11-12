import { useState } from 'react'
import type { CardData } from '../api/types'
import { seriesColor } from '../lib/chart'
import { fy, num } from '../lib/format'
import { sameYear } from '../lib/years'
import { describeValues } from '../lib/a11y'
import { CardModal } from './CardModal'
import { Chip, ChipGroup } from './Tabs'
import { Icon, ICON } from './Modal'
import { ProfileCard } from './ProfileCard'
import { CardTable, stackParts, unitOf, type Split } from './CardTable'
import { BarChart, SeriesChart } from './charts'
import { Empty } from './ui'

/** The card's chart or figures; also used by static (non-expandable) cards. */
export function CardBody({ card, split }: { card: CardData; split: Split }) {
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
        <div
          className="chart-body" style={{ height: Math.max(180, card.columns.length * 38) }}
          role="img" aria-label={`${card.title}. ${describeValues(card.columns.map((c) => c.label), card.columns.map((c) => card.total![c.key] ?? null), shared || undefined)}`}
        >
          <BarChart
            horizontal
            labels={card.columns.map((c) => c.label)}
            values={card.columns.map((c) => card.total![c.key] ?? null)}
            unit={shared}
            color={seriesColor(0)}
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
        <ChipGroup label="Metric">
          {card.columns.map((c, i) => (canAll && c.total ? null : <Chip key={c.key} on={i === active} onClick={() => setActive(i)}>{c.label}</Chip>))}
          {canAll && <Chip on={all} onClick={() => setActive(-1)}>All (stacked)</Chip>}
        </ChipGroup>
      )}
      <p className="small muted">
        {all ? `All measures by ${split}` : <>{col.label}{unitOf(col)} by {split}</>}
        {!all && card.total?.[col.key] != null && <> &middot; {split === 'district' ? 'state' : 'district'} total <strong>{num(card.total[col.key])}</strong></>}
      </p>
      <div
        className="chart-body" style={{ height: 260 }}
        role="img" aria-label={`${card.title}. ${all ? `All measures by ${split}.` : describeValues(labels, card.rows.map((r) => r.values[col.key] ?? null), col.unit)}`}
      >
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
            color={seriesColor(Math.max(active, 0))}
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
          {!card.static && (
            <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`View ${card.title} full screen`} title="Full screen">
              <Icon d={ICON.expand} />
            </button>
          )}
        </div>
      </header>
      {card.static ? <ProfileCard card={card} /> : <CardBody card={card} split={split} />}
      {open && !card.static && <CardModal card={card} split={split} historyPath={historyPath} selectedYear={selectedYear} onClose={() => setOpen(false)} />}
    </section>
  )
}
