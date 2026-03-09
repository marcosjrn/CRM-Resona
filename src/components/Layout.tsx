import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Trello, DollarSign, LogOut, UserCog, BarChart2, Bell, AlertCircle, Calendar, Zap, X, CheckCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { apiFetch, clearToken, clearCurrentUser, getCurrentUser } from '../utils/api';

const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

interface Notifications {
  overdueInvoices: { id: string; company_name: string; amount: number; due_date: string }[];
  dueSoonInvoices: { id: string; company_name: string; amount: number; due_date: string }[];
  overdueActions: { id: string; company_name: string; next_action: string; next_action_date: string }[];
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifPos, setNotifPos] = useState<{ top: number; left: number } | null>(null);
  const [notifs, setNotifs] = useState<Notifications>({ overdueInvoices: [], dueSoonInvoices: [], overdueActions: [] });
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_dismissed') || '[]')); }
    catch { return new Set(); }
  });
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch('/api/notifications').then(r => r.json()).then(setNotifs).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        bellRef.current && !bellRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem('notif_dismissed', JSON.stringify([...next]));
      return next;
    });
  };

  const dismissAll = () => {
    const allIds = [
      ...notifs.overdueInvoices.map(n => n.id),
      ...notifs.overdueActions.map(n => n.id),
      ...notifs.dueSoonInvoices.map(n => n.id),
    ];
    setDismissedIds(prev => {
      const next = new Set([...prev, ...allIds]);
      localStorage.setItem('notif_dismissed', JSON.stringify([...next]));
      return next;
    });
  };

  const visibleOverdueInvoices = notifs.overdueInvoices.filter(n => !dismissedIds.has(n.id));
  const visibleOverdueActions = notifs.overdueActions.filter(n => !dismissedIds.has(n.id));
  const visibleDueSoonInvoices = notifs.dueSoonInvoices.filter(n => !dismissedIds.has(n.id));
  const totalNotifs = visibleOverdueInvoices.length + visibleOverdueActions.length;
  const totalVisible = totalNotifs + visibleDueSoonInvoices.length;

  const handleBellClick = () => {
    if (!notifOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setNotifPos({ top: rect.bottom + 8, left: rect.left });
    }
    setNotifOpen(v => !v);
  };

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    clearToken();
    clearCurrentUser();
    navigate('/login');
  };

  const navItems = [
    { name: 'Hoje', path: '/', icon: LayoutDashboard },
    { name: 'Dashboard', path: '/dashboard', icon: BarChart2 },
    { name: 'Clientes/Leads', path: '/accounts', icon: Users },
    { name: 'Pipeline', path: '/pipeline', icon: Trello },
    { name: 'Financeiro', path: '/finance', icon: DollarSign },
  ];

  const adminItems = [
    { name: 'Usuários', path: '/users', icon: UserCog },
  ];

  return (
    <div className="flex h-screen bg-[#0B0B0F] text-[#D8D8DE] font-sans relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#8151D1] opacity-[0.07] blur-[120px] rounded-full pointer-events-none transform translate-x-1/3 -translate-y-1/3"></div>

      {/* Chevron Background Element */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden opacity-[0.15] z-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute w-[150%] h-[150%] top-[-25%] right-[-25%] text-[#3F1E6A]">
          <polygon points="50,0 100,50 50,100 0,50" fill="url(#grad1)" />
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#3F1E6A', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#8151D1', stopOpacity: 0 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Sidebar */}
      <aside className="w-64 bg-[#131018] border-r border-white/5 flex flex-col z-10 relative shadow-2xl">
        <div className="p-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Resona <span className="text-[#8151D1]">IA</span></h1>
            <p className="text-[10px] text-[#D8D8DE]/60 font-semibold mt-1 uppercase tracking-widest">CRM Operacional</p>
          </div>
          {/* Bell Notification */}
          <button
            ref={bellRef}
            onClick={handleBellClick}
            className={clsx(
              'relative p-2 rounded-lg transition-colors mt-1',
              notifOpen ? 'bg-[#8151D1]/20 text-white' : 'text-[#D8D8DE]/50 hover:text-white hover:bg-white/5'
            )}
          >
            <Bell className="h-4 w-4" />
            {totalNotifs > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                {totalNotifs > 9 ? '9+' : totalNotifs}
              </span>
            )}
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 mt-4 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.name}
                to={item.path}
                className={clsx(
                  'flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-[#8151D1]/15 text-white border border-[#8151D1]/30 shadow-[0_0_15px_rgba(129,81,209,0.1)]'
                    : 'text-[#D8D8DE]/70 hover:bg-white/5 hover:text-white'
                )}
              >
                <item.icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-[#8151D1]' : 'text-[#D8D8DE]/50')} />
                {item.name}
              </Link>
            );
          })}

          {currentUser?.role === 'admin' && (
            <div className="pt-4 mt-2 border-t border-white/5">
              <p className="px-4 pb-2 text-[10px] font-bold text-[#D8D8DE]/30 uppercase tracking-widest">Admin</p>
              {adminItems.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={clsx(
                      'flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-[#8151D1]/15 text-white border border-[#8151D1]/30 shadow-[0_0_15px_rgba(129,81,209,0.1)]'
                        : 'text-[#D8D8DE]/70 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <item.icon className={clsx('mr-3 h-5 w-5', isActive ? 'text-[#8151D1]' : 'text-[#D8D8DE]/50')} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3F1E6A] to-[#8151D1] flex items-center justify-center text-sm font-bold text-white shadow-[0_0_10px_rgba(129,81,209,0.3)] flex-shrink-0">
                {currentUser?.name?.slice(0, 2).toUpperCase() ?? 'EU'}
              </div>
              <div className="ml-3 min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentUser?.name ?? 'Usuário'}</p>
                <p className="text-xs font-medium text-[#D8D8DE]/60">{currentUser?.role === 'admin' ? 'Admin' : 'Membro'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-2 text-[#D8D8DE]/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Notification Dropdown — fixed to viewport, below bell button */}
      {notifOpen && notifPos && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: notifPos.top, left: notifPos.left }}
          className="w-80 bg-[#1a1520] border border-white/10 rounded-2xl shadow-2xl z-[200] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider">Notificações</span>
            <div className="flex items-center gap-2">
              {totalVisible > 0 && (
                <button
                  onClick={dismissAll}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#D8D8DE]/40 hover:text-[#8151D1] transition-colors"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas
                </button>
              )}
              {totalNotifs > 0 && <span className="text-xs font-bold text-red-400">{totalNotifs} alerta{totalNotifs !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <div className="max-h-[360px] overflow-y-auto">
            {totalVisible === 0 ? (
              <p className="text-sm text-[#D8D8DE]/50 text-center py-6">Tudo em dia</p>
            ) : (
              <>
                {visibleOverdueInvoices.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-red-400" />
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Invoices Atrasadas — {visibleOverdueInvoices.length}</span>
                    </div>
                    {visibleOverdueInvoices.map(n => (
                      <Link key={n.id} to="/finance" onClick={() => setNotifOpen(false)} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] border-b border-white/5 transition-colors group">
                        <div>
                          <p className="text-xs font-bold text-white">{n.company_name}</p>
                          <p className="text-[11px] text-red-400">{format(new Date(n.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-400">{fmt(n.amount)}</span>
                          <button onClick={(e) => dismiss(n.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-[#D8D8DE]/40 hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {visibleOverdueActions.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-orange-400" />
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Ações Atrasadas — {visibleOverdueActions.length}</span>
                    </div>
                    {visibleOverdueActions.map(n => (
                      <Link key={n.id} to="/pipeline" onClick={() => setNotifOpen(false)} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] border-b border-white/5 transition-colors group">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white">{n.company_name}</p>
                          <p className="text-[11px] text-[#D8D8DE]/60 truncate">{n.next_action}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                          <span className="text-[11px] font-bold text-orange-400">{format(new Date(n.next_action_date + 'T12:00:00'), 'dd/MM')}</span>
                          <button onClick={(e) => dismiss(n.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-[#D8D8DE]/40 hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {visibleDueSoonInvoices.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-yellow-400" />
                      <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">Vencendo em 7 dias — {visibleDueSoonInvoices.length}</span>
                    </div>
                    {visibleDueSoonInvoices.map(n => (
                      <Link key={n.id} to="/finance" onClick={() => setNotifOpen(false)} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] border-b border-white/5 transition-colors group">
                        <div>
                          <p className="text-xs font-bold text-white">{n.company_name}</p>
                          <p className="text-[11px] text-yellow-400">{format(new Date(n.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-yellow-400">{fmt(n.amount)}</span>
                          <button onClick={(e) => dismiss(n.id, e)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-[#D8D8DE]/40 hover:text-white">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto z-10 relative">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
