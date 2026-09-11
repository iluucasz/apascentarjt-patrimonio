import { db } from '@/lib/db';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { AssetStatusBadge, AssetConditionBadge } from '@/components/AssetBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Printer, Search, Eye, ArrowLeft, Trash2, Pencil } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { canDeleteAsset, canEditAsset } from '@/lib/permissions';
import { toast } from 'sonner';

export default function PatrimonioLote() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { user } = useApp();
  const [units, setUnits] = useState(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleteScope, setDeleteScope] = useState(null); // 'selected' | 'all'
  const [deleting, setDeleting] = useState(false);

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

  const toggle = (id) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const toggleSelectAllFiltered = () => {
    setSelected((s) => {
      if (allFilteredSelected) {
        const next = new Set(s);
        filtered.forEach((u) => next.delete(u.id));
        return next;
      }
      return new Set([...s, ...filtered.map((u) => u.id)]);
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const payload = { batch_id: batchId };
      if (deleteScope === 'selected') payload.ids = [...selected];
      const res = await db.functions.invoke('deleteAssetBatch', payload);
      const count = res.data.count;
      toast.success(`${count} patrimônio${count === 1 ? '' : 's'} excluído${count === 1 ? '' : 's'}`);
      if (deleteScope === 'all') {
        navigate('/patrimonios');
        return;
      }
      setUnits((prev) => prev.filter((u) => !selected.has(u.id)));
      setSelected(new Set());
      setDeleteScope(null);
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

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
        {canEditAsset(user) && (
          <Button variant="outline" onClick={() => navigate(`/patrimonios/lote/${batchId}/editar`)}><Pencil className="w-4 h-4 mr-2" /> Editar lote</Button>
        )}
        <Button onClick={() => navigate(`/etiquetas?batch_id=${batchId}`)}><Printer className="w-4 h-4 mr-2" /> Imprimir etiquetas</Button>
        {canDeleteAsset(user) && (
          <Button variant="destructive" onClick={() => setDeleteScope('all')}><Trash2 className="w-4 h-4 mr-2" /> Excluir lote inteiro</Button>
        )}
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

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, variante, local..." className="pl-9" />
        </div>
        {canDeleteAsset(user) && (
          <>
            <Button size="sm" variant="outline" onClick={toggleSelectAllFiltered}>
              {allFilteredSelected ? 'Desmarcar' : q ? 'Selecionar filtrados' : 'Selecionar todos'} ({filtered.length})
            </Button>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteScope('selected')}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir selecionados ({selected.size})
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {canDeleteAsset(user) && (
                <th className="px-4 py-3 w-8"><input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} /></th>
              )}
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
                {canDeleteAsset(user) && (
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                )}
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

      <ConfirmDialog
        open={!!deleteScope}
        onOpenChange={(v) => { if (!v) setDeleteScope(null); }}
        title={deleteScope === 'all' ? 'Excluir lote inteiro?' : `Excluir ${selected.size} patrimônios?`}
        description={deleteScope === 'all'
          ? `Isso vai apagar as ${units.length} unidades deste lote ("${first.name}") e todo o histórico delas (movimentações, manutenções, documentos e registros de inventário) para sempre. Essa ação não pode ser desfeita.`
          : `Isso vai apagar ${selected.size} unidade${selected.size === 1 ? '' : 's'} selecionada${selected.size === 1 ? '' : 's'} e todo o histórico delas para sempre. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir permanentemente"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Layout>
  );
}
