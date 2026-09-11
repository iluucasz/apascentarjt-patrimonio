import { db } from '@/lib/db';

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge, AssetConditionBadge } from '@/components/AssetBadges';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Search, Eye, Pencil, ImageIcon, Layers, Trash2 } from 'lucide-react';
import { formatDate, STATUS_LABELS } from '@/lib/format';
import { Image } from '@/components/ui/image';
import { canCreateAsset, canDeleteAsset } from '@/lib/permissions';
import NovoPatrimonioDialog from '@/components/NovoPatrimonioDialog';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

export default function Patrimonios() {
  const { categories, locations, user } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [assets, setAssets] = useState(null);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [category, setCategory] = useState('all');
  const [location, setLocation] = useState('all');
  const [condition, setCondition] = useState('all');
  const [page, setPage] = useState(1);
  const [novoOpen, setNovoOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const list = await db.entities.Asset.list('-updated_date');
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
        const hay = [a.asset_number, a.name, a.variant, a.brand, a.model, a.serial_number, a.responsible_person].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [assets, q, status, category, location, condition]);

  // Unidades que vieram de um cadastro em lote (mesmo batch_id) viram uma
  // única linha agrupada aqui — abrir a linha leva para /patrimonios/lote/:id
  // com a lista completa, em vez de jogar centenas de linhas soltas na tabela.
  const rows = useMemo(() => {
    if (!filtered) return [];
    const groups = new Map();
    const result = [];
    for (const a of filtered) {
      if (!a.batch_id) { result.push(a); continue; }
      let group = groups.get(a.batch_id);
      if (!group) {
        group = {
          isBatch: true, id: a.batch_id, batch_id: a.batch_id, name: a.name,
          category_name: a.category_name, location_name: a.location_name,
          responsible_person: a.responsible_person, photo_url: a.photo_url,
          updated_date: a.updated_date, count: 0,
        };
        groups.set(a.batch_id, group);
        result.push(group);
      }
      group.count += 1;
      if (a.updated_date > group.updated_date) group.updated_date = a.updated_date;
    }
    return result;
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allCurrentSelected = current.length > 0 && current.every((r) => selected.has(r.id));
  const toggleSelectAllCurrent = () => {
    setSelected((s) => {
      if (allCurrentSelected) {
        const next = new Set(s);
        current.forEach((r) => next.delete(r.id));
        return next;
      }
      return new Set([...s, ...current.map((r) => r.id)]);
    });
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedUnitsCount = selectedRows.reduce((sum, r) => sum + (r.isBatch ? r.count : 1), 0);
  const selectedBatchCount = selectedRows.filter((r) => r.isBatch).length;

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      await Promise.all(selectedRows.map((r) => (
        r.isBatch
          ? db.functions.invoke('deleteAssetBatch', { batch_id: r.batch_id })
          : db.entities.Asset.delete(r.id)
      )));
      toast.success('Patrimônios excluídos');
      setSelected(new Set());
      setDeleteOpen(false);
      await load();
    } catch (e) {
      toast.error('Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

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
          {canDeleteAsset(user) && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>Selecionar todos ({rows.length})</Button>
              {selected.size > 0 && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir selecionados ({selected.size})
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {canDeleteAsset(user) && (
                    <th className="px-4 py-3 w-8"><input type="checkbox" checked={allCurrentSelected} onChange={toggleSelectAllCurrent} /></th>
                  )}
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
                {current.map((a) => a.isBatch ? (
                  <tr key={a.id} onClick={() => navigate(`/patrimonios/lote/${a.batch_id}`)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                    {canDeleteAsset(user) && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Layers className="w-3.5 h-3.5" /> Lote</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.photo_url ? <Image src={a.photo_url} className="w-8 h-8 rounded object-cover" fittingType="fill" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>}
                        <span className="font-medium">{a.name}</span>
                        <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 shrink-0">{a.count} unidades</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.category_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.location_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.responsible_person || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground">—</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(a.updated_date)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/patrimonios/lote/${a.batch_id}`} className="p-1.5 rounded hover:bg-accent" title="Ver lote"><Eye className="w-4 h-4" /></Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id} onClick={() => navigate(`/p/${a.asset_number}`)} className="border-t border-border hover:bg-accent/30 cursor-pointer">
                    {canDeleteAsset(user) && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{a.asset_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.photo_url ? <Image src={a.photo_url} className="w-8 h-8 rounded object-cover" fittingType="fill" /> : <div className="w-8 h-8 rounded bg-muted flex items-center justify-center"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>}
                        <span className="font-medium">{a.name}</span>
                        {a.variant && <span className="text-xs text-muted-foreground">· {a.variant}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.category_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.location_name || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.responsible_person || '-'}</td>
                    <td className="px-4 py-3"><AssetStatusBadge status={a.status} /></td>
                    <td className="px-4 py-3"><AssetConditionBadge condition={a.condition} /></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(a.updated_date)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
            {current.map((a) => a.isBatch ? (
              <Link key={a.id} to={`/patrimonios/lote/${a.batch_id}`} className="block rounded-xl border border-border bg-card p-3 active:bg-accent/30">
                <div className="flex items-center gap-3">
                  {a.photo_url ? <Image src={a.photo_url} className="w-12 h-12 rounded object-cover" fittingType="fill" /> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Layers className="w-5 h-5 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Layers className="w-3 h-3" /> Lote · {a.count} unidades</p>
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.category_name || '-'} · {a.location_name || '-'}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <Link key={a.id} to={`/p/${a.asset_number}`} className="block rounded-xl border border-border bg-card p-3 active:bg-accent/30">
                <div className="flex items-center gap-3">
                  {a.photo_url ? <Image src={a.photo_url} className="w-12 h-12 rounded object-cover" fittingType="fill" /> : <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><ImageIcon className="w-5 h-5 text-muted-foreground" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-muted-foreground">{a.asset_number}</p>
                    <p className="font-medium truncate">{a.name}{a.variant && <span className="text-muted-foreground font-normal"> · {a.variant}</span>}</p>
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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Excluir ${selected.size} ${selected.size === 1 ? 'item selecionado' : 'itens selecionados'}?`}
        description={`Isso vai apagar ${selectedUnitsCount} patrimônio${selectedUnitsCount === 1 ? '' : 's'}${selectedBatchCount > 0 ? ` (incluindo ${selectedBatchCount} lote${selectedBatchCount === 1 ? '' : 's'} inteiro${selectedBatchCount === 1 ? '' : 's'})` : ''} e todo o histórico deles (movimentações, manutenções, documentos e registros de inventário) para sempre. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir permanentemente"
        loading={deleting}
        onConfirm={handleDeleteSelected}
      />
    </Layout>
  );
}