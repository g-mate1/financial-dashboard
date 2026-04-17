export interface Company {
  id: string;
  name: string;
  region: 'vienna' | 'germany' | 'switzerland';
  size?: string;
  has_peers: boolean;
  peers?: Peer[];
  revenue?: number;
  ebitda?: number;
  ebit?: number;
  net_income?: number;
  gross_margin?: number;
  ebitda_margin?: number;
  ebit_margin?: number;
  net_margin?: number;
  roe?: number;
  roa?: number;
  debt_equity?: number;
  equity_ratio?: number;
  current_ratio?: number;
  net_debt_ebitda?: number;
  rev_growth?: number;
  asset_turnover?: number;
  pe?: number;
  ev_ebitda?: number;
  pb?: number;
  eps1?: number;
  eps2?: number;
  dps1?: number;
  bpsfy0?: number;
  target_price?: number;
  fwd_pe?: number;
  fwd_ev_ebitda?: number;
  fwd_rev_growth?: number;
  fwd_roe?: number;
  analysts?: number;
}

export interface Peer {
  id: string;
  name: string;
  revenue?: number;
  ebitda?: number;
  ebitda_margin?: number;
  ebit_margin?: number;
  net_margin?: number;
  roe?: number;
  debt_equity?: number;
  equity_ratio?: number;
  net_debt_ebitda?: number;
  rev_growth?: number;
  fwd_pe?: number;
  fwd_ev_ebitda?: number;
  fwd_roe?: number;
  fwd_rev_growth?: number;
  eps1?: number;
  target_price?: number;
}

export const REGION_LABELS: Record<string, string> = {
  vienna: 'Austria', germany: 'Germany', switzerland: 'Switzerland',
};

export const REGION_COLORS: Record<string, string> = {
  vienna: '#dc2626', germany: '#2563eb', switzerland: '#059669',
};

export const METRICS: { key: keyof Company; label: string; suffix: string; higherBetter: boolean }[] = [
  { key: 'ebit_margin', label: 'EBIT Margin', suffix: '%', higherBetter: true },
  { key: 'ebitda_margin', label: 'EBITDA Margin', suffix: '%', higherBetter: true },
  { key: 'net_margin', label: 'Net Margin', suffix: '%', higherBetter: true },
  { key: 'roe', label: 'ROE', suffix: '%', higherBetter: true },
  { key: 'roa', label: 'ROA', suffix: '%', higherBetter: true },
  { key: 'fwd_pe', label: 'Forward P/E', suffix: 'x', higherBetter: false },
  { key: 'fwd_ev_ebitda', label: 'Forward EV/EBITDA', suffix: 'x', higherBetter: false },
  { key: 'fwd_roe', label: 'Forward ROE', suffix: '%', higherBetter: true },
  { key: 'fwd_rev_growth', label: 'Revenue Growth', suffix: '%', higherBetter: true },
  { key: 'debt_equity', label: 'Debt/Equity', suffix: 'x', higherBetter: false },
  { key: 'equity_ratio', label: 'Equity Ratio', suffix: '%', higherBetter: true },
  { key: 'current_ratio', label: 'Current Ratio', suffix: 'x', higherBetter: true },
];

export function percentile(arr: number[], val: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  return Math.round(sorted.filter(v => v <= val).length / sorted.length * 100);
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function q1(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * 0.25)];
}

export function q3(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.slice().sort((a, b) => a - b)[Math.floor(arr.length * 0.75)];
}
