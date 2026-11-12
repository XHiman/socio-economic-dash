import { useRef, useState, type ReactNode } from 'react'
import { exportPng, type LegendItem } from '../lib/download'
import { DATA_DISCLAIMER } from '../config'
import { dash } from '../lib/format'
import { Icon, ICON, Modal } from './Modal'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="state state-error" role="alert">
      Couldn&apos;t load this data. <span className="muted">({message})</span>
    </div>
  )
}

export function Empty({ children = 'No data reported for this selection.' }: { children?: ReactNode }) {
  return <div className="state muted">{children}</div>
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value || dash}</div>
      {hint && <div className={`kpi-hint ${tone ?? ''}`}>{hint}</div>}
    </div>
  )
}

/** Card with a title and a "download as PNG" action that stitches every canvas inside it. */
export function ChartCard({ title, subtitle, children, height = 320, className = '', legend, expanded, description }: {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
  className?: string
  /** Colour key for charts whose legend is HTML, so the PNG export carries it. */
  legend?: LegendItem[]
  /** Text alternative for the chart (announced instead of the canvas); omit while it is loading. */
  description?: string
  /** Content of the full-screen view; adds an expand button when given. */
  expanded?: () => ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const download = () => { void exportPng([...(body.current?.querySelectorAll('canvas') ?? [])], { title, legend }) }

  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <div className="card-actions">
        {expanded && (
          <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={`View ${title} full screen`} title="Full screen">
            <Icon d={ICON.expand} />
          </button>
        )}
        <button type="button" className="icon-btn" onClick={download} aria-label={`Download ${title} as PNG`} title="Download as PNG">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
        </div>
      </header>
      {open && expanded && <Modal title={title} onClose={() => setOpen(false)}>{expanded()}</Modal>}
      <div
        ref={body} className="chart-body" style={{ height }}
        {...(description ? { role: 'img', 'aria-label': `${title}. ${description}` } : {})}
      >
        {children}
      </div>
    </section>
  )
}

/** Data-coverage notice; the text lives in config.ts. */
export function DataDisclaimer() {
  if (!DATA_DISCLAIMER) return null
  return (
    <p className="disclaimer" role="note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>{DATA_DISCLAIMER}</span>
    </p>
  )
}
