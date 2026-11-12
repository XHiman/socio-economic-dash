import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { Chart, type ChartOptions, type Plugin } from 'chart.js'
import { AXIS, GRID, PALETTE, seriesColor } from '../lib/chart'
import { compact, num } from '../lib/format'

export interface LineSeries { label: string; data: (number | null)[]; color?: string; emphasis?: boolean }

export function LineChart({ labels, series, yTitle, format = (v) => num(v, 2) }: {
  labels: string[]
  series: LineSeries[]
  yTitle?: string
  format?: (v: number) => string
}) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: series.length > 1, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${format(c.parsed.y ?? 0)}` } },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: GRID },
        title: { display: !!yTitle, text: yTitle ?? '' },
        ticks: { callback: (v) => compact(Number(v)) },
      },
    },
  }
  return (
    <Line
      options={options}
      data={{
        labels,
        datasets: series.map((s, i) => {
          const color = s.color ?? PALETTE[i % PALETTE.length]
          return {
            label: s.label,
            data: s.data,
            borderColor: color,
            backgroundColor: color,
            borderWidth: s.emphasis ? 3.5 : 2,
            pointRadius: s.emphasis ? 3 : 1.5,
            tension: 0.25,
            spanGaps: true,
          }
        }),
      }}
    />
  )
}

export function BarChart({ labels, values, color = PALETTE[0], horizontal = false, format = (v) => num(v, 2), unit }: {
  labels: string[]
  values: (number | null)[]
  color?: string
  horizontal?: boolean
  format?: (v: number) => string
  unit?: string
}) {
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${format(c.parsed[horizontal ? 'x' : 'y'] ?? 0)}${unit ? ` ${unit}` : ''}` } },
    },
    scales: {
      x: { grid: { display: horizontal, color: GRID }, ticks: { color: AXIS, ...(horizontal ? { callback: (v) => compact(Number(v)) } : {}) } },
      y: { grid: { display: !horizontal, color: GRID }, ticks: { color: AXIS, ...(horizontal ? {} : { callback: (v) => compact(Number(v)) }) } },
    },
  }
  return (
    <Bar
      options={options}
      data={{ labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 3, maxBarThickness: 36 }] }}
    />
  )
}

/** Draws each segment share on the ring (and its name when `names` is set); segments under 4% are skipped. */
function calloutPlugin(names: string[] | null): Plugin<'doughnut'> {
  return {
    id: 'callouts',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      const data = chart.data.datasets[0]!.data as (number | null)[]
      const total = data.reduce<number>((a, v) => a + (v ?? 0), 0)
      if (!total) return
      const size = Math.max(11, Math.min(18, chart.width / 16))
      chart.getDatasetMeta(0).data.forEach((arc, i) => {
        const share = ((data[i] ?? 0) / total) * 100
        if (share < 4) return
        const { x, y } = arc.tooltipPosition(true)
        if (x === null || y === null) return
        const lines = names ? [names[i]!, `${num(share, 1)}%`] : [`${num(share, 1)}%`]
        ctx.save()
        ctx.font = `700 ${size}px ${Chart.defaults.font.family}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        lines.forEach((t, j) => {
          const ly = y + (j - (lines.length - 1) / 2) * size * 1.2
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)'
          ctx.strokeText(t, x, ly)
          ctx.fillStyle = '#fff'
          ctx.fillText(t, x, ly)
        })
        ctx.restore()
      })
    },
  }
}

export function DoughnutChart({ labels, values, colors, callouts = false, names = false }: {
  labels: string[]
  values: (number | null)[]
  colors: string[]
  /** Print each segment share on the ring. */
  callouts?: boolean
  /** Include the segment name in the callout. */
  names?: boolean
}) {
  const total = values.reduce<number>((a, v) => a + (v ?? 0), 0)
  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: callouts ? '45%' : '58%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            const v = Number(c.parsed)
            return `${c.label}: ${num(total ? (v / total) * 100 : 0, 1)}%`
          },
        },
      },
    },
  }
  return (
    <Doughnut
      options={options}
      plugins={callouts ? [calloutPlugin(names ? labels : null)] : []}
      data={{ labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] }}
    />
  )
}

export interface Series { label: string; data: (number | null)[] }

/** Multi-series bar/line chart for the expanded card view: optional stacking, animation and a pinned value axis. */
export function SeriesChart({ labels, series, type, stacked = false, unit, yMax, yTitle }: {
  labels: string[]
  series: Series[]
  type: 'bar' | 'line'
  stacked?: boolean
  unit?: string
  yMax?: number
  yTitle?: string
}) {
  const tick = { callback: (v: string | number) => compact(Number(v)) }
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: series.length > 1, position: 'bottom' as const, labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { callbacks: { label: (c: { dataset: { label?: string }; parsed: { y: number | null } }) => `${c.dataset.label}: ${num(c.parsed.y)}${unit ? ` ${unit}` : ''}` } },
    },
    scales: {
      x: { stacked, grid: { display: false } },
      y: {
        stacked, grid: { color: GRID }, ticks: tick, beginAtZero: true,
        ...(yMax ? { max: yMax } : {}),
        title: { display: !!(yTitle ?? unit), text: yTitle ?? unit ?? '' },
      },
    },
  }
  if (type === 'line') {
    return (
      <Line
        options={common}
        data={{
          labels,
          datasets: series.map((s, i) => ({
            label: s.label, data: s.data, borderColor: seriesColor(i), backgroundColor: seriesColor(i),
            borderWidth: 2, pointRadius: 3.5, tension: 0.2, spanGaps: true,
          })),
        }}
      />
    )
  }
  return (
    <Bar
      options={common}
      data={{
        labels,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data, backgroundColor: seriesColor(i), borderRadius: stacked ? 0 : 3, maxBarThickness: 48,
        })),
      }}
    />
  )
}
