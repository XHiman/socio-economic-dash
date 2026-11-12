import { useState } from 'react'
import { useApi } from '../api/client'
import type { SectionResponse, SectionSummary } from '../api/types'
import { DsaCard } from './DsaCard'
import { Masonry } from './Masonry'
import { Tab, TabList } from './Tabs'
import { ErrorBox, Loading } from './ui'

/** The Statistical Abstract: one tab per section, each a masonry of cards. districtId null = whole state (cards split by district). */
export function DsaSections({ districtId, year }: { districtId: number | null; year: string | null }) {
  const sections = useApi<SectionSummary[]>('/sections')
  const [chosen, setChosen] = useState<string | null>(null)
  const active = chosen ?? sections.data?.[0]?.id ?? null
  const base = districtId === null ? '/state' : `/districts/${districtId}`
  const data = useApi<SectionResponse>(active && year ? `${base}/sections/${active}?year=${year}` : null)

  if (sections.error) return <ErrorBox message={sections.error} />
  if (!sections.data) return <Loading />
  const current = sections.data.find((s) => s.id === active)
  // Static cards (the profile) are shown by the page itself on the state view.
  const cards = data.data?.cards.filter((c) => districtId !== null || !c.static) ?? []

  return (
    <section aria-labelledby="dsa-heading" className="dsa">
      <h2 id="dsa-heading">{districtId === null ? 'State' : 'District'} Statistical Abstract</h2>
      <TabList label="Abstract sections">
        {sections.data.map((s) => (
          <Tab key={s.id} id={`tab-${s.id}`} controls="dsa-panel" selected={s.id === active} onSelect={() => setChosen(s.id)}>{s.title}</Tab>
        ))}
      </TabList>
      <div id="dsa-panel" role="tabpanel" aria-labelledby={active ? `tab-${active}` : undefined} tabIndex={0}>
        {current && <p className="muted">{current.description}</p>}
        {data.loading && <Loading />}
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
