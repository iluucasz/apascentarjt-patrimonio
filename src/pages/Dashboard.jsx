import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge } from '@/components/AssetBadges';
import EmptyState from '@/components/EmptyState';
import { Package, Wrench, ArrowLeftRight, ClipboardList, AlertTriangle, ChevronRight, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatCurrency, STATUS_LABELS, STATUS_TONES, TONE_SOLID, formatDay } from '@/lib/format';
import { canViewFinancials } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const STATUS_ORDER = ['active', 'maintenance', 'loaned', 'storage', 'disposed', 'lost'];

function Panel({ title, action, children, className }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="p-5 pt-4">{children}</div>
    </section>
  );
}

function BarList({ entries, total }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Ainda não há dados.</p>;
  const max = entries[0][1] || 1;
  return (
    <ul className="space-y-4">
      {entries.map(([name, count]) => (
        <li key={name}>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <span className="text-sm font-medium text-foreground truncate">{name}</span>
            <span className="text-sm text-muted-foreground tnum shrink-0"><b className="font-bold text-foreground">{count}</b> · {Math.round((count / total) * 100)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="presentation">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, (count / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function AttentionItem({ icon: Icon, tone, title, detail, to }) {
  return (
    <Link to={to} className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-border bg-card shadow-card p-4 shadow-card transition-colors hover:bg-accent/50">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white', TONE_SOLID[tone])}><Icon className="w-5 h-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold leading-snug">{title}</span>
        <span className="block text-sm text-muted-foreground truncate">{detail}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

export default function Dashboard() {
  const { user, settings } = useApp();
  const [assets, setAssets] = useState(null);
  const [movements, setMovements] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [inventories, setInventories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.list('-created_date');
        setAssets(list);
      } catch (e) { setAssets([]); }
      try {
        setMovements(await db.entities.AssetMovement.list('-created_date', 5));
      } catch (e) {}
      try {
        setMaintenances(await db.entities.MaintenanceRecord.filter({ status: 'open' }, '-created_date'));
      } catch (e) {}
      try {
        setInventories(await db.entities.Inventory.filter({ status: 'in_progress' }, '-created_date'));
      } catch (e) {}
    })();
  }, []);

  if (assets === null) {
    return (
      <Layout>
        <div className="h-10 w-56 rounded-lg bg-muted animate-pulse mb-6" />
        <div className="h-56 rounded-2xl bg-muted animate-pulse mb-6" />
        <div className="grid md:grid-cols-2 gap-6">{[0, 1].map((i) => <div key={i} className="h-72 rounded-2xl bg-muted animate-pulse" />)}</div>
      </Layout>
    );
  }

  const total = assets.length;
  const byStatus = (s) => assets.filter((a) => a.status === s).length;
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.acquisition_value) || 0), 0);
  const recent = assets.slice(0, 5);
  const showFinancials = canViewFinancials(user);
  const damaged = assets.filter((a) => a.condition === 'damaged' && a.status === 'active').length;
  const lost = byStatus('lost');
  const firstName = (user?.full_name || '').split(' ')[0];

  const tally = (key, fallback) => {
    const dist = {};
    assets.forEach((a) => { const k = a[key] || fallback; dist[k] = (dist[k] || 0) + 1; });
    return Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 6);
  };
  const catEntries = tally('category_name', 'Sem categoria');
  const locEntries = tally('location_name', 'Sem unidade');

  const attention = [
    inventories.length > 0 && { key: 'inv', icon: ClipboardList, tone: 'blue', title: `${inventories.length} inventário${inventories.length === 1 ? '' : 's'} em andamento`, detail: inventories.map((i) => i.name).join(', '), to: inventories.length === 1 ? `/inventarios/${inventories[0].id}` : '/inventarios' },
    maintenances.length > 0 && { key: 'man', icon: Wrench, tone: 'amber', title: `${maintenances.length} manutenç${maintenances.length === 1 ? 'ão aberta' : 'ões abertas'}`, detail: maintenances.slice(0, 3).map((m) => m.asset_name).join(', '), to: '/manutencoes' },
    lost > 0 && { key: 'lost', icon: ShieldAlert, tone: 'red', title: `${lost} patrimônio${lost === 1 ? ' perdido' : 's perdidos'}`, detail: 'Veja quais itens não foram localizados', to: '/patrimonios?status=lost' },
    damaged > 0 && { key: 'dmg', icon: AlertTriangle, tone: 'orange', title: `${damaged} ite${damaged === 1 ? 'm danificado' : 'ns danificados'} em uso`, detail: 'Condição "danificado" ainda ativo', to: '/patrimonios?status=active' },
  ].filter(Boolean);

  return (
    <Layout>
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : 'Visão geral'}
        description={`Resumo do patrimônio${settings?.church_name ? ` · ${settings.church_name}` : ''}`}
      />

      {/* Resumo: o total e como ele se divide por situação */}
      <section className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6 mb-6" aria-labelledby="resumo-titulo">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <h2 id="resumo-titulo" className="text-sm font-semibold text-muted-foreground">Total de patrimônios</h2>
            <p className="text-5xl sm:text-6xl font-bold tracking-tight tnum leading-none mt-2 text-primary">{total}</p>
          </div>
          {showFinancials && (
            <div className="sm:text-right">
              <p className="text-sm font-semibold text-muted-foreground">Valor patrimonial</p>
              <p className="text-2xl sm:text-3xl font-bold tnum mt-1">{formatCurrency(totalValue)}</p>
            </div>
          )}
        </div>

        {total > 0 && (
          <>
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted mt-6 gap-0.5" role="img" aria-label={STATUS_ORDER.map((s) => `${STATUS_LABELS[s]}: ${byStatus(s)}`).join(', ')}>
              {STATUS_ORDER.filter((s) => byStatus(s) > 0).map((s) => (
                <div key={s} className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_SOLID[STATUS_TONES[s]])} style={{ width: `${(byStatus(s) / total) * 100}%` }} />
              ))}
            </div>
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
              {STATUS_ORDER.map((s) => (
                <li key={s}>
                  <Link to={`/patrimonios?status=${s}`} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-accent/60 transition-colors">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_SOLID[STATUS_TONES[s]])} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className={cn('block text-2xl font-bold tnum leading-none', byStatus(s) === 0 && 'text-muted-foreground/60')}>{byStatus(s)}</span>
                      <span className="block text-sm text-muted-foreground mt-1">{STATUS_LABELS[s]}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* O que pede ação agora */}
      <section className="mb-6" aria-labelledby="atencao-titulo">
        <h2 id="atencao-titulo" className="text-lg font-bold mb-3">Precisa de atenção</h2>
        {attention.length === 0 ? (
          <div className="flex items-center gap-3.5 rounded-xl border border-emerald-700/20 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
            <CheckCircle2 className="w-6 h-6 shrink-0" aria-hidden="true" />
            <p className="font-semibold">Tudo em dia: nenhuma manutenção aberta, inventário em andamento ou item perdido.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{attention.map(({ key, ...a }) => <AttentionItem key={key} {...a} />)}</div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Por categoria"><BarList entries={catEntries} total={total} /></Panel>
        <Panel title="Por unidade"><BarList entries={locEntries} total={total} /></Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Cadastrados recentemente" action={<Link to="/patrimonios" className="text-sm font-semibold text-primary hover:underline underline-offset-4">Ver todos</Link>}>
          {recent.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum patrimônio" description="Cadastre o primeiro patrimônio." className="py-6" />
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link to={`/p/${a.asset_number}`} className="flex items-center justify-between gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{a.name}</p>
                      <p className="text-sm text-muted-foreground truncate"><span className="font-mono text-[13px]">{a.asset_number}</span> · {a.location_name || 'Sem unidade'}</p>
                    </div>
                    <AssetStatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Últimas movimentações" action={<Link to="/movimentacoes" className="text-sm font-semibold text-primary hover:underline underline-offset-4">Ver todas</Link>}>
          {movements.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="Sem movimentações" description="Quando um item mudar de unidade, aparece aqui." className="py-6" />
          ) : (
            <ul className="-my-1 divide-y divide-border">
              {movements.map((m) => (
                <li key={m.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold text-foreground truncate">{m.asset_name}</p>
                    <span className="shrink-0 text-sm text-muted-foreground tnum">{formatDay(m.created_date)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {m.from_location_name || '-'} <ArrowRight className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" aria-hidden="true" /> <span className="text-foreground">{m.to_location_name || '-'}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Layout>
  );
}
