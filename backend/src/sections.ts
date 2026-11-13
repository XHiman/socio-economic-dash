/**
 * Curated DSA dashboard sections. This is the single place to edit what the
 * district page shows. Every table/column is validated against the live schema
 * at startup; cards that reference something missing are dropped with a warning,
 * so the same config works against a partial dev schema and the full one.
 *
 * Units are only stated where the source definition is unambiguous; add `unit`
 * to a column once confirmed against the DSA data dictionary.
 */
import type { SchemaCatalog } from './schema.js';

export type CardKind = 'kpis' | 'breakdown' | 'taluka';
/** How a column combines across districts for the state view. Counts/areas sum; rates and averages are averaged. */
export interface CardColumn { key: string; label: string; unit?: string; agg?: 'sum' | 'avg'; /** This column is the sum of its siblings; left out of stacked views. */ total?: boolean; /** Digits to show; percentages default to 1 on the client, the sex ratio is a whole number. */ decimals?: number; /** Averaged across districts weighted by this column of the same table (e.g. population). */ weightBy?: string }
export interface CardDef {
  id: string;
  title: string;
  table: string;
  kind: CardKind;
  columns: CardColumn[];
  /** Columns are additive parts of one whole, so an "All" stacked view makes sense. */
  stackable?: boolean;
  /** Only read rows where this column equals this value (tables that hold several rows per district and year). */
  rowFilter?: { column: string; value: string };
  /** Shown as a plain card: no full-screen view. */
  static?: boolean;
}
export interface SectionDef { id: string; title: string; description: string; cards: CardDef[] }

const AVG_KEYS = new Set(['avg_rainfall', 'ref_year_avg_rainfall', 'rainfall_day_cnt', 'area_pop_gen_ratio']);
const c = (key: string, label: string, unit?: string, total = false): CardColumn => ({
  key, label, ...(unit ? { unit } : {}), ...(total ? { total } : {}),
  ...(unit === '%' || AVG_KEYS.has(key) ? { agg: 'avg' as const } : {}),
});

/** dsa_11a has one row per district for each census year plus these two; the card shows the reference-year row. */
const REF_ROW = { column: 'reporting_year', value: 'Reference year' };
const POP = 'area_pop_net_pop';
/** Rates weighted by population when combined across districts (a plain mean would overstate small districts). */
const byPop = (col: CardColumn): CardColumn => ({ ...col, weightBy: POP });
const whole = (col: CardColumn): CardColumn => ({ ...col, decimals: 0 });

export const SECTIONS: SectionDef[] = [
  {
    id: 'people',
    title: 'People & Society',
    description: 'Population, literacy, workers and local governance.',
    cards: [
      { id: 'profile', title: 'District profile', table: 'dsa_11a', kind: 'kpis', static: true, rowFilter: REF_ROW, columns: [
        c('area_pop_net_area', 'Net area'), c(POP, 'Net population'),
        c('area_pop_tot_taluka', 'Talukas'), c('area_pop_vill_pop', 'Inhabited villages'),
        c('area_pop_vill_non_pop', 'Uninhabited villages'), c('area_pop_city', 'Towns & cities'),
        byPop(c('area_pop_prop_urban', 'Urban population', '%')), byPop(c('area_pop_prop_rural', 'Rural population', '%')),
        whole(byPop(c('area_pop_gen_ratio', 'Sex ratio', 'females per 1,000 males'))), byPop(c('lit_tot', 'Literacy rate', '%')),
      ] },
      { id: 'literacy', title: 'Literacy rate', table: 'dsa_11a', kind: 'breakdown', rowFilter: REF_ROW, columns: [
        byPop(c('lit_male', 'Male', '%')), byPop(c('lit_female', 'Female', '%')), byPop(c('lit_rural', 'Rural', '%')),
        byPop(c('lit_urban', 'Urban', '%')), byPop(c('lit_sc_castes', 'Scheduled Castes', '%')), byPop(c('lit_sc_tribes', 'Scheduled Tribes', '%')),
      ] },
      { id: 'local-gov', title: 'Local self-government bodies', table: 'dsa_11a', kind: 'breakdown', rowFilter: REF_ROW, columns: [
        c('loc_gov_mun_corp', 'Municipal corporations'), c('loc_gov_mun_coun', 'Municipal councils'),
        c('loc_gov_nag_panch', 'Nagar panchayats'), c('loc_gov_cutt_board', 'Cantonment boards'),
        c('loc_gov_punch_sam', 'Panchayat samitis'), c('loc_gov_gram_punch', 'Gram panchayats'),
      ] },
      { id: 'literacy-taluka', title: 'Literacy by taluka', table: 'dsa_87', kind: 'taluka', columns: [
        c('tot_lite_perce', 'Total', '%'), c('tot_lite_perce_man', 'Male', '%'), c('tot_lite_perce_womman', 'Female', '%'),
      ] },
      { id: 'workers', title: 'Workers by taluka', table: 'dsa_115', stackable: true, kind: 'taluka', columns: [
        c('mainperf_total', 'Main workers'), c('marginalworker', 'Marginal workers'), c('tot_main_marginalwor', 'Total workers', undefined, true),
      ] },
    ],
  },
  {
    id: 'economy',
    title: 'Economy',
    description: 'Industry and banking.',
    cards: [
      { id: 'industry', title: 'Small & medium industry by taluka', table: 'dsa_61a', kind: 'taluka', columns: [
        c('tot_sma_mid_indst', 'Units'), c('tot_jobs', 'Jobs'), c('tot_inv', 'Investment'),
      ] },
      { id: 'banking', title: 'Commercial banking by taluka', table: 'dsa_45', kind: 'taluka', columns: [
        c('comm_bank_off', 'Bank offices'), c('branch_comm_bank', 'Branches'), c('deposit_comm_bank', 'Deposits'),
      ] },
    ],
  },
  {
    id: 'agriculture',
    title: 'Agriculture & Land',
    description: 'Land use, rainfall and livestock.',
    cards: [
      { id: 'land-use', title: 'Land use', table: 'dsa_51', stackable: true, kind: 'breakdown', columns: [
        c('net_area', 'Net sown area'), c('tot_fall_land', 'Fallow land'), c('fallen_uncaltivated_land', 'Uncultivated land'),
        c('for_cov_area', 'Forest cover'), c('land_non_agri', 'Non-agricultural use'),
      ] },
      { id: 'rainfall', title: 'Rainfall by taluka', table: 'dsa_57', kind: 'taluka', columns: [
        c('avg_rainfall', 'Normal average rainfall'), c('ref_year_avg_rainfall', 'Reference-year rainfall'),
        c('rainfall_day_cnt', 'Normal rainy days'),
      ] },
      { id: 'livestock', title: 'Livestock', table: 'dsa_118c', stackable: true, kind: 'breakdown', columns: [
        c('cow_and_bull', 'Cattle'), c('buff_and_redd', 'Buffaloes'), c('sheep', 'Sheep'), c('goat', 'Goats'),
        c('horse_colt_mule', 'Horses & mules'), c('donkey', 'Donkeys'), c('other_livestock', 'Other'),
      ] },
    ],
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    description: 'Electricity and roads.',
    cards: [
      { id: 'electricity', title: 'Electricity consumption by taluka', table: 'dsa_71', stackable: true, kind: 'taluka', columns: [
        c('tot_elecons_total', 'Total', undefined, true), c('tot_elecconsu_home', 'Domestic'), c('tot_elecons_industrial', 'Industrial'),
        c('tot_elecons_agri', 'Agricultural'), c('tot_elecons_commwork', 'Commercial'),
      ] },
      { id: 'roads', title: 'Road network', table: 'dsa_78', stackable: true, kind: 'breakdown', columns: [
        c('nationalhi_road', 'National highways', 'km'), c('lengroad_statehighway', 'State highways', 'km'),
        c('lengroad_majordisroad', 'Major district roads', 'km'), c('lengroad_otherdisroad', 'Other district roads', 'km'),
        c('lengroad_ruraldisroad', 'Rural roads', 'km'),
      ] },
    ],
  },
  {
    id: 'education-health',
    title: 'Education & Health',
    description: 'Schools, health facilities and vital statistics.',
    cards: [
      { id: 'schools', title: 'Schools by management', table: 'dsa_81', stackable: true, kind: 'breakdown', columns: [
        c('tot_gov_sch', 'Government'), c('tot_local_sch', 'Local body'), c('tot_priv_sch', 'Private aided'),
        c('tot_priv_non_sch', 'Private unaided'),
      ] },
      { id: 'health-facilities', title: 'Public health facilities by taluka', table: 'dsa_815', kind: 'taluka', columns: [
        c('pub_medfac_hospitals', 'Hospitals'), c('pub_medfac_prihealcent', 'Primary health centres'),
        c('pub_medfac_subcent', 'Sub-centres'), c('pub_medfac_doctors', 'Doctors'), c('numbeds_total', 'Beds'),
      ] },
      { id: 'vital', title: 'Births & deaths', table: 'dsa_817', kind: 'breakdown', columns: [
        c('tot_num_livebir_total', 'Live births'), c('tot_num_deathbir_total', 'Deaths'),
        c('numchilddeath_total', 'Child deaths'), c('numinfantdeath_total', 'Infant deaths'),
      ] },
    ],
  },
];

/** Drop anything the live schema can't serve. Returns the usable sections. */
export function validateSections(catalog: SchemaCatalog, warn: (msg: string) => void): SectionDef[] {
  const out: SectionDef[] = [];
  for (const s of SECTIONS) {
    const cards: CardDef[] = [];
    for (const card of s.cards) {
      const t = catalog.table(card.table);
      if (!t || !t.hasDistrict) { warn(`card ${card.id}: table ${card.table} missing`); continue; }
      if (card.kind === 'taluka' && !t.hasTaluka) { warn(`card ${card.id}: ${card.table} has no taluka_id`); continue; }
      const cols = card.columns.filter((col) => {
        const ok = !!t.columns.get(col.key)?.numeric;
        if (!ok) warn(`card ${card.id}: column ${card.table}.${col.key} missing/non-numeric`);
        return ok;
      });
      let rowFilter = card.rowFilter;
      if (rowFilter && !t.columns.has(rowFilter.column)) { warn(`card ${card.id}: rowFilter column ${card.table}.${rowFilter.column} missing, ignored`); rowFilter = undefined; }
      const withWeights = cols.map((col) => {
        if (!col.weightBy || t.columns.get(col.weightBy)?.numeric) return col;
        warn(`card ${card.id}: weight column ${card.table}.${col.weightBy} missing, ${col.key} is averaged unweighted`);
        const { weightBy: _dropped, ...rest } = col;
        return rest;
      });
      if (withWeights.length) cards.push({ ...card, columns: withWeights, rowFilter });
    }
    if (cards.length) out.push({ ...s, cards });
  }
  return out;
}

/**
 * Units live in the database (dim_unit: table_name, column_name, unit) so they can be maintained
 * without a deploy. A column's unit is taken from there when present, else from the defaults above.
 * The table is optional: if it doesn't exist yet nothing changes.
 */
export function applyUnits(sections: SectionDef[], units: Map<string, string>): void {
  for (const s of sections) {
    for (const card of s.cards) {
      for (const col of card.columns) {
        const u = units.get(`${card.table}.${col.key}`);
        if (u) col.unit = u;
      }
    }
  }
}
