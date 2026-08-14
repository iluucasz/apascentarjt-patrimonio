import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge } from '@/components/AssetBadges';
import EmptyState from '@/components/EmptyState';
import { Package, Wrench, ArrowLeftRight, ClipboardList, AlertTriangle, Wallet, TrendingUp, MapPin } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { canViewFinancials } from '@/lib/permissions';

function StatCard({ label, value, icon: Icon, color = 'text-foreground', to }) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export default function Dashboard() {
  const { user, categories, locations } = useApp();
  const [assets, setAssets] = useState(null);
  const [movements, setMovements] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [inventories, setInventories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.list('-created_date', 500);
        setAssets(list);
      } catch (e) { setAssets([]); }
      try {
        setMovements(await db.entities.AssetMovement.list('-created_date', 5));
      } catch (e) {}
      try {
        setMaintenances(await db.entities.MaintenanceRecord.filter({ status: 'open' }, '-created_date', 5));
      } catch (e) {}
      try {
        setInventories(await db.entities.Inventory.filter({ status: 'in_progress' }, '-created_date', 5));
      } catch (e) {}
    })();
  }, []);

  if (assets === null) {
    return <Layout><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />)}</div></Layout>;
  }

  const byStatus = (s) => assets.filter((a) => a.status === s).length;
  const totalValue = assets.reduce((sum, a) => sum + (Number(a.acquisition_value) || 0), 0);
  const recent = assets.slice(0, 5);
  const showFinancials = canViewFinancials(user);

  // distribution by category
  const catDist = {};
  assets.forEach((a) => {
    const c = a.category_name || 'Sem categoria';
    catDist[c] = (catDist[c] || 0) + 1;
  });
  const catEntries = Object.entries(catDist).sort((a,b)=>b[1]-a[1]).slice(0,6);

  // distribution by location
  const locDist = {};
  assets.forEach((a) => {
    const l = a.location_name || 'Sem local';
    locDist[l] = (locDist[l] || 0) + 1;
  });
  const locEntries = Object.entries(locDist).sort((a,b)=>b[1]-a[1]).slice(0,6);

  return (
    <Layout>
      <PageHeader title="Dashboard" description="Visão geral do patrimônio da igreja" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total de patrimônios" value={assets.length} icon={Package} to="/patrimonios" />
        <StatCard label="Em uso (ativos)" value={byStatus('active')} icon={Package} color="text-emerald-600" to="/patrimonios?status=active" />
        <StatCard label="Em manutenção" value={byStatus('maintenance')} icon={Wrench} color="text-amber-600" to="/manutencoes" />
        <StatCard label="Emprestados" value={byStatus('loaned')} icon={ArrowLeftRight} color="text-blue-600" />
        <StatCard label="Em estoque" value={byStatus('storage')} icon={Package} color="text-slate-600" />
        <StatCard label="Baixados" value={byStatus('disposed')} icon={Package} color="text-rose-600" />
        <StatCard label="Perdidos" value={byStatus('lost')} icon={AlertTriangle} color="text-red-600" />
        {showFinancials ? (
          <StatCard label="Valor patrimonial total" value={formatCurrency(totalValue)} icon={Wallet} color="text-emerald-600" />
        ) : (
          <StatCard label="Inventários ativos" value={inventories.length} icon={ClipboardList} to="/inventarios" />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Distribuição por categoria</h3>
          {catEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {catEntries.map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">{name}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(count / assets.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><MapPin className="w-4 h-4" /> Distribuição por local</h3>
          {locEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados</p>
          ) : (
            <div className="space-y-3">
              {locEntries.map(([name, count]) => (
                <div key={name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">{name}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(count / assets.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Últimos patrimônios cadastrados</h3>
          {recent.length === 0 ? (
            <EmptyState icon={Package} title="Nenhum patrimônio" description="Cadastre o primeiro patrimônio." />
          ) : (
            <div className="space-y-2">
              {recent.map((a) => (
                <Link key={a.id} to={`/p/${a.asset_number}`} className="flex items-center justify-between py-2 border-b border-border last:border-0 hover:bg-accent/50 -mx-2 px-2 rounded">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.asset_number} · {a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.category_name || '-'} · {a.location_name || '-'}</p>
                  </div>
                  <AssetStatusBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-4">Últimas movimentações</h3>
          {movements.length === 0 ? (
            <EmptyState icon={ArrowLeftRight} title="Sem movimentações" />
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div key={m.id} className="py-2 border-b border-border last:border-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.asset_number} · {m.asset_name}</p>
                  <p className="text-xs text-muted-foreground">{m.from_location_name || '-'} → {m.to_location_name || '-'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}