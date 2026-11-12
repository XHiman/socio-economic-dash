import type { CardColumn, CardData } from '../api/types'
import { fy, num } from '../lib/format'

export type Split = 'taluka' | 'district'

export const unitOf = (c: CardColumn) => (c.unit ? ` (${c.unit})` : '')

/** "DSA table 11a - 2024-25" (or a year range when several years are shown). */
export function refLabel(table: string, years: (string | null)[]): string {
  const ys = [...new Set(years.filter((y): y is string => !!y))].map(fy)
  const span = ys.length > 1 ? `${ys[0]} to ${ys.at(-1)}` : ys[0]
  return `DSA table ${table.replace(/^dsa_/, '')}${span ? ` - ${span}` : ''}`
}

/** The columns that are additive parts (a "total" column would double-count in a stack). */
export const stackParts = (card: Pick<CardData, 'columns' | 'stackable'>) =>
  card.stackable ? card.columns.filter((c) => !c.total) : []

export function CardTable({ card, split }: { card: CardData; split: Split }) {
  if (card.kind !== 'taluka') {
    return (
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Measure</th><th scope="col" className="num">Value</th><th scope="col">Unit</th></tr></thead>
          <tbody>
            {card.columns.map((c) => (
              <tr key={c.key}><th scope="row">{c.label}</th><td className="num">{num(card.total?.[c.key])}</td><td>{c.unit ?? ''}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{split === 'district' ? 'District' : 'Taluka'}</th>
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
          {card.total && (
            <tr className="total">
              <th scope="row">{split === 'district' ? 'State total' : 'District total'}</th>
              {card.columns.map((c) => <td key={c.key} className="num">{num(card.total![c.key])}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
