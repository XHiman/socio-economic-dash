import { useState } from 'react'
import { useApi } from '../api/client'
import type { District, ExploreResponse, ExploreTable } from '../api/types'
import { Empty, ErrorBox, Loading } from '../components/ui'
import { csvCell, humanize, num } from '../lib/format'

const MAX_COLS = 30

export default function ExplorerPage() {
  const districts = useApi<District[]>('/districts')
  const tables = useApi<ExploreTable[]>('/explore/tables')
  const [tableName, setTableName] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [level, setLevel] = useState<'district' | 'taluka'>('district')
  const [picked, setPicked] = useState<string[] | null>(null)

  const table = tables.data?.find((t) => t.name === (tableName ?? tables.data?.[0]?.name))
  const district = districtId ?? districts.data?.find((d) => d.name === 'Jalgaon')?.id ?? districts.data?.[0]?.id ?? null
  const cols = (picked ?? table?.columns.slice(0, 8) ?? []).filter((c) => table?.columns.includes(c))
  const effLevel = table?.hasTaluka ? level : 'district'

  const path = table && district && cols.length
    ? `/explore/${table.name}?district=${district}&level=${effLevel}&columns=${cols.join(',')}`
    : null
  const result = useApi<ExploreResponse>(path)

  const toggle = (c: string) => {
    const next = cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c].slice(0, MAX_COLS)
    setPicked(next)
  }

  const downloadCsv = () => {
    if (!result.data) return
    const hasTaluka = result.data.rows.some((r) => '_taluka' in r)
    const header = ['year', ...(hasTaluka ? ['taluka'] : []), ...result.data.columns]
    const lines = [header.map(csvCell).join(',')]
    for (const r of result.data.rows) {
      lines.push([r._year, ...(hasTaluka ? [r._taluka] : []), ...result.data.columns.map((c) => r[c])].map(csvCell).join(','))
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.data.table}_${district}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (tables.error || districts.error) return <ErrorBox message={tables.error ?? districts.error ?? ''} />
  if (!tables.data || !districts.data) return <Loading />

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <p className="eyebrow">District Statistical Abstract</p>
          <h1>Data explorer</h1>
        </div>
      </div>

      <div className="explorer">
        <aside className="card explorer-side">
          <label className="field">
            <span>Table</span>
            <select value={table?.name ?? ''} onChange={(e) => { setTableName(e.target.value); setPicked(null) }}>
              {tables.data.map((t) => <option key={t.name} value={t.name}>{t.name.replace('dsa_', 'DSA ')}</option>)}
            </select>
          </label>
          <label className="field">
            <span>District</span>
            <select value={district ?? ''} onChange={(e) => setDistrictId(Number(e.target.value))}>
              {districts.data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {table?.hasTaluka && (
            <fieldset className="field">
              <legend>Level</legend>
              {(['district', 'taluka'] as const).map((l) => (
                <label key={l} className="radio"><input type="radio" name="level" checked={effLevel === l} onChange={() => setLevel(l)} />{l === 'district' ? 'District total' : 'By taluka'}</label>
              ))}
            </fieldset>
          )}
          <fieldset className="field cols">
            <legend>Columns ({cols.length}/{MAX_COLS})</legend>
            {table?.columns.map((c) => (
              <label key={c} className="check"><input type="checkbox" checked={cols.includes(c)} onChange={() => toggle(c)} />{humanize(c)}</label>
            ))}
          </fieldset>
        </aside>

        <section className="card explorer-main" aria-live="polite">
          <header className="card-head">
            <h3>{table?.name.replace('dsa_', 'DSA ')}</h3>
            <button type="button" className="btn" onClick={downloadCsv} disabled={!result.data?.rows.length}>Download CSV</button>
          </header>
          {!cols.length ? <Empty>Select at least one column.</Empty>
            : result.loading ? <Loading />
            : result.error ? <ErrorBox message={result.error} />
            : !result.data?.rows.length ? <Empty />
            : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Year</th>
                      {result.data.rows.some((r) => '_taluka' in r) && <th scope="col">Taluka</th>}
                      {result.data.columns.map((c) => <th key={c} scope="col" className="num">{humanize(c)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r._year ?? '–'}</td>
                        {'_taluka' in r && <th scope="row">{r._taluka ?? '–'}</th>}
                        {result.data!.columns.map((c) => <td key={c} className="num">{typeof r[c] === 'number' ? num(r[c] as number) : '–'}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>
    </>
  )
}
