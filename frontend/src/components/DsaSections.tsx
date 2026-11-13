import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../api/client'
import type { SectionResponse, SectionSummary } from '../api/types'
import { DsaCard } from './DsaCard'
import { Masonry } from './Masonry'
import { Icon, ICON } from './Modal'
import { Tab, TabList } from './Tabs'
import { DEFAULT_SECTION_ID } from '../config'
import { ErrorBox, Skeleton } from './ui'

/** The Statistical Abstract: one tab per section, each a masonry of cards. districtId null = whole state (cards split by district). */
export function DsaSections({ districtId, year, yearQuery }: { districtId: number | null; year: string | null; yearQuery: string }) {
  const sections = useApi<SectionSummary[]>('/sections')
  const [chosen, setChosen] = useState<string | null>(null)
  // The first section is requested straight away (in parallel with the section list), not after the list arrives.
  const list = sections.data
  const active = chosen ?? (list && !list.some((s) => s.id === DEFAULT_SECTION_ID) ? list[0]?.id : DEFAULT_SECTION_ID) ?? DEFAULT_SECTION_ID
  const base = districtId === null ? '/state' : `/districts/${districtId}`
  const data = useApi<SectionResponse>(`${base}/sections/${active}${yearQuery}`)

  if (sections.error) return <ErrorBox message={sections.error} />
  const current = list?.find((s) => s.id === active)
  // Static cards (the profile) are shown by the page itself on the state view.
  const cards = data.data?.cards.filter((c) => districtId !== null || !c.static) ?? []

  return (
    <section aria-labelledby="dsa-heading" className="dsa">
      <div className="dsa-head">
        <h2 id="dsa-heading">{districtId === null ? 'State' : 'District'} Statistical Abstract</h2>
        {/* Opens the stand-alone print version (all sections, whatever is expanded here) in its own tab. */}
        <Link className="btn-tool" to={`/print/${districtId ?? 'state'}${yearQuery ? `${yearQuery}&` : '?'}autoprint=1`} target="_blank" rel="noopener">
          <Icon d={ICON.print} />Print abstract
        </Link>
      </div>
      <TabList label="Abstract sections">
        {(list ?? []).map((s) => (
          <Tab key={s.id} id={`tab-${s.id}`} controls="dsa-panel" selected={s.id === active} onSelect={() => setChosen(s.id)}>{s.title}</Tab>
        ))}
      </TabList>
      <div id="dsa-panel" role="tabpanel" aria-labelledby={active ? `tab-${active}` : undefined} tabIndex={0}>
        {current && <p className="muted">{current.description}</p>}
        {data.loading && (
          <div className="skeleton-grid">
            {[220, 300, 260, 220].map((h, i) => <Skeleton key={i} height={h} label="Loading abstract cards…" />)}
          </div>
        )}
        {data.error && <ErrorBox message={data.error} />}
        {data.data && (
          <Masonry className="dsa-grid">
            {cards.map((c) => (
              <DsaCard
                key={c.id} card={c} split={districtId === null ? 'district' : 'taluka'}
                historyPath={`${base}/cards/${c.id}/history`} selectedYear={year}
              />
            ))}
          </Masonry>
        )}
      </div>
    </section>
  )
}
