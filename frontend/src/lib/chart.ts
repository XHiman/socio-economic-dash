import {
  ArcElement, BarElement, CategoryScale, Chart, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js'

Chart.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip)

/** Categorical palette (colour-blind safe ordering, matches the previous dashboard's brand colours). */
export const PALETTE = ['#1E3A8A', '#0D9488', '#F59E0B', '#7C3AED', '#DB2777', '#0EA5E9', '#65A30D', '#64748B']
export const SECTOR_COLORS = ['#0D9488', '#1E3A8A', '#F59E0B']

export const AXIS = '#64748B'
export const GRID = '#E2E8F0'

Chart.defaults.font.family = "system-ui, 'Segoe UI', Roboto, sans-serif"
Chart.defaults.color = AXIS
Chart.defaults.animation = false
