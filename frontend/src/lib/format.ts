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

export function pct(v: number | null | undefined, frac = 2): string {
  return v === null || v === undefined ? dash : `${num(v, frac)}%`
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
