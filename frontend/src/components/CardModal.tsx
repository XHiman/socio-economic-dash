import { useEffect, useRef, useState } from 'react'
import type { CardColumn, CardData, CardHistory } from '../api/types'
import { useApi } from '../api/client'
import { describeValues } from '../lib/a11y'
import { exportPng } from '../lib/download'
import { fmt, fy } from '../lib/format'
import { resolveYearIndex } from '../lib/years'
import { CardTable, refLabel, stackParts, unitLine, unitOf, type Split } from './CardTable'
import { SeriesChart, type Series } from './charts'
import { Icon, ICON, Modal } from './Modal'
import { Chip, ChipGroup, Tab, TabList } from './Tabs'
import { Empty, ErrorBox, Loading } from './ui'

const clean = (name: string) => name.replace(/ \(synthetic\)$/, '')
/** The decimals every column agrees on (undefined if they differ or none is set). */
const sharedDecimals = (cols: CardColumn[]) => {
  const d = new Set(cols.map((c) => c.decimals))
  return d.size === 1 ? [...d][0] : undefined
}
const sharedUnit = (cols: CardColumn[]) => {
  const u = new Set(cols.map((c) => c.unit ?? ''))
  return u.size === 1 ? [...u][0] || undefined : undefined
}

interface Spec { labels: string[]; series: Series[]; stacked: boolean; horizontal: boolean; unit?: string; yMax?: number }

function Viewer({ h, split, selectedYear }: { h: CardHistory; split: Split; selectedYear: string | null }) {
  const { years } = h
  const keys = years.length ? years : [''] // tables without a year column keep one '' entry
  const [pickedIdx, setPickedIdx] = useState<number | null>(null)
  const initial = years.length ? Math.max(resolveYearIndex(years, selectedYear), 0) : 0
  const idx = Math.min(pickedIdx ?? initial, keys.length - 1)
  const year = keys[idx]!
  const [tab, setTab] = useState<'chart' | 'table'>('chart')
  const [timeSeries, setTimeSeries] = useState(false)
  const [metric, setMetric] = useState(h.kind === 'taluka' && stackParts(h).length > 1 ? -1 : 0) // -1 = "All" (stacked)
  const [playing, setPlaying] = useState(false)
  const chartBox = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (idx < keys.length - 1) setPickedIdx(idx + 1)
      else setPlaying(false)
    }, 1100)
    return () => clearTimeout(t)
  }, [playing, idx, keys.length])

  const parts = stackParts(h)
  const canAll = h.kind === 'taluka' && parts.length > 1
  const all = canAll && metric === -1
  const col = h.columns[Math.max(metric, 0)] ?? h.columns[0]!
  const labelFor = (cols: CardColumn[]) => (c: CardColumn) => (sharedUnit(cols) || !c.unit ? c.label : `${c.label} (${c.unit})`)

  const totalOf = (y: string, key: string) => {
    const d = h.data[y]
    if (d?.total?.[key] != null) return d.total[key]!
    const v = (d?.rows ?? []).map((r) => r.values[key]).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) : null
  }
  const yearLabels = years.length ? years.map(fy) : ['Latest']

  // Time series keeps the chart's own form (horizontal bars stay horizontal, stacks stay stacked) and moves
  // the financial years onto the category axis.
  const spec = ((): Spec | null => {
    if (h.kind === 'kpis') return null
    if (h.kind === 'breakdown') {
      const lab = labelFor(h.columns)
      const val = (y: string, c: CardColumn) => h.data[y]?.total?.[c.key] ?? null
      if (!timeSeries) {
        const yMax = Math.max(0, ...keys.flatMap((y) => h.columns.map((c) => val(y, c) ?? 0)))
        return { stacked: false, horizontal: true, unit: sharedUnit(h.columns), yMax, labels: h.columns.map(lab), series: [{ label: h.title, data: h.columns.map((c) => val(year, c)), decimals: sharedDecimals(h.columns) }] }
      }
      const cols = h.stackable ? parts : h.columns
      return { stacked: h.stackable, horizontal: true, unit: sharedUnit(cols), labels: yearLabels, series: cols.map((c) => ({ label: lab(c), data: keys.map((y) => val(y, c)), decimals: c.decimals })) }
    }
    // taluka / district split
    const cols = all ? parts : [col]
    const lab = labelFor(cols)
    if (!timeSeries) {
      const rowSum = (r: CardData['rows'][number]) => cols.reduce((a, c) => a + (r.values[c.key] ?? 0), 0)
      const yMax = Math.max(0, ...keys.flatMap((y) => (h.data[y]?.rows ?? []).map((r) => (all ? rowSum(r) : r.values[col.key] ?? 0))))
      const rows = h.data[year]?.rows ?? []
      return {
        stacked: all, horizontal: false, unit: sharedUnit(cols), yMax, labels: rows.map((r) => clean(r.taluka)),
        series: cols.map((c) => ({ label: lab(c), data: rows.map((r) => r.values[c.key] ?? null), decimals: c.decimals })),
      }
    }
    if (all) {
      return { stacked: true, horizontal: false, unit: sharedUnit(cols), labels: yearLabels, series: cols.map((c) => ({ label: lab(c), data: keys.map((y) => totalOf(y, c.key)), decimals: c.decimals })) }
    }
    const names = [...new Set(keys.flatMap((y) => (h.data[y]?.rows ?? []).map((r) => r.taluka)))].sort()
    return {
      stacked: false, horizontal: false, unit: col.unit, labels: yearLabels,
      series: names.map((n) => ({ label: clean(n), data: keys.map((y) => h.data[y]?.rows.find((r) => r.taluka === n)?.values[col.key] ?? null), decimals: col.decimals })),
    }
  })()
  const hasSeriesData = !!spec && spec.series.some((x) => x.data.some((v) => v != null))

  const slice: CardData = { ...h, year: year || null, total: h.data[year]?.total ?? null, rows: h.data[year]?.rows ?? [] }
  const showAllYears = tab === 'chart' && timeSeries
  // Unit of what is plotted: the chart's shared unit, else the units of the measures shown (named in the labels).
  const unitText = spec?.unit ?? undefined
  const ref = refLabel(h.table, showAllYears ? years : [years.length ? year : null])
  const hasData = !!h.data[year]
  const canDownload = tab === 'chart' && !!spec
  const timeLocked = showAllYears || keys.length < 2
  const onlyOneYear = keys.length < 2

  const play = () => {
    if (playing) return setPlaying(false)
    if (idx >= keys.length - 1) setPickedIdx(0)
    setPlaying(true)
  }
  const download = () => {
    const stamp = showAllYears ? '' : years.length ? ` - ${fy(year)}` : ''
    void exportPng([...(chartBox.current?.querySelectorAll('canvas') ?? [])], { title: `${h.title}${stamp}`, subtitle: unitText ? `Unit: ${unitText}` : undefined, reference: ref })
  }

  const axisHint = h.kind === 'breakdown'
    ? (timeSeries ? 'Financial years on the y-axis' : 'Components on the y-axis')
    : (timeSeries ? (all ? 'Financial years on the x-axis, stacked by measure' : `Financial years on the x-axis, one bar per ${split}`) : `${split === 'district' ? 'Districts' : 'Talukas'} on the x-axis`)

  const metricChips = tab === 'chart' && h.kind === 'taluka' && h.columns.length > 1 && (
    <ChipGroup label="Metric">
      {h.columns.map((c, i) => (canAll && c.total ? null : <Chip key={c.key} on={i === metric} onClick={() => setMetric(i)}>{c.label}</Chip>))}
      {canAll && <Chip on={all} onClick={() => setMetric(-1)}>All (stacked)</Chip>}
    </ChipGroup>
  )

  const chartLabel = spec
    ? `${h.title}. ${axisHint}. ${spec.series.length === 1
      ? describeValues(spec.labels, spec.series[0]!.data, spec.unit, (v) => fmt(v, { unit: spec.unit, decimals: spec.series[0]!.decimals }))
      : `${spec.series.length} series. Open the Data table tab for the values.`}`
    : h.title

  return (
    <>
      <div className="modal-bar">
        <TabList label="View">
          {(['chart', 'table'] as const).map((t) => (
            <Tab key={t} selected={tab === t} onSelect={() => setTab(t)}>{t === 'chart' ? (h.kind === 'kpis' ? 'Overview' : 'Chart') : 'Data table'}</Tab>
          ))}
        </TabList>
        <div className="modal-tools">
          {years.length > 0 && (
            <label>
              <span>Year</span>
              <select value={idx} disabled={showAllYears} onChange={(e) => { setPlaying(false); setPickedIdx(Number(e.target.value)) }}>
                {years.map((y, i) => <option key={y} value={i}>{fy(y)}</option>)}
              </select>
            </label>
          )}
          <button type="button" className="btn-tool" onClick={play} disabled={timeLocked} title={timeLocked ? 'Needs more than one year, with the time series view off' : 'Animate across years'}>
            <Icon d={playing ? ICON.pause : ICON.play} />{playing ? 'Pause' : 'Play'}
          </button>
          {h.kind !== 'kpis' && tab === 'chart' && (
            <button type="button" className={`btn-tool ${timeSeries ? 'on' : ''}`} aria-pressed={timeSeries} disabled={onlyOneYear} onClick={() => { setPlaying(false); setTimeSeries((f) => !f) }} title={onlyOneYear ? 'Only one financial year is available for this chart' : 'Show this chart across financial years'}>
              <Icon d={ICON.series} />Show Timeseries
            </button>
          )}
          <button type="button" className="btn-tool" onClick={download} disabled={!canDownload} title={canDownload ? 'Download as PNG' : 'Download is available for charts'}>
            <Icon d={ICON.download} />Download
          </button>
        </div>
      </div>

      {metricChips}

      <div className="modal-body">
        {!hasData ? <Empty /> : tab === 'table' ? (
          <CardTable card={slice} split={split} />
        ) : h.kind === 'kpis' ? (
          <dl className="stat-grid big">
            {h.columns.map((c) => (
              <div key={c.key} className="stat">
                <dt>{c.label}</dt>
                <dd>{fmt(slice.total?.[c.key], c)}</dd>
                {c.unit && <div className="unit-line">{c.unit}</div>}
              </div>
            ))}
          </dl>
        ) : spec && !hasSeriesData ? (
          <Empty>{timeSeries ? 'No time-series data is available for this chart.' : undefined}</Empty>
        ) : spec && (
          <>
            <p className="small muted">
              {h.kind === 'taluka' && !all ? `${col.label}${unitOf(col)} · ` : ''}{axisHint}
            </p>
            <div ref={chartBox} className="modal-chart">
              <div className="chart-fill" role="img" aria-label={chartLabel}>
                <SeriesChart labels={spec.labels} series={spec.series} stacked={spec.stacked} horizontal={spec.horizontal} unit={spec.unit} yMax={timeSeries ? undefined : spec.yMax} />
              </div>
              {!showAllYears && years.length > 0 && <div className="year-stamp" aria-live="polite">{fy(year)}</div>}
            </div>
          </>
        )}
      </div>
      <footer className="modal-foot muted small">{ref}</footer>
    </>
  )
}

export function CardModal({ card, split, historyPath, selectedYear, onClose }: {
  card: CardData; split: Split; historyPath: string; selectedYear: string | null; onClose: () => void
}) {
  const hist = useApi<CardHistory>(historyPath)
  return (
    <Modal title={card.title} subtitle={[refLabel(card.table, []), unitLine(card)].filter(Boolean).join(' · ')} onClose={onClose}>
      {hist.error ? <ErrorBox message={hist.error} /> : !hist.data ? <Loading /> : <Viewer h={hist.data} split={split} selectedYear={selectedYear} />}
    </Modal>
  )
}
