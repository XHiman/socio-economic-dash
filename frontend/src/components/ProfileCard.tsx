import type { CardData } from '../api/types'
import { num } from '../lib/format'

/** Profile card body (state or district): grouped figures plus an urban / rural split. Used by static cards. */
export function ProfileCard({ card }: { card: CardData }) {
  const total = card.total ?? {}
  const unit = (key: string) => card.columns.find((c) => c.key === key)?.unit
  const tile = (key: string, label: string, hint?: string) => (
    <div className="profile-tile" key={key}>
      <dt>{label}</dt>
      <dd>
        {num(total[key], key === 'area_pop_gen_ratio' || key === 'lit_tot' ? 1 : 2)}
        {unit(key) && unit(key)!.length <= 2 && <span className="unit">{unit(key)}</span>}
      </dd>
      {unit(key) && unit(key)!.length > 2 && <div className="unit-line">{unit(key)}</div>}
      {hint && <div className="unit-line">{hint}</div>}
    </div>
  )

  const urban = total.area_pop_prop_urban ?? null
  const rural = total.area_pop_prop_rural ?? null
  const shares = urban !== null && rural !== null ? urban + rural : null
  const urbanWidth = urban !== null && shares ? (urban / shares) * 100 : null
  const uninhabited = total.area_pop_vill_non_pop

  return (
    <div className="profile">
      <section aria-labelledby="profile-geo">
        <h4 id="profile-geo">Geography &amp; administration</h4>
        <dl className="profile-tiles">
          {tile('area_pop_net_area', 'Net area')}
          {tile('area_pop_tot_taluka', 'Talukas')}
          {tile('area_pop_vill_pop', 'Inhabited villages', uninhabited != null ? `${num(uninhabited, 0)} uninhabited` : undefined)}
          {tile('area_pop_city', 'Towns & cities')}
        </dl>
      </section>

      <section aria-labelledby="profile-people">
        <h4 id="profile-people">People</h4>
        <dl className="profile-tiles">
          {tile('area_pop_net_pop', 'Net population')}
          {tile('area_pop_gen_ratio', 'Sex ratio')}
          {tile('lit_tot', 'Literacy rate')}
        </dl>
      </section>

      {urbanWidth !== null && (
        <section aria-labelledby="profile-split">
          <h4 id="profile-split">Urban / rural population</h4>
          <div
            className="split-bar" role="img"
            aria-label={`${num(urban, 1)}% urban, ${num(rural, 1)}% rural`}
          >
            {urbanWidth > 0 && <span className="urban" style={{ width: `${urbanWidth}%` }} />}
            {urbanWidth < 100 && <span className="rural" />}
          </div>
          <ul className="split-legend">
            <li><i className="urban" />Urban {num(urban, 1)}%</li>
            <li><i className="rural" />Rural {num(rural, 1)}%</li>
          </ul>
        </section>
      )}
    </div>
  )
}
