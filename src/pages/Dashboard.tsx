import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { TrendingUp, Users, AlertCircle, BarChart2, PieChart, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtMonth = (m: string) => { const [y, mo] = m.split('-'); return `${MONTH_NAMES[+mo - 1]} ${y.slice(2)}`; };

const HEALTH_COLOR: Record<string, string> = {
  Verde: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Amarelo: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  Vermelho: 'bg-red-500/20 text-red-400 border-red-500/30',
};

interface Analytics {
  topClients: { company_name: string; mrr: number; health: string; segment: string }[];
  clientsByStatus: { status: string; count: number }[];
  clientsBySegment: { segment: string; count: number }[];
  overdueByClient: { company_name: string; total: number }[];
  revenueByMonth: { month: string; mensalidade: number; implementacao: number; costs: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/dashboard/analytics')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-[#D8D8DE]/50">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-[#D8D8DE]/50">Erro ao carregar dados.</div>;

  const maxMRR = Math.max(...data.topClients.map(c => c.mrr), 1);
  const CHART_H = 140;
  const maxRev = Math.max(...data.revenueByMonth.map(d => d.mensalidade + d.implementacao + d.costs), 1);
  const barH = (v: number) => v > 0 ? Math.max(Math.round((v / maxRev) * CHART_H), 3) : 0;

  const totalClients = data.clientsByStatus.reduce((s, r) => s + r.count, 0);
  const totalSegments = data.clientsBySegment.reduce((s, r) => s + r.count, 0);

  // Last 6 months for the revenue chart
  const last6 = data.revenueByMonth.slice(-6);
  const totalOverdue = data.overdueByClient.reduce((s, r) => s + r.total, 0);
  const maxOverdue = Math.max(...data.overdueByClient.map(c => c.total), 1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-[#D8D8DE]/60 mt-1">Análise aprofundada dos indicadores da empresa</p>
        </div>
      </div>

      {/* Revenue Trend — last 6 months */}
      <div className="resona-card overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#8151D1]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Receita vs Custos — Últimos 6 Meses</h3>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#8151D1]/70 inline-block" />Mensalidade</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-400/60 inline-block" />Implementação</span>
            <span className="flex items-center gap-1.5 text-red-400"><span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" />Custos</span>
          </div>
        </div>
        <div className="px-6 pt-6 pb-4">
          {last6.every(d => d.mensalidade === 0 && d.implementacao === 0 && d.costs === 0) ? (
            <p className="text-sm text-[#D8D8DE]/50 text-center py-8">Nenhum dado disponível ainda.</p>
          ) : (
            <>
              <div className="flex items-end justify-around h-[140px] border-b border-white/5">
                {last6.map(d => {
                  const marg = d.mensalidade + d.implementacao - d.costs;
                  return (
                    <div key={d.month} className="flex items-end gap-0.5 group/bar cursor-default">
                      <div className="w-6 bg-[#8151D1]/60 group-hover/bar:bg-[#8151D1]/90 rounded-t-md transition-colors" style={{ height: `${barH(d.mensalidade)}px` }} title={`Mensalidade: ${fmt(d.mensalidade)}`} />
                      <div className="w-6 bg-indigo-400/50 group-hover/bar:bg-indigo-400/75 rounded-t-md transition-colors" style={{ height: `${barH(d.implementacao)}px` }} title={`Implementação: ${fmt(d.implementacao)}`} />
                      <div className="w-6 bg-red-500/50 group-hover/bar:bg-red-500/75 rounded-t-md transition-colors" style={{ height: `${barH(d.costs)}px` }} title={`Custos: ${fmt(d.costs)}`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-around mt-3">
                {last6.map(d => {
                  const marg = d.mensalidade + d.implementacao - d.costs;
                  return (
                    <div key={d.month} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-[#D8D8DE]/50 font-medium">{fmtMonth(d.month)}</span>
                      {(d.mensalidade + d.implementacao + d.costs > 0) && (
                        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded', marg >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10')}>
                          {marg >= 0 ? '+' : ''}{fmt(marg)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Clients by MRR */}
        <div className="resona-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top Clientes por MRR</h3>
          </div>
          <div className="p-6 space-y-3">
            {data.topClients.length === 0 ? (
              <p className="text-sm text-[#D8D8DE]/50 text-center py-6">Nenhum cliente ativo com MRR cadastrado.</p>
            ) : data.topClients.map((c, i) => (
              <div key={c.company_name} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-[#D8D8DE]/30 w-5 text-right flex-shrink-0">#{i + 1}</span>
                    <span className="text-sm font-bold text-white truncate">{c.company_name}</span>
                    {c.health && (
                      <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0', HEALTH_COLOR[c.health] || 'bg-white/5 text-[#D8D8DE]/50 border-white/10')}>
                        {c.health}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-emerald-400 ml-3 flex-shrink-0">{fmt(c.mrr)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden ml-7">
                  <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${(c.mrr / maxMRR) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue by Client */}
        <div className="resona-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 bg-red-500/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Inadimplência por Cliente</h3>
            </div>
            {totalOverdue > 0 && <span className="text-xs font-bold text-red-400">{fmt(totalOverdue)}</span>}
          </div>
          <div className="p-6 space-y-3">
            {data.overdueByClient.length === 0 ? (
              <p className="text-sm text-emerald-400 text-center py-6 font-bold">Sem inadimplência</p>
            ) : data.overdueByClient.map(c => (
              <div key={c.company_name} className="group">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-white truncate">{c.company_name}</span>
                  <span className="text-sm font-bold text-red-400 ml-3 flex-shrink-0">{fmt(c.total)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-700 to-red-400 rounded-full transition-all duration-500" style={{ width: `${(c.total / maxOverdue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Clients by Status */}
        <div className="resona-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#8151D1]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clientes por Status</h3>
          </div>
          <div className="p-6 space-y-4">
            {data.clientsByStatus.length === 0 ? (
              <p className="text-sm text-[#D8D8DE]/50 text-center py-6">Nenhum cliente cadastrado.</p>
            ) : data.clientsByStatus.map(s => {
              const pct = totalClients > 0 ? Math.round((s.count / totalClients) * 100) : 0;
              const color = s.status === 'Ativo' ? 'from-[#3F1E6A] to-[#8151D1]' : s.status === 'Pausado' ? 'from-yellow-700 to-yellow-500' : 'from-red-800 to-red-500';
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#D8D8DE]">{s.status || 'Sem status'}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#D8D8DE]/50">{pct}%</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30">{s.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Clients by Segment */}
        <div className="resona-card overflow-hidden">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#8151D1]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Empresas por Segmento</h3>
          </div>
          <div className="p-6 space-y-4">
            {data.clientsBySegment.length === 0 ? (
              <p className="text-sm text-[#D8D8DE]/50 text-center py-6">Nenhum dado de segmento.</p>
            ) : data.clientsBySegment.slice(0, 8).map((s, i) => {
              const pct = totalSegments > 0 ? Math.round((s.count / totalSegments) * 100) : 0;
              const opacities = ['from-[#3F1E6A] to-[#8151D1]', 'from-[#2a145a] to-[#6b3db5]', 'from-[#1a0d3d] to-[#5530a0]', 'from-blue-900 to-blue-600', 'from-cyan-900 to-cyan-600', 'from-teal-900 to-teal-600', 'from-indigo-900 to-indigo-600', 'from-purple-900 to-purple-600'];
              return (
                <div key={s.segment}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#D8D8DE] truncate">{s.segment}</span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs font-bold text-[#D8D8DE]/50">{pct}%</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30">{s.count}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${opacities[i % opacities.length]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
