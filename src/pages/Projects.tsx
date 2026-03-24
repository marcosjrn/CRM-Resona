import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, FolderOpen, CheckSquare, AlertTriangle, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { Project, ProjectTask, ProjectStatus, Account } from '../types';
import { apiFetch } from '../utils/api';
import { useToast } from '../components/Toast';
import { v4 as uuidv4 } from 'uuid';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  'Planejamento': { label: 'Planejamento', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  'Em andamento': { label: 'Em andamento', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  'Concluído':    { label: 'Concluído',    color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  'Pausado':      { label: 'Pausado',      color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  'Cancelado':    { label: 'Cancelado',    color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const ALL_STATUSES: ProjectStatus[] = ['Planejamento', 'Em andamento', 'Concluído', 'Pausado', 'Cancelado'];

function parseProject(raw: Record<string, unknown>): Project {
  let tasks: ProjectTask[] = [];
  try { tasks = JSON.parse(String(raw.tasks || '[]')); } catch { tasks = []; }
  return { ...raw, tasks } as Project;
}

function isOverdue(project: Project): boolean {
  if (!project.deadline || project.status === 'Concluído' || project.status === 'Cancelado') return false;
  return project.deadline < new Date().toISOString().slice(0, 10);
}

function Progress({ tasks }: { tasks: ProjectTask[] }) {
  if (tasks.length === 0) return <span className="text-xs text-[#D8D8DE]/40">Sem tarefas</span>;
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : 'bg-[#8151D1]')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[#D8D8DE]/60 tabular-nums whitespace-nowrap">{done}/{tasks.length}</span>
    </div>
  );
}

export default function Projects() {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'Todos'>('Todos');
  const [clientFilter, setClientFilter] = useState('Todos');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Modal form fields
  const [formAccountId, setFormAccountId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<ProjectStatus>('Planejamento');
  const [formOwner, setFormOwner] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formTasks, setFormTasks] = useState<ProjectTask[]>([]);
  const [formNotes, setFormNotes] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const [projRes, accRes] = await Promise.all([
        apiFetch('/api/projects').then(r => r.json()),
        apiFetch('/api/accounts').then(r => r.json()),
      ]);
      setProjects((projRes as Record<string, unknown>[]).map(parseProject));
      setAccounts((accRes as Account[]).filter(a => a.type === 'Cliente'));
    } catch {
      showToast('Erro ao carregar projetos', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function openCreateModal() {
    setEditingProject(null);
    setFormAccountId(accounts[0]?.id ?? '');
    setFormName('');
    setFormDescription('');
    setFormStatus('Planejamento');
    setFormOwner('');
    setFormStartDate('');
    setFormDeadline('');
    setFormTasks([]);
    setFormNotes('');
    setNewTaskTitle('');
    setIsModalOpen(true);
  }

  function openEditModal(p: Project) {
    setEditingProject(p);
    setFormAccountId(p.account_id);
    setFormName(p.name);
    setFormDescription(p.description ?? '');
    setFormStatus(p.status);
    setFormOwner(p.owner ?? '');
    setFormStartDate(p.start_date ?? '');
    setFormDeadline(p.deadline ?? '');
    setFormTasks(p.tasks.map(t => ({ ...t })));
    setFormNotes(p.notes ?? '');
    setNewTaskTitle('');
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingProject(null);
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    setFormTasks(prev => [...prev, { id: uuidv4(), title, done: false }]);
    setNewTaskTitle('');
  }

  function toggleTask(id: string) {
    setFormTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function removeTask(id: string) {
    setFormTasks(prev => prev.filter(t => t.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formAccountId || !formName.trim()) return;
    const payload = {
      account_id: formAccountId,
      name: formName.trim(),
      description: formDescription.trim() || null,
      status: formStatus,
      owner: formOwner.trim() || null,
      start_date: formStartDate || null,
      deadline: formDeadline || null,
      tasks: JSON.stringify(formTasks),
      notes: formNotes.trim() || null,
    };
    try {
      if (editingProject) {
        await apiFetch(`/api/projects/${editingProject.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showToast('Projeto atualizado', 'success');
      } else {
        await apiFetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        showToast('Projeto criado', 'success');
      }
      closeModal();
      fetchData();
    } catch {
      showToast('Erro ao salvar projeto', 'error');
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      showToast('Projeto excluído', 'success');
      setConfirmDeleteId(null);
      fetchData();
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  const filtered = projects.filter(p => {
    if (statusFilter !== 'Todos' && p.status !== statusFilter) return false;
    if (clientFilter !== 'Todos' && p.account_id !== clientFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.company_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-[#D8D8DE]/40 focus:outline-none focus:border-[#8151D1]/50 focus:ring-1 focus:ring-[#8151D1]/30";
  const labelClass = "block text-xs font-bold text-[#D8D8DE]/60 uppercase tracking-wider mb-1";

  return (
    <div className="animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Projetos</h1>
          <p className="text-sm text-[#D8D8DE]/50 mt-1">{projects.length} projeto{projects.length !== 1 ? 's' : ''} no total</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#8151D1] hover:bg-[#9063e0] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-[0_0_20px_rgba(129,81,209,0.3)]"
        >
          <Plus className="h-4 w-4" />
          Novo Projeto
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#D8D8DE]/40" />
          <input
            type="text"
            placeholder="Buscar projeto ou cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#D8D8DE]/40 focus:outline-none focus:border-[#8151D1]/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ProjectStatus | 'Todos')}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8151D1]/50"
        >
          <option value="Todos">Todos os status</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8151D1]/50"
        >
          <option value="Todos">Todos os clientes</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#D8D8DE]/40 text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#D8D8DE]/40">
          <FolderOpen className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">{projects.length === 0 ? 'Nenhum projeto criado ainda.' : 'Nenhum projeto encontrado com os filtros aplicados.'}</p>
        </div>
      ) : (
        <div className="bg-[#131018] border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#D8D8DE]/40 uppercase tracking-wider">Projeto</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#D8D8DE]/40 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#D8D8DE]/40 uppercase tracking-wider w-36">Progresso</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#D8D8DE]/40 uppercase tracking-wider">Deadline</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-[#D8D8DE]/40 uppercase tracking-wider">Responsável</th>
                <th className="px-5 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => {
                const cfg = STATUS_CONFIG[p.status];
                const overdue = isOverdue(p);
                return (
                  <tr
                    key={p.id}
                    className={clsx('border-b border-white/5 hover:bg-white/[0.02] transition-colors', i === filtered.length - 1 && 'border-b-0')}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{p.name}</p>
                          {p.description && <p className="text-xs text-[#D8D8DE]/50 mt-0.5 line-clamp-1">{p.description}</p>}
                          <span className={clsx('inline-flex items-center mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border', cfg.color, cfg.bg)}>
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-[#D8D8DE]/80">{p.company_name}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Progress tasks={p.tasks} />
                    </td>
                    <td className="px-5 py-4">
                      {p.deadline ? (
                        <div className={clsx('flex items-center gap-1.5', overdue ? 'text-red-400' : 'text-[#D8D8DE]/70')}>
                          {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          <span className="text-xs font-medium">
                            {format(new Date(p.deadline + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#D8D8DE]/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-[#D8D8DE]/70">{p.owner || '—'}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-2 text-[#D8D8DE]/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className={clsx(
                            'p-2 rounded-lg transition-colors text-xs font-bold',
                            confirmDeleteId === p.id
                              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 px-3'
                              : 'text-[#D8D8DE]/40 hover:text-red-400 hover:bg-red-500/10'
                          )}
                          title="Excluir"
                          onBlur={() => setConfirmDeleteId(null)}
                        >
                          {confirmDeleteId === p.id ? 'Confirmar' : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#131018] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl custom-scrollbar">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-lg font-bold text-white">{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</h2>
              <button onClick={closeModal} className="p-2 text-[#D8D8DE]/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name + Client */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nome do Projeto *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex: Implementação ERP"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Cliente *</label>
                  <select
                    required
                    value={formAccountId}
                    onChange={e => setFormAccountId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione um cliente</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.company_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Status + Owner */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as ProjectStatus)} className={inputClass}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Responsável</label>
                  <input
                    type="text"
                    value={formOwner}
                    onChange={e => setFormOwner(e.target.value)}
                    placeholder="Nome do responsável"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Data de Início</label>
                  <input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Deadline</label>
                  <input type="date" value={formDeadline} onChange={e => setFormDeadline(e.target.value)} className={inputClass} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Descrição</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Breve descrição do projeto..."
                  className={clsx(inputClass, 'resize-none')}
                />
              </div>

              {/* Tasks */}
              <div>
                <label className={clsx(labelClass, 'flex items-center gap-2')}>
                  <CheckSquare className="h-3.5 w-3.5" />
                  Tarefas
                  {formTasks.length > 0 && (
                    <span className="text-[#8151D1]">
                      {formTasks.filter(t => t.done).length}/{formTasks.length}
                    </span>
                  )}
                </label>
                <div className="space-y-1.5 mb-2">
                  {formTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-2 group">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={clsx(
                          'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
                          task.done ? 'bg-[#8151D1] border-[#8151D1]' : 'border-white/20 hover:border-[#8151D1]/50'
                        )}
                      >
                        {task.done && <span className="text-white text-[10px] font-bold">✓</span>}
                      </button>
                      <span className={clsx('flex-1 text-sm', task.done ? 'line-through text-[#D8D8DE]/40' : 'text-[#D8D8DE]')}>
                        {task.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-[#D8D8DE]/40 hover:text-red-400 transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                    placeholder="Nova tarefa..."
                    className={clsx(inputClass, 'flex-1')}
                  />
                  <button
                    type="button"
                    onClick={addTask}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-[#D8D8DE]/70 hover:text-white transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className={labelClass}>Notas</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Observações internas..."
                  className={clsx(inputClass, 'resize-none')}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-bold text-[#D8D8DE]/70 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8151D1] hover:bg-[#9063e0] text-white text-sm font-bold rounded-xl transition-colors"
                >
                  {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
