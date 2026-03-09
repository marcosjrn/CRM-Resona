import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calendar, Trash2, X, Check, GripVertical, Search, ExternalLink, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { Deal, Account } from '../types';
import { useToast } from '../components/Toast';
import { apiFetch } from '../utils/api';
import DatePicker from '../components/DatePicker';

const DEFAULT_STAGES = ['Novo', 'Qualificação', 'Diagnóstico agendado', 'Proposta enviada', 'Negociação', 'Ganhou', 'Perdido'];

export default function Pipeline() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Dynamic stages
  const [stages, setStages] = useState<string[]>(DEFAULT_STAGES);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [confirmDeleteStage, setConfirmDeleteStage] = useState<string | null>(null);
  const newStageInputRef = useRef<HTMLInputElement>(null);

  // Inline rename
  const [renamingStage, setRenamingStage] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const renameConfirmedRef = useRef(false);

  // Card drag & drop
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Column drag & drop (reorder)
  const [draggedStageIdx, setDraggedStageIdx] = useState<number | null>(null);
  const [dragOverStageIdx, setDragOverStageIdx] = useState<number | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Reagendar mini modal
  const [reagendandoDeal, setReagendandoDeal] = useState<Deal | null>(null);

  // Motivo de Perda modal
  const [pendingLossDeal, setPendingLossDeal] = useState<{ deal: Deal; targetStage: string } | null>(null);
  const [lossReason, setLossReason] = useState('Preço');
  const [lossNotes, setLossNotes] = useState('');

  const saveStages = async (newStages: string[]) => {
    setStages(newStages);
    try {
      await apiFetch('/api/pipeline/stages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: newStages }),
      });
    } catch {
      toast('Erro ao salvar etapas', 'error');
    }
  };

  const fetchData = async () => {
    try {
      const [dealsRes, accountsRes, stagesRes] = await Promise.all([
        apiFetch('/api/deals'),
        apiFetch('/api/accounts'),
        apiFetch('/api/pipeline/stages'),
      ]);
      if (!dealsRes.ok || !accountsRes.ok) throw new Error();
      const dealsData = await dealsRes.json();
      const accountsData = await accountsRes.json();
      setDeals(dealsData);
      setAccounts(accountsData.filter((a: Account) => a.type === 'Lead'));
      if (stagesRes.ok) {
        const contentType = stagesRes.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const stagesData = await stagesRes.json();
          if (Array.isArray(stagesData) && stagesData.length > 0) setStages(stagesData);
        } else {
          console.warn('Resposta inválida em /api/pipeline/stages');
        }
      }
    } catch {
      toast('Erro ao carregar pipeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (addingStage) newStageInputRef.current?.focus();
  }, [addingStage]);

  useEffect(() => {
    if (renamingStage) {
      renameInputRef.current?.focus();
      renameConfirmedRef.current = false;
    }
  }, [renamingStage]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    if (!data.next_action_date) { toast('Selecione a data da próxima ação', 'error'); return; }

    try {
      const res = editingDeal
        ? await apiFetch(`/api/deals/${editingDeal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          })
        : await apiFetch('/api/deals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

      if (!res.ok) throw new Error();
      toast(editingDeal ? 'Deal atualizado' : 'Deal criado', 'success');
      setIsModalOpen(false);
      setEditingDeal(null);
      setConfirmDelete(false);
      fetchData();
    } catch {
      toast('Erro ao salvar deal', 'error');
    }
  };

  const handleDelete = async () => {
    if (!editingDeal) return;
    try {
      const res = await apiFetch(`/api/deals/${editingDeal.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast('Deal excluído', 'success');
      setIsModalOpen(false);
      setEditingDeal(null);
      setConfirmDelete(false);
      fetchData();
    } catch {
      toast('Erro ao excluir deal', 'error');
    }
  };

  const moveDeal = async (dealId: string, newStage: string) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    // Intercept "Perdido" stages
    if (newStage.toLowerCase().includes('perdido')) {
      setPendingLossDeal({ deal, targetStage: newStage });
      return;
    }
    setDeals(deals.map(d => d.id === dealId ? { ...d, stage: newStage } : d));
    try {
      const res = await apiFetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deal, stage: newStage }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast('Erro ao mover deal', 'error');
      fetchData();
    }
  };

  const handleConfirmLoss = async () => {
    if (!pendingLossDeal) return;
    const { deal, targetStage } = pendingLossDeal;
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: targetStage } : d));
    setPendingLossDeal(null);
    try {
      const res = await apiFetch(`/api/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...deal, stage: targetStage, loss_reason: lossReason, loss_notes: lossNotes }),
      });
      if (!res.ok) throw new Error();
      toast('Deal marcado como Perdido', 'success');
    } catch {
      toast('Erro ao mover deal', 'error');
      fetchData();
    }
    setLossReason('Preço');
    setLossNotes('');
  };

  const handleReagendar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reagendandoDeal) return;
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    if (!data.next_action_date) { toast('Selecione a data', 'error'); return; }
    try {
      const res = await apiFetch(`/api/deals/${reagendandoDeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reagendandoDeal, next_action: data.next_action, next_action_date: data.next_action_date }),
      });
      if (!res.ok) throw new Error();
      toast('Deal reagendado com sucesso', 'success');
      setReagendandoDeal(null);
      fetchData();
    } catch {
      toast('Erro ao reagendar deal', 'error');
    }
  };

  // Stage management
  const addStage = () => {
    const name = newStageName.trim();
    if (!name) { setAddingStage(false); return; }
    if (stages.includes(name)) { toast('Etapa já existe', 'error'); return; }
    const updated = [...stages, name];
    saveStages(updated);
    setNewStageName('');
    setAddingStage(false);
    toast(`Etapa "${name}" criada`, 'success');
  };

  const deleteStage = async (stage: string) => {
    const stageDeals = deals.filter(d => d.stage === stage);
    if (stageDeals.length > 0) {
      try {
        await Promise.all(stageDeals.map(d => apiFetch(`/api/deals/${d.id}`, { method: 'DELETE' })));
        toast(`${stageDeals.length} deal(s) excluído(s)`, 'success');
      } catch {
        toast('Erro ao excluir deals da etapa', 'error');
        setConfirmDeleteStage(null);
        return;
      }
    }
    const updated = stages.filter(s => s !== stage);
    saveStages(updated);
    setConfirmDeleteStage(null);
    fetchData();
    toast(`Etapa "${stage}" excluída`, 'success');
  };

  const confirmRename = async () => {
    const oldName = renamingStage;
    const newName = renameValue.trim();
    setRenamingStage(null);
    if (!oldName || !newName || newName === oldName) return;
    if (stages.includes(newName)) { toast('Etapa já existe', 'error'); return; }

    const newStages = stages.map(s => s === oldName ? newName : s);
    saveStages(newStages);

    const affectedDeals = deals.filter(d => d.stage === oldName);
    if (affectedDeals.length > 0) {
      try {
        await Promise.all(affectedDeals.map(d =>
          apiFetch(`/api/deals/${d.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...d, stage: newName }),
          })
        ));
        setDeals(deals.map(d => d.stage === oldName ? { ...d, stage: newName } : d));
      } catch {
        toast('Erro ao renomear etapa', 'error');
        fetchData();
        return;
      }
    }
    toast(`Etapa renomeada para "${newName}"`, 'success');
  };

  // Card DnD
  const onCardDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/card-id', dealId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedDealId(dealId);
  };

  // Column DnD (reorder)
  const onColDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('text/stage-idx', String(idx));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedStageIdx(idx);
  };

  const onColumnDragOver = (e: React.DragEvent, stage: string, idx: number) => {
    if (e.dataTransfer.types.includes('text/stage-idx')) {
      e.preventDefault();
      setDragOverStageIdx(idx);
    } else if (e.dataTransfer.types.includes('text/card-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverStage(stage);
    }
  };

  const onColumnDragLeave = () => {
    setDragOverStage(null);
    setDragOverStageIdx(null);
  };

  const onColumnDrop = (e: React.DragEvent, stage: string, idx: number) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('text/stage-idx')) {
      const fromIdx = parseInt(e.dataTransfer.getData('text/stage-idx'));
      if (fromIdx !== idx) {
        const newStages = [...stages];
        const [removed] = newStages.splice(fromIdx, 1);
        newStages.splice(idx, 0, removed);
        saveStages(newStages);
        toast('Ordem das etapas atualizada', 'success');
      }
      setDraggedStageIdx(null);
      setDragOverStageIdx(null);
    } else if (e.dataTransfer.types.includes('text/card-id')) {
      const dealId = e.dataTransfer.getData('text/card-id');
      moveDeal(dealId, stage);
      setDraggedDealId(null);
      setDragOverStage(null);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col space-y-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Pipeline</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">
            Arraste cards entre colunas · Arraste o header para reordenar · Duplo clique no nome para renomear
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D8D8DE]/40 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar deals..."
              className="resona-input pl-9 pr-4 py-2.5 rounded-xl text-sm w-48"
            />
          </div>
          <button
            onClick={() => { setEditingDeal(null); setConfirmDelete(false); setIsModalOpen(true); }}
            className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Novo Deal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#D8D8DE]/50">Carregando pipeline...</div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 h-full" style={{ minWidth: `${(stages.length + 1) * 292}px` }}>
            {stages.map((stage, idx) => {
              const q = searchQuery.toLowerCase();
              const stageDeals = deals.filter(d =>
                d.stage === stage &&
                (!q || d.company_name?.toLowerCase().includes(q) || d.next_action?.toLowerCase().includes(q))
              );
              const isDragOver = dragOverStage === stage;
              const isDragOverCol = dragOverStageIdx === idx && draggedStageIdx !== null;
              const isDraggedCol = draggedStageIdx === idx;
              const isConfirmingDelete = confirmDeleteStage === stage;

              return (
                <div
                  key={stage}
                  className={clsx(
                    'w-72 flex flex-col rounded-2xl border overflow-hidden flex-shrink-0 transition-all duration-150',
                    isDraggedCol
                      ? 'opacity-40 scale-[0.97] border-white/10 bg-[#131018]/50'
                      : isDragOver
                      ? 'border-[#8151D1]/60 bg-[#8151D1]/10 shadow-[0_0_20px_rgba(129,81,209,0.2)]'
                      : isDragOverCol
                      ? 'border-[#8151D1]/40 bg-[#8151D1]/5 shadow-[0_0_12px_rgba(129,81,209,0.15)]'
                      : 'bg-[#131018]/50 border-white/5'
                  )}
                  onDragOver={(e) => onColumnDragOver(e, stage, idx)}
                  onDragLeave={onColumnDragLeave}
                  onDrop={(e) => onColumnDrop(e, stage, idx)}
                >
                  {/* Column header — draggable to reorder */}
                  <div
                    className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between group/header cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => onColDragStart(e, idx)}
                    onDragEnd={() => { setDraggedStageIdx(null); setDragOverStageIdx(null); }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GripVertical className="h-4 w-4 text-white/20 group-hover/header:text-white/50 flex-shrink-0 transition-colors" />
                      {renamingStage === stage ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { renameConfirmedRef.current = true; confirmRename(); }
                            if (e.key === 'Escape') { renameConfirmedRef.current = true; setRenamingStage(null); }
                          }}
                          onBlur={() => { if (!renameConfirmedRef.current) confirmRename(); }}
                          className="resona-input text-xs font-bold uppercase tracking-wider py-0.5 px-2 rounded-lg flex-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h3
                          className="text-xs font-bold text-white uppercase tracking-wider truncate hover:text-[#D0C8E3] transition-colors select-none"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setRenamingStage(stage);
                            setRenameValue(stage);
                          }}
                          title="Duplo clique para renomear"
                        >
                          {stage}
                        </h3>
                      )}
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#8151D1]/20 text-[#D0C8E3] border border-[#8151D1]/30 flex-shrink-0">
                        {stageDeals.length}
                      </span>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-red-400 mr-1 font-bold">Excluir?</span>
                          <button onClick={() => deleteStage(stage)} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors" title="Confirmar">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDeleteStage(null)} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteStage(stage)}
                          className="p-1.5 text-white/0 group-hover/header:text-white/20 hover:!text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Excluir etapa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-[80px]">
                    {stageDeals.map(deal => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={(e) => onCardDragStart(e, deal.id)}
                        onDragEnd={() => { setDraggedDealId(null); setDragOverStage(null); }}
                        onClick={() => { if (!draggedDealId) { setEditingDeal(deal); setConfirmDelete(false); setIsModalOpen(true); } }}
                        className={clsx(
                          'resona-card p-4 hover:border-[#8151D1]/50 transition-all cursor-grab active:cursor-grabbing group select-none',
                          draggedDealId === deal.id && 'opacity-40 scale-95'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <h4 className="text-sm font-bold text-white leading-tight">{deal.company_name}</h4>
                          <GripVertical className="h-4 w-4 text-white/20 group-hover:text-white/40 flex-shrink-0 mt-0.5 transition-colors" />
                        </div>
                        <div className="border-t border-white/5 pt-3">
                          <p className="text-[10px] font-bold text-[#D8D8DE]/50 uppercase tracking-widest mb-1">Próxima ação</p>
                          <p className="text-xs text-[#D8D8DE] line-clamp-2">{deal.next_action}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center text-xs font-medium text-[#8151D1] bg-[#8151D1]/10 px-2 py-1 rounded-lg border border-[#8151D1]/20">
                              <Calendar className="h-3 w-3 mr-1" />
                              {format(new Date(deal.next_action_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-all">
                              <button
                                onClick={(e) => { e.stopPropagation(); setReagendandoDeal(deal); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#D8D8DE]/50 hover:text-[#D0C8E3] transition-colors"
                                title="Reagendar"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Reagendar
                              </button>
                              <span className="text-white/20 text-[10px]">·</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/accounts?open=${deal.account_id}`); }}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#8151D1] hover:text-[#D0C8E3] transition-colors"
                                title="Ver empresa"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver empresa
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {stageDeals.length === 0 && (
                      <div className={clsx(
                        'h-16 rounded-xl border-2 border-dashed flex items-center justify-center transition-colors',
                        isDragOver ? 'border-[#8151D1]/60 bg-[#8151D1]/5' : 'border-white/5'
                      )}>
                        <p className="text-xs text-white/20">Solte aqui</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add stage */}
            <div className="w-72 flex-shrink-0">
              {addingStage ? (
                <div className="bg-[#131018]/80 border border-[#8151D1]/40 rounded-2xl p-4">
                  <p className="text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-3">Nova Etapa</p>
                  <input
                    ref={newStageInputRef}
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addStage(); if (e.key === 'Escape') { setAddingStage(false); setNewStageName(''); } }}
                    placeholder="Nome da etapa..."
                    className="resona-input block w-full py-2 px-3 rounded-xl text-sm mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={addStage} className="resona-btn flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Criar
                    </button>
                    <button onClick={() => { setAddingStage(false); setNewStageName(''); }} className="flex-1 py-2 rounded-xl text-xs font-bold text-white/70 bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingStage(true)}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-white/10 hover:border-[#8151D1]/40 hover:bg-[#8151D1]/5 transition-all flex flex-col items-center justify-center gap-2 text-white/30 hover:text-[#8151D1]"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Nova Etapa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reagendar Modal */}
      {reagendandoDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => setReagendandoDeal(null)}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm">
            <form onSubmit={handleReagendar}>
              <div className="px-6 pt-6 pb-6">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-[#8151D1]" />
                  <h3 className="text-lg font-extrabold text-white">Reagendar</h3>
                </div>
                <p className="text-sm text-[#D8D8DE]/60 mb-5">{reagendandoDeal.company_name}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Próxima Ação *</label>
                    <input type="text" name="next_action" required defaultValue={reagendandoDeal.next_action} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: Reunião de diagnóstico" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nova Data *</label>
                    <DatePicker name="next_action_date" required defaultValue={reagendandoDeal.next_action_date} placeholder="Selecione a data..." />
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] px-6 py-4 flex justify-end gap-3 border-t border-white/5">
                <button type="button" onClick={() => setReagendandoDeal(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                  Cancelar
                </button>
                <button type="submit" className="resona-btn px-5 py-2.5 rounded-xl text-sm font-bold">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Motivo de Perda Modal */}
      {pendingLossDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => setPendingLossDeal(null)}></div>
          <div className="relative z-10 bg-[#131018] border border-red-500/20 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-6">
              <h3 className="text-lg font-extrabold text-white mb-1">Motivo de Perda</h3>
              <p className="text-sm text-[#D8D8DE]/60 mb-5">{pendingLossDeal.deal.company_name}</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Motivo *</label>
                  <select
                    value={lossReason}
                    onChange={(e) => setLossReason(e.target.value)}
                    className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm"
                  >
                    <option value="Preço">Preço</option>
                    <option value="Concorrência">Concorrência</option>
                    <option value="Timing">Timing</option>
                    <option value="Sem fit">Sem fit</option>
                    <option value="Sem resposta">Sem resposta</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Observações <span className="font-normal normal-case text-[#D8D8DE]/40">(opcional)</span></label>
                  <textarea
                    value={lossNotes}
                    onChange={(e) => setLossNotes(e.target.value)}
                    rows={3}
                    className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm"
                    placeholder="Detalhes sobre a perda..."
                  />
                </div>
              </div>
            </div>
            <div className="bg-white/[0.02] px-6 py-4 flex justify-end gap-3 border-t border-white/5">
              <button type="button" onClick={() => setPendingLossDeal(null)} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
                Cancelar
              </button>
              <button
                onClick={handleConfirmLoss}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => { setIsModalOpen(false); setConfirmDelete(false); }}></div>
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
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
                    <select name="stage" required defaultValue={editingDeal?.stage || stages[0]} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                      {stages.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Próxima Ação *</label>
                    <input type="text" name="next_action" required defaultValue={editingDeal?.next_action} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: Reunião de diagnóstico" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Data da Próxima Ação *</label>
                    <DatePicker
                      name="next_action_date"
                      required
                      defaultValue={editingDeal?.next_action_date}
                      placeholder="Selecione a data..."
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] px-6 py-4 flex items-center justify-between border-t border-white/5">
                {editingDeal && (
                  <div>
                    {confirmDelete ? (
                      <button type="button" onClick={handleDelete} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Confirmar exclusão
                      </button>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center gap-2 border border-red-500/20">
                        <Trash2 className="h-4 w-4" /> Excluir
                      </button>
                    )}
                  </div>
                )}
                <div className={clsx('flex gap-3', !editingDeal && 'ml-auto')}>
                  <button type="button" onClick={() => { setIsModalOpen(false); setConfirmDelete(false); }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
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
