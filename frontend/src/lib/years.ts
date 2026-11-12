const startOf = (y: string) => /^\d{4}/.exec(y)?.[0] ?? ''

/** True when two financial-year labels start in the same year ('2023_24' and '2023-24'). */
export const sameYear = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && startOf(a) === startOf(b)

/** Index of the latest year starting at or before `selected` (mirrors the API); -1 if none. */
export function resolveYearIndex(years: string[], selected: string | null | undefined): number {
  const s = selected ? startOf(selected) : ''
  if (!s) return years.length - 1
  let found = -1
  years.forEach((y, i) => { if (startOf(y) && startOf(y) <= s) found = i })
  return found
}
