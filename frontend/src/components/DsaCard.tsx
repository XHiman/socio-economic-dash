import { useState } from 'react'
import type { CardColumn, CardData } from '../api/types'
import { PALETTE } from '../lib/chart'
import { num } from '../lib/format'
import { BarChart } from './charts'
import { Empty } from './ui'

const unitOf = (c: CardColumn) => (c.unit ? ` (${c.unit})` : '')

function Table({ card }: { card: CardData }) {
  const first = card.kind === 'taluka'
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {first && <th scope="col">Taluka</th>}
            {card.columns.map((c) => <th key={c.key} scope="col" className="num">{c.label}{unitOf(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((r) => (
            <tr key={r.taluka}>
              <th scope="row">{r.taluka}</th>
              {card.columns.map((c) => <td key={c.key} className="num">{num(r.values[c.key])}</td>)}
            </tr>
          ))}
          {card.total && card.kind === 'taluka' && (
            <tr className="total">
              <th scope="row">District total</th>
              {card.columns.map((c) => <td key={c.key} className="num">{num(card.total![c.key])}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function Body({ card }: { card: CardData }) {
  const [active, setActive] = useState(0)

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

  // taluka
  if (!card.rows.length) return card.total ? <Table card={card} /> : <Empty />
  const col = card.columns[active] ?? card.columns[0]!
  return (
    <>
      {card.columns.length > 1 && (
        <div className="chips" role="tablist" aria-label="Metric">
          {card.columns.map((c, i) => (
            <button
              key={c.key} type="button" role="tab" aria-selected={i === active}
              className={`chip ${i === active ? 'on' : ''}`} onClick={() => setActive(i)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <p className="small muted">
        {col.label}{unitOf(col)} by taluka
        {card.total?.[col.key] != null && <> &middot; district total <strong>{num(card.total[col.key])}</strong></>}
      </p>
      <div className="chart-body" style={{ height: 260 }}>
        <BarChart
          labels={card.rows.map((r) => r.taluka.replace(/ \(synthetic\)$/, ''))}
          values={card.rows.map((r) => r.values[col.key] ?? null)}
          unit={col.unit}
          color={PALETTE[active % PALETTE.length]}
        />
      </div>
      <details className="more">
        <summary>View data table</summary>
        <Table card={card} />
      </details>
    </>
  )
}

export function DsaCard({ card }: { card: CardData }) {
  return (
    <section className={`card dsa-card kind-${card.kind}`}>
      <header className="card-head">
        <h3>{card.title}</h3>
        {card.year && <span className="badge">{card.year}</span>}
      </header>
      <Body card={card} />
    </section>
  )
}
