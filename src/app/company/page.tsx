"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCompanies, getCompany } from "@/lib/data";
import { Company, Peer, REGION_LABELS, REGION_COLORS, METRICS, percentile, median } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>;
}

function PercentileBar({ label, value, pctDach, pctRegion, suffix, higherBetter }: {
  label: string; value: number; pctDach: number; pctRegion: number; suffix: string; higherBetter: boolean;
}) {
  const effectivePct = higherBetter ? pctDach : 100 - pctDach;
  const color = effectivePct > 66 ? '#059669' : effectivePct > 33 ? '#d97706' : '#dc2626';
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-28 text-xs text-slate-500 shrink-0 font-medium">{label}</div>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full relative overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctDach}%`, background: color }} />
      </div>
      <div className="w-16 text-xs font-mono text-right text-slate-700 font-medium">{value.toFixed(1)}{suffix}</div>
      <div className="w-12 text-[10px] text-slate-400 font-mono">P{pctDach}</div>
      <div className="w-14 text-[10px] text-slate-400 font-mono">P{pctRegion} reg</div>
    </div>
  );
}

function PeerBarChart({ company, peers, metricKey, label, suffix }: {
  company: Company; peers: Peer[]; metricKey: string; label: string; suffix: string;
}) {
  const all = useMemo(() => {
    const items = [
      { name: company.name, value: (company as unknown as Record<string, number | undefined>)[metricKey], isCompany: true },
      ...peers.map(p => ({ name: p.name, value: (p as unknown as Record<string, number | undefined>)[metricKey], isCompany: false })),
    ].filter(x => x.value != null);
    items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return items;
  }, [company, peers, metricKey]);

  if (all.length < 2) return null;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <ResponsiveContainer width="100%" height={Math.max(140, all.length * 30 + 20)}>
        <BarChart data={all} layout="vertical" margin={{ left: 0 }}>
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${v}${suffix}`} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} width={130}
            tickFormatter={(v: string) => v.length > 20 ? v.substring(0, 18) + '...' : v} axisLine={false} tickLine={false} />
          <Tooltip {...TT} formatter={(v) => [`${Number(v).toFixed(1)}${suffix}`, label]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {all.map((d, i) => <Cell key={i} fill={d.isCompany ? '#2563eb' : '#cbd5e1'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CompanyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const allCompanies = useMemo(() => getCompanies(), []);
  const company = useMemo(() => id ? getCompany(id) : undefined, [id]);

  if (!company) {
    return (
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">← Back to Dashboard</Link>
        <div className="mt-12 text-center text-slate-400">Company not found. Select one from the dashboard.</div>
      </div>
    );
  }

  const regionCompanies = allCompanies.filter(c => c.region === company.region);

  const radarData = useMemo(() => {
    if (!company.has_peers || !company.peers?.length) return [];
    const metrics = [
      { key: 'ebitda_margin', label: 'Margin', higherBetter: true },
      { key: 'roe', label: 'ROE', higherBetter: true },
      { key: 'fwd_pe', label: 'P/E (inv)', higherBetter: false },
      { key: 'fwd_rev_growth', label: 'Growth', higherBetter: true },
      { key: 'debt_equity', label: 'Leverage (inv)', higherBetter: false },
    ];
    return metrics.map(m => {
      const compVal = (company as unknown as Record<string, number | undefined>)[m.key];
      const peerVals = company.peers!.map(p => (p as unknown as Record<string, number | undefined>)[m.key]).filter(v => v != null) as number[];
      const peerMed = peerVals.length ? median(peerVals) : 0;
      const maxVal = Math.max(Math.abs(compVal ?? 0), Math.abs(peerMed), 1);
      let compNorm = compVal != null ? (compVal / maxVal) * 50 + 50 : 50;
      let peerNorm = (peerMed / maxVal) * 50 + 50;
      if (!m.higherBetter) { compNorm = 100 - compNorm; peerNorm = 100 - peerNorm; }
      return { metric: m.label, company: Math.max(0, Math.min(100, compNorm)), peers: Math.max(0, Math.min(100, peerNorm)) };
    });
  }, [company]);

  const getNeighbors = (key: keyof Company, n = 2) => {
    const val = company[key] as number | undefined;
    if (val == null) return [];
    const all = allCompanies.filter(c => c[key] != null).sort((a, b) => (b[key] as number) - (a[key] as number));
    const idx = all.findIndex(c => c.id === company.id);
    if (idx < 0) return [];
    return all.slice(Math.max(0, idx - n), Math.min(all.length, idx + n + 1))
      .map(c => ({ name: c.name, value: c[key] as number, isTarget: c.id === company.id, rank: all.indexOf(c) + 1, total: all.length }));
  };

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8">
      <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">← Back to Dashboard</Link>

      {/* Company Header */}
      <Card className="p-6 mt-5 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {REGION_LABELS[company.region]} | Revenue: {company.revenue ? `${Math.round(company.revenue).toLocaleString()}M` : '—'} | {company.has_peers ? `${company.peers?.length} peers` : 'No peer data'}
            </p>
          </div>
          <div className="flex gap-8">
            {([
              ['EBIT %', company.ebit_margin, '%'], ['ROE', company.roe, '%'],
              ['Fwd P/E', company.fwd_pe, 'x'], ['Fwd ROE', company.fwd_roe, '%'], ['Growth', company.fwd_rev_growth, '%'],
            ] as [string, number | undefined, string][]).map(([label, val, suffix]) => (
              <div key={label} className="text-right">
                <div className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{label}</div>
                <div className="text-xl font-bold text-slate-900">{val != null ? `${val.toFixed(1)}${suffix}` : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Percentile Positioning */}
      <Card className="p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">Percentile Rank vs DACH Universe</h2>
        {METRICS.filter(m => company[m.key] != null).map(m => {
          const val = company[m.key] as number;
          const allVals = allCompanies.filter(c => c[m.key] != null).map(c => c[m.key] as number);
          const regVals = regionCompanies.filter(c => c[m.key] != null).map(c => c[m.key] as number);
          return <PercentileBar key={m.key} label={m.label} value={val} suffix={m.suffix}
            pctDach={percentile(allVals, val)} pctRegion={percentile(regVals, val)} higherBetter={m.higherBetter} />;
        })}
      </Card>

      {/* Ranking Neighbors */}
      <Card className="p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">DACH Ranking — Nearest Neighbors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {([
            ['ebit_margin', 'EBIT Margin', '%'], ['roe', 'ROE', '%'], ['fwd_pe', 'Forward P/E', 'x'],
            ['fwd_roe', 'Forward ROE', '%'], ['fwd_rev_growth', 'Rev Growth', '%'], ['debt_equity', 'Debt/Equity', 'x'],
          ] as [keyof Company, string, string][]).map(([key, label, suffix]) => {
            const neighbors = getNeighbors(key);
            if (!neighbors.length) return null;
            return (
              <div key={key} className="bg-slate-50 rounded-lg p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
                {neighbors.map((n, i) => (
                  <div key={i} className={`flex justify-between text-xs py-0.5 ${n.isTarget ? 'text-blue-600 font-bold' : 'text-slate-600'}`}>
                    <span>#{n.rank} {n.name.length > 24 ? n.name.substring(0, 22) + '...' : n.name}</span>
                    <span className="font-mono">{n.value.toFixed(1)}{suffix}</span>
                  </div>
                ))}
                <div className="text-[10px] text-slate-400 mt-1.5">of {neighbors[0]?.total} companies</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Peer Comparison */}
      {company.has_peers && company.peers && company.peers.length > 0 && (
        <>
          {/* Radar + Key Bars */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">Peer Group Profile</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <div className="text-xs text-slate-400 mb-2 font-medium">Company vs Peer Median</div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <PolarRadiusAxis tick={false} domain={[0, 100]} />
                    <Radar name={company.name} dataKey="company" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} strokeWidth={2} />
                    <Radar name="Peer Median" dataKey="peers" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} strokeDasharray="4 4" />
                    <Tooltip {...TT} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-6">
                <PeerBarChart company={company} peers={company.peers} metricKey="ebitda_margin" label="EBITDA Margin" suffix="%" />
                <PeerBarChart company={company} peers={company.peers} metricKey="roe" label="ROE" suffix="%" />
              </div>
            </div>
          </Card>

          {/* Industry Deep-Dive */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">Industry Benchmarking</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PeerBarChart company={company} peers={company.peers} metricKey="revenue" label="Revenue (M)" suffix="" />
              <PeerBarChart company={company} peers={company.peers} metricKey="ebit_margin" label="EBIT Margin" suffix="%" />
              <PeerBarChart company={company} peers={company.peers} metricKey="net_margin" label="Net Margin" suffix="%" />
              <PeerBarChart company={company} peers={company.peers} metricKey="fwd_pe" label="Forward P/E" suffix="x" />
              <PeerBarChart company={company} peers={company.peers} metricKey="fwd_ev_ebitda" label="Forward EV/EBITDA" suffix="x" />
              <PeerBarChart company={company} peers={company.peers} metricKey="debt_equity" label="Debt / Equity" suffix="x" />
            </div>

            {/* Summary cards */}
            {(() => {
              const pm: [string, string, string, boolean][] = [
                ['EBITDA Margin', 'ebitda_margin', '%', true], ['Net Margin', 'net_margin', '%', true],
                ['ROE', 'roe', '%', true], ['Fwd P/E', 'fwd_pe', 'x', false],
                ['Fwd EV/EBITDA', 'fwd_ev_ebitda', 'x', false], ['D/E', 'debt_equity', 'x', false],
              ];
              return (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Company vs Peer Median</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {pm.map(([label, key, suffix, higherBetter]) => {
                      const compVal = (company as unknown as Record<string, number | undefined>)[key];
                      const peerVals = company.peers!.map(p => (p as unknown as Record<string, number | undefined>)[key]).filter(v => v != null) as number[];
                      if (!peerVals.length || compVal == null) return null;
                      const med = median(peerVals);
                      const diff = (compVal - med) / Math.abs(med) * 100;
                      const isGood = higherBetter ? diff > 0 : diff < 0;
                      return (
                        <div key={key} className="bg-slate-50 rounded-lg p-3">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">{label}</div>
                          <div className="text-lg font-bold text-slate-900">{compVal.toFixed(1)}{suffix}</div>
                          <div className="text-xs text-slate-400">Peer median: {med.toFixed(1)}{suffix}</div>
                          <div className={`text-xs font-bold mt-0.5 ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(0)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Card>

          {/* Full Peer Table */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">Peer Comparison Table</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] text-slate-400 uppercase tracking-wide border-b border-slate-200">
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2 text-right">Revenue</th>
                    <th className="px-3 py-2 text-right">EBITDA %</th>
                    <th className="px-3 py-2 text-right">Net %</th>
                    <th className="px-3 py-2 text-right">ROE</th>
                    <th className="px-3 py-2 text-right">D/E</th>
                    <th className="px-3 py-2 text-right">Fwd P/E</th>
                    <th className="px-3 py-2 text-right">Fwd EV/EBITDA</th>
                  </tr>
                </thead>
                <tbody>
                  {[company, ...company.peers].map((c, i) => {
                    const isComp = i === 0;
                    return (
                      <tr key={c.id || i} className={`border-b border-slate-100 ${isComp ? 'bg-blue-50 font-semibold' : ''}`}>
                        <td className={`px-3 py-2.5 ${isComp ? 'text-blue-700' : 'text-slate-700'}`}>{c.name}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.revenue ? Math.round(c.revenue).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.ebitda_margin != null ? c.ebitda_margin.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.net_margin != null ? c.net_margin.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.roe != null ? c.roe.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.debt_equity != null ? c.debt_equity.toFixed(2) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.fwd_pe != null ? c.fwd_pe.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-slate-600">{c.fwd_ev_ebitda != null ? c.fwd_ev_ebitda.toFixed(1) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Regional Distribution */}
      <Card className="p-6 mb-8">
        <h2 className="text-sm font-bold text-slate-700 mb-5 uppercase tracking-wide">Position in {REGION_LABELS[company.region]}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {([
            ['ebit_margin', 'EBIT Margin', 5, -30, 50],
            ['roe', 'ROE', 5, -30, 60],
          ] as [keyof Company, string, number, number, number][]).map(([key, label, binSize, rangeMin, rangeMax]) => {
            const vals = regionCompanies.filter(c => c[key] != null && (c[key] as number) >= rangeMin && (c[key] as number) <= rangeMax);
            const nBins = Math.ceil((rangeMax - rangeMin) / binSize);
            const bins = Array(nBins).fill(0);
            vals.forEach(c => { const b = Math.min(nBins - 1, Math.max(0, Math.floor(((c[key] as number) - rangeMin) / binSize))); bins[b]++; });
            const compBin = company[key] != null ? Math.min(nBins - 1, Math.max(0, Math.floor(((company[key] as number) - rangeMin) / binSize))) : -1;
            const histData = bins.map((count, i) => ({ label: `${rangeMin + i * binSize}%`, count, isCompany: i === compBin }));
            return (
              <div key={key as string}>
                <div className="text-xs text-slate-400 font-medium mb-2">{label} Distribution — {REGION_LABELS[company.region]} ({vals.length} companies)</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={histData}>
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TT} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {histData.map((d, i) => <Cell key={i} fill={d.isCompany ? '#2563eb' : REGION_COLORS[company.region] + '30'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="text-center text-xs text-slate-400 py-6">
        DACH Equity Analytics | Data as of April 2026
      </div>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="max-w-[1400px] mx-auto px-6 py-8 text-slate-400">Loading...</div>}>
      <CompanyContent />
    </Suspense>
  );
}
