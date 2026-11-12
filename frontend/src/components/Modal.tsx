import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { exportPng, type LegendItem } from '../lib/download'

export const ICON = {
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  series: 'M3 3v18h18M7 15l4-4 4 3 5-7',
  flip: 'M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  close: 'M18 6L6 18M6 6l12 12',
  expand: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
}

export function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const FOCUSABLE = 'a[href], button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * Full-screen dialog. It is rendered in <body> and the app root is made inert while it is open, so keyboard and
 * screen-reader users can't reach the page behind it. Esc, a backdrop click or the close button dismiss it;
 * Tab cycles inside it, and focus returns to whatever opened it.
 */
export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const appRoot = document.getElementById('root')
    const prevOverflow = document.body.style.overflow
    appRoot?.setAttribute('inert', '')
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab' || !dialog.current) return
      const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]!, last = items.at(-1)!
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    closeBtn.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      appRoot?.removeAttribute('inert')
      document.body.style.overflow = prevOverflow
      opener?.focus()
    }
  }, [])

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={dialog} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-head">
          <div>
            <h2 id={titleId} className="modal-title">{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button ref={closeBtn} type="button" className="icon-btn" onClick={onClose} aria-label="Close full screen" title="Close (Esc)"><Icon d={ICON.close} /></button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * Toolbar + chart area for an expanded chart. Download stitches every canvas inside onto a white, watermarked PNG.
 * `description` is the text alternative announced for the chart.
 */
export function ChartPanel({ title, description, reference, legend, tabs, tools, canDownload = true, plain = false, children }: {
  title: string
  description?: string
  reference?: string
  legend?: LegendItem[]
  /** Tab list (use <TabList>) or a plain caption, shown left of the tools. */
  tabs?: ReactNode
  tools?: ReactNode
  canDownload?: boolean
  /** No fixed chart height, no image role (tables). */
  plain?: boolean
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const download = () => { void exportPng([...(box.current?.querySelectorAll('canvas') ?? [])], { title, reference, legend }) }
  return (
    <>
      <div className="modal-bar">
        <div className="modal-bar-left">{tabs}</div>
        <div className="modal-tools">
          {tools}
          <button type="button" className="btn-tool" onClick={download} disabled={!canDownload} title={canDownload ? 'Download as PNG' : 'Download is available for charts'}>
            <Icon d={ICON.download} />Download
          </button>
        </div>
      </div>
      <div className="modal-body">
        {plain
          ? <div ref={box} className="modal-plain">{children}</div>
          : <div ref={box} className="modal-chart" role="img" aria-label={description ? `${title}. ${description}` : title}>{children}</div>}
      </div>
      {reference && <footer className="modal-foot muted small">{reference}</footer>}
    </>
  )
}
