import type { CardColumn, CardData } from '../api/types'
import { fmt, fy } from '../lib/format'
import { compareCell } from '../lib/insights'

export type Split = 'taluka' | 'district'

export const unitOf = (c: CardColumn) => (c.unit ? ` (${c.unit})` : '')

/** "DSA table 11a - 2024-25" (or a year range when several years are shown). */
export function refLabel(table: string, years: (string | null)[]): string {
  const ys = [...new Set(years.filter((y): y is string => !!y))].map(fy)
  const span = ys.length > 1 ? `${ys[0]} to ${ys.at(-1)}` : ys[0]
  return `DSA table ${table.replace(/^dsa_/, '')}${span ? ` - ${span}` : ''}`
}

/** "Unit: km" when every measure on a chart/table shares one unit; per-measure units are shown beside each value otherwise. */
export function unitLine(card: Pick<CardData, 'kind' | 'columns'>): string | null {
  if (card.kind === 'kpis') return null
  const units = [...new Set(card.columns.map((c) => c.unit).filter((u): u is string => !!u))]
  return units.length === 1 && card.columns.every((c) => c.unit) ? `Unit: ${units[0]}` : null
}

/** The columns that are additive parts (a "total" column would double-count in a stack). */
export const stackParts = (card: Pick<CardData, 'columns' | 'stackable'>) =>
  card.stackable ? card.columns.filter((c) => !c.total) : []

/**
 * `compare` (print only) is the State's version of this card: it adds a State column and a "vs State" column, or
 * for taluka tables a State row and a district-versus-State row.
 */
export function CardTable({ card, split, compare, label = 'Value' }: { card: CardData; split: Split; compare?: CardData | null; label?: string }) {
  const sv = compare?.total
  if (card.kind !== 'taluka' && sv) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Measure</th><th scope="col" className="num">{label}</th><th scope="col" className="num">State</th>
              <th scope="col" className="num">vs State</th><th scope="col">Unit</th>
            </tr>
          </thead>
          <tbody>
            {card.columns.map((c) => (
              <tr key={c.key}>
                <th scope="row">{c.label}</th>
                <td className="num">{fmt(card.total?.[c.key], c)}</td>
                <td className="num">{fmt(sv[c.key], c)}</td>
                <td className="num">{compareCell(c, card.total?.[c.key], sv[c.key])}</td>
                <td>{c.unit ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
  if (card.kind !== 'taluka') {
    return (
      <div className="table-wrap">
        <table>
          <thead><tr><th scope="col">Measure</th><th scope="col" className="num">Value</th><th scope="col">Unit</th></tr></thead>
          <tbody>
            {card.columns.map((c) => (
              <tr key={c.key}><th scope="row">{c.label}</th><td className="num">{fmt(card.total?.[c.key], c)}</td><td>{c.unit ?? ''}</td></tr>
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
              {card.columns.map((c) => <td key={c.key} className="num">{fmt(r.values[c.key], c)}</td>)}
            </tr>
          ))}
          {card.total && (
            <tr className="total">
              <th scope="row">{split === 'district' ? 'State total' : 'District total'}</th>
              {card.columns.map((c) => <td key={c.key} className="num">{fmt(card.total![c.key], c)}</td>)}
            </tr>
          )}
          {card.total && sv && (
            <>
              <tr className="compare">
                <th scope="row">State</th>
                {card.columns.map((c) => <td key={c.key} className="num">{fmt(sv[c.key], c)}</td>)}
              </tr>
              <tr className="compare">
                <th scope="row">{label} vs State</th>
                {card.columns.map((c) => <td key={c.key} className="num">{compareCell(c, card.total![c.key], sv[c.key])}</td>)}
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
