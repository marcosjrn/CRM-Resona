import { useState, useEffect } from 'react';
import { Plus, Filter, FileText, CreditCard, Trash2, Download, CheckCircle } from 'lucide-react';
import { format, addMonths, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import { Invoice, Cost, Account, RevenueType } from '../types';
import { useToast } from '../components/Toast';
import { apiFetch } from '../utils/api';
import DatePicker from '../components/DatePicker';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

// Derives invoice status from data (ignores manually stored status)
const computeStatus = (invoice: Invoice): 'Pago' | 'Pendente' | 'Atrasado' => {
  if (invoice.paid_date) return 'Pago';
  if (new Date(invoice.due_date + 'T00:00:00') < new Date()) return 'Atrasado';
  return 'Pendente';
};

const normalizeRevenueType = (invoice: Invoice): RevenueType =>
  invoice.revenue_type === 'Implementacao' ? 'Implementacao' : 'Mensalidade';

const revenueTypeLabel = (type: RevenueType): string =>
  type === 'Implementacao' ? 'Implementação' : 'Mensalidade';

export default function Finance() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'invoices' | 'costs'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [clientFilter, setClientFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pago' | 'Pendente' | 'Atrasado'>('All');
  const [revenueTypeFilter, setRevenueTypeFilter] = useState<'All' | RevenueType>('All');

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState(false);
  const [confirmDeleteCost, setConfirmDeleteCost] = useState(false);

  const [invoiceRecurring, setInvoiceRecurring] = useState(false);
  const [invoiceRecurringMonths, setInvoiceRecurringMonths] = useState(3);
  const [costRecurring, setCostRecurring] = useState(false);
  const [costRecurringMonths, setCostRecurringMonths] = useState(3);

  const shiftMonth = (yearMonth: string, n: number): string => {
    const [y, m] = yearMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const shiftDate = (dateStr: string, n: number): string =>
    format(addMonths(parseISO(dateStr), n), 'yyyy-MM-dd');

  const fetchData = async () => {
    try {
      const [invoicesRes, costsRes, accountsRes] = await Promise.all([
        apiFetch('/api/invoices'),
        apiFetch('/api/costs'),
        apiFetch('/api/accounts')
      ]);

      if (!invoicesRes.ok || !costsRes.ok || !accountsRes.ok) {
        throw new Error('Falha ao carregar dados');
      }

      setInvoices(await invoicesRes.json());
      setCosts(await costsRes.json());
      const accountsData = await accountsRes.json();
      setAccounts(accountsData.filter((a: Account) => a.type === 'Cliente'));
    } catch (error) {
      toast('Erro ao carregar dados financeiros', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    if (!data.due_date) {
      toast('Selecione uma data de vencimento', 'error');
      return;
    }

    try {
      if (!editingInvoice && invoiceRecurring && invoiceRecurringMonths > 1) {
        const requests = Array.from({ length: invoiceRecurringMonths }, (_, i) =>
          apiFetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              competence_month: shiftMonth(data.competence_month as string, i),
              due_date: shiftDate(data.due_date as string, i),
              status: 'Pendente',
              paid_date: '',
            }),
          })
        );
        await Promise.all(requests);
        toast(`${invoiceRecurringMonths} invoices criadas com sucesso`, 'success');
      } else {
        const res = editingInvoice
          ? await apiFetch(`/api/invoices/${editingInvoice.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
          : await apiFetch('/api/invoices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
        if (!res.ok) throw new Error();
        toast(editingInvoice ? 'Invoice atualizada com sucesso' : 'Invoice criada com sucesso', 'success');
      }
      setIsInvoiceModalOpen(false);
      setEditingInvoice(null);
      setConfirmDeleteInvoice(false);
      setInvoiceRecurring(false);
      setInvoiceRecurringMonths(3);
      fetchData();
    } catch {
      toast('Erro ao salvar invoice. Tente novamente.', 'error');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!editingInvoice) return;
    try {
      const res = await apiFetch(`/api/invoices/${editingInvoice.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('Invoice excluída', 'success');
      setIsInvoiceModalOpen(false);
      setEditingInvoice(null);
      setConfirmDeleteInvoice(false);
      fetchData();
    } catch {
      toast('Erro ao excluir invoice', 'error');
    }
  };

  const handleSaveCost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    if (data.account_id === '') data.account_id = null as any;

    try {
      if (!editingCost && costRecurring && costRecurringMonths > 1) {
        const requests = Array.from({ length: costRecurringMonths }, (_, i) =>
          apiFetch('/api/costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...data,
              competence_month: shiftMonth(data.competence_month as string, i),
            }),
          })
        );
        await Promise.all(requests);
        toast(`${costRecurringMonths} custos criados com sucesso`, 'success');
      } else {
        const res = editingCost
          ? await apiFetch(`/api/costs/${editingCost.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })
          : await apiFetch('/api/costs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
        if (!res.ok) throw new Error();
        toast(editingCost ? 'Custo atualizado com sucesso' : 'Custo criado com sucesso', 'success');
      }
      setIsCostModalOpen(false);
      setEditingCost(null);
      setConfirmDeleteCost(false);
      setCostRecurring(false);
      setCostRecurringMonths(3);
      fetchData();
    } catch {
      toast('Erro ao salvar custo. Tente novamente.', 'error');
    }
  };

  const handleDeleteCost = async () => {
    if (!editingCost) return;
    try {
      const res = await apiFetch(`/api/costs/${editingCost.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('Custo excluído', 'success');
      setIsCostModalOpen(false);
      setEditingCost(null);
      setConfirmDeleteCost(false);
      fetchData();
    } catch {
      toast('Erro ao excluir custo', 'error');
    }
  };

  const handleQuickPay = async (invoice: Invoice) => {
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

  const exportFinanceCSV = () => {
    if (activeTab === 'invoices') {
      const headers = ['Cliente', 'Tipo Receita', 'Mês', 'Vencimento', 'Valor', 'Status', 'Data Pagamento'];
      const rows = filteredInvoices.map(i => [
        i.company_name || '', revenueTypeLabel(normalizeRevenueType(i)), i.competence_month,
        format(new Date(i.due_date + 'T12:00:00'), 'dd/MM/yyyy'),
        i.amount, i.status,
        i.paid_date ? format(new Date(i.paid_date + 'T12:00:00'), 'dd/MM/yyyy') : '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'invoices.csv'; a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Nome', 'Categoria', 'Mês', 'Valor', 'Cliente', 'Notas'];
      const rows = filteredCosts.map(c => [
        c.name || '', c.category, c.competence_month, c.amount, c.company_name || '', c.notes || '',
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'custos.csv'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const baseFilteredInvoices = invoices.filter(i =>
    (monthFilter ? i.competence_month === monthFilter : true) &&
    (clientFilter !== 'All' ? i.account_id === clientFilter : true) &&
    (revenueTypeFilter !== 'All' ? normalizeRevenueType(i) === revenueTypeFilter : true)
  );

  const filteredInvoices = baseFilteredInvoices.filter(i =>
    statusFilter === 'All' ? true : computeStatus(i) === statusFilter
  );

  const filteredCosts = costs.filter(c =>
    (monthFilter ? c.competence_month === monthFilter : true) &&
    (clientFilter !== 'All' ? c.account_id === clientFilter : true)
  );

  const totalCosts = filteredCosts.reduce((sum, c) => sum + c.amount, 0);
  const totalPago = baseFilteredInvoices.filter(i => computeStatus(i) === 'Pago').reduce((sum, i) => sum + i.amount, 0);
  const totalPendente = baseFilteredInvoices.filter(i => computeStatus(i) === 'Pendente').reduce((sum, i) => sum + i.amount, 0);
  const totalAtrasado = baseFilteredInvoices.filter(i => computeStatus(i) === 'Atrasado').reduce((sum, i) => sum + i.amount, 0);
  const totalMensalidadePago = baseFilteredInvoices
    .filter(i => computeStatus(i) === 'Pago' && normalizeRevenueType(i) === 'Mensalidade')
    .reduce((sum, i) => sum + i.amount, 0);
  const totalImplementacaoPago = baseFilteredInvoices
    .filter(i => computeStatus(i) === 'Pago' && normalizeRevenueType(i) === 'Implementacao')
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Financeiro</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Controle de faturamento e custos operacionais.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportFinanceCSV}
            className="px-5 py-2.5 text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl shadow-lg inline-flex items-center"
          >
            <Download className="-ml-1 mr-2 h-5 w-5" />
            Exportar CSV
          </button>
          <button
            onClick={() => { setEditingCost(null); setConfirmDeleteCost(false); setCostRecurring(false); setCostRecurringMonths(3); setIsCostModalOpen(true); }}
            className="px-5 py-2.5 text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl shadow-lg inline-flex items-center"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Novo Custo
          </button>
          <button
            onClick={() => { setEditingInvoice(null); setConfirmDeleteInvoice(false); setInvoiceRecurring(false); setInvoiceRecurringMonths(3); setIsInvoiceModalOpen(true); }}
            className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nova Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="resona-card p-5 space-y-4">
        {/* Row 1: Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-1">
            <Filter className="h-4 w-4 text-[#D8D8DE]/50" />
            <span className="text-xs font-bold text-[#D8D8DE]/60 uppercase tracking-wider">Filtros:</span>
          </div>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="resona-input py-2 px-3 rounded-xl text-sm w-40"
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="resona-input py-2 px-3 rounded-xl text-sm w-48"
          >
            <option value="All">Todos os Clientes</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.company_name}</option>
            ))}
          </select>
          {activeTab === 'invoices' && (
            <select
              value={revenueTypeFilter}
              onChange={(e) => setRevenueTypeFilter(e.target.value as 'All' | RevenueType)}
              className="resona-input py-2 px-3 rounded-xl text-sm w-44"
            >
              <option value="All">Todas Receitas</option>
              <option value="Mensalidade">Mensalidade</option>
              <option value="Implementacao">Implementação</option>
            </select>
          )}
          {activeTab === 'invoices' && (
            <div className="flex gap-1.5 ml-1">
              {(['All', 'Pendente', 'Atrasado', 'Pago'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border',
                    statusFilter === s
                      ? s === 'All' ? 'bg-white/10 text-white border-white/20'
                        : s === 'Pago' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : s === 'Pendente' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                        : 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'text-[#D8D8DE]/50 border-white/5 hover:border-white/15 hover:text-[#D8D8DE]/80'
                  )}
                >
                  {s === 'All' ? 'Todas' : s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row 2: Totais */}
        <div className="flex flex-wrap gap-2 text-xs font-bold pt-3 border-t border-white/5">
          {activeTab === 'invoices' ? (
            <>
              <div className="text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                ✓ Pago: {fmt(totalPago)}
              </div>
              <div className="text-cyan-300 bg-cyan-500/10 px-3 py-2 rounded-xl border border-cyan-500/20">
                Mensalidade: {fmt(totalMensalidadePago)}
              </div>
              <div className="text-indigo-300 bg-indigo-500/10 px-3 py-2 rounded-xl border border-indigo-500/20">
                Implementação: {fmt(totalImplementacaoPago)}
              </div>
              {totalPendente > 0 && (
                <div className="text-yellow-400 bg-yellow-500/10 px-3 py-2 rounded-xl border border-yellow-500/20">
                  Pendente: {fmt(totalPendente)}
                </div>
              )}
              {totalAtrasado > 0 && (
                <div className="text-red-400 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                  Atrasado: {fmt(totalAtrasado)}
                </div>
              )}
              <div className="text-red-400 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                Custos: {fmt(totalCosts)}
              </div>
              <div className={clsx('px-3 py-2 rounded-xl border', (totalPago - totalCosts) >= 0 ? 'text-white bg-white/5 border-white/10' : 'text-red-400 bg-red-500/10 border-red-500/20')}>
                Saldo real: {fmt(totalPago - totalCosts)}
              </div>
            </>
          ) : (
            <div className="text-red-400 bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
              Total custos: {fmt(totalCosts)}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('invoices')}
            className={clsx(
              activeTab === 'invoices'
                ? 'border-[#8151D1] text-[#8151D1]'
                : 'border-transparent text-[#D8D8DE]/50 hover:text-[#D8D8DE]/80 hover:border-white/10',
              'whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors'
            )}
          >
            <FileText className="h-4 w-4" />
            Invoices
          </button>
          <button
            onClick={() => setActiveTab('costs')}
            className={clsx(
              activeTab === 'costs'
                ? 'border-[#8151D1] text-[#8151D1]'
                : 'border-transparent text-[#D8D8DE]/50 hover:text-[#D8D8DE]/80 hover:border-white/10',
              'whitespace-nowrap py-4 px-1 border-b-2 font-bold text-sm flex items-center gap-2 transition-colors'
            )}
          >
            <CreditCard className="h-4 w-4" />
            Custos
          </button>
        </nav>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#D8D8DE]/50">Carregando financeiro...</div>
      ) : (
        <div className="resona-card overflow-hidden">
          {activeTab === 'invoices' ? (
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Cliente</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Tipo Receita</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Mês</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Vencimento</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Valor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Status</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Pago em</th>
                  <th scope="col" className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors group" onClick={() => { setEditingInvoice(invoice); setConfirmDeleteInvoice(false); setIsInvoiceModalOpen(true); }}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">{invoice.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={clsx(
                        "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        normalizeRevenueType(invoice) === 'Mensalidade'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      )}>
                        {revenueTypeLabel(normalizeRevenueType(invoice))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{invoice.competence_month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{format(new Date(invoice.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const s = computeStatus(invoice);
                        return (
                          <span className={clsx(
                            "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            s === 'Pago' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                            s === 'Pendente' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                            'bg-red-500/20 text-red-300 border-red-500/30'
                          )}>
                            {s}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]/60">
                      {invoice.paid_date ? format(new Date(invoice.paid_date + 'T12:00:00'), 'dd/MM/yyyy') : <span className="text-[#D8D8DE]/25">—</span>}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {computeStatus(invoice) !== 'Pago' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickPay(invoice); }}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                          title="Marcar como pago"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Marcar Pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-[#D8D8DE]/50">Nenhuma invoice encontrada para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Nome</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Categoria</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Mês</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Valor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Cliente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {filteredCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { setEditingCost(cost); setConfirmDeleteCost(false); setIsCostModalOpen(true); }}>
                    <td className="px-6 py-4 text-sm font-bold text-white max-w-xs truncate">{cost.name || <span className="text-[#D8D8DE]/30 italic">—</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[#D8D8DE] border border-white/10">
                        {cost.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{cost.competence_month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cost.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{cost.company_name || <span className="text-[#D8D8DE]/30 italic">Geral</span>}</td>
                  </tr>
                ))}
                {filteredCosts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#D8D8DE]/50">Nenhum custo encontrado para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => { setIsInvoiceModalOpen(false); setConfirmDeleteInvoice(false); }}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSaveInvoice}>
                <div className="px-6 pt-6 pb-6">
                  <h3 className="text-xl font-extrabold text-white mb-6">
                    {editingInvoice ? 'Editar Invoice' : 'Nova Invoice'}
                  </h3>

                  <div className="space-y-5">
                    {!editingInvoice && (
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Cliente *</label>
                        <select name="account_id" required className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                          <option value="">Selecione um cliente...</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.company_name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Tipo de Receita *</label>
                        <select name="revenue_type" required defaultValue={editingInvoice ? normalizeRevenueType(editingInvoice) : 'Mensalidade'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                          <option value="Mensalidade">Mensalidade</option>
                          <option value="Implementacao">Implementação</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Mês de Competência *</label>
                        <input type="month" name="competence_month" required defaultValue={editingInvoice?.competence_month || monthFilter} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Data de Vencimento *</label>
                        <DatePicker name="due_date" required defaultValue={editingInvoice?.due_date} placeholder="Selecione..." />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Valor (R$) *</label>
                        <input type="number" step="0.01" min="0.01" name="amount" required defaultValue={editingInvoice?.amount} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Status *</label>
                        <select name="status" required defaultValue={editingInvoice?.status || 'Pendente'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                          <option value="Pendente">Pendente</option>
                          <option value="Pago">Pago</option>
                          <option value="Atrasado">Atrasado</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Data de Pagamento</label>
                      <DatePicker name="paid_date" defaultValue={editingInvoice?.paid_date} placeholder="Selecione (opcional)..." />
                    </div>

                    {!editingInvoice && (
                      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={invoiceRecurring}
                            onChange={e => setInvoiceRecurring(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#8151D1] cursor-pointer"
                          />
                          <span className="text-sm font-bold text-white">Recorrente</span>
                          <span className="text-xs text-[#D8D8DE]/50">— cria a invoice para os próximos meses automaticamente</span>
                        </label>
                        {invoiceRecurring && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-xs text-[#D8D8DE]/60">Repetir por</span>
                            <input
                              type="number"
                              min={2}
                              max={24}
                              value={invoiceRecurringMonths}
                              onChange={e => setInvoiceRecurringMonths(Math.max(2, Math.min(24, Number(e.target.value))))}
                              className="resona-input w-20 py-2 px-3 rounded-lg text-sm text-center"
                            />
                            <span className="text-xs text-[#D8D8DE]/60">meses consecutivos</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex items-center justify-between border-t border-white/5">
                  {editingInvoice && (
                    <div>
                      {confirmDeleteInvoice ? (
                        <button type="button" onClick={handleDeleteInvoice} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Confirmar exclusão
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteInvoice(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 border border-red-500/20">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                  <div className={clsx("flex gap-3", !editingInvoice && "ml-auto")}>
                    <button type="button" onClick={() => { setIsInvoiceModalOpen(false); setConfirmDeleteInvoice(false); setInvoiceRecurring(false); setInvoiceRecurringMonths(3); }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                      Cancelar
                    </button>
                    <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                      Salvar
                    </button>
                  </div>
                </div>
              </form>
          </div>
        </div>
      )}

      {/* Cost Modal */}
      {isCostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => { setIsCostModalOpen(false); setConfirmDeleteCost(false); }}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
              <form onSubmit={handleSaveCost}>
                <div className="px-6 pt-6 pb-6">
                  <h3 className="text-xl font-extrabold text-white mb-6">
                    {editingCost ? 'Editar Custo' : 'Novo Custo'}
                  </h3>

                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Categoria *</label>
                        <select name="category" required defaultValue={editingCost?.category || 'Ferramentas'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                          <option value="Ferramentas">Ferramentas</option>
                          <option value="Terceiros">Terceiros</option>
                          <option value="Mídia">Mídia</option>
                          <option value="Horas">Horas</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Mês de Competência *</label>
                        <input type="month" name="competence_month" required defaultValue={editingCost?.competence_month || monthFilter} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nome do Custo *</label>
                      <input type="text" name="name" required defaultValue={editingCost?.name} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: Assinatura Notion, Freelancer João..." />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Cliente (Opcional)</label>
                      <select name="account_id" defaultValue={editingCost?.account_id || ''} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                        <option value="">Custo Geral (Sem cliente específico)</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>{acc.company_name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Valor (R$) *</label>
                      <input type="number" step="0.01" min="0.01" name="amount" required defaultValue={editingCost?.amount} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Notas</label>
                      <textarea name="notes" rows={2} defaultValue={editingCost?.notes} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>

                    {!editingCost && (
                      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={costRecurring}
                            onChange={e => setCostRecurring(e.target.checked)}
                            className="w-4 h-4 rounded accent-[#8151D1] cursor-pointer"
                          />
                          <span className="text-sm font-bold text-white">Recorrente</span>
                          <span className="text-xs text-[#D8D8DE]/50">— replica o custo para os próximos meses</span>
                        </label>
                        {costRecurring && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-xs text-[#D8D8DE]/60">Repetir por</span>
                            <input
                              type="number"
                              min={2}
                              max={24}
                              value={costRecurringMonths}
                              onChange={e => setCostRecurringMonths(Math.max(2, Math.min(24, Number(e.target.value))))}
                              className="resona-input w-20 py-2 px-3 rounded-lg text-sm text-center"
                            />
                            <span className="text-xs text-[#D8D8DE]/60">meses consecutivos</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex items-center justify-between border-t border-white/5">
                  {editingCost && (
                    <div>
                      {confirmDeleteCost ? (
                        <button type="button" onClick={handleDeleteCost} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Confirmar exclusão
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDeleteCost(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 border border-red-500/20">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                  <div className={clsx("flex gap-3", !editingCost && "ml-auto")}>
                    <button type="button" onClick={() => { setIsCostModalOpen(false); setConfirmDeleteCost(false); setCostRecurring(false); setCostRecurringMonths(3); }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                      Cancelar
                    </button>
                    <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                      Salvar
                    </button>
                  </div>
                </div>
              </form>
          </div>
        </div>
      )}
    </div>
  );
}
