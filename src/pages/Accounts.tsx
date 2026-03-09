import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Building2, Phone, Mail, Activity, Edit2, X, Calendar, Users, Trash2, Download, Send, MessageCircle, FileText, ArrowRightCircle, Tag, User } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { Account, Activity as ActivityType } from '../types';
import { useToast } from '../components/Toast';
import { apiFetch } from '../utils/api';

export default function Accounts() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOpenIdRef = useRef(searchParams.get('open'));

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Lead' | 'Cliente'>('All');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterSegment, setFilterSegment] = useState<string | null>(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Manual activity
  const [activityType, setActivityType] = useState('Nota');
  const [activityDesc, setActivityDesc] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await apiFetch('/api/accounts');
      if (!res.ok) throw new Error();
      const data: Account[] = await res.json();
      setAccounts(data);
      // Auto-open account from URL param (e.g. navigated from Pipeline)
      if (initialOpenIdRef.current) {
        const acc = data.find(a => a.id === initialOpenIdRef.current);
        if (acc) openDetail(acc);
        initialOpenIdRef.current = null;
        setSearchParams({}, { replace: true });
      }
    } catch {
      toast('Erro ao carregar empresas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async (accountId: string) => {
    try {
      const res = await apiFetch(`/api/activities/${accountId}`);
      if (!res.ok) throw new Error();
      setActivities(await res.json());
    } catch {
      toast('Erro ao carregar atividades', 'error');
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const openDetail = (account: Account) => {
    setSelectedAccount(account);
    setConfirmDelete(false);
    fetchActivities(account.id);
    setIsDetailModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setIsDetailModalOpen(false);
    setIsFormModalOpen(true);
  };

  // Extract all unique tags and segments for the filter cloud
  const allTags = Array.from(new Set(
    accounts.flatMap(a => a.tags ? a.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
  )).sort();
  const allSegments = Array.from(new Set(accounts.map(a => a.segment).filter(Boolean))).sort();

  const filteredAccounts = accounts.filter(acc => {
    const matchesSearch = acc.company_name.toLowerCase().includes(search.toLowerCase()) ||
                          (acc.contact_name && acc.contact_name.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'All' || acc.type === filterType;
    const accTags = acc.tags ? acc.tags.split(',').map(t => t.trim()) : [];
    const matchesTag = !filterTag || accTags.includes(filterTag);
    const matchesSegment = !filterSegment || acc.segment === filterSegment;
    return matchesSearch && matchesType && matchesTag && matchesSegment;
  });

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    Object.keys(data).forEach(key => {
      if (data[key] === '') data[key] = null as any;
    });

    try {
      const res = editingAccount
        ? await apiFetch(`/api/accounts/${editingAccount.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await apiFetch('/api/accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

      if (!res.ok) throw new Error();
      toast(editingAccount ? 'Empresa atualizada com sucesso' : 'Empresa criada com sucesso', 'success');
      setIsFormModalOpen(false);
      setEditingAccount(null);
      fetchAccounts();

      if (editingAccount && selectedAccount?.id === editingAccount.id) {
        const updatedRes = await apiFetch(`/api/accounts/${editingAccount.id}`);
        const updatedAccount = await updatedRes.json();
        setSelectedAccount(updatedAccount);
        fetchActivities(editingAccount.id);
        setIsDetailModalOpen(true);
      }
    } catch {
      toast('Erro ao salvar empresa. Tente novamente.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    try {
      const res = await apiFetch(`/api/accounts/${selectedAccount.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast(`${selectedAccount.company_name} excluída com sucesso`, 'success');
      setIsDetailModalOpen(false);
      setSelectedAccount(null);
      setConfirmDelete(false);
      fetchAccounts();
    } catch {
      toast('Erro ao excluir empresa', 'error');
    }
  };

  const handleConvertToClient = async () => {
    if (!selectedAccount) return;
    try {
      const res = await apiFetch(`/api/accounts/${selectedAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Cliente',
          status: selectedAccount.status || 'Ativo',
          company_name: selectedAccount.company_name,
          segment: selectedAccount.segment,
          acquisition_channel: selectedAccount.acquisition_channel,
          owner: selectedAccount.owner,
          contact_name: selectedAccount.contact_name,
          contact_email: selectedAccount.contact_email,
          contact_whatsapp: selectedAccount.contact_whatsapp,
          notes: selectedAccount.notes,
          tags: selectedAccount.tags,
          health: selectedAccount.health,
          mrr: selectedAccount.mrr,
          potential_value: selectedAccount.potential_value,
        }),
      });
      if (!res.ok) throw new Error();
      toast(`${selectedAccount.company_name} convertido para Cliente!`, 'success');
      fetchAccounts();
      const updatedRes = await apiFetch(`/api/accounts/${selectedAccount.id}`);
      if (updatedRes.ok) setSelectedAccount(await updatedRes.json());
    } catch {
      toast('Erro ao converter lead', 'error');
    }
  };

  const handleAddActivity = async () => {
    if (!selectedAccount || !activityDesc.trim()) return;
    try {
      const res = await apiFetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: selectedAccount.id, type: activityType, description: activityDesc.trim() }),
      });
      if (!res.ok) throw new Error();
      setActivityDesc('');
      fetchActivities(selectedAccount.id);
      toast('Atividade registrada', 'success');
    } catch {
      toast('Erro ao registrar atividade', 'error');
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      const res = await apiFetch(`/api/activities/${activityId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch {
      toast('Erro ao excluir atividade', 'error');
    }
  };

  const exportCSV = () => {
    const headers = ['Tipo', 'Empresa', 'Segmento', 'Canal', 'Status', 'Saúde', 'MRR', 'Valor Potencial', 'Contato', 'Email', 'WhatsApp', 'Criado em'];
    const rows = filteredAccounts.map(a => [
      a.type, a.company_name, a.segment, a.acquisition_channel,
      a.status || '', a.health || '',
      a.mrr || '', a.potential_value || '',
      a.contact_name || '', a.contact_email || '', a.contact_whatsapp || '',
      format(new Date(a.created_at), 'dd/MM/yyyy'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'empresas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Empresas</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Gerencie seus leads e clientes.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="px-5 py-2.5 text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl shadow-lg inline-flex items-center"
          >
            <Download className="-ml-1 mr-2 h-5 w-5" />
            Exportar CSV
          </button>
          <button
            onClick={() => { setEditingAccount(null); setIsFormModalOpen(true); }}
            className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Nova Empresa
          </button>
        </div>
      </div>

      <div className="resona-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
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
            {(['All', 'Lead', 'Cliente'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={clsx('px-4 py-2 text-sm font-bold rounded-lg transition-all', filterType === t ? 'bg-[#8151D1] text-white shadow-md' : 'text-[#D8D8DE]/70 hover:text-white')}>
                {t === 'All' ? 'Todos' : t + 's'}
              </button>
            ))}
          </div>
        </div>

        {/* Tags & Segments clickable filter */}
        {(allTags.length > 0 || allSegments.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/5">
            {filterTag || filterSegment ? (
              <button
                onClick={() => { setFilterTag(null); setFilterSegment(null); }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <X className="h-3 w-3" /> Limpar filtros
              </button>
            ) : null}
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={clsx(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border',
                  filterTag === tag
                    ? 'bg-[#8151D1]/30 text-white border-[#8151D1]/50'
                    : 'text-[#D8D8DE]/60 bg-white/5 border-white/10 hover:bg-[#8151D1]/10 hover:text-[#D0C8E3] hover:border-[#8151D1]/20'
                )}
              >
                <Tag className="h-2.5 w-2.5" />{tag}
              </button>
            ))}
            {allSegments.map(seg => (
              <button
                key={seg}
                onClick={() => setFilterSegment(filterSegment === seg ? null : seg)}
                className={clsx(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border',
                  filterSegment === seg
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'text-[#D8D8DE]/60 bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:text-cyan-300 hover:border-cyan-500/20'
                )}
              >
                <Building2 className="h-2.5 w-2.5" />{seg}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#D8D8DE]/50">Carregando empresas...</div>
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
                      <div className="flex items-center gap-3 flex-wrap">
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
                        {account.health && (
                          <span className={clsx(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border',
                            account.health === 'Verde' ? 'bg-green-500/10 text-green-300 border-green-500/20' :
                            account.health === 'Amarelo' ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20' :
                            'bg-red-500/10 text-red-300 border-red-500/20'
                          )}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full',
                              account.health === 'Verde' ? 'bg-green-400' :
                              account.health === 'Amarelo' ? 'bg-yellow-400' : 'bg-red-400'
                            )} />
                            {account.health}
                          </span>
                        )}
                        {account.latest_deal_stage && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold border bg-[#8151D1]/10 text-[#D0C8E3]/80 border-[#8151D1]/20">
                            <ArrowRightCircle className="h-3 w-3" />
                            {account.latest_deal_stage}
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
                        {account.owner && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-4 w-4 opacity-70" />
                            {account.owner}
                          </div>
                        )}
                        {account.latest_deal_next_action_date && (
                          <div className="flex items-center gap-1.5 text-[#D8D8DE]/50">
                            <Calendar className="h-3.5 w-3.5 opacity-70" />
                            Próx. ação: {format(new Date(account.latest_deal_next_action_date + 'T12:00:00'), 'dd/MM/yyyy')}
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
                Nenhuma empresa encontrada.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => { setIsDetailModalOpen(false); setConfirmDelete(false); }}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl overflow-y-auto max-h-[90vh]">
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
                      {selectedAccount.health && (
                        <span className={clsx(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                          selectedAccount.health === 'Verde' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                          selectedAccount.health === 'Amarelo' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' :
                          'bg-red-500/20 text-red-300 border-red-500/30'
                        )}>
                          <span className={clsx('w-1.5 h-1.5 rounded-full',
                            selectedAccount.health === 'Verde' ? 'bg-green-400' :
                            selectedAccount.health === 'Amarelo' ? 'bg-yellow-400' : 'bg-red-400'
                          )} />
                          {selectedAccount.health}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  {selectedAccount.type === 'Lead' && (
                    <button
                      onClick={handleConvertToClient}
                      className="px-3 py-2 text-xs font-bold text-[#8151D1] hover:text-white hover:bg-[#8151D1] rounded-xl transition-colors border border-[#8151D1]/40 flex items-center gap-1.5"
                      title="Converter para Cliente"
                    >
                      <ArrowRightCircle className="h-4 w-4" />
                      Converter para Cliente
                    </button>
                  )}
                  {confirmDelete ? (
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Confirmar exclusão
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="p-2.5 text-red-400/60 hover:text-red-400 rounded-xl hover:bg-red-500/10 transition-colors"
                      title="Excluir empresa"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                  <button onClick={() => openEdit(selectedAccount)} className="p-2.5 text-[#D8D8DE]/70 hover:text-[#8151D1] rounded-xl hover:bg-white/5 transition-colors">
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button onClick={() => { setIsDetailModalOpen(false); setConfirmDelete(false); }} className="p-2.5 text-[#D8D8DE]/70 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
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
                      {selectedAccount.owner && (
                        <div>
                          <dt className="text-[#D8D8DE]/70 flex items-center gap-1.5"><User className="h-3 w-3" /> Responsável</dt>
                          <dd className="font-bold text-white mt-1">{selectedAccount.owner}</dd>
                        </div>
                      )}
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
                      {selectedAccount.tags && (
                        <div>
                          <dt className="text-[#D8D8DE]/70 flex items-center gap-1.5"><Tag className="h-3 w-3" /> Tags</dt>
                          <dd className="mt-2 flex flex-wrap gap-1.5">
                            {selectedAccount.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                              <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#8151D1]/10 text-[#D0C8E3] border border-[#8151D1]/20">
                                {tag}
                              </span>
                            ))}
                          </dd>
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
                  <h3 className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#8151D1]" />
                    Timeline de Atividades
                  </h3>

                  {/* Manual activity entry */}
                  <div className="mb-6 bg-white/[0.02] rounded-xl border border-white/5 p-4">
                    <p className="text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-3">Registrar Atividade</p>
                    <div className="flex gap-2 mb-2">
                      <select
                        value={activityType}
                        onChange={(e) => setActivityType(e.target.value)}
                        className="resona-input py-2 px-3 rounded-xl text-sm w-36 flex-shrink-0"
                      >
                        <option value="Reunião">Reunião</option>
                        <option value="Ligação">Ligação</option>
                        <option value="Email">Email</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Proposta">Proposta</option>
                        <option value="Nota">Nota</option>
                        <option value="Outro">Outro</option>
                      </select>
                      <input
                        type="text"
                        value={activityDesc}
                        onChange={(e) => setActivityDesc(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddActivity(); }}
                        placeholder="Descreva a atividade..."
                        className="resona-input flex-1 py-2 px-3 rounded-xl text-sm"
                      />
                      <button
                        onClick={handleAddActivity}
                        disabled={!activityDesc.trim()}
                        className="resona-btn px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flow-root">
                    <ul className="-mb-8">
                      {activities.map((activity, activityIdx) => {
                        const iconMap: Record<string, React.ReactNode> = {
                          'Reunião': <Users className="h-4 w-4 text-[#D0C8E3]" />,
                          'Ligação': <Phone className="h-4 w-4 text-[#D0C8E3]" />,
                          'Email': <Mail className="h-4 w-4 text-[#D0C8E3]" />,
                          'WhatsApp': <MessageCircle className="h-4 w-4 text-[#D0C8E3]" />,
                          'Proposta': <FileText className="h-4 w-4 text-[#D0C8E3]" />,
                          'Nota': <FileText className="h-4 w-4 text-[#D0C8E3]" />,
                        };
                        const icon = iconMap[activity.type] ?? <Calendar className="h-4 w-4 text-[#D0C8E3]" />;
                        return (
                          <li key={activity.id}>
                            <div className="relative pb-8">
                              {activityIdx !== activities.length - 1 ? (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-white/10" aria-hidden="true"></span>
                              ) : null}
                              <div className="relative flex space-x-4 group/activity">
                                <div>
                                  <span className="h-8 w-8 rounded-full bg-[#3F1E6A] flex items-center justify-center ring-4 ring-[#131018]">
                                    {icon}
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                  <div>
                                    {activity.type && !['account_created', 'account_updated', 'deal_created', 'deal_stage_changed', 'invoice_created', 'cost_created'].includes(activity.type) && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30 mr-2">
                                        {activity.type}
                                      </span>
                                    )}
                                    <p className="text-sm font-medium text-white inline">{activity.description}</p>
                                  </div>
                                  <div className="text-right flex items-start gap-2 flex-shrink-0">
                                    <span className="text-xs font-medium text-[#D8D8DE]/50">
                                      {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm")}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteActivity(activity.id)}
                                      className="opacity-0 group-hover/activity:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all rounded"
                                      title="Excluir atividade"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
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
      )}

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => setIsFormModalOpen(false)}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl overflow-y-auto max-h-[90vh]">
            <form onSubmit={handleSave}>
              <div className="px-6 pt-6 pb-6">
                <h3 className="text-xl font-extrabold text-white mb-6">
                  {editingAccount ? 'Editar Empresa' : 'Nova Empresa'}
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
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nome da Empresa *</label>
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

                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Responsável</label>
                    <input type="text" name="owner" defaultValue={editingAccount?.owner || ''} placeholder="Nome do responsável" className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                  </div>

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
                      <input type="number" step="0.01" min="0" name="mrr" defaultValue={editingAccount?.mrr} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Valor Potencial (Lead)</label>
                      <input type="number" step="0.01" min="0" name="potential_value" defaultValue={editingAccount?.potential_value} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
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

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Tags <span className="font-normal normal-case text-[#D8D8DE]/40">(separadas por vírgula)</span></label>
                    <input type="text" name="tags" defaultValue={editingAccount?.tags} placeholder="ex: upsell, vip, churn-risk" className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" />
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
      )}
    </div>
  );
}
