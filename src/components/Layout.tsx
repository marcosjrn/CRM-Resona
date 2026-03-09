import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Trello, DollarSign, LogOut, UserCog } from 'lucide-react';
import { clsx } from 'clsx';
import { apiFetch, clearToken, clearCurrentUser, getCurrentUser } from '../utils/api';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  const handleLogout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    clearToken();
    clearCurrentUser();
    navigate('/login');
  };

  const navItems = [
    { name: 'Hoje', path: '/', icon: LayoutDashboard },
    { name: 'Empresas', path: '/accounts', icon: Users },
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
        <div className="p-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Resona <span className="text-[#8151D1]">IA</span></h1>
          <p className="text-[10px] text-[#D8D8DE]/60 font-semibold mt-1 uppercase tracking-widest">CRM Operacional</p>
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto z-10 relative">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
