import { useEffect, useRef, type ReactNode } from 'react'
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

/** Full-screen overlay: Esc / backdrop click / ✕ close it and the page behind doesn't scroll. */
export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  const closeBtn = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    closeBtn.current?.focus()
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button ref={closeBtn} type="button" className="icon-btn" onClick={onClose} aria-label="Close full screen" title="Close (Esc)"><Icon d={ICON.close} /></button>
        </header>
        {children}
      </div>
    </div>
  )
}

/** Toolbar + chart area for an expanded chart. Download stitches every canvas inside onto a white, watermarked PNG. */
export function ChartPanel({ title, reference, legend, tabs, tools, canDownload = true, plain = false, children }: {
  title: string
  reference?: string
  legend?: LegendItem[]
  tabs?: ReactNode
  tools?: ReactNode
  canDownload?: boolean
  /** No fixed chart height (tables). */
  plain?: boolean
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const download = () => { void exportPng([...(box.current?.querySelectorAll('canvas') ?? [])], { title, reference, legend }) }
  return (
    <>
      <div className="modal-bar">
        <div className="tabs" role="tablist">{tabs}</div>
        <div className="modal-tools">
          {tools}
          <button type="button" className="btn-tool" onClick={download} disabled={!canDownload} title={canDownload ? 'Download as PNG' : 'Download is available for charts'}>
            <Icon d={ICON.download} />Download
          </button>
        </div>
      </div>
      <div className="modal-body">
        <div ref={box} className={plain ? 'modal-plain' : 'modal-chart'}>{children}</div>
      </div>
      {reference && <footer className="modal-foot muted small">{reference}</footer>}
    </>
  )
}
