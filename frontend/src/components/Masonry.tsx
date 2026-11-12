import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** One grid row is this many px; keep in sync with `.masonry { grid-auto-rows }` in index.css. */
const ROW = 4
/** Space kept below each item (matches the old 1.1rem grid gap). */
const GAP = 18

function Item({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [span, setSpan] = useState(1)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const measure = () => setSpan(Math.ceil((el.offsetHeight + GAP) / ROW))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return <div className="mason-item" style={{ gridRowEnd: `span ${span}` }}><div ref={inner}>{children}</div></div>
}

/**
 * Cards flow in reading order (left to right, then down) but each goes into the column with free space,
 * so a short card never leaves a hole beside a tall one. One column on narrow screens.
 */
export function Masonry({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`masonry ${className}`}>{Children.map(children, (c) => <Item>{c}</Item>)}</div>
}
