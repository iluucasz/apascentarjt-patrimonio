import { db } from '@/lib/db';

import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Package, ScanLine, ClipboardList, ArrowLeftRight, Wrench,
  MapPin, Tags, QrCode, Users, Settings, Search, LogOut, ChevronsUpDown, Check, Ellipsis, X
} from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import BrandMark from '@/components/BrandMark';
import { resolveBranding } from '@/lib/locations';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import { cn } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions';

// Menu agrupado por tarefa: o que se faz no dia a dia fica no topo.
const NAV_GROUPS = [
  {
    label: 'Dia a dia',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/patrimonios', label: 'Patrimônios', icon: Package },
      { to: '/scanner', label: 'Scanner', icon: ScanLine },
      { to: '/inventarios', label: 'Inventários', icon: ClipboardList },
    ],
  },
  {
    label: 'Acompanhamento',
    items: [
      { to: '/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
      { to: '/manutencoes', label: 'Manutenções', icon: Wrench },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { to: '/unidades', label: 'Unidades', icon: MapPin },
      { to: '/categorias', label: 'Categorias', icon: Tags },
      { to: '/etiquetas', label: 'Etiquetas', icon: QrCode },
    ],
  },
  {
    label: 'Administração',
    items: [
      { to: '/usuarios', label: 'Usuários', icon: Users, adminOnly: true },
      { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
    ],
  },
];

// Barra inferior do celular: as 4 telas de uso diário + "Mais".
const TAB_ROUTES = ['/', '/patrimonios', '/scanner', '/inventarios'];

function isRouteActive(pathname, to) {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
}

export default function Layout({ children }) {
  const { user, settings, locations, filialOptions, currentFilial, setFilial } = useApp();
  // Logo/cor da filial atual (herdando do local pai, da principal e das configurações).
  const brandingOf = (id) => resolveBranding(locations, id, settings);
  const branding = brandingOf(currentFilial?.id || '');
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [search, setSearch] = useState('');
  const mobileSearchRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.adminOnly || (user && user.role === 'admin')) }))
    .filter((g) => g.items.length > 0);
  const moreGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((n) => !TAB_ROUTES.includes(n.to)) }))
    .filter((g) => g.items.length > 0);
  const moreActive = moreGroups.some((g) => g.items.some((n) => isRouteActive(pathname, n.to)));

  useEffect(() => { if (mobileSearch) mobileSearchRef.current?.focus(); }, [mobileSearch]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/patrimonios?q=${encodeURIComponent(search.trim())}`);
      setSearch('');
      setMobileSearch(false);
    }
  };

  const handleLogout = async () => {
    await db.auth.logout();
    window.location.href = '/login';
  };

  // Seletor de filial (só aparece com mais de uma opção).
  const canSwitchFilial = filialOptions.length > 1;
  const filialLabel = !currentFilial || (!canSwitchFilial && currentFilial.overview)
    ? 'Patrimônio'
    : currentFilial.main ? 'Matriz · visão geral' : currentFilial.name;

  const BrandBlock = ({ dark = false }) => (
    <>
      <BrandMark logoUrl={branding.logoUrl} bgColor={branding.bgColor} className="w-10 h-10 rounded-xl" />
      <div className="min-w-0 text-left">
        <p className={cn('text-[15px] font-bold leading-tight truncate', dark ? 'text-white' : 'text-foreground')}>{settings?.church_name || 'Gestão Patrimonial'}</p>
        <p className={cn('text-xs truncate mt-0.5', dark ? 'text-sidebar-foreground/70' : 'text-muted-foreground')}>{filialLabel}</p>
      </div>
    </>
  );

  const FilialMenu = ({ children, className, title = 'Trocar de filial' }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={className} title={title} aria-label={title}>{children}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 max-w-[calc(100vw-1rem)]">
        <DropdownMenuLabel>Ver patrimônio de</DropdownMenuLabel>
        {filialOptions.map((o) => (
          <DropdownMenuItem key={o.id || 'all'} onSelect={() => { setFilial(o.id); setMoreOpen(false); }} className={cn('gap-2.5', o.kind === 'filial' && 'ml-4')}>
            <Check className={cn('w-4 h-4 shrink-0 text-primary', currentFilial?.id === o.id ? 'opacity-100' : 'opacity-0')} />
            <BrandMark {...brandingOf(o.id)} className="w-7 h-7 rounded-lg" iconClassName="w-4 h-4" />
            <span className="truncate flex-1">{o.name}</span>
            {o.kind === 'matriz' && <span className="text-xs text-muted-foreground">Matriz</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const initial = (user?.full_name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Menu lateral (computador) */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground flex-col z-30">
        {canSwitchFilial ? (
          <FilialMenu className="flex items-center gap-3 px-5 h-[72px] shrink-0 w-full text-left hover:bg-sidebar-accent/60 transition-colors">
            <BrandBlock dark />
            <ChevronsUpDown className="w-4 h-4 text-sidebar-foreground/70 shrink-0 ml-auto" />
          </FilialMenu>
        ) : (
          <div className="flex items-center gap-3 px-5 h-[72px] shrink-0"><BrandBlock dark /></div>
        )}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2" aria-label="Menu principal">
          {groups.map((group, gi) => (
            <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
              <p className="px-3 mb-1.5 text-xs font-semibold text-sidebar-foreground/60">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => cn(
                        'group flex items-center gap-3 px-3 h-11 rounded-lg text-[15px] font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={cn('w-5 h-5 shrink-0', isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/70 group-hover:text-sidebar-primary')} />
                          <span>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3 shrink-0">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-primary shrink-0">{initial}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate text-white">{user?.full_name || user?.email}</p>
              <p className="text-xs text-sidebar-foreground/70 truncate">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
            </div>
            <button onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:text-white hover:bg-sidebar-accent transition-colors" title="Sair" aria-label="Sair">
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        {/* Barra superior: computador */}
        <header className="hidden lg:flex sticky top-0 z-20 items-center h-16 px-8 bg-background/90 backdrop-blur border-b border-border">
          <form onSubmit={handleSearch} className="flex-1 max-w-xl" role="search">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar patrimônio por número, nome ou marca"
                aria-label="Buscar patrimônio"
                className="w-full h-10 pl-10 pr-3 text-sm rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] hover:border-foreground/40 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              />
            </div>
          </form>
        </header>

        {/* Barra superior: celular */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-2 h-16 px-4 bg-background/95 backdrop-blur border-b border-border">
          {mobileSearch ? (
            <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2" role="search">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
                <input
                  ref={mobileSearchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Número, nome ou marca"
                  aria-label="Buscar patrimônio"
                  enterKeyHint="search"
                  className="w-full h-11 pl-10 pr-3 text-base rounded-lg border border-input bg-card text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
                />
              </div>
              <button type="button" onClick={() => { setMobileSearch(false); setSearch(''); }} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent" aria-label="Fechar busca">
                <X className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <>
              {canSwitchFilial ? (
                <FilialMenu className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-lg -ml-1 pl-1 pr-2 py-1 active:bg-accent">
                  <BrandBlock />
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
                </FilialMenu>
              ) : (
                <div className="flex flex-1 min-w-0 items-center gap-3"><BrandBlock /></div>
              )}
              <button onClick={() => setMobileSearch(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent" aria-label="Buscar patrimônio">
                <Search className="w-5 h-5" />
              </button>
            </>
          )}
        </header>

        <main className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-28 lg:pb-12 max-w-[1240px] mx-auto">
          {children}
        </main>
      </div>

      {/* Barra inferior (celular) */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Menu principal">
        <ul className="grid grid-cols-5 items-end h-16 max-w-xl mx-auto">
          {[
            { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
            { to: '/patrimonios', label: 'Patrimônios', icon: Package },
            { to: '/scanner', label: 'Escanear', icon: ScanLine, primary: true },
            { to: '/inventarios', label: 'Inventários', icon: ClipboardList },
          ].map((item) => {
            const Icon = item.icon;
            const active = isRouteActive(pathname, item.to);
            return (
              <li key={item.to} className="flex justify-center">
                <NavLink
                  to={item.to}
                  end={item.end}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 w-full h-16 text-xs font-semibold transition-colors',
                    item.primary ? 'text-primary' : active ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.primary ? (
                    <span className="flex h-14 w-14 -mt-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-pop ring-4 ring-card active:scale-95 transition-transform">
                      <Icon className="w-7 h-7" />
                    </span>
                  ) : (
                    <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition-colors', active && 'bg-accent')}>
                      <Icon className="w-[22px] h-[22px]" />
                    </span>
                  )}
                  <span className={item.primary ? '-mt-0.5' : ''}>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li className="flex justify-center">
            <button
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn('flex flex-col items-center justify-center gap-0.5 w-full h-16 text-xs font-semibold transition-colors', moreActive ? 'text-primary' : 'text-muted-foreground')}
            >
              <span className={cn('flex h-8 w-14 items-center justify-center rounded-full transition-colors', moreActive && 'bg-accent')}>
                <Ellipsis className="w-[22px] h-[22px]" />
              </span>
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* "Mais" (celular): o resto do menu + conta */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden p-0 pb-[env(safe-area-inset-bottom)]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <SheetTitle className="sr-only">Mais opções</SheetTitle>
          <SheetDescription className="sr-only">Outras telas do sistema e sua conta</SheetDescription>
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          <div className="px-5 pt-4 pb-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-base font-bold text-primary shrink-0">{initial}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{user?.full_name || user?.email}</p>
              <p className="text-sm text-muted-foreground truncate">{user ? ROLE_LABELS[user.role] || user.role : ''}</p>
            </div>
          </div>
          <div className="px-3 pb-3 space-y-4">
            {moreGroups.map((group) => (
              <div key={group.label}>
                <p className="px-2 mb-1 text-xs font-semibold text-muted-foreground">{group.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isRouteActive(pathname, item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-3.5 h-14 text-[15px] font-semibold transition-colors',
                          active ? 'border-primary/30 bg-accent text-primary' : 'border-border bg-card text-foreground active:bg-accent'
                        )}
                      >
                        <Icon className="w-5 h-5 shrink-0 text-primary" />
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
            <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border h-12 text-[15px] font-semibold text-destructive active:bg-accent">
              <LogOut className="w-[18px] h-[18px]" /> Sair da conta
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
