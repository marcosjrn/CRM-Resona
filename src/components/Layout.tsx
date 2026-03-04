import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Trello, DollarSign } from 'lucide-react';
import { clsx } from 'clsx';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Hoje', path: '/', icon: LayoutDashboard },
    { name: 'Accounts', path: '/accounts', icon: Users },
    { name: 'Pipeline', path: '/pipeline', icon: Trello },
    { name: 'Financeiro', path: '/finance', icon: DollarSign },
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
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
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
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3F1E6A] to-[#8151D1] flex items-center justify-center text-sm font-bold text-white shadow-[0_0_10px_rgba(129,81,209,0.3)]">
              EU
            </div>
            <div className="ml-3">
              <p className="text-sm font-bold text-white">Admin</p>
              <p className="text-xs font-medium text-[#D8D8DE]/60">Online</p>
            </div>
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
