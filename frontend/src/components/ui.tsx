import { useRef, type ReactNode } from 'react'
import { dash } from '../lib/format'

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
export function ChartCard({ title, subtitle, children, height = 320, className = '' }: {
  title: string
  subtitle?: string
  children: ReactNode
  height?: number
  className?: string
}) {
  const body = useRef<HTMLDivElement>(null)

  const download = () => {
    const canvases = [...(body.current?.querySelectorAll('canvas') ?? [])]
    if (!canvases.length) return
    const gap = 24
    const out = document.createElement('canvas')
    out.width = canvases.reduce((w, c) => w + c.width, 0) + gap * (canvases.length - 1)
    out.height = Math.max(...canvases.map((c) => c.height))
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, out.width, out.height)
    let x = 0
    for (const c of canvases) { ctx.drawImage(c, x, 0); x += c.width + gap }
    const a = document.createElement('a')
    a.download = `${title.replace(/[^\w]+/g, '_')}.png`
    a.href = out.toDataURL('image/png')
    a.click()
  }

  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <button type="button" className="icon-btn" onClick={download} aria-label={`Download ${title} as PNG`} title="Download as PNG">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      </header>
      <div ref={body} className="chart-body" style={{ height }}>{children}</div>
    </section>
  )
}
