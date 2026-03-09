import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setToken, setCurrentUser } from '../utils/api';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Usuário ou senha inválidos');
        return;
      }

      const { token, user } = await res.json();
      setToken(token);
      setCurrentUser(user);
      navigate('/');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#8151D1] opacity-[0.07] blur-[120px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Resona <span className="text-[#8151D1]">IA</span>
          </h1>
          <p className="text-[10px] text-[#D8D8DE]/60 font-semibold mt-1 uppercase tracking-widest">
            CRM Operacional
          </p>
        </div>

        <div className="bg-[#131018] border border-white/10 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-extrabold text-white mb-6">Entrar</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">
                Usuário
              </label>
              <input
                type="text"
                name="username"
                required
                autoFocus
                className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#D8D8DE]/70 uppercase tracking-wider mb-2">
                Senha
              </label>
              <input
                type="password"
                name="password"
                required
                className="resona-input block w-full py-2.5 px-4 rounded-xl text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="resona-btn w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
