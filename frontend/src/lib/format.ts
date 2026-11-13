const IN = 'en-IN'

export const dash = '–'

export function num(v: number | null | undefined, maxFrac = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return dash
  return v.toLocaleString(IN, { maximumFractionDigits: maxFrac })
}

export function inr(v: number | null | undefined): string {
  return v === null || v === undefined ? dash : `₹${num(v, 0)}`
}

/** GDDP is stored in rupees crore; 1,00,000 crore = 1 lakh crore. */
export function crore(v: number | null | undefined): string {
  if (v === null || v === undefined) return dash
  if (Math.abs(v) >= 100_000) return `₹${num(v / 100_000, 2)} lakh Cr`
  return `₹${num(v, 0)} Cr`
}

/** Exactly `d` decimals (12 -> "12.0" for d = 1), unlike num() which only caps them. */
export function fixed(v: number | null | undefined, d: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return dash
  return v.toLocaleString(IN, { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** Percentages are always shown with exactly one decimal. Display only: stored values are untouched. */
export function pct(v: number | null | undefined, frac = 1): string {
  return v === null || v === undefined ? dash : `${fixed(v, frac)}%`
}

/** What decides how a measure is printed: its unit and, when the data owner fixes it, its number of decimals. */
export interface ValueFormat { unit?: string; decimals?: number }

/** Digits to show: the measure's own `decimals`, else 1 for percentages, else undefined (natural, up to 2). */
export const decimalsOf = (f?: ValueFormat): number | undefined => f?.decimals ?? (f?.unit === '%' ? 1 : undefined)

/** Format a measure's value consistently everywhere (cards, tables, tooltips, labels, exports). */
export function fmt(v: number | null | undefined, f?: ValueFormat): string {
  const d = decimalsOf(f)
  return d === undefined ? num(v) : fixed(v, d)
}

/** "12.5" + "%" -> "12.5%"; "3,000" + "km" -> "3,000 km"; no unit -> unchanged. */
export function withUnit(text: string, unit?: string): string {
  return !unit ? text : unit === '%' ? `${text}%` : `${text} ${unit}`
}

/** '2023_24' -> '2023-24' */
export function fy(y: string | null | undefined): string {
  return y ? y.replace('_', '-') : dash
}

/** Short axis ticks: 1.2K, 3.4L (lakh), 5.6Cr style would confuse, so use K/M. */
export function compact(v: number): string {
  return new Intl.NumberFormat(IN, { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

/** Neutralise spreadsheet formula injection for CSV export. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** 'tot_elecons_total' -> 'Tot elecons total' (fallback label for the explorer). */
export function humanize(col: string): string {
  const s = col.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
