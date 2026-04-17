"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCompanies, getCompany } from "@/lib/data";
import { Company, Peer, REGION_LABELS, REGION_COLORS, median } from "@/lib/types";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

const TT = { contentStyle: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>;
}

function PeerBar({ company, peers, metricKey, label, suffix, lowerBetter = false }: {
  company: Company; peers: Peer[]; metricKey: string; label: string; suffix: string; lowerBetter?: boolean;
}) {
  const all = useMemo(() => {
    const items = [
      { name: company.name, value: (company as unknown as Record<string, number | undefined>)[metricKey], isCompany: true },
      ...peers.map(p => ({ name: p.name, value: (p as unknown as Record<string, number | undefined>)[metricKey], isCompany: false })),
    ].filter(x => x.value != null);
    if (lowerBetter) items.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    else items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return items;
  }, [company, peers, metricKey, lowerBetter]);

  if (all.length < 2) return null;
  const peerVals = all.filter(x => !x.isCompany).map(x => x.value!);
  const peerMed = peerVals.length ? median(peerVals) : undefined;

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <ResponsiveContainer width="100%" height={Math.max(120, all.length * 28 + 20)}>
        <BarChart data={all} layout="vertical" margin={{ left: 0 }}>
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => {
              if (suffix === 'M') return v >= 1000 ? `${(v/1000).toFixed(0)}B` : `${v.toFixed(0)}M`;
              return `${v}${suffix}`;
            }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} width={130} axisLine={false} tickLine={false}
            tickFormatter={(v: string) => v.length > 20 ? v.substring(0, 18) + '…' : v} />
          <Tooltip {...TT} formatter={(v) => {
            const n = Number(v);
            if (suffix === 'M') return [n >= 1000 ? `${(n/1000).toFixed(1)}B` : `${n.toFixed(0)}M`, label];
            return [`${n.toFixed(1)}${suffix}`, label];
          }} />
          {peerMed !== undefined && <ReferenceLine x={peerMed} stroke="#94a3b8" strokeDasharray="3 3"
            label={{ value: suffix === 'M' ? `Med ${peerMed >= 1000 ? (peerMed/1000).toFixed(0)+'B' : peerMed.toFixed(0)+'M'}` : `Med ${peerMed.toFixed(1)}${suffix}`, position: 'top', fill: '#94a3b8', fontSize: 9 }} />}
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {all.map((d, i) => <Cell key={i} fill={d.isCompany ? '#2563eb' : '#e2e8f0'} stroke={d.isCompany ? '#1d4ed8' : '#cbd5e1'} strokeWidth={1} />)}
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
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">← Back to Dashboard</Link>
        <div className="mt-12 text-center text-slate-400">Company not found. Select one from the dashboard.</div>
      </div>
    );
  }

  const hasPeers = company.has_peers && company.peers && company.peers.length > 0;
  const peers = company.peers || [];

  // Compute peer summary
  const peerSummary = useMemo(() => {
    if (!hasPeers) return [];
    const metrics: { label: string; key: string; suffix: string; higherBetter: boolean }[] = [
      { label: 'EBITDA Margin', key: 'ebitda_margin', suffix: '%', higherBetter: true },
      { label: 'EBIT Margin', key: 'ebit_margin', suffix: '%', higherBetter: true },
      { label: 'Net Margin', key: 'net_margin', suffix: '%', higherBetter: true },
      { label: 'ROE', key: 'roe', suffix: '%', higherBetter: true },
      { label: 'Forward P/E', key: 'fwd_pe', suffix: 'x', higherBetter: false },
      { label: 'Forward EV/EBITDA', key: 'fwd_ev_ebitda', suffix: 'x', higherBetter: false },
      { label: 'Debt/Equity', key: 'debt_equity', suffix: 'x', higherBetter: false },
    ];
    return metrics.map(m => {
      const compVal = (company as unknown as Record<string, number | undefined>)[m.key];
      const peerVals = peers.map(p => (p as unknown as Record<string, number | undefined>)[m.key]).filter(v => v != null) as number[];
      if (compVal == null || !peerVals.length) return null;
      const med = median(peerVals);
      const diff = (compVal - med) / Math.abs(med) * 100;
      const isGood = m.higherBetter ? diff > 5 : diff < -5;
      const isBad = m.higherBetter ? diff < -5 : diff > 5;
      return { ...m, compVal, med, diff, isGood, isBad };
    }).filter(Boolean) as { label: string; key: string; suffix: string; higherBetter: boolean; compVal: number; med: number; diff: number; isGood: boolean; isBad: boolean }[];
  }, [company, peers, hasPeers]);

  // Radar
  const radarData = useMemo(() => {
    if (!hasPeers) return [];
    const axes = [
      { key: 'ebitda_margin', label: 'Margin', hb: true },
      { key: 'roe', label: 'ROE', hb: true },
      { key: 'fwd_pe', label: 'Valuation', hb: false },
      { key: 'fwd_rev_growth', label: 'Growth', hb: true },
      { key: 'debt_equity', label: 'Leverage', hb: false },
    ];
    return axes.map(a => {
      const cv = (company as unknown as Record<string, number | undefined>)[a.key];
      const pvs = peers.map(p => (p as unknown as Record<string, number | undefined>)[a.key]).filter(v => v != null) as number[];
      const pm = pvs.length ? median(pvs) : 0;
      const mx = Math.max(Math.abs(cv ?? 0), Math.abs(pm), 1);
      let cn = cv != null ? (cv / mx) * 50 + 50 : 50;
      let pn = (pm / mx) * 50 + 50;
      if (!a.hb) { cn = 100 - cn; pn = 100 - pn; }
      return { metric: a.label, company: Math.max(0, Math.min(100, cn)), peers: Math.max(0, Math.min(100, pn)) };
    });
  }, [company, peers, hasPeers]);

  // Key insights
  const insights = useMemo(() => {
    if (!peerSummary.length) return [];
    const msgs: { icon: string; text: string; color: string }[] = [];
    const margin = peerSummary.find(m => m.key === 'ebitda_margin' || m.key === 'ebit_margin');
    if (margin) {
      if (margin.isGood) msgs.push({ icon: '▲', text: `Operates at ${margin.compVal.toFixed(1)}% ${margin.label}, ${Math.abs(margin.diff).toFixed(0)}% above peer median (${margin.med.toFixed(1)}%). Suggests pricing power or operational efficiency advantage.`, color: 'text-emerald-700' });
      else if (margin.isBad) msgs.push({ icon: '▼', text: `${margin.label} of ${margin.compVal.toFixed(1)}% trails peer median of ${margin.med.toFixed(1)}% by ${Math.abs(margin.diff).toFixed(0)}%. May indicate cost structure or competitive positioning challenges.`, color: 'text-red-700' });
      else msgs.push({ icon: '●', text: `${margin.label} of ${margin.compVal.toFixed(1)}% is in line with peer median (${margin.med.toFixed(1)}%).`, color: 'text-slate-600' });
    }
    const pe = peerSummary.find(m => m.key === 'fwd_pe');
    if (pe) {
      if (pe.isBad) msgs.push({ icon: '▲', text: `Trades at ${pe.compVal.toFixed(1)}x forward P/E vs peer median ${pe.med.toFixed(1)}x — a ${Math.abs(pe.diff).toFixed(0)}% premium. Market may be pricing in higher growth expectations.`, color: 'text-amber-700' });
      else if (pe.isGood) msgs.push({ icon: '▼', text: `Forward P/E of ${pe.compVal.toFixed(1)}x represents a ${Math.abs(pe.diff).toFixed(0)}% discount to peers (${pe.med.toFixed(1)}x). Potentially undervalued if fundamentals hold.`, color: 'text-emerald-700' });
    }
    const roe = peerSummary.find(m => m.key === 'roe');
    if (roe) {
      if (roe.isGood) msgs.push({ icon: '▲', text: `ROE of ${roe.compVal.toFixed(1)}% exceeds peer median (${roe.med.toFixed(1)}%) — generating superior returns on shareholder equity.`, color: 'text-emerald-700' });
      else if (roe.isBad) msgs.push({ icon: '▼', text: `ROE of ${roe.compVal.toFixed(1)}% lags peers (${roe.med.toFixed(1)}%). Capital efficiency may be a concern.`, color: 'text-red-700' });
    }
    const de = peerSummary.find(m => m.key === 'debt_equity');
    if (de) {
      if (de.isGood) msgs.push({ icon: '◆', text: `Conservative balance sheet with D/E of ${de.compVal.toFixed(2)}x vs peer median ${de.med.toFixed(2)}x.`, color: 'text-emerald-700' });
      else if (de.isBad) msgs.push({ icon: '◆', text: `Higher leverage (D/E ${de.compVal.toFixed(2)}x) vs peers (${de.med.toFixed(2)}x) — ${Math.abs(de.diff).toFixed(0)}% above median.`, color: 'text-amber-700' });
    }
    return msgs.slice(0, 5);
  }, [peerSummary]);

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <Link href="/" className="text-blue-600 hover:underline text-sm font-medium">← Back to Dashboard</Link>

      {/* Header */}
      <Card className="p-6 mt-5 mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {REGION_LABELS[company.region]} | Revenue {company.revenue ? `${Math.round(company.revenue).toLocaleString()}M` : '—'} | {hasPeers ? `${peers.length} peer companies` : 'No peer data available'}
            </p>
          </div>
          <div className="flex gap-8">
            {([['EBIT %', company.ebit_margin, '%'], ['ROE', company.roe, '%'], ['Fwd P/E', company.fwd_pe, 'x'], ['Growth', company.fwd_rev_growth, '%']] as [string, number | undefined, string][]).map(([l, v, s]) => (
              <div key={l} className="text-right">
                <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold">{l}</div>
                <div className="text-xl font-bold text-slate-900">{v != null ? `${v.toFixed(1)}${s}` : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {!hasPeers ? (
        <Card className="p-8 text-center text-slate-400 mb-8">
          <p className="text-lg mb-2">No peer group data available for this company.</p>
          <p className="text-sm">Peer analysis is currently available for 25 industrial companies. <Link href="/" className="text-blue-600 hover:underline">Browse companies with peer data →</Link></p>
        </Card>
      ) : (
        <>
          {/* 1. Key Insights */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Key Insights</h2>
            <div className="space-y-3">
              {insights.map((ins, i) => (
                <div key={i} className={`flex gap-3 text-sm ${ins.color}`}>
                  <span className="font-bold text-lg leading-5">{ins.icon}</span>
                  <span>{ins.text}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 2. Company Profile Radar */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Competitive Profile</h2>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis tick={false} domain={[0, 100]} />
                    <Radar name={company.name} dataKey="company" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} />
                    <Radar name="Peer Median" dataKey="peers" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.05} strokeDasharray="4 4" />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip content={({ payload, label }) => {
                      if (!payload?.length) return null;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                          <div className="font-semibold text-slate-700 mb-1">{label}</div>
                          {payload.map((p, i) => (
                            <div key={i} className="flex justify-between gap-4">
                              <span style={{ color: p.color }}>{p.name}</span>
                              <span className="font-mono">{Number(p.value).toFixed(0)}/100</span>
                            </div>
                          ))}
                          <div className="text-slate-400 mt-1 text-[10px]">Normalized score (higher = better)</div>
                        </div>
                      );
                    }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-3 content-start">
                {peerSummary.map(m => (
                  <div key={m.key} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-[11px] text-slate-500 font-semibold uppercase">{m.label}</div>
                    <div className="text-lg font-bold text-slate-900">{m.suffix === 'x' ? m.compVal.toFixed(2) : m.compVal.toFixed(1)}{m.suffix}</div>
                    <div className="text-xs text-slate-400">Peer med: {m.suffix === 'x' ? m.med.toFixed(2) : m.med.toFixed(1)}{m.suffix}</div>
                    <div className={`text-xs font-bold ${m.isGood ? 'text-emerald-600' : m.isBad ? 'text-red-600' : 'text-slate-500'}`}>
                      {m.diff > 0 ? '+' : ''}{m.diff.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 3. Profitability & Scale */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Profitability & Scale</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PeerBar company={company} peers={peers} metricKey="ebitda_margin" label="EBITDA Margin" suffix="%" />
              <PeerBar company={company} peers={peers} metricKey="revenue" label="Revenue" suffix="M" />
              <PeerBar company={company} peers={peers} metricKey="net_margin" label="Net Margin" suffix="%" />
              <PeerBar company={company} peers={peers} metricKey="roe" label="Return on Equity" suffix="%" />
            </div>
          </Card>

          {/* 4. Valuation & Risk */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Valuation & Risk</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <PeerBar company={company} peers={peers} metricKey="fwd_pe" label="Forward P/E" suffix="x" lowerBetter />
              <PeerBar company={company} peers={peers} metricKey="fwd_ev_ebitda" label="Forward EV/EBITDA" suffix="x" lowerBetter />
              <PeerBar company={company} peers={peers} metricKey="debt_equity" label="Debt / Equity" suffix="x" lowerBetter />
              <PeerBar company={company} peers={peers} metricKey="net_debt_ebitda" label="Net Debt / EBITDA" suffix="x" lowerBetter />
            </div>
          </Card>

          {/* 5. Full Comparison Table */}
          <Card className="p-6 mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide">Full Peer Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 uppercase tracking-wide border-b border-slate-200">
                    <th className="px-3 py-2 text-left">Company</th>
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
                  {[company, ...peers].map((c, i) => {
                    const isComp = i === 0;
                    return (
                      <tr key={c.id || i} className={`border-b border-slate-100 ${isComp ? 'bg-blue-50/70' : ''}`}>
                        <td className={`px-3 py-2.5 font-medium ${isComp ? 'text-blue-700' : 'text-slate-700'}`}>{c.name}</td>
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

      <div className="text-center text-xs text-slate-400 py-6">DACH Equity Analytics | Data as of April 2026</div>
    </div>
  );
}

export default function CompanyPage() {
  return (
    <Suspense fallback={<div className="max-w-[1200px] mx-auto px-6 py-8 text-slate-400">Loading...</div>}>
      <CompanyContent />
    </Suspense>
  );
}
