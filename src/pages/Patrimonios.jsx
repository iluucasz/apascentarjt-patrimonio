import { db } from '@/lib/db';

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge, AssetConditionBadge } from '@/components/AssetBadges';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Search, Eye, Pencil, ImageIcon } from 'lucide-react';
import { formatDate, STATUS_LABELS } from '@/lib/format';
import { Image } from '@/components/ui/image';
import { canCreateAsset } from '@/lib/permissions';
import NovoPatrimonioDialog from '@/components/NovoPatrimonioDialog';

const PAGE_SIZE = 12;

export default function Patrimonios() {
  const { categories, locations, user } = useApp();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState(null);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [condition, setCondition] = useState('all');
  const [page, setPage] = useState(1);
  const [novoOpen, setNovoOpen] = useState(false);

  const load = async () => {
    try {
      const list = await db.entities.Asset.list('-updated_date', 1000);
      setAssets(list);
    } catch (e) { setAssets([]); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!assets) return null;
    const term = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (status !== 'all' && a.status !== status) return false;
      if (category !== 'all' && a.category_id !== category) return false;
      if (location !== 'all' && a.location_id !== location) return false;
      if (condition !== 'all' && a.condition !== condition) return false;
      if (term) {
        const hay = [a.asset_number, a.name, a.brand, a.model, a.serial_number, a.responsible_person].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [assets, q, status, category, location, condition]);

  const totalPages = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const current = filtered ? filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  return (
    <Layout>
      <PageHeader title="Patrimônios" description={`${filtered ? filtered.length : 0} bens cadastrados`}>
        {canCreateAsset(user) && (
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo patrimônio
          </Button>
        )}
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar por número, nome, marca..." className="pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={location} onValueChange={(v) => { setLocation(v); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="Local" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os locais</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered === null ? (
        <div className="space-y-2">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>
      ) : current.length === 0 ? (
        <EmptyState icon={Package} title="Nenhum patrimônio encontrado" description="Ajuste os filtros ou cadastre um novo patrimônio." />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Número</th>
                  <th className="text-left font-medium px-4 py-3">Patrimônio</th>
                  <th className="text-left font-medium px-4 py-3">Categoria</th>
                  <th className="text-left font-medium px-4 py-3">Local</th>
                  <th className="text-left font-medium px-4 py-3">Responsável</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Condição</th>
                  <th className="text-left font-medium px-4 py-3">Atualizado</th>
                  <th className="text-right font-medium px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {current.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-xs">{a.asset_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.photo_url ? <Image src={a.photo_url} className="w-8 h-8 rounded object-cover" fittingType="fill" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>}
                        <span className="font-medium">{a.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.category_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.location_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.responsible_person || '-'}</td>
                    <td className="px-4 py-3"><AssetStatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><AssetConditionBadge condition={a.condition} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(a.updated_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/p/${a.asset_number}`} className="p-1.5 rounded hover:bg-accent" title="Visualizar"><Eye className="w-4 h-4" /></Link>
                        {canCreateAsset(user) && <Link to={`/patrimonios/${a.id}/editar`} className="p-1.5 rounded hover:bg-accent" title="Editar"><Pencil className="w-4 h-4" /></Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {current.map((a) => (
              <Link key={a.id} to={`/p/${a.asset_number}`} className="block rounded-xl border border-border bg-card p-3 active:bg-accent/30">
                <div className="flex items-center gap-3">
                  {a.photo_url ? <Image src={a.photo_url} className="w-12 h-12 rounded object-cover" fittingType="fill" /> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{a.asset_number}</p>
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.category_name || '-'} · {a.location_name || '-'}</p>
                  </div>
                  <AssetStatusBadge status={a.status} />
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
              <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
            </div>
          )}
        </>
      )}

      <NovoPatrimonioDialog open={novoOpen} onOpenChange={setNovoOpen} onCreated={load} />
    </Layout>
  );
}