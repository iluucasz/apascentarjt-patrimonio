import { db } from '@/lib/db';

import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ScanLine, ClipboardList, ArrowLeftRight, Wrench,
  MapPin, Tags, QrCode, Users, Settings, Menu, X, Search, LogOut, Church
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';

import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patrimonios', label: 'Patrimônios', icon: Package },
  { to: '/scanner', label: 'Scanner', icon: ScanLine },
  { to: '/inventarios', label: 'Inventários', icon: ClipboardList },
  { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { to: '/manutencoes', label: 'Manutenções', icon: Wrench },
  { to: '/locais', label: 'Locais', icon: MapPin },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/etiquetas', label: 'Etiquetas', icon: QrCode },
  { to: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true }
];

export default function Layout({ children }) {
  const { user, settings } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = NAV.filter((n) => !n.adminOnly || (user && user.role === 'admin'));

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/patrimonios?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setMobileOpen(false);
    }
  };

  const handleLogout = async () => {
    await db.auth.logout();
    window.location.href = '/login';
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-border shrink-0">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 overflow-hidden">
          {settings?.church_logo_url ? (
            <img src={settings.church_logo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Church className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate text-foreground">{settings?.church_name || 'Gestão Patrimonial'}</p>
          <p className="text-xs text-muted-foreground truncate">Patrimônio</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
            {(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">{user?.full_name || user?.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r border-border bg-card flex-col z-30">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-card flex flex-col">
            <button className="absolute top-4 right-4 p-1.5 rounded-md text-muted-foreground" onClick={() => setMobileOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 h-16 px-4 sm:px-6 border-b border-border bg-background/80 backdrop-blur">
          <button className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-accent" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar patrimônio (ex: 000127, Behringer, X32)..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </form>
        </header>
        <main className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}