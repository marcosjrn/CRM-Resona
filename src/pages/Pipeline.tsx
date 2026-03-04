import { useState, useEffect } from 'react';
import { Plus, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Deal, DealStage, Account } from '../types';

const STAGES: DealStage[] = [
  'Novo',
  'Qualificação',
  'Diagnóstico agendado',
  'Proposta enviada',
  'Negociação',
  'Ganhou',
  'Perdido'
];

export default function Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  const fetchData = async () => {
    try {
      const [dealsRes, accountsRes] = await Promise.all([
        fetch('/api/deals'),
        fetch('/api/accounts')
      ]);
      const dealsData = await dealsRes.json();
      const accountsData = await accountsRes.json();
      
      setDeals(dealsData);
      setAccounts(accountsData.filter((a: Account) => a.type === 'Lead'));
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (editingDeal) {
        await fetch(`/api/deals/${editingDeal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/deals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setIsModalOpen(false);
      setEditingDeal(null);
      fetchData();
    } catch (error) {
      console.error('Error saving deal:', error);
    }
  };

  const moveDeal = async (dealId: string, newStage: DealStage) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;

    // Optimistic update
    setDeals(deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d));

    try {
      await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deal, stage: newStage }),
      });
      fetchData(); // Refresh to ensure sync
    } catch (error) {
      console.error('Error moving deal:', error);
      fetchData(); // Revert on error
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col space-y-8">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Pipeline</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Acompanhe e mova seus leads pelo funil.</p>
        </div>
        <button
          onClick={() => { setEditingDeal(null); setIsModalOpen(true); }}
          className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Novo Deal
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#D8D8DE]/50">Carregando pipeline...</div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-6 h-full min-w-max">
            {STAGES.map(stage => {
              const stageDeals = deals.filter(d => d.stage === stage);
              return (
                <div key={stage} className="w-80 flex flex-col bg-[#131018]/50 rounded-2xl border border-white/5 overflow-hidden flex-shrink-0">
                  <div className="px-4 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{stage}</h3>
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {stageDeals.map(deal => (
                      <div 
                        key={deal.id} 
                        className="resona-card p-4 hover:border-[#8151D1]/50 transition-colors cursor-pointer group"
                        onClick={() => { setEditingDeal(deal); setIsModalOpen(true); }}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-base font-bold text-white leading-tight">{deal.company_name}</h4>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            {STAGES.indexOf(stage) < STAGES.length - 1 && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); moveDeal(deal.id, STAGES[STAGES.indexOf(stage) + 1]); }}
                                className="p-1.5 text-[#D8D8DE]/50 hover:text-[#8151D1] rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                title="Mover para próximo estágio"
                              >
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <p className="text-[10px] font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-1">Próxima ação:</p>
                          <p className="text-sm text-[#D8D8DE] line-clamp-2">{deal.next_action}</p>
                          <div className="mt-3 flex items-center text-xs font-medium text-[#8151D1] bg-[#8151D1]/10 px-2.5 py-1.5 rounded-lg w-fit border border-[#8151D1]/20">
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />
                            {format(new Date(deal.next_action_date), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-[#0B0B0F] opacity-90" onClick={() => setIsModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[#131018] border border-white/10 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSave}>
                <div className="px-6 pt-6 pb-6">
                  <h3 className="text-xl font-extrabold text-white mb-6">
                    {editingDeal ? 'Editar Deal' : 'Novo Deal'}
                  </h3>
                  
                  <div className="space-y-5">
                    {!editingDeal && (
                      <div>
                        <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Lead *</label>
                        <select name="account_id" required className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                          <option value="">Selecione um lead...</option>
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.company_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Estágio *</label>
                      <select name="stage" required defaultValue={editingDeal?.stage || 'Novo'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                        {STAGES.map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Próxima Ação *</label>
                      <input type="text" name="next_action" required defaultValue={editingDeal?.next_action} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: Reunião de diagnóstico" />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Data da Próxima Ação *</label>
                      <input type="date" name="next_action_date" required defaultValue={editingDeal?.next_action_date} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex flex-row-reverse gap-3 border-t border-white/5">
                  <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
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
