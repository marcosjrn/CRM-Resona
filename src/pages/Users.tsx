import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, User, Key } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';
import { apiFetch, getCurrentUser } from '../utils/api';
import { useToast } from '../components/Toast';

interface UserRecord {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'member';
  created_at: string;
}

export default function Users() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = Object.fromEntries(fd.entries());
    if ((data.password as string).length < 6) {
      toast('Senha deve ter no mínimo 6 caracteres', 'error');
      return;
    }
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.status === 409) { toast('Nome de usuário já existe', 'error'); return; }
      if (!res.ok) throw new Error();
      toast('Usuário criado com sucesso', 'success');
      setIsModalOpen(false);
      fetchUsers();
    } catch {
      toast('Erro ao criar usuário', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUser) return;
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const confirm = fd.get('confirm') as string;
    if (password !== confirm) { toast('As senhas não coincidem', 'error'); return; }
    if (password.length < 6) { toast('Senha deve ter no mínimo 6 caracteres', 'error'); return; }
    try {
      const res = await apiFetch(`/api/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error();
      toast('Senha alterada com sucesso', 'success');
      setIsPasswordModalOpen(false);
      setSelectedUser(null);
    } catch {
      toast('Erro ao alterar senha', 'error');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      const res = await apiFetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Erro ao excluir', 'error'); return; }
      toast('Usuário excluído', 'success');
      setConfirmDelete(null);
      fetchUsers();
    } catch {
      toast('Erro ao excluir usuário', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Usuários</h1>
          <p className="text-sm text-[#D8D8DE]/70 mt-1">Gerencie quem tem acesso ao CRM.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="resona-btn inline-flex items-center px-5 py-2.5 text-sm font-bold rounded-xl shadow-lg"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Novo Usuário
        </button>
      </div>

      <div className="resona-card overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-[#D8D8DE]/50">Carregando...</div>
        ) : (
          <table className="min-w-full divide-y divide-white/5">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Usuário</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Login</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Perfil</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-[#D8D8DE]/50 uppercase tracking-widest">Criado em</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#3F1E6A] to-[#8151D1] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] text-[#8151D1] font-bold">você</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#D8D8DE]/70 font-mono">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                      u.role === 'admin'
                        ? 'bg-[#8151D1]/20 text-[#D0C8E3] border-[#8151D1]/30'
                        : 'bg-white/5 text-[#D8D8DE]/60 border-white/10'
                    )}>
                      {u.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {u.role === 'admin' ? 'Admin' : 'Membro'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#D8D8DE]/50">
                    {format(new Date(u.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button
                        onClick={() => { setSelectedUser(u); setIsPasswordModalOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#D8D8DE]/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        <Key className="h-3.5 w-3.5" />
                        Alterar senha
                      </button>
                      {u.id !== currentUser?.id && (
                        confirmDelete === u.id ? (
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                          >
                            Confirmar
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            className="p-1.5 rounded-lg text-[#D8D8DE]/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#D8D8DE]/50">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Novo Usuário */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => setIsModalOpen(false)} />
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
            <form onSubmit={handleCreateUser}>
              <div className="px-6 pt-6 pb-6">
                <h3 className="text-xl font-extrabold text-white mb-6">Novo Usuário</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nome completo *</label>
                    <input type="text" name="name" required className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: João Silva" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nome de usuário (login) *</label>
                    <input type="text" name="username" required className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Ex: joao.silva" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Senha *</label>
                    <input type="password" name="password" required minLength={6} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Mínimo 6 caracteres" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Perfil *</label>
                    <select name="role" required defaultValue="member" className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm">
                      <option value="member">Membro — acesso normal ao CRM</option>
                      <option value="admin">Admin — pode gerenciar usuários</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] px-6 py-4 flex justify-end gap-3 border-t border-white/5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                  Criar Usuário
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Alterar Senha */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0B0B0F]/90" onClick={() => { setIsPasswordModalOpen(false); setSelectedUser(null); }} />
          <div className="relative z-10 bg-[#131018] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md">
            <form onSubmit={handleChangePassword}>
              <div className="px-6 pt-6 pb-6">
                <h3 className="text-xl font-extrabold text-white mb-1">Alterar senha</h3>
                <p className="text-sm text-[#D8D8DE]/60 mb-6">{selectedUser.name} ({selectedUser.username})</p>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Nova senha *</label>
                    <input type="password" name="password" required minLength={6} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Mínimo 6 caracteres" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">Confirmar senha *</label>
                    <input type="password" name="confirm" required minLength={6} className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm" placeholder="Repita a senha" />
                  </div>
                </div>
              </div>
              <div className="bg-white/[0.02] px-6 py-4 flex justify-end gap-3 border-t border-white/5">
                <button type="button" onClick={() => { setIsPasswordModalOpen(false); setSelectedUser(null); }} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="resona-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
