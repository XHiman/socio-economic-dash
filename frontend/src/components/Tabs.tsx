import type { KeyboardEvent, ReactNode } from 'react'

/**
 * WAI-ARIA tabs: the list is one tab stop (roving tabindex on the Tab buttons) and Left/Right/Home/End move
 * between tabs, activating them as they receive focus.
 */
export function TabList({ label, className = 'tabs', children }: { label: string; className?: string; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')]
    const at = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    e.preventDefault()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    tabs[next]!.focus()
    tabs[next]!.click()
  }
  return <div className={className} role="tablist" aria-label={label} onKeyDown={onKeyDown}>{children}</div>
}

export function Tab({ selected, onSelect, id, controls, children }: {
  selected: boolean
  onSelect: () => void
  id?: string
  controls?: string
  children: ReactNode
}) {
  return (
    <button
      type="button" role="tab" id={id} aria-selected={selected} aria-controls={controls} tabIndex={selected ? 0 : -1}
      className={`tab ${selected ? 'on' : ''}`} onClick={onSelect}
    >
      {children}
    </button>
  )
}

/** Metric picker: a group of toggle buttons (not tabs, as they don't switch a panel). */
export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="chips" role="group" aria-label={label}>{children}</div>
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={on} className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{children}</button>
}
