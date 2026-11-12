import {
  ArcElement, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'

Chart.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

/** Number of --GcolorN variables defined in index.css. */
export const GCOLOR_COUNT = 10
/** Only used if the CSS variables are unavailable (SSR, tests); the real values live in index.css. */
const FALLBACK = ['#1E3A8A', '#0D9488', '#F59E0B', '#7C3AED', '#DB2777', '#0EA5E9', '#65A30D', '#64748B', '#EA580C', '#92400E']

const resolved: string[] = []
/** Resolved value of --Gcolor{i+1}. Canvas can't use var(), so charts read the variable (once; cached) when they render. */
function gcolor(i: number): string {
  if (resolved[i]) return resolved[i]!
  const v = typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(`--Gcolor${i + 1}`).trim()
  if (v) resolved[i] = v
  return v || FALLBACK[i]!
}
/** Series colour: the 10 global colours, then generated hues so charts with many series (one per taluka) stay distinguishable. */
export const seriesColor = (i: number) => (i < GCOLOR_COUNT ? gcolor(i) : `hsl(${(i * 47) % 360} 55% 45%)`)
/** Primary / Secondary / Tertiary. */
export const sectorColors = () => [gcolor(1), gcolor(0), gcolor(2)]

export const AXIS = '#64748B'
export const GRID = '#E2E8F0'

Chart.defaults.font.family = "system-ui, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.color = AXIS
Chart.defaults.animation = false

/** Chart transition for charts that animate (expanded views); none for people who ask for reduced motion. */
export const chartAnimation = () => ({
  duration: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500,
})
