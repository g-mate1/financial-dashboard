"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getCompanies } from "@/lib/data";
import { Company, REGION_LABELS, REGION_COLORS, SECTOR_COLORS, median, q1, q3 } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, Legend, ReferenceLine,
} from "recharts";

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } };

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
        <BarChart data={chartData.regions} layout="vertical">
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}${suffix}`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="region" tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} width={85} axisLine={false} tickLine={false} />
          <Tooltip
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              const med = (d.q1 + d.medSpread).toFixed(1);
              const q3v = (d.q1 + d.medSpread + d.q3Spread).toFixed(1);
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                  <div className="font-semibold text-slate-800 mb-1">{d.region} (n={d.n})</div>
                  <div className="text-slate-500">Q1: {d.q1.toFixed(1)}{suffix}</div>
                  <div className="text-slate-700 font-medium">Median: {med}{suffix}</div>
                  <div className="text-slate-500">Q3: {q3v}{suffix}</div>
                </div>
              );
            }}
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
  const [tab, setTab] = useState<'overview' | 'industries' | 'peers'>('overview');
  const [selectedPeer, setSelectedPeer] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");

  const filtered = useMemo(() => {
    let d = companies;
    if (search) d = d.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search.toLowerCase()));
    if (regionFilter !== "all") d = d.filter(c => c.region === regionFilter);
    if (tab === 'peers') d = d.filter(c => c.has_peers);
    return [...d].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      return ((b[sortKey] as number) ?? -Infinity) - ((a[sortKey] as number) ?? -Infinity);
    });
  }, [companies, search, regionFilter, sortKey, tab]);

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

  const peersCompanies = companies.filter(c => c.has_peers);

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

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-slate-200">
        <button onClick={() => setTab('overview')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Market Overview
        </button>
        <button onClick={() => setTab('industries')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'industries' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Industry Comparison
        </button>
        <button onClick={() => setTab('peers')}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'peers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Peer Analysis ({peersCompanies.length})
        </button>
      </div>

      {tab === 'overview' && (
        <>
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
            <p className="text-xs text-slate-500 mb-5">Does size drive margins or valuation premiums?</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {[
                { data: scatterMargin, yLabel: 'EBIT Margin (%)', title: 'Revenue vs EBIT Margin' },
                { data: scatterPe, yLabel: 'Forward P/E (x)', title: 'Revenue vs Forward P/E' },
              ].map(({ data: sData, yLabel, title }) => (
                <Card key={title} className="p-5">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ bottom: 25, left: 5 }}>
                      <XAxis type="number" dataKey="x" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                        tickFormatter={v => { const r = Math.pow(10, v); return r >= 1000 ? `${(r / 1000).toFixed(0)}B` : `${r.toFixed(0)}M`; }}
                        label={{ value: 'Revenue (log scale)', position: 'bottom', fill: '#94a3b8', fontSize: 10, offset: 5 }} />
                      <YAxis type="number" dataKey="y" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                        label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }} />
                      <Tooltip
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          return (
                            <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                              <div className="font-semibold text-slate-800">{d.name}</div>
                              <div className="text-slate-500">Revenue: {d.rev >= 1000 ? `${(d.rev/1000).toFixed(1)}B` : `${Math.round(d.rev)}M`}</div>
                              <div className="text-slate-500">{yLabel}: {d.y?.toFixed(1)}</div>
                            </div>
                          );
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} iconSize={8} />
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
        </>
      )}

      {tab === 'industries' && (() => {
        const sectors = [...new Set(companies.map(c => c.broad_sector || 'Other'))].filter(s => companies.filter(c => c.broad_sector === s).length >= 5).sort();
        const selSector = selectedIndustry || '';
        const sectorCos = selSector ? companies.filter(c => c.broad_sector === selSector) : [];

        const sectorSummary = sectors.map(s => {
          const cos = companies.filter(c => c.broad_sector === s);
          return {
            sector: s, n: cos.length, color: SECTOR_COLORS[s] || '#94a3b8',
            ebit_margin: median(cos.filter(c => c.ebit_margin != null).map(c => c.ebit_margin!)),
            roe: median(cos.filter(c => c.roe != null).map(c => c.roe!)),
            fwd_pe: median(cos.filter(c => c.fwd_pe != null && c.fwd_pe > 0 && c.fwd_pe < 100).map(c => c.fwd_pe!)),
            debt_equity: median(cos.filter(c => c.debt_equity != null && c.debt_equity < 10).map(c => c.debt_equity!)),
          };
        });

        const indBar = (cos: Company[], key: keyof Company, label: string, suffix: string, top = 15) => {
          const items = cos.filter(c => c[key] != null).sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, top);
          if (items.length < 2) return null;
          const med = median(items.map(c => c[key] as number));
          return (
            <Card className="p-5">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{label} — Top {Math.min(top, items.length)}</div>
              <ResponsiveContainer width="100%" height={Math.max(140, items.length * 26 + 20)}>
                <BarChart data={items.map(c => ({ name: c.name, value: c[key] as number }))} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => suffix === 'M' ? (v >= 1000 ? `${(v/1000).toFixed(0)}B` : `${v.toFixed(0)}M`) : `${v}${suffix}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} width={130} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.length > 20 ? v.substring(0, 18) + '…' : v} />
                  <Tooltip {...TT} formatter={(v) => {
                    const n = Number(v);
                    return [suffix === 'M' ? (n >= 1000 ? `${(n/1000).toFixed(1)}B` : `${n.toFixed(0)}M`) : `${n.toFixed(1)}${suffix}`, label];
                  }} />
                  <ReferenceLine x={med} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: `Med ${med.toFixed(1)}`, position: 'top', fill: '#94a3b8', fontSize: 9 }} />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]} fill={SECTOR_COLORS[selSector] || '#94a3b8'} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          );
        };

        return (
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-6">
              <select value={selSector} onChange={e => setSelectedIndustry(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                <option value="">Select an industry...</option>
                {sectors.map(s => (
                  <option key={s} value={s}>{s} ({companies.filter(c => c.broad_sector === s).length} companies)</option>
                ))}
              </select>
            </div>

            {!selSector ? (
              <>
                {/* Overview table when no industry selected */}
                <Card className="p-6 mb-8">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Industry Overview — All Sectors</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                          <th className="px-3 py-2 text-left">Industry</th>
                          <th className="px-3 py-2 text-right">N</th>
                          <th className="px-3 py-2 text-right">Med. EBIT %</th>
                          <th className="px-3 py-2 text-right">Med. ROE</th>
                          <th className="px-3 py-2 text-right">Med. P/E</th>
                          <th className="px-3 py-2 text-right">Med. D/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectorSummary.sort((a, b) => (b.ebit_margin ?? 0) - (a.ebit_margin ?? 0)).map(s => (
                          <tr key={s.sector} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedIndustry(s.sector)}>
                            <td className="px-3 py-2.5 font-medium text-slate-800">
                              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: s.color }} />{s.sector}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-500">{s.n}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{s.ebit_margin ? `${s.ebit_margin.toFixed(1)}%` : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{s.roe ? `${s.roe.toFixed(1)}%` : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{s.fwd_pe ? `${s.fwd_pe.toFixed(1)}x` : '—'}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-600">{s.debt_equity ? `${s.debt_equity.toFixed(2)}x` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <>
                {/* Industry header */}
                <Card className="p-5 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ background: SECTOR_COLORS[selSector] || '#94a3b8' }} />
                        {selSector}
                      </h2>
                      <p className="text-sm text-slate-500">{sectorCos.length} companies in DACH universe</p>
                    </div>
                    <div className="flex gap-6">
                      {(() => {
                        const ss = sectorSummary.find(s => s.sector === selSector);
                        if (!ss) return null;
                        return ([['EBIT %', ss.ebit_margin, '%'], ['ROE', ss.roe, '%'], ['Fwd P/E', ss.fwd_pe, 'x'], ['D/E', ss.debt_equity, 'x']] as [string, number|null, string][]).map(([l,v,s]) => (
                          <div key={l} className="text-right">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">Med. {l}</div>
                            <div className="text-lg font-bold text-slate-900">{v != null ? `${v.toFixed(1)}${s}` : '—'}</div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </Card>

                {/* KPI charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {indBar(sectorCos, 'ebit_margin', 'EBIT Margin', '%')}
                  {indBar(sectorCos, 'roe', 'ROE', '%')}
                  {indBar(sectorCos, 'fwd_pe', 'Forward P/E', 'x')}
                  {indBar(sectorCos, 'revenue', 'Revenue', 'M')}
                </div>

                {/* Company table */}
                <Card className="p-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">{selSector} Companies</h3>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-200 sticky top-0 bg-white">
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-center">Region</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                          <th className="px-3 py-2 text-right">EBIT %</th>
                          <th className="px-3 py-2 text-right">ROE</th>
                          <th className="px-3 py-2 text-right">Fwd P/E</th>
                          <th className="px-3 py-2 text-right">D/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sectorCos.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).map(c => (
                          <tr key={c.id} className="border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer">
                            <td className="px-3 py-2">
                              <Link href={`/company?id=${c.id}`} className="text-slate-800 hover:text-blue-600 font-medium">{c.name}</Link>
                              {c.has_peers && <span className="text-[10px] text-blue-500 font-medium ml-1">PEERS</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: REGION_COLORS[c.region] + '15', color: REGION_COLORS[c.region] }}>
                                {REGION_LABELS[c.region].substring(0, 2).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{c.revenue ? Math.round(c.revenue).toLocaleString() : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{c.ebit_margin?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{c.roe?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{c.fwd_pe?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{c.debt_equity?.toFixed(2) ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        );
      })()}

      {tab === 'peers' && (() => {
        const sel = peersCompanies.find(c => c.id === selectedPeer);
        const peers = sel?.peers || [];
        const industryCos = sel ? companies.filter(c => c.broad_sector === sel.broad_sector && c.id !== sel.id) : [];
        const industryMetrics = (key: string) => {
          const vals = industryCos.map(c => (c as unknown as Record<string, number | undefined>)[key]).filter(v => v != null) as number[];
          return vals.length ? median(vals) : null;
        };

        const peerBar = (metricKey: string, label: string, suffix: string, lowerBetter = false) => {
          if (!sel) return null;
          const items = [
            { name: sel.name, value: (sel as unknown as Record<string, number | undefined>)[metricKey], type: 'company' },
            ...peers.map(p => ({ name: p.name, value: (p as unknown as Record<string, number | undefined>)[metricKey], type: 'peer' })),
          ].filter(x => x.value != null);
          const indMed = industryMetrics(metricKey);
          if (indMed != null) items.push({ name: `${sel.broad_sector} Median`, value: indMed, type: 'industry' });
          if (lowerBetter) items.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
          else items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
          if (items.length < 2) return null;
          return (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
              <ResponsiveContainer width="100%" height={Math.max(120, items.length * 28 + 20)}>
                <BarChart data={items} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => suffix === 'M' ? (v >= 1000 ? `${(v/1000).toFixed(0)}B` : `${v.toFixed(0)}M`) : `${v}${suffix}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} width={140} axisLine={false} tickLine={false}
                    tickFormatter={(v: string) => v.length > 22 ? v.substring(0, 20) + '…' : v} />
                  <Tooltip {...TT} formatter={(v) => {
                    const n = Number(v);
                    return [suffix === 'M' ? (n >= 1000 ? `${(n/1000).toFixed(1)}B` : `${n.toFixed(0)}M`) : `${n.toFixed(1)}${suffix}`, label];
                  }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {items.map((d, i) => <Cell key={i}
                      fill={d.type === 'company' ? '#2563eb' : d.type === 'industry' ? '#f59e0b' : '#e2e8f0'}
                      stroke={d.type === 'company' ? '#1d4ed8' : d.type === 'industry' ? '#d97706' : '#cbd5e1'}
                      strokeWidth={1} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        };

        return (
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-6">
              <select value={selectedPeer} onChange={e => setSelectedPeer(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm w-96 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                <option value="">Select a company...</option>
                {peersCompanies.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({REGION_LABELS[c.region]}) — {c.peers?.length} peers</option>
                ))}
              </select>
              {sel && (
                <div className="flex gap-4 text-xs text-slate-400">
                  <span><span className="inline-block w-3 h-3 rounded bg-blue-600 mr-1 align-middle" /> Company</span>
                  <span><span className="inline-block w-3 h-3 rounded bg-slate-200 border border-slate-300 mr-1 align-middle" /> Peers</span>
                  <span><span className="inline-block w-3 h-3 rounded bg-amber-400 mr-1 align-middle" /> {sel.broad_sector} Median</span>
                </div>
              )}
            </div>

            {!sel ? (
              <Card className="p-12 text-center text-slate-400">
                <p className="text-lg mb-2">Select a company to see its peer group analysis</p>
                <p className="text-sm">25 industrial companies available with full peer benchmarking data</p>
              </Card>
            ) : (
              <>
                {/* Company header */}
                <Card className="p-5 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{sel.name}</h2>
                      <p className="text-sm text-slate-500">{REGION_LABELS[sel.region]} | {sel.broad_sector} | {peers.length} peers | Industry group: {industryCos.length} companies</p>
                    </div>
                    <div className="flex gap-6">
                      {([['EBIT %', sel.ebit_margin, '%'], ['ROE', sel.roe, '%'], ['Fwd P/E', sel.fwd_pe, 'x'], ['Growth', sel.fwd_rev_growth, '%']] as [string, number|undefined, string][]).map(([l,v,s]) => (
                        <div key={l} className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">{l}</div>
                          <div className="text-lg font-bold text-slate-900">{v != null ? `${v.toFixed(1)}${s}` : '—'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Profitability */}
                <Card className="p-6 mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Profitability & Scale</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {peerBar('ebitda_margin', 'EBITDA Margin', '%')}
                    {peerBar('revenue', 'Revenue', 'M')}
                    {peerBar('net_margin', 'Net Margin', '%')}
                    {peerBar('roe', 'Return on Equity', '%')}
                  </div>
                </Card>

                {/* Valuation */}
                <Card className="p-6 mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Valuation & Risk</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {peerBar('fwd_pe', 'Forward P/E', 'x', true)}
                    {peerBar('fwd_ev_ebitda', 'Forward EV/EBITDA', 'x', true)}
                    {peerBar('debt_equity', 'Debt / Equity', 'x', true)}
                    {peerBar('net_debt_ebitda', 'Net Debt / EBITDA', 'x', true)}
                  </div>
                </Card>

                {/* Comparison table */}
                <Card className="p-6 mb-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Full Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                          <th className="px-3 py-2 text-left">Company</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-right">Revenue</th>
                          <th className="px-3 py-2 text-right">EBITDA %</th>
                          <th className="px-3 py-2 text-right">Net %</th>
                          <th className="px-3 py-2 text-right">ROE</th>
                          <th className="px-3 py-2 text-right">D/E</th>
                          <th className="px-3 py-2 text-right">Fwd P/E</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Company row */}
                        <tr className="bg-blue-50/70 border-b border-slate-200">
                          <td className="px-3 py-2.5 font-semibold text-blue-700">{sel.name}</td>
                          <td className="px-3 py-2.5"><span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">COMPANY</span></td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.revenue ? Math.round(sel.revenue).toLocaleString() : '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.ebitda_margin?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.net_margin?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.roe?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.debt_equity?.toFixed(2) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{sel.fwd_pe?.toFixed(1) ?? '—'}</td>
                        </tr>
                        {/* Peer rows */}
                        {peers.map(p => (
                          <tr key={p.id} className="border-b border-slate-100">
                            <td className="px-3 py-2 text-slate-700">{p.name}</td>
                            <td className="px-3 py-2"><span className="text-[10px] text-slate-400">Peer</span></td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.revenue ? Math.round(p.revenue).toLocaleString() : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.ebitda_margin?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.net_margin?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.roe?.toFixed(1) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.debt_equity?.toFixed(2) ?? '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-slate-600">{p.fwd_pe?.toFixed(1) ?? '—'}</td>
                          </tr>
                        ))}
                        {/* Industry median row */}
                        <tr className="bg-amber-50/50 border-t-2 border-amber-200">
                          <td className="px-3 py-2.5 font-semibold text-amber-700">{sel.broad_sector} Median</td>
                          <td className="px-3 py-2.5"><span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">INDUSTRY</span></td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{(() => { const v = industryMetrics('revenue'); return v ? Math.round(v).toLocaleString() : '—'; })()}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{industryMetrics('ebitda_margin')?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{industryMetrics('net_margin')?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{industryMetrics('roe')?.toFixed(1) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{industryMetrics('debt_equity')?.toFixed(2) ?? '—'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-700">{industryMetrics('fwd_pe')?.toFixed(1) ?? '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </div>
        );
      })()}

      {/* Screening Table */}
      <div className="mb-10">
        <h2 className="text-lg font-bold text-slate-900 mb-1">{tab === 'peers' ? 'Peer Companies' : 'Company Screening'}</h2>
        <p className="text-xs text-slate-500 mb-4">Click any company for detailed analysis.</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company..."
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500" />
          <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="all">All Regions</option>
            <option value="vienna">Austria</option>
            <option value="germany">Germany</option>
            <option value="switzerland">Switzerland</option>
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as keyof Company)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm">
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
                <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-200 sticky top-0 bg-white z-10">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-3 py-3 text-center">Region</th>
                  <th className="px-3 py-3 text-right">Revenue</th>
                  <th className="px-3 py-3 text-right">EBIT %</th>
                  <th className="px-3 py-3 text-right">ROE</th>
                  <th className="px-3 py-3 text-right">Fwd P/E</th>
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
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: REGION_COLORS[c.region] + '15', color: REGION_COLORS[c.region] }}>
                        {REGION_LABELS[c.region].substring(0, 2).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.revenue ? Math.round(c.revenue).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.ebit_margin != null ? c.ebit_margin.toFixed(1) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.roe != null ? c.roe.toFixed(1) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.fwd_pe != null ? c.fwd_pe.toFixed(1) : '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${(c.fwd_rev_growth ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {c.fwd_rev_growth != null ? `${c.fwd_rev_growth > 0 ? '+' : ''}${c.fwd_rev_growth.toFixed(1)}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.debt_equity != null ? c.debt_equity.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-slate-400 py-6">DACH Equity Analytics | Data as of April 2026 | 468 companies</div>
    </div>
  );
}
