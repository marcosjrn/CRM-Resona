import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Trello, DollarSign, AlertCircle, Calendar } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Invoice } from '../types';

export default function Home() {
  const [stats, setStats] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, invoicesRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/invoices')
        ]);
        
        const statsData = await statsRes.json();
        const invoicesData = await invoicesRes.json();
        
        setStats(statsData);
        setInvoices(invoicesData);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-center text-[#D8D8DE]/50">Carregando...</div>;

  const today = new Date();
  const next7Days = addDays(today, 7);
  
  const overdueInvoices = invoices.filter(i => i.status === 'Atrasado' || (i.status === 'Pendente' && isBefore(new Date(i.due_date), today)));
  const dueSoonInvoices = invoices.filter(i => i.status === 'Pendente' && isAfter(new Date(i.due_date), today) && isBefore(new Date(i.due_date), next7Days));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Hoje</h1>
        <div className="text-sm text-[#D8D8DE]/70 font-medium uppercase tracking-wider">
          {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="resona-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#D8D8DE]/70 uppercase tracking-widest">Clientes Ativos</h3>
            <Users className="h-5 w-5 text-[#8151D1]" />
          </div>
          <p className="mt-4 text-4xl font-bold text-white">{stats?.activeClients || 0}</p>
        </div>
        
        <div className="resona-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#D8D8DE]/70 uppercase tracking-widest">Leads em Aberto</h3>
            <Trello className="h-5 w-5 text-[#8151D1]" />
          </div>
          <p className="mt-4 text-4xl font-bold text-white">{stats?.openLeads || 0}</p>
        </div>

        <div className="resona-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#D8D8DE]/70 uppercase tracking-widest">MRR (Mês)</h3>
            <DollarSign className="h-5 w-5 text-[#8151D1]" />
          </div>
          <p className="mt-4 text-3xl font-bold text-[#8151D1]">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.financials?.mrr || 0)}
          </p>
        </div>

        <div className="resona-card p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#D8D8DE]/70 uppercase tracking-widest">Margem (Mês)</h3>
            <DollarSign className="h-5 w-5 text-[#D8D8DE]/50" />
          </div>
          <p className="mt-4 text-3xl font-bold text-white">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats?.financials?.margin || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Snapshot */}
        <div className="resona-card overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pipeline Snapshot</h3>
          </div>
          <div className="p-6 flex-1">
            <div className="space-y-5">
              {stats?.pipeline?.map((stage: any) => (
                <div key={stage.stage} className="flex items-center justify-between group">
                  <span className="text-sm font-medium text-[#D8D8DE] group-hover:text-white transition-colors">{stage.stage}</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30">
                    {stage.count}
                  </span>
                </div>
              ))}
              {(!stats?.pipeline || stats.pipeline.length === 0) && (
                <p className="text-sm text-[#D8D8DE]/50 text-center py-4">Nenhum deal no pipeline.</p>
              )}
            </div>
            <div className="mt-8 pt-6 border-t border-white/5">
              <Link to="/pipeline" className="text-sm font-bold text-[#8151D1] hover:text-[#D0C8E3] transition-colors flex items-center">
                Ver Pipeline completo <span className="ml-2">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Alerts & Tasks */}
        <div className="space-y-6">
          {/* Overdue */}
          <div className="resona-card overflow-hidden border-red-500/30">
            <div className="px-6 py-4 border-b border-red-500/20 bg-red-500/10 flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Invoices Atrasadas</h3>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-white/5">
                {overdueInvoices.map(invoice => (
                  <li key={invoice.id} className="px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{invoice.company_name}</p>
                      <p className="text-xs text-red-400 mt-1.5 font-medium">Venceu em {format(new Date(invoice.due_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                    </div>
                  </li>
                ))}
                {overdueInvoices.length === 0 && (
                  <li className="px-6 py-6 text-sm text-[#D8D8DE]/50 text-center">Nenhuma invoice atrasada.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Due Soon */}
          <div className="resona-card overflow-hidden border-yellow-500/30">
            <div className="px-6 py-4 border-b border-yellow-500/20 bg-yellow-500/10 flex items-center">
              <Calendar className="h-5 w-5 text-yellow-400 mr-3" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Vencendo em 7 dias</h3>
            </div>
            <div className="p-0">
              <ul className="divide-y divide-white/5">
                {dueSoonInvoices.map(invoice => (
                  <li key={invoice.id} className="px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div>
                      <p className="text-sm font-bold text-white">{invoice.company_name}</p>
                      <p className="text-xs text-yellow-400 mt-1.5 font-medium">Vence em {format(new Date(invoice.due_date), 'dd/MM/yyyy')}</p>
                    </div>
                    <div className="text-sm font-bold text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
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
      </div>
    </div>
  );
}
