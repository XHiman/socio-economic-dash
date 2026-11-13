import { fmt, num, withUnit } from './format'

/** Text alternative for a bar-style chart: how many values, and the highest and lowest. */
export function describeValues(labels: string[], values: (number | null)[], unit?: string, format: (v: number) => string = (v) => fmt(v, { unit })): string {
  const pts = values.flatMap((v, i) => (v === null ? [] : [{ label: labels[i] ?? '', v }]))
  if (!pts.length) return 'No data.'
  const hi = pts.reduce((a, b) => (b.v > a.v ? b : a))
  const lo = pts.reduce((a, b) => (b.v < a.v ? b : a))
  return `${pts.length} values. Highest: ${hi.label}, ${withUnit(format(hi.v), unit)}. Lowest: ${lo.label}, ${withUnit(format(lo.v), unit)}.`
}

/** Text alternative for a time series: first and last point and the peak. */
export function describeTrend(labels: string[], values: (number | null)[], format: (v: number) => string = (v) => num(v)): string {
  const pts = values.flatMap((v, i) => (v === null ? [] : [{ label: labels[i] ?? '', v }]))
  if (pts.length < 2) return pts.length ? `${pts[0]!.label}: ${format(pts[0]!.v)}.` : 'No data.'
  const first = pts[0]!
  const last = pts.at(-1)!
  const peak = pts.reduce((a, b) => (b.v > a.v ? b : a))
  return `From ${first.label}, ${format(first.v)}, to ${last.label}, ${format(last.v)}. Peak: ${peak.label}, ${format(peak.v)}.`
}
