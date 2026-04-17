"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getCompanies } from "@/lib/data";
import { Company, REGION_LABELS, REGION_COLORS, median, q1, q3 } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ReferenceLine,
} from "recharts";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </Card>
  );
}

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } };

function RegionBoxChart({ data, metricKey, label, suffix }: { data: Company[]; metricKey: keyof Company; label: string; suffix: string }) {
  const chartData = useMemo(() => {
    const allVals = data.filter(c => c[metricKey] != null).map(c => c[metricKey] as number);
    const dachMedian = median(allVals);
    return {
      regions: (['vienna', 'germany', 'switzerland'] as const).map(r => {
        const vals = data.filter(c => c.region === r && c[metricKey] != null).map(c => c[metricKey] as number);
        const q1v = q1(vals), medv = median(vals), q3v = q3(vals);
        return { region: REGION_LABELS[r], n: vals.length, q1: q1v, medSpread: medv - q1v, q3Spread: q3v - medv, color: REGION_COLORS[r] };
      }),
      dachMedian,
    };
  }, [data, metricKey]);

  return (
    <Card className="p-5">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label}</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData.regions} layout="vertical" barGap={0}>
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}${suffix}`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="region" tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} width={85} axisLine={false} tickLine={false} />
          <Tooltip {...TT}
            formatter={(v, name, props) => {
              const d = chartData.regions[props?.payload ? chartData.regions.findIndex(r => r.region === props.payload.region) : 0];
              if (!d) return [`${Number(v).toFixed(1)}${suffix}`, name];
              return [`Q1: ${d.q1.toFixed(1)} | Med: ${(d.q1 + d.medSpread).toFixed(1)} | Q3: ${(d.q1 + d.medSpread + d.q3Spread).toFixed(1)}`, `${d.region} (n=${d.n})`];
            }}
            labelFormatter={() => ''}
          />
          <ReferenceLine x={chartData.dachMedian} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `DACH ${chartData.dachMedian.toFixed(1)}`, position: 'top', fill: '#94a3b8', fontSize: 9 }} />
          <Bar dataKey="q1" stackId="box" fill="transparent" />
          <Bar dataKey="medSpread" stackId="box" name="Q1 to Median" radius={[4, 0, 0, 4]}>
            {chartData.regions.map((d, i) => <Cell key={i} fill={d.color + '55'} />)}
          </Bar>
          <Bar dataKey="q3Spread" stackId="box" name="Median to Q3" radius={[0, 4, 4, 0]}>
            {chartData.regions.map((d, i) => <Cell key={i} fill={d.color + '99'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

export default function Dashboard() {
  const companies = useMemo(() => getCompanies(), []);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<keyof Company>("name");

  const filtered = useMemo(() => {
    let d = companies;
    if (search) d = d.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search.toLowerCase()));
    if (regionFilter !== "all") d = d.filter(c => c.region === regionFilter);
    return [...d].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return ((b[sortKey] as number) ?? -Infinity) - ((a[sortKey] as number) ?? -Infinity);
    });
  }, [companies, search, regionFilter, sortKey]);

  const withEbit = companies.filter(c => c.ebit_margin != null);
  const withRoe = companies.filter(c => c.roe != null);
  const withPe = companies.filter(c => c.fwd_pe != null && c.fwd_pe > 0 && c.fwd_pe < 200);
  const profitable = companies.filter(c => c.net_income != null && c.net_income > 0);
  const withGrowth = companies.filter(c => c.fwd_rev_growth != null && c.fwd_rev_growth > 0);

  const scatterMargin = useMemo(() =>
    companies.filter(c => c.revenue && c.revenue > 0 && c.ebit_margin != null && c.ebit_margin > -30 && c.ebit_margin < 50)
      .map(c => ({ x: Math.log10(c.revenue!), y: c.ebit_margin!, name: c.name, region: c.region, rev: c.revenue! })), [companies]);

  const scatterPe = useMemo(() =>
    companies.filter(c => c.revenue && c.revenue > 0 && c.fwd_pe != null && c.fwd_pe > 0 && c.fwd_pe < 80)
      .map(c => ({ x: Math.log10(c.revenue!), y: c.fwd_pe!, name: c.name, region: c.region, rev: c.revenue! })), [companies]);

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">DACH Equity Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Descriptive financial analysis across 468 listed companies</p>
        </div>
        <div className="flex gap-5 items-center text-xs">
          {Object.entries(REGION_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: REGION_COLORS[k] }} />{v}
            </span>
          ))}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
        <StatCard label="Universe" value={companies.length} sub={`AT ${companies.filter(c => c.region === 'vienna').length} / DE ${companies.filter(c => c.region === 'germany').length} / CH ${companies.filter(c => c.region === 'switzerland').length}`} />
        <StatCard label="Median EBIT Margin" value={`${median(withEbit.map(c => c.ebit_margin!)).toFixed(1)}%`} sub={`n=${withEbit.length}`} />
        <StatCard label="Median ROE" value={`${median(withRoe.map(c => c.roe!)).toFixed(1)}%`} sub={`n=${withRoe.length}`} />
        <StatCard label="Median Fwd P/E" value={`${median(withPe.map(c => c.fwd_pe!)).toFixed(1)}x`} sub={`n=${withPe.length}`} />
        <StatCard label="Profitable" value={`${(100 * profitable.length / Math.max(1, companies.filter(c => c.net_income != null).length)).toFixed(0)}%`} sub={`${profitable.length} companies`} />
        <StatCard label="Growing Revenue" value={`${(100 * withGrowth.length / Math.max(1, companies.filter(c => c.fwd_rev_growth != null).length)).toFixed(0)}%`} sub={`${withGrowth.length} companies`} />
      </div>

      {/* Regional Comparison */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Regional KPI Comparison</h2>
        <p className="text-xs text-slate-500 mb-5">Interquartile range by region. Dashed line = DACH median.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <RegionBoxChart data={companies} metricKey="ebit_margin" label="EBIT Margin (%)" suffix="%" />
          <RegionBoxChart data={companies} metricKey="net_margin" label="Net Margin (%)" suffix="%" />
          <RegionBoxChart data={companies} metricKey="roe" label="Return on Equity (%)" suffix="%" />
          <RegionBoxChart data={companies} metricKey="fwd_pe" label="Forward P/E" suffix="x" />
          <RegionBoxChart data={companies} metricKey="fwd_rev_growth" label="Revenue Growth (%)" suffix="%" />
          <RegionBoxChart data={companies} metricKey="debt_equity" label="Debt / Equity" suffix="x" />
        </div>
      </div>

      {/* Size vs Profitability */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Scale vs. Profitability & Valuation</h2>
        <p className="text-xs text-slate-500 mb-5">Does size drive margins or valuation premiums across the DACH region?</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[
            { data: scatterMargin, yLabel: 'EBIT Margin (%)', title: 'Revenue vs EBIT Margin' },
            { data: scatterPe, yLabel: 'Forward P/E (x)', title: 'Revenue vs Forward P/E' },
          ].map(({ data: sData, yLabel, title }) => (
            <Card key={title} className="p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ bottom: 20 }}>
                  <XAxis type="number" dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => { const r = Math.pow(10, v); return r >= 1000 ? `${(r / 1000).toFixed(0)}B` : `${r.toFixed(0)}M`; }}
                    label={{ value: 'Revenue (log scale)', position: 'bottom', fill: '#94a3b8', fontSize: 10, offset: 5 }} />
                  <YAxis type="number" dataKey="y" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                    label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip {...TT} formatter={(v) => Number(v).toFixed(1)} labelFormatter={() => ''} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {(['vienna', 'germany', 'switzerland'] as const).map(r => (
                    <Scatter key={r} name={REGION_LABELS[r]} data={sData.filter(d => d.region === r)} fill={REGION_COLORS[r]} opacity={0.5}>
                      {sData.filter(d => d.region === r).map((_, i) => <Cell key={i} />)}
                    </Scatter>
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          ))}
        </div>
      </div>

      {/* Screening Table */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Company Screening</h2>
        <p className="text-xs text-slate-500 mb-4">Click any company for detailed peer analysis and positioning.</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company..."
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="all">All Regions</option>
            <option value="vienna">Austria</option>
            <option value="germany">Germany</option>
            <option value="switzerland">Switzerland</option>
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as keyof Company)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
            <option value="name">Sort: Name</option>
            <option value="revenue">Sort: Revenue</option>
            <option value="ebit_margin">Sort: EBIT Margin</option>
            <option value="roe">Sort: ROE</option>
            <option value="fwd_pe">Sort: Forward P/E</option>
          </select>
          <span className="text-sm text-slate-400 ml-auto self-center">{filtered.length} companies</span>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200 sticky top-0 bg-white z-10">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-3 py-3 text-center">Region</th>
                  <th className="px-3 py-3 text-right">Revenue</th>
                  <th className="px-3 py-3 text-right">EBIT %</th>
                  <th className="px-3 py-3 text-right">ROE</th>
                  <th className="px-3 py-3 text-right">Fwd P/E</th>
                  <th className="px-3 py-3 text-right">Fwd ROE</th>
                  <th className="px-3 py-3 text-right">Growth</th>
                  <th className="px-3 py-3 text-right">D/E</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/company?id=${c.id}`} className="hover:text-blue-600">
                        <div className="font-medium text-slate-800">{c.name}</div>
                        {c.has_peers && <span className="text-[10px] text-blue-500 font-medium">PEERS</span>}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold tracking-wide"
                        style={{ background: REGION_COLORS[c.region] + '15', color: REGION_COLORS[c.region] }}>
                        {REGION_LABELS[c.region].substring(0, 2).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.revenue ? `${Math.round(c.revenue).toLocaleString()}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.ebit_margin != null ? `${c.ebit_margin.toFixed(1)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.roe != null ? `${c.roe.toFixed(1)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.fwd_pe != null ? `${c.fwd_pe.toFixed(1)}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.fwd_roe != null ? `${c.fwd_roe.toFixed(1)}` : '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${(c.fwd_rev_growth ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.fwd_rev_growth != null ? `${c.fwd_rev_growth > 0 ? '+' : ''}${c.fwd_rev_growth.toFixed(1)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.debt_equity != null ? `${c.debt_equity.toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-400 py-6">
        DACH Equity Analytics | Data as of April 2026 | 468 companies across Austria, Germany & Switzerland
      </div>
    </div>
  );
}
