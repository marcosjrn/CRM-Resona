import React, { useState, useEffect } from 'react';
import { Plus, Search, Building2, Phone, Mail, Tag, Activity, Edit2, X, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { Account, Activity as ActivityType } from '../types';

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Lead' | 'Cliente'>('All');
  
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (accountId: string) => {
    try {
      const res = await fetch(`/api/activities/${accountId}`);
      const data = await res.json();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openDetail = (account: Account) => {
    setSelectedAccount(account);
    fetchActivities(account.id);
    setIsDetailModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.company_name.toLowerCase().includes(search.toLowerCase()) || 
                          (acc.contact_name && acc.contact_name.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'All' || acc.type === filterType;
    return matchesSearch && matchesType;
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    
    Object.keys(data).forEach(key => {
      if (data[key] === '') data[key] = null as any;
    });

    try {
      if (editingAccount) {
        await fetch(`/api/accounts/${editingAccount.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setIsFormModalOpen(false);
      setEditingAccount(null);
      fetchAccounts();
      
      if (editingAccount && selectedAccount?.id === editingAccount.id) {
         const res = await fetch(`/api/accounts/${editingAccount.id}`);
         const updatedAccount = await res.json();
         setSelectedAccount(updatedAccount);
         fetchActivities(editingAccount.id);
         setIsDetailModalOpen(true);
      }
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Accounts</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Gerencie seus leads e clientes.</p>
        </div>
        <button
          onClick={() => { setEditingAccount(null); setIsFormModalOpen(true); }}
          className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Novo Account
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between resona-card p-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[#D8D8DE]/50" />
          </div>
          <input
            type="text"
            placeholder="Buscar por empresa ou contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="resona-input block w-full pl-11 pr-4 py-2.5 rounded-xl leading-5 sm:text-sm"
          />
        </div>
        <div className="flex items-center space-x-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setFilterType('All')}
            className={clsx('px-4 py-2 text-sm font-bold rounded-lg transition-all', filterType === 'All' ? 'bg-[#8151D1] text-white shadow-md' : 'text-[#D8D8DE]/70 hover:text-white')}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterType('Lead')}
            className={clsx('px-4 py-2 text-sm font-bold rounded-lg transition-all', filterType === 'Lead' ? 'bg-[#8151D1] text-white shadow-md' : 'text-[#D8D8DE]/70 hover:text-white')}
          >
            Leads
          </button>
          <button
            onClick={() => setFilterType('Cliente')}
            className={clsx('px-4 py-2 text-sm font-bold rounded-lg transition-all', filterType === 'Cliente' ? 'bg-[#8151D1] text-white shadow-md' : 'text-[#D8D8DE]/70 hover:text-white')}
          >
            Clientes
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#D8D8DE]/50">Carregando accounts...</div>
      ) : (
        <div className="resona-card overflow-hidden">
          <ul className="divide-y divide-white/5">
            {filteredAccounts.map((account) => (
              <li key={account.id} className="hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => openDetail(account)}>
                <div className="px-6 py-6 flex items-center justify-between">
                  <div className="flex items-center min-w-0 gap-5">
                    <div className={clsx(
                      "flex-shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-bold border",
                      account.type === 'Cliente' ? 'bg-[#8151D1]/20 text-[#D0C8E3] border-[#8151D1]/30' : 'bg-white/5 text-white border-white/10'
                    )}>
                      {account.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="text-base font-bold text-white truncate">{account.company_name}</p>
                        <span className={clsx(
                          "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          account.type === 'Cliente' ? 'bg-[#8151D1]/20 text-[#D0C8E3] border-[#8151D1]/30' : 'bg-white/5 text-[#D8D8DE] border-white/10'
                        )}>
                          {account.type}
                        </span>
                        {account.status && (
                          <span className={clsx(
                            "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            account.status === 'Ativo' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 
                            account.status === 'Pausado' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
                          )}>
                            {account.status}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-5 text-sm text-[#D8D8DE]/70">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-4 w-4 opacity-70" />
                          {account.segment}
                        </div>
                        {account.contact_name && (
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4 opacity-70" />
                            {account.contact_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-base font-bold text-white">
                      {account.type === 'Cliente' && account.mrr ? (
                        <span className="text-[#8151D1]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(account.mrr)}</span>
                      ) : account.potential_value ? (
                        <span className="text-[#D8D8DE]/60 font-medium text-sm">Potencial: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(account.potential_value)}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-[#D8D8DE]/50 font-medium uppercase tracking-wider">
                      Criado em {format(new Date(account.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {filteredAccounts.length === 0 && (
              <li className="px-6 py-12 text-center text-[#D8D8DE]/50">
                Nenhum account encontrado.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-[#0B0B0F] opacity-90" onClick={() => setIsDetailModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[#131018] border border-white/10 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="px-6 pt-6 pb-6">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-5">
                    <div className={clsx(
                      "flex-shrink-0 h-20 w-20 rounded-2xl flex items-center justify-center text-3xl font-bold border",
                      selectedAccount.type === 'Cliente' ? 'bg-[#8151D1]/20 text-[#D0C8E3] border-[#8151D1]/30' : 'bg-white/5 text-white border-white/10'
                    )}>
                      {selectedAccount.company_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-3xl font-extrabold text-white">{selectedAccount.company_name}</h2>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={clsx(
                          "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                          selectedAccount.type === 'Cliente' ? 'bg-[#8151D1]/20 text-[#D0C8E3] border-[#8151D1]/30' : 'bg-white/5 text-[#D8D8DE] border-white/10'
                        )}>
                          {selectedAccount.type}
                        </span>
                        {selectedAccount.status && (
                          <span className={clsx(
                            "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            selectedAccount.status === 'Ativo' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 
                            selectedAccount.status === 'Pausado' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'
                          )}>
                            {selectedAccount.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(selectedAccount)} className="p-2.5 text-[#D8D8DE]/70 hover:text-[#8151D1] rounded-xl hover:bg-white/5 transition-colors">
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button onClick={() => setIsDetailModalOpen(false)} className="p-2.5 text-[#D8D8DE]/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1 space-y-8">
                    <div>
                      <h3 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-3">Detalhes</h3>
                      <dl className="space-y-4 text-sm">
                        <div>
                          <dt className="text-[#D8D8DE]/70">Segmento</dt>
                          <dd className="font-bold text-white mt-1">{selectedAccount.segment}</dd>
                        </div>
                        <div>
                          <dt className="text-[#D8D8DE]/70">Canal</dt>
                          <dd className="font-bold text-white mt-1">{selectedAccount.acquisition_channel}</dd>
                        </div>
                        {selectedAccount.type === 'Cliente' && selectedAccount.mrr && (
                          <div>
                            <dt className="text-[#D8D8DE]/70">MRR</dt>
                            <dd className="font-bold text-[#8151D1] mt-1 text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedAccount.mrr)}</dd>
                          </div>
                        )}
                        {selectedAccount.type === 'Lead' && selectedAccount.potential_value && (
                          <div>
                            <dt className="text-[#D8D8DE]/70">Valor Potencial</dt>
                            <dd className="font-bold text-[#8151D1] mt-1 text-lg">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedAccount.potential_value)}</dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-3">Contato</h3>
                      <dl className="space-y-4 text-sm">
                        {selectedAccount.contact_name && (
                          <div className="flex items-center gap-3">
                            <Users className="h-4 w-4 text-[#8151D1]" />
                            <dd className="font-medium text-white">{selectedAccount.contact_name}</dd>
                          </div>
                        )}
                        {selectedAccount.contact_email && (
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-[#8151D1]" />
                            <dd className="font-medium text-white">{selectedAccount.contact_email}</dd>
                          </div>
                        )}
                        {selectedAccount.contact_whatsapp && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-[#8151D1]" />
                            <dd className="font-medium text-white">{selectedAccount.contact_whatsapp}</dd>
                          </div>
                        )}
                        {!selectedAccount.contact_name && !selectedAccount.contact_email && !selectedAccount.contact_whatsapp && (
                          <span className="text-[#D8D8DE]/50 italic">Nenhum contato cadastrado.</span>
                        )}
                      </dl>
                    </div>

                    {selectedAccount.notes && (
                      <div>
                        <h3 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-3">Notas</h3>
                        <p className="text-sm text-[#D8D8DE] whitespace-pre-wrap leading-relaxed">{selectedAccount.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-6 border-b border-white/10 pb-3 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#8151D1]" />
                      Timeline de Atividades
                    </h3>
                    
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {activities.map((activity, activityIdx) => (
                          <li key={activity.id}>
                            <div className="relative pb-8">
                              {activityIdx !== activities.length - 1 ? (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-white/10" aria-hidden="true"></span>
                              ) : null}
                              <div className="relative flex space-x-4">
                                <div>
                                  <span className="h-8 w-8 rounded-full bg-[#3F1E6A] flex items-center justify-center ring-4 ring-[#131018]">
                                    <Calendar className="h-4 w-4 text-[#D0C8E3]" aria-hidden="true" />
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                  <div>
                                    <p className="text-sm font-medium text-white">{activity.description}</p>
                                  </div>
                                  <div className="text-right text-xs font-medium text-[#D8D8DE]/50">
                                    {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                        {activities.length === 0 && (
                          <li className="text-sm text-[#D8D8DE]/50 py-4 text-center">Nenhuma atividade registrada.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-[#0B0B0F] opacity-90" onClick={() => setIsFormModalOpen(false)}></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-[#131018] border border-white/10 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <form onSubmit={handleSave}>
                <div className="px-6 pt-6 pb-6">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <h3 className="text-xl font-extrabold text-white mb-6">
                        {editingAccount ? 'Editar Account' : 'Novo Account'}
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Tipo *</label>
                          <select name="type" required defaultValue={editingAccount?.type || 'Lead'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                            <option value="Lead">Lead</option>
                            <option value="Cliente">Cliente</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Empresa *</label>
                          <input type="text" name="company_name" required defaultValue={editingAccount?.company_name} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Segmento *</label>
                          <input type="text" name="segment" required defaultValue={editingAccount?.segment} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Canal de Aquisição *</label>
                          <select name="acquisition_channel" required defaultValue={editingAccount?.acquisition_channel || 'Inbound'} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                            <option value="Indicação">Indicação</option>
                            <option value="Inbound">Inbound</option>
                            <option value="Outbound">Outbound</option>
                            <option value="Comunidade">Comunidade</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>
                        
                        {/* Conditional Fields for Cliente */}
                        <div className="col-span-2 grid grid-cols-2 gap-5 bg-white/[0.02] p-5 rounded-xl border border-white/5 mt-2">
                          <div>
                            <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Status (Cliente)</label>
                            <select name="status" defaultValue={editingAccount?.status || ''} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                              <option value="">Selecione...</option>
                              <option value="Ativo">Ativo</option>
                              <option value="Pausado">Pausado</option>
                              <option value="Encerrado">Encerrado</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Saúde (Cliente)</label>
                            <select name="health" defaultValue={editingAccount?.health || ''} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                              <option value="">Selecione...</option>
                              <option value="Verde">Verde</option>
                              <option value="Amarelo">Amarelo</option>
                              <option value="Vermelho">Vermelho</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">MRR (Cliente)</label>
                            <input type="number" step="0.01" name="mrr" defaultValue={editingAccount?.mrr} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Valor Potencial (Lead)</label>
                            <input type="number" step="0.01" name="potential_value" defaultValue={editingAccount?.potential_value} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                          </div>
                        </div>

                        <div className="col-span-2 mt-4">
                          <h4 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest border-b border-white/10 pb-3 mb-4">Contato</h4>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nome</label>
                          <input type="text" name="contact_name" defaultValue={editingAccount?.contact_name} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Email</label>
                          <input type="email" name="contact_email" defaultValue={editingAccount?.contact_email} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">WhatsApp</label>
                          <input type="text" name="contact_whatsapp" defaultValue={editingAccount?.contact_whatsapp} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                        
                        <div className="col-span-2 mt-2">
                          <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Notas</label>
                          <textarea name="notes" rows={3} defaultValue={editingAccount?.notes} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.02] px-6 py-4 flex flex-row-reverse gap-3 border-t border-white/5">
                  <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setIsFormModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
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
