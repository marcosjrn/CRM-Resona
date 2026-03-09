import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { Link } from 'react-router-dom';
import { Users, DollarSign, AlertCircle, Calendar, TrendingUp, TrendingDown, ArrowRight, BarChart2, Zap, CheckCircle } from 'lucide-react';
import { format, isAfter, isBefore, addDays, startOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Invoice, Deal } from '../types';
import { clsx } from 'clsx';
import { useToast } from '../components/Toast';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const formatMonth = (month: string) => {
  const [year, m] = month.split('-');
  return `${MONTH_NAMES[parseInt(m) - 1]} ${year.slice(2)}`;
};

export default function Home() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [chartData, setChartData] = useState<{ month: string; revenue: number; revenue_mensalidade: number; revenue_implementacao: number; costs: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, invoicesRes, chartRes, dealsRes] = await Promise.all([
        apiFetch('/api/dashboard'),
        apiFetch('/api/invoices'),
        apiFetch('/api/dashboard/chart'),
        apiFetch('/api/deals'),
      ]);
      setStats(await statsRes.json());
      setInvoices(await invoicesRes.json());
      setChartData(await chartRes.json());
      if (dealsRes.ok) setDeals(await dealsRes.json());
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuickPayHome = async (invoice: Invoice) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    try {
      const res = await apiFetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...invoice, status: 'Pago', paid_date: today }),
      });
      if (!res.ok) throw new Error();
      toast('Invoice marcada como paga', 'success');
      fetchData();
    } catch {
      toast('Erro ao atualizar invoice', 'error');
    }
  };

  if (loading) return <div className="p-8 text-center text-[#D8D8DE]/50">Carregando...</div>;

  const today = new Date();
  const next7Days = addDays(today, 7);
  const todayStart = startOfDay(today);

  // Invoices — derived status from data (mirrors Finance.tsx computeStatus)
  const computeInvoiceStatus = (i: Invoice): 'Pago' | 'Pendente' | 'Atrasado' => {
    if (i.paid_date) return 'Pago';
    if (new Date(i.due_date + 'T00:00:00') < today) return 'Atrasado';
    return 'Pendente';
  };

  const overdueInvoices = invoices.filter(i => computeInvoiceStatus(i) === 'Atrasado');
  const dueSoonInvoices = invoices.filter(i =>
    computeInvoiceStatus(i) === 'Pendente' &&
    isAfter(new Date(i.due_date + 'T00:00:00'), today) &&
    isBefore(new Date(i.due_date + 'T00:00:00'), next7Days)
  );

  const mrr = stats?.financials?.mrr || 0;
  const costs = stats?.financials?.costs || 0;
  const paidRevenueMensalidade = stats?.financials?.revenue_mensalidade || 0;
  const paidRevenueImplementacao = stats?.financials?.revenue_implementacao || 0;
  const paidRevenueTotal = stats?.financials?.revenue_total || 0;
  const margin = mrr - costs;
  const pipeline = stats?.pipeline || [];
  const totalDeals = pipeline.reduce((s: number, p: any) => s + p.count, 0);
  const maxCount = Math.max(...pipeline.map((p: any) => p.count), 1);

  // Próximas Ações — split into overdue (past) + upcoming (today/future)
  const overdueActionDeals = [...deals]
    .filter(d => startOfDay(parseISO(d.next_action_date)) < todayStart)
    .sort((a, b) => a.next_action_date.localeCompare(b.next_action_date));
  const upcomingActionDeals = [...deals]
    .filter(d => startOfDay(parseISO(d.next_action_date)) >= todayStart)
    .sort((a, b) => a.next_action_date.localeCompare(b.next_action_date))
    .slice(0, 7);
  const dealUrgency = (dateStr: string) => {
    const d = startOfDay(parseISO(dateStr));
    if (d < todayStart) return 'overdue';
    if (d.getTime() === todayStart.getTime()) return 'today';
    return 'future';
  };

  // Chart calculations
  const maxVal = Math.max(...chartData.map(d => Math.max(d.revenue, d.costs)), 1);
  const CHART_H = 128; // px — container is h-32
  const barH = (val: number) => val > 0 ? Math.max(Math.round((val / maxVal) * CHART_H), 4) : 0;
  const hasChartData = chartData.some(d => d.revenue > 0 || d.costs > 0);

  const statCards = [
    { label: 'Clientes Ativos', value: stats?.activeClients || 0, icon: Users, color: 'text-[#8151D1]', bg: 'bg-[#8151D1]/10', format: 'number' },
    { label: 'Leads em Aberto', value: stats?.openLeads || 0, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10', format: 'number' },
    { label: 'Faturamento Realizado', value: paidRevenueTotal, icon: CheckCircle, color: 'text-cyan-300', bg: 'bg-cyan-500/10', format: 'currency' },
    { label: 'Faturamento Mensal', value: mrr, icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10', format: 'currency' },
    { label: 'Custos do Mês', value: costs, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10', format: 'currency' },
    { label: 'Margem', value: margin, icon: DollarSign, color: margin >= 0 ? 'text-white' : 'text-red-400', bg: margin >= 0 ? 'bg-white/5' : 'bg-red-500/10', format: 'currency' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Hoje</h1>
        <div className="text-sm text-[#D8D8DE]/70 font-medium uppercase tracking-wider">
          {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="resona-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-[#D8D8DE]/60 uppercase tracking-widest leading-tight">{card.label}</p>
              <div className={clsx('p-2 rounded-lg', card.bg)}>
                <card.icon className={clsx('h-4 w-4', card.color)} />
              </div>
            </div>
            <p className={clsx('text-2xl font-extrabold', card.color)}>
              {card.format === 'currency' ? fmt(card.value) : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Revenue vs Costs Chart */}
      <div className="resona-card overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-[#8151D1]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Receitas Pagas vs Custos — Últimos 6 Meses</h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded border border-cyan-500/20">
              Mensalidade: {fmt(paidRevenueMensalidade)}
            </span>
            <span className="text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
              Implementação: {fmt(paidRevenueImplementacao)}
            </span>
            <span className="flex items-center gap-1.5 text-red-400 ml-2">
              <span className="w-3 h-3 rounded-sm bg-red-500/60 inline-block" />
              Custos
            </span>
          </div>
        </div>
        <div className="px-6 pt-6 pb-4">
          {!hasChartData ? (
            <p className="text-sm text-[#D8D8DE]/50 text-center py-8">Nenhum dado financeiro disponível ainda.</p>
          ) : (
            <>
              {/* Bars */}
              <div className="flex items-end justify-around h-32 border-b border-white/5">
                {chartData.map(d => {
                  const rH = barH(d.revenue);
                  const cH = barH(d.costs);
                  return (
                    <div key={d.month} className="flex items-end gap-1 group/bar cursor-default">
                      <div
                        className="w-7 bg-emerald-500/50 group-hover/bar:bg-emerald-500/75 rounded-t-md transition-colors"
                        style={{ height: `${rH}px` }}
                        title={`Receitas (${formatMonth(d.month)}): ${fmt(d.revenue)} | Mensalidade: ${fmt(d.revenue_mensalidade)} | Implementação: ${fmt(d.revenue_implementacao)}`}
                      />
                      <div
                        className="w-7 bg-red-500/50 group-hover/bar:bg-red-500/75 rounded-t-md transition-colors"
                        style={{ height: `${cH}px` }}
                        title={`Custos (${formatMonth(d.month)}): ${fmt(d.costs)}`}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Labels */}
              <div className="flex justify-around mt-3">
                {chartData.map(d => {
                  const marg = d.revenue - d.costs;
                  return (
                    <div key={d.month} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-[#D8D8DE]/50 font-medium">{formatMonth(d.month)}</span>
                      {(d.revenue > 0 || d.costs > 0) && (
                        <span className={clsx(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded',
                          marg >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
                        )}>
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
        {/* Interactive Pipeline Funnel */}
        <div className="resona-card overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Funil de Vendas</h3>
            <span className="text-xs font-bold text-[#D8D8DE]/50">{totalDeals} deal{totalDeals !== 1 ? 's' : ''} total</span>
          </div>
          <div className="p-6 flex-1 space-y-3">
            {pipeline.length === 0 ? (
              <p className="text-sm text-[#D8D8DE]/50 text-center py-8">Nenhum deal no pipeline.</p>
            ) : (
              pipeline.map((stage: any) => {
                const pct = totalDeals > 0 ? Math.round((stage.count / totalDeals) * 100) : 0;
                const barWidth = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
                return (
                  <div key={stage.stage} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-[#D8D8DE] group-hover:text-white transition-colors">{stage.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#D8D8DE]/50">{pct}%</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#3F1E6A] to-[#8151D1] rounded-full transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-6 pb-5 border-t border-white/5 pt-4">
            <Link
              to="/pipeline"
              className="text-sm font-bold text-[#8151D1] hover:text-[#D0C8E3] transition-colors flex items-center gap-1.5"
            >
              Ver Pipeline completo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-6">
          {/* Overdue */}
          <div className="resona-card overflow-hidden border-red-500/30">
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center justify-between">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Invoices Atrasadas</h3>
              </div>
              {overdueInvoices.length > 0 && (
                <span className="text-xs font-bold text-red-400">{fmt(overdueInvoices.reduce((s, i) => s + i.amount, 0))}</span>
              )}
            </div>
            <ul className="divide-y divide-white/5">
              {overdueInvoices.map(invoice => (
                <li key={invoice.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="text-sm font-bold text-white">{invoice.company_name}</p>
                    <p className="text-xs text-red-400 mt-1 font-medium">Venceu em {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                  <span className="text-sm font-bold text-white">{fmt(invoice.amount)}</span>
                </li>
              ))}
              {overdueInvoices.length === 0 && (
                <li className="px-6 py-6 text-sm text-[#D8D8DE]/50 text-center">Nenhuma invoice atrasada.</li>
              )}
            </ul>
          </div>

          {/* Due Soon */}
          <div className="resona-card overflow-hidden border-yellow-500/30">
            <div className="px-6 py-4 border-b border-yellow-500/20 bg-yellow-500/10 flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-yellow-400 mr-3" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Vencendo em 7 dias</h3>
              </div>
              {dueSoonInvoices.length > 0 && (
                <span className="text-xs font-bold text-yellow-400">{fmt(dueSoonInvoices.reduce((s, i) => s + i.amount, 0))}</span>
              )}
            </div>
            <ul className="divide-y divide-white/5">
              {dueSoonInvoices.map(invoice => (
                <li key={invoice.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                  <div>
                    <p className="text-sm font-bold text-white">{invoice.company_name}</p>
                    <p className="text-xs text-yellow-400 mt-1 font-medium">Vence em {format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQuickPayHome(invoice)}
                      className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Marcar Pago
                    </button>
                    <span className="text-sm font-bold text-white">{fmt(invoice.amount)}</span>
                  </div>
                </li>
              ))}
              {dueSoonInvoices.length === 0 && (
                <li className="px-6 py-6 text-sm text-[#D8D8DE]/50 text-center">Nenhuma invoice vencendo em breve.</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Pipeline Actions */}
      <div className="resona-card overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#8151D1]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Ações do Pipeline</h3>
          </div>
          <Link to="/pipeline" className="text-xs font-bold text-[#8151D1] hover:text-[#D0C8E3] transition-colors flex items-center gap-1">
            Ver Pipeline <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {overdueActionDeals.length === 0 && upcomingActionDeals.length === 0 ? (
          <p className="text-sm text-[#D8D8DE]/50 text-center py-8">Nenhum deal no pipeline.</p>
        ) : (
          <>
            {/* Overdue actions */}
            {overdueActionDeals.length > 0 && (
              <div>
                <div className="px-6 py-2.5 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Atrasados — {overdueActionDeals.length}</span>
                </div>
                <ul className="divide-y divide-white/5">
                  {overdueActionDeals.map(deal => (
                    <li key={deal.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white truncate">{deal.company_name}</p>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-[#D8D8DE]/60 border border-white/10 flex-shrink-0">
                            {deal.stage}
                          </span>
                        </div>
                        <p className="text-xs text-[#D8D8DE]/70 truncate">{deal.next_action}</p>
                      </div>
                      <span className="ml-4 flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border text-red-400 bg-red-500/10 border-red-500/20">
                        ⚠ {format(parseISO(deal.next_action_date), 'dd/MM')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Upcoming actions */}
            {upcomingActionDeals.length > 0 && (
              <div>
                {overdueActionDeals.length > 0 && (
                  <div className="px-6 py-2.5 bg-white/[0.02] border-b border-white/5">
                    <span className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-wider">Próximas Ações</span>
                  </div>
                )}
                <ul className="divide-y divide-white/5">
                  {upcomingActionDeals.map(deal => {
                    const urgency = dealUrgency(deal.next_action_date);
                    return (
                      <li key={deal.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-white truncate">{deal.company_name}</p>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/5 text-[#D8D8DE]/60 border border-white/10 flex-shrink-0">
                              {deal.stage}
                            </span>
                          </div>
                          <p className="text-xs text-[#D8D8DE]/70 truncate">{deal.next_action}</p>
                        </div>
                        <span className={clsx(
                          'ml-4 flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border',
                          urgency === 'today' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                                              : 'text-[#8151D1] bg-[#8151D1]/10 border-[#8151D1]/20'
                        )}>
                          {urgency === 'today' ? '● ' : ''}{format(parseISO(deal.next_action_date), 'dd/MM')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
