import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { Chart, type ChartOptions, type ChartType, type Plugin } from 'chart.js'
import { AXIS, chartAnimation, GRID, seriesColor } from '../lib/chart'
import { compact, fixed, fmt, num, withUnit } from '../lib/format'

/** Format a data label / tooltip value for dataset `datasetIndex`. */
type LabelFormat = (value: number, datasetIndex: number) => string

interface Box { x: number; y: number; w: number; h: number }
const overlaps = (a: Box, b: Box, pad = 2) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad

/**
 * Prints each point's actual value on bar and line charts. Placement follows the chart type: above vertical bars
 * (rotated when the bar is too narrow for the text), beside horizontal bars, centred inside stacked segments, above
 * line points. A label that would overlap one already drawn, leave the canvas or not fit its segment is skipped, so
 * what is shown stays legible; the tooltip always has every value. Emphasised series are placed first.
 */
function valueLabelPlugin(cfg: { format: LabelFormat; stacked: boolean; horizontal: boolean; line: boolean }): Plugin<'bar' | 'line'> {
  return {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart
      const size = 11
      const taken: Box[] = []
      ctx.save()
      ctx.font = `600 ${size}px ${Chart.defaults.font.family}`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'

      const place = (text: string, cx: number, cy: number, rotated: boolean): boolean => {
        const w = ctx.measureText(text).width
        if (!rotated) cx = Math.min(Math.max(cx, chart.chartArea.left + w / 2), chart.width - w / 2 - 2) // first/last points sit on the axes
        const box: Box = rotated ? { x: cx - size / 2, y: cy - w / 2, w: size, h: w } : { x: cx - w / 2, y: cy - size / 2, w, h: size }
        if (box.x < 0 || box.y < 0 || box.x + box.w > chart.width || box.y + box.h > chart.height) return false
        if (taken.some((t) => overlaps(box, t))) return false
        taken.push(box)
        ctx.save()
        ctx.translate(cx, cy)
        if (rotated) ctx.rotate(-Math.PI / 2)
        ctx.lineWidth = 3
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.strokeText(text, 0, 0)
        ctx.fillStyle = '#0f172a'
        ctx.fillText(text, 0, 0)
        ctx.restore()
        return true
      }

      const order = chart.data.datasets.map((_, i) => i).sort((a, b) =>
        Number(!!(chart.data.datasets[b] as { emphasis?: boolean }).emphasis) - Number(!!(chart.data.datasets[a] as { emphasis?: boolean }).emphasis))
      for (const di of order) {
        if (!chart.isDatasetVisible(di)) continue
        const data = chart.data.datasets[di]!.data as (number | null)[]
        chart.getDatasetMeta(di).data.forEach((el, i) => {
          const v = data[i]
          if (v === null || v === undefined || Number.isNaN(v)) return
          const text = cfg.format(v, di)
          const textW = ctx.measureText(text).width
          const p = el.getProps(['x', 'y', 'base', 'width', 'height'], true) as { x: number; y: number; base: number; width: number; height: number }
          if (cfg.line) { place(text, p.x, p.y - 10, false); return }
          if (cfg.horizontal) {
            const thickness = p.height, end = Math.max(p.x, p.base), len = Math.abs(p.x - p.base)
            if (thickness < size) return
            if (cfg.stacked) { if (len >= textW + 6) place(text, (p.x + p.base) / 2, p.y, false); return }
            if (!place(text, end + 6 + textW / 2, p.y, false) && len >= textW + 10) place(text, end - 6 - textW / 2, p.y, false)
            return
          }
          const barW = p.width, top = Math.min(p.y, p.base), segH = Math.abs(p.base - p.y)
          if (cfg.stacked) {
            if (segH >= size + 2 && barW >= textW + 4) place(text, p.x, (p.y + p.base) / 2, false)
            else if (barW >= size + 2 && segH >= textW + 6) place(text, p.x, (p.y + p.base) / 2, true)
            return
          }
          if (barW >= textW + 2) place(text, p.x, top - size / 2 - 3, false)
          else if (barW >= size) place(text, p.x, top - textW / 2 - 4, true)
        })
      }
      ctx.restore()
    },
  }
}

/** Room around the plot for labels that sit outside the bars/points. */
const labelPadding = (horizontal: boolean) => ({ top: horizontal ? 8 : 22, right: horizontal ? 64 : 12, bottom: 4, left: 4 })

export interface LineSeries { label: string; data: (number | null)[]; color?: string; emphasis?: boolean }

export function LineChart({ labels, series, yTitle, format = (v) => num(v, 2), showValues = false, labelFormat }: {
  labels: string[]
  series: LineSeries[]
  yTitle?: string
  format?: (v: number) => string
  /** Print the value at every point (expanded views). */
  showValues?: boolean
  labelFormat?: (v: number) => string
}) {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    ...(showValues ? { layout: { padding: labelPadding(false) } } : {}),
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
      plugins={showValues ? [valueLabelPlugin({ format: (v) => (labelFormat ?? format)(v), stacked: false, horizontal: false, line: true })] : []}
      data={{
        labels,
        datasets: series.map((s, i) => {
          const color = s.color ?? seriesColor(i)
          return {
            label: s.label,
            data: s.data,
            borderColor: color,
            backgroundColor: color,
            borderWidth: s.emphasis ? 3.5 : 2,
            pointRadius: s.emphasis ? 3 : 1.5,
            tension: 0.25,
            spanGaps: true,
            emphasis: s.emphasis,
          }
        }),
      }}
    />
  )
}

/** Break a long category label onto lines of at most `max` characters so it isn't cut off beside a horizontal bar. */
const wrapLabel = (text: string, max: number): string | string[] => {
  if (text.length <= max) return text
  const lines: string[] = []
  for (const word of text.split(' ')) {
    const last = lines.at(-1)
    if (last !== undefined && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

export function BarChart({ labels, values, color = seriesColor(0), colors, horizontal = false, format = (v) => num(v, 2), unit, showValues = false, labelFormat, dense = false }: {
  labels: string[]
  values: (number | null)[]
  color?: string
  /** One colour per bar (e.g. to highlight a single district); overrides `color`. */
  colors?: string[]
  horizontal?: boolean
  format?: (v: number) => string
  unit?: string
  /** Print the value on every bar (expanded views). */
  showValues?: boolean
  labelFormat?: (v: number) => string
  /** Many categories (e.g. every district): show every label, in a smaller size. */
  dense?: boolean
}) {
  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    ...(showValues ? { layout: { padding: labelPadding(horizontal) } } : {}),
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => withUnit(format(c.parsed[horizontal ? 'x' : 'y'] ?? 0), unit) } },
    },
    scales: {
      x: { grid: { display: horizontal, color: GRID }, ticks: { color: AXIS, ...(horizontal ? { callback: (v) => compact(Number(v)) } : {}) } },
      y: { grid: { display: !horizontal, color: GRID }, ticks: { color: AXIS, ...(horizontal ? (dense ? { autoSkip: false, font: { size: 9 } } : { autoSkip: false }) : { callback: (v) => compact(Number(v)) }) } },
    },
  }
  return (
    <Bar
      options={options}
      plugins={showValues ? [valueLabelPlugin({ format: (v) => (labelFormat ?? format)(v), stacked: false, horizontal, line: false })] : []}
      data={{ labels: horizontal && !dense ? (labels.map((l) => wrapLabel(l, 18)) as string[]) : labels, datasets: [{ data: values, backgroundColor: colors ?? color, borderRadius: 3, maxBarThickness: 36 }] }}
    />
  )
}

interface CalloutOptions { enabled: boolean; names: boolean }

declare module 'chart.js' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> { callouts?: CalloutOptions }
}

/**
 * Draws each segment share on the ring (and its name when `names` is set); segments under 4% are skipped.
 * Registered once and switched through the chart's `plugins.callouts` options: Chart.js applies a changed plugin
 * list only when the chart is created, but option changes are picked up on every update.
 */
const calloutPlugin: Plugin<'doughnut', CalloutOptions> = {
    id: 'callouts',
    defaults: { enabled: false, names: false },
    afterDatasetsDraw(chart, _args, opts) {
      if (!opts.enabled) return
      const names = opts.names ? (chart.data.labels as string[]) : null
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
        const lines = names ? [names[i]!, `${fixed(share, 1)}%`] : [`${fixed(share, 1)}%`]
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
    cutout: '55%', // same with or without callouts so the expanded view only adds the labels
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (c) => {
            const v = Number(c.parsed)
            return `${c.label}: ${fixed(total ? (v / total) * 100 : 0, 1)}%`
          },
        },
      },
      callouts: { enabled: callouts, names },
    },
  }
  return (
    <Doughnut
      options={options}
      plugins={[calloutPlugin]}
      data={{ labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }] }}
    />
  )
}

/** `decimals` fixes the digits shown for this series' labels and tooltips (e.g. 1 for percentages, 0 for the sex ratio). */
export interface Series { label: string; data: (number | null)[]; decimals?: number }

/**
 * Multi-series bar/line chart for the expanded card view: stacking, horizontal bars, animation, a pinned value axis
 * and the actual value printed on every bar/point. The category axis (talukas, components or financial years) is
 * `x`, or `y` when horizontal.
 */
export function SeriesChart({ labels, series, type = 'bar', stacked = false, horizontal = false, unit, yMax, yTitle, showValues = true, animate = true }: {
  labels: string[]
  series: Series[]
  type?: 'bar' | 'line'
  stacked?: boolean
  horizontal?: boolean
  unit?: string
  yMax?: number
  yTitle?: string
  showValues?: boolean
  /** Off for static output (the print document). */
  animate?: boolean
}) {
  const value = horizontal ? 'x' : 'y'
  const category = horizontal ? 'y' : 'x'
  const format: LabelFormat = (v, di) => fmt(v, { unit, decimals: series[di]?.decimals })
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: animate ? chartAnimation() : false,
    indexAxis: category,
    interaction: { mode: 'index', intersect: false, axis: category },
    ...(showValues ? { layout: { padding: labelPadding(horizontal) } } : {}),
    plugins: {
      legend: { display: series.length > 1, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: {
        callbacks: {
          label: (c: { dataset: { label?: string }; datasetIndex: number; parsed: Record<string, number | null> }) =>
            `${c.dataset.label}: ${withUnit(format(c.parsed[value] ?? 0, c.datasetIndex), unit)}`,
        },
      },
    },
    scales: {
      [category]: { stacked, grid: { display: false }, ticks: { autoSkip: false } },
      [value]: {
        stacked, grid: { color: GRID }, beginAtZero: true,
        ticks: { callback: (v: string | number) => compact(Number(v)) },
        ...(yMax ? { max: yMax } : {}),
        title: { display: !!(yTitle ?? unit), text: yTitle ?? unit ?? '' },
      },
    },
  }
  const labelPlugin = showValues ? [valueLabelPlugin({ format, stacked, horizontal, line: type === 'line' })] : []
  if (type === 'line') {
    return (
      <Line
        options={options as unknown as ChartOptions<'line'>}
        plugins={labelPlugin}
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
      options={options as unknown as ChartOptions<'bar'>}
      plugins={labelPlugin}
      data={{
        labels,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data, backgroundColor: seriesColor(i), borderRadius: stacked ? 0 : 3, maxBarThickness: 48,
        })),
      }}
    />
  )
}
