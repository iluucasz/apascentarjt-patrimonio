import { db } from '@/lib/db';

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge, AssetConditionBadge, AssetBadgeSummary, countBy } from '@/components/AssetBadges';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Plus, Search, Eye, Pencil, ImageIcon, Layers, Trash2, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/format';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';
import { canCreateAsset, canDeleteAsset } from '@/lib/permissions';
import NovoPatrimonioDialog from '@/components/NovoPatrimonioDialog';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

// Miniatura do patrimônio (foto, ou ícone quando não há foto).
function Thumb({ src, batch, className }) {
  const Icon = batch ? Layers : ImageIcon;
  return src
    ? <Image src={src} className={`${className} shrink-0 rounded-xl object-cover`} fittingType="fill" />
    : <div className={`${className} shrink-0 rounded-xl bg-accent flex items-center justify-center`}><Icon className="w-1/2 h-1/2 text-primary/60" aria-hidden="true" /></div>;
}

export default function Patrimonios() {
  const { categories, scopeLocations: locations, user } = useApp();
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [status, category, location, condition].filter((v) => v !== 'all').length;
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
        const hay = [a.asset_number, a.name, a.variant, a.brand, a.model, a.serial_number, a.responsible_person, a.location_name, a.location_detail].filter(Boolean).join(' ').toLowerCase();
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
          updated_date: a.updated_date, units: [],
        };
        groups.set(a.batch_id, group);
        result.push(group);
      }
      group.units.push(a);
      if (a.updated_date > group.updated_date) group.updated_date = a.updated_date;
    }
    for (const r of result) {
      if (!r.isBatch) continue;
      r.count = r.units.length;
      r.statusCounts = countBy(r.units, 'status');
      r.conditionCounts = countBy(r.units, 'condition');
      r.locationCount = new Set(r.units.map((u) => u.location_id || '')).size;
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
            <Plus className="w-[18px] h-[18px]" /> Novo patrimônio
          </Button>
        )}
      </PageHeader>

      <div className="rounded-2xl border border-border bg-card shadow-card p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <div className="flex gap-2 md:col-span-3 xl:col-span-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
              <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Número, nome ou marca" aria-label="Buscar patrimônio" className="pl-10" />
            </div>
            <Button type="button" variant="outline" size="icon" className="md:hidden relative shrink-0" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-label="Filtros">
              <SlidersHorizontal className="w-[18px] h-[18px]" />
              {activeFilters > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">{activeFilters}</span>}
            </Button>
          </div>
          <div className={cn('grid gap-3 md:contents', !filtersOpen && 'hidden')}>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger aria-label="Filtrar por status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger aria-label="Filtrar por categoria"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={location} onValueChange={(v) => { setLocation(v); setPage(1); }}>
            <SelectTrigger aria-label="Filtrar por unidade"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as unidades</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          </div>
        </div>
      </div>

      {filtered === null ? (
        <div className="space-y-3">{Array.from({length:6}).map((_,i)=><div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
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
                    <Trash2 className="w-4 h-4" /> Excluir selecionados ({selected.size})
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Computador: tabela */}
          <div className="hidden xl:block table-card">
            <table>
              <thead>
                <tr>
                  {canDeleteAsset(user) && (
                    <th className="w-12"><Checkbox checked={allCurrentSelected} onCheckedChange={toggleSelectAllCurrent} aria-label="Selecionar todos desta página" /></th>
                  )}
                  <th>Número</th>
                  <th>Patrimônio</th>
                  <th>Categoria</th>
                  <th>Unidade</th>
                  <th className="hidden 2xl:table-cell">Responsável</th>
                  <th>Status</th>
                  <th className="hidden 2xl:table-cell">Condição</th>
                  <th className="text-right"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {current.map((a) => (
                  <tr key={a.id} onClick={() => navigate(a.isBatch ? `/patrimonios/lote/${a.batch_id}` : `/p/${a.asset_number}`)} className="row-link">
                    {canDeleteAsset(user) && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} aria-label={`Selecionar ${a.name}`} />
                      </td>
                    )}
                    <td>
                      {a.isBatch
                        ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Layers className="w-4 h-4" aria-hidden="true" /> Lote</span>
                        : <span className="asset-code">{a.asset_number}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-3 min-w-[12rem]">
                        <Thumb src={a.photo_url} batch={a.isBatch} className="w-10 h-10" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground leading-snug">
                            {a.name}
                            {a.isBatch && <span className="ml-2 align-middle rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">{a.count} itens</span>}
                            {!a.isBatch && a.variant && <span className="font-normal text-muted-foreground"> · {a.variant}</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-muted-foreground">{a.category_name || '-'}</td>
                    <td className="text-muted-foreground min-w-[9rem]">
                      {a.isBatch ? (a.locationCount > 1 ? `Várias unidades (${a.locationCount})` : a.location_name || '-') : (a.location_name || '-')}
                      {!a.isBatch && a.location_detail && <span className="block text-xs">{a.location_detail}</span>}
                    </td>
                    <td className="hidden 2xl:table-cell text-muted-foreground">{a.responsible_person || '-'}</td>
                    <td>{a.isBatch ? <AssetBadgeSummary kind="status" counts={a.statusCounts} /> : <AssetStatusBadge status={a.status} />}</td>
                    <td className="hidden 2xl:table-cell">{a.isBatch ? <AssetBadgeSummary kind="condition" counts={a.conditionCounts} /> : <AssetConditionBadge condition={a.condition} />}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Link to={a.isBatch ? `/patrimonios/lote/${a.batch_id}` : `/p/${a.asset_number}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" title={a.isBatch ? 'Ver lote' : 'Ver detalhes'} aria-label={a.isBatch ? 'Ver lote' : 'Ver detalhes'}><Eye className="w-[18px] h-[18px]" /></Link>
                        {!a.isBatch && canCreateAsset(user) && <Link to={`/patrimonios/${a.id}/editar`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" title="Editar" aria-label="Editar"><Pencil className="w-[18px] h-[18px]" /></Link>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="xl:hidden grid gap-3 md:grid-cols-2">
            {current.map((a) => (
              <li key={a.id}>
                <Link to={a.isBatch ? `/patrimonios/lote/${a.batch_id}` : `/p/${a.asset_number}`} className="block rounded-2xl border border-border bg-card p-3.5 shadow-card active:bg-accent/50">
                  <div className="flex items-start gap-3.5">
                    <Thumb src={a.photo_url} batch={a.isBatch} className="w-14 h-14" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        {a.isBatch ? <><Layers className="w-3.5 h-3.5" aria-hidden="true" /> Lote · {a.count} itens</> : <span className="asset-code">{a.asset_number}</span>}
                      </p>
                      <p className="font-bold text-base leading-snug text-foreground mt-0.5">{a.name}{!a.isBatch && a.variant && <span className="font-normal text-muted-foreground"> · {a.variant}</span>}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{a.category_name || 'Sem categoria'} · {a.isBatch ? (a.locationCount > 1 ? 'Várias unidades' : a.location_name || '-') : (a.location_name || '-')}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.isBatch ? (
                      <>
                        <AssetBadgeSummary kind="status" counts={a.statusCounts} />
                        <AssetBadgeSummary kind="condition" counts={a.conditionCounts} />
                      </>
                    ) : (
                      <>
                        <AssetStatusBadge status={a.status} />
                        <AssetConditionBadge condition={a.condition} />
                      </>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between gap-2 mt-6" aria-label="Paginação">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /> Anterior</Button>
              <span className="text-sm text-muted-foreground tnum">Página <b className="text-foreground">{page}</b> de {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima <ChevronRight className="w-4 h-4" /></Button>
            </nav>
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