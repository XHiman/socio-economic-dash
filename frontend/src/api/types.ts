export interface District { id: number; name: string; division: string }

export interface Meta {
  years: string[];
  latestYear: string | null;
  metrics: Record<string, { column: string; label: string; unit: string }>;
}

export interface Overview {
  dist: number | null; per_cap_dist: number | null; pop: number | null; state: number | null;
  per_cap_state: number | null; perc_dis_state: number | null; perc_lastyr: number | null;
  tot_prim: number | null; tot_sec: number | null; tot_third: number | null;
  gddp_rank: number | null; district_count: number | null;
}
export interface OverviewResponse { year: string; overview: Overview | null }

export interface Mix { primary: number | null; secondary: number | null; tertiary: number | null }
export interface SectorMixResponse { year: string; district: Mix | null; state: Mix | null }

export interface SeriesResponse {
  metric: string;
  years: string[];
  series: { districtId: number; values: (number | null)[] }[];
}

export interface StateRow {
  id: number; name: string; division: string;
  dist: number | null; per_cap_dist: number | null; pop: number | null;
  perc_dis_state: number | null; perc_lastyr: number | null;
  /** Source reports this district with the same figures as another (e.g. Mumbai City/Suburban). */
  combinedWithOther: boolean;
}
export interface StateResponse {
  year: string;
  districts: StateRow[];
  trend: { year: string; gddp: number }[];
  state: { state: number | null; per_cap_state: number | null } | null;
}

export interface SectionSummary { id: string; title: string; description: string; cards: { id: string; title: string; kind: string }[] }
export interface CardColumn { key: string; label: string; unit?: string }
export interface CardData {
  id: string; title: string; kind: 'kpis' | 'breakdown' | 'taluka';
  columns: CardColumn[];
  year: string | null;
  total: Record<string, number | null> | null;
  rows: { taluka: string; values: Record<string, number | null> }[];
}
export interface SectionResponse { id: string; title: string; cards: CardData[] }

export interface ExploreTable { name: string; hasTaluka: boolean; hasYear: boolean; columns: string[] }
export interface ExploreResponse {
  table: string;
  columns: string[];
  rows: Record<string, string | number | null>[];
}
