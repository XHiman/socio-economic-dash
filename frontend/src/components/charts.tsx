import { Bar, Doughnut, Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { AXIS, GRID, PALETTE } from '../lib/chart'
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

export function DoughnutChart({ labels, values, colors }: {
  labels: string[]
  values: (number | null)[]
  colors: string[]
}) {
  const total = values.reduce<number>((a, v) => a + (v ?? 0), 0)
  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
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
      data={{ labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] }}
    />
  )
}
