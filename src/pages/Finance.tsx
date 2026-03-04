import { useState, useEffect } from 'react';
import { Plus, Filter, FileText, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Invoice, Cost, Account } from '../types';

export default function Finance() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'costs'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [clientFilter, setClientFilter] = useState('All');
  
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editingCost, setEditingCost] = useState<Cost | null>(null);

  const fetchData = async () => {
    try {
      const [invoicesRes, costsRes, accountsRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/costs'),
        fetch('/api/accounts')
      ]);
      
      const invoicesData = await invoicesRes.json();
      const costsData = await costsRes.json();
      const accountsData = await accountsRes.json();
      
      setInvoices(invoicesData);
      setCosts(costsData);
      setAccounts(accountsData.filter((a: Account) => a.type === 'Cliente'));
    } catch (error) {
      console.error('Error fetching finance data:', error);
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

    try {
      if (editingInvoice) {
        await fetch(`/api/invoices/${editingInvoice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setIsInvoiceModalOpen(false);
      setEditingInvoice(null);
      fetchData();
    } catch (error) {
      console.error('Error saving invoice:', error);
    }
  };

  const handleSaveCost = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    if (data.account_id === '') data.account_id = null as any;

    try {
      if (editingCost) {
        await fetch(`/api/costs/${editingCost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/costs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setIsCostModalOpen(false);
      setEditingCost(null);
      fetchData();
    } catch (error) {
      console.error('Error saving cost:', error);
    }
  };

  const filteredInvoices = invoices.filter(i => 
    (monthFilter ? i.competence_month === monthFilter : true) &&
    (clientFilter !== 'All' ? i.account_id === clientFilter : true)
  );

  const filteredCosts = costs.filter(c => 
    (monthFilter ? c.competence_month === monthFilter : true) &&
    (clientFilter !== 'All' ? c.account_id === clientFilter : true)
  );

  const totalInvoices = filteredInvoices.reduce((sum, i) => sum + i.amount, 0);
  const totalCosts = filteredCosts.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Financeiro</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Controle de faturamento e custos operacionais.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingCost(null); setIsCostModalOpen(true); }}
            className="px-5 py-2.5 text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl shadow-lg inline-flex items-center"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Novo Custo
          </button>
          <button
            onClick={() => { setEditingInvoice(null); setIsInvoiceModalOpen(true); }}
            className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nova Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="resona-card p-6 flex flex-col sm:flex-row gap-6 items-center justify-between">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#D8D8DE]/50" />
            <span className="text-sm font-bold text-[#D8D8DE]/70 uppercase tracking-wider">Filtros:</span>
          </div>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="resona-input block w-40 py-2.5 px-4 rounded-xl text-sm"
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="resona-input block w-48 py-2.5 px-4 rounded-xl text-sm"
          >
            <option value="All">Todos os Clientes</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.company_name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-4 text-sm font-bold">
          <div className="text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
            Receitas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvoices)}
          </div>
          <div className="text-red-400 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
            Custos: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalCosts)}
          </div>
          <div className={clsx("px-4 py-2 rounded-xl border", (totalInvoices - totalCosts) >= 0 ? "text-white bg-white/5 border-white/10" : "text-red-400 bg-red-500/10 border-red-500/20")}>
            Saldo: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInvoices - totalCosts)}
          </div>
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
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Mês</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Vencimento</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Valor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { setEditingInvoice(invoice); setIsInvoiceModalOpen(true); }}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">{invoice.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{invoice.competence_month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{format(new Date(invoice.due_date), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        invoice.status === 'Pago' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                        invoice.status === 'Pendente' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                        'bg-red-500/20 text-red-300 border-red-500/30'
                      )}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#D8D8DE]/50">Nenhuma invoice encontrada para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Categoria</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Cliente (Opcional)</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Mês</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Valor</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-transparent">
                {filteredCosts.map((cost) => (
                  <tr key={cost.id} className="hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => { setEditingCost(cost); setIsCostModalOpen(true); }}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white/5 text-[#D8D8DE] border border-white/10">
                        {cost.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{cost.company_name || <span className="text-[#D8D8DE]/30 italic">Geral</span>}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]">{cost.competence_month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-400">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cost.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#D8D8DE]/70 truncate max-w-xs">{cost.notes || '-'}</td>
                  </tr>
                ))}
                {filteredCosts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#D8D8DE]/50">Nenhum custo encontrado para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-[#0B0B0F] opacity-90" onClick={() => setIsInvoiceModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[#131018] border border-white/10 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Mês de Competência *</label>
                        <input type="month" name="competence_month" required defaultValue={editingInvoice?.competence_month || monthFilter} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Data de Vencimento *</label>
                        <input type="date" name="due_date" required defaultValue={editingInvoice?.due_date} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Valor (R$) *</label>
                        <input type="number" step="0.01" name="amount" required defaultValue={editingInvoice?.amount} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
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
                      <input type="date" name="paid_date" defaultValue={editingInvoice?.paid_date} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex flex-row-reverse gap-3 border-t border-white/5">
                  <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Cost Modal */}
      {isCostModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-[#0B0B0F] opacity-90" onClick={() => setIsCostModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[#131018] border border-white/10 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                      <input type="number" step="0.01" name="amount" required defaultValue={editingCost?.amount} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Notas</label>
                      <textarea name="notes" rows={2} defaultValue={editingCost?.notes} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex flex-row-reverse gap-3 border-t border-white/5">
                  <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setIsCostModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
