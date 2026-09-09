import { db } from '@/lib/db';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { AssetStatusBadge, AssetConditionBadge } from '@/components/AssetBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Printer, Search, Eye, ArrowLeft } from 'lucide-react';
import { formatDate } from '@/lib/format';

export default function PatrimonioLote() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [units, setUnits] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.filter({ batch_id: batchId }, 'asset_number', 2000);
        setUnits(list);
      } catch (e) { setUnits([]); }
    })();
  }, [batchId]);

  const byVariant = useMemo(() => {
    if (!units) return [];
    const counts = new Map();
    for (const u of units) {
      const key = u.variant || 'Padrão';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()];
  }, [units]);

  const filtered = useMemo(() => {
    if (!units) return [];
    const term = q.trim().toLowerCase();
    if (!term) return units;
    return units.filter((u) => [u.asset_number, u.variant, u.location_name].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [units, q]);

  if (units === null) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  if (units.length === 0) {
    return (
      <Layout>
        <EmptyState icon={Package} title="Lote não encontrado" description="Nenhum patrimônio encontrado para este lote." />
      </Layout>
    );
  }

  const first = units[0];

  return (
    <Layout>
      <PageHeader title={first.name} description={`Lote com ${units.length} unidades`}>
        <Button variant="outline" onClick={() => navigate('/patrimonios')}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        <Button onClick={() => navigate(`/etiquetas?batch_id=${batchId}`)}><Printer className="w-4 h-4 mr-2" /> Imprimir etiquetas</Button>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><p className="text-muted-foreground">Categoria</p><p className="font-medium">{first.category_name || '-'}</p></div>
        <div><p className="text-muted-foreground">Local</p><p className="font-medium">{first.location_name || '-'}</p></div>
        <div><p className="text-muted-foreground">Total de unidades</p><p className="font-medium">{units.length}</p></div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-muted-foreground">Variantes</p>
          <p className="font-medium">{byVariant.map(([label, count]) => `${label} (${count})`).join(', ')}</p>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, variante, local..." className="pl-9" />
      </div>

      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-3">Número</th>
              <th className="text-left font-medium px-4 py-3">Variante</th>
              <th className="text-left font-medium px-4 py-3">Local</th>
              <th className="text-left font-medium px-4 py-3">Status</th>
              <th className="text-left font-medium px-4 py-3">Condição</th>
              <th className="text-left font-medium px-4 py-3">Atualizado</th>
              <th className="text-right font-medium px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-4 py-3 font-mono text-xs">{u.asset_number}</td>
                <td className="px-4 py-3">{u.variant || '-'}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.location_name || '-'}</td>
                <td className="px-4 py-3"><AssetStatusBadge status={u.status} /></td>
                <td className="px-4 py-3"><AssetConditionBadge condition={u.condition} /></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(u.updated_date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/p/${u.asset_number}`} className="p-1.5 rounded hover:bg-accent" title="Visualizar"><Eye className="w-4 h-4" /></Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <Link key={u.id} to={`/p/${u.asset_number}`} className="block rounded-xl border border-border bg-card p-3 active:bg-accent/30">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{u.asset_number}</p>
                <p className="font-medium truncate">{u.variant || first.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.location_name || '-'}</p>
              </div>
              <AssetStatusBadge status={u.status} />
            </div>
          </Link>
        ))}
      </div>
    </Layout>
  );
}
