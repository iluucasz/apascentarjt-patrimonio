import { db } from '@/lib/db';

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import { AssetStatusBadge, AssetConditionBadge, AssetBadgeSummary, countBy } from '@/components/AssetBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Package, Printer, Search, Eye, ArrowLeft, Trash2, Pencil, ArrowLeftRight, Tag, Loader2 } from 'lucide-react';
import { formatDate, MOVEMENT_LABELS, STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { canDeleteAsset, canEditAsset, canMoveAsset } from '@/lib/permissions';
import { toast } from 'sonner';

const KEEP = '__keep';
const EMPTY_MOVE = { to_location_id: '', responsible_person: '', movement_type: 'transfer', notes: '' };
const EMPTY_STATE = { status: KEEP, condition: KEEP };

export default function PatrimonioLote() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { user, locations } = useApp();
  const [units, setUnits] = useState(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleteScope, setDeleteScope] = useState(null); // 'selected' | 'all'
  const [deleting, setDeleting] = useState(false);
  // Movimentar / alterar status: escopo 'selected' | 'all' (null = fechado)
  const [moveScope, setMoveScope] = useState(null);
  const [moveForm, setMoveForm] = useState(EMPTY_MOVE);
  const [stateScope, setStateScope] = useState(null);
  const [stateForm, setStateForm] = useState(EMPTY_STATE);
  const [working, setWorking] = useState(false);

  const load = async () => {
    try {
      const list = await db.entities.Asset.filter({ batch_id: batchId }, 'asset_number', 2000);
      setUnits(list);
    } catch (e) { setUnits([]); }
  };

  useEffect(() => { load(); }, [batchId]);

  const byVariant = useMemo(() => {
    if (!units) return [];
    const counts = new Map();
    for (const u of units) {
      const key = u.variant || 'Padrão';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()];
  }, [units]);

  const byLocation = useMemo(() => {
    if (!units) return [];
    const counts = new Map();
    for (const u of units) {
      const key = u.location_name || '-';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [units]);

  const filtered = useMemo(() => {
    if (!units) return [];
    const term = q.trim().toLowerCase();
    if (!term) return units;
    return units.filter((u) => [
      u.asset_number, u.variant, u.location_name, STATUS_LABELS[u.status], CONDITION_LABELS[u.condition],
    ].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [units, q]);

  const canSelect = canEditAsset(user) || canDeleteAsset(user);
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

  const scopeIds = (scope) => (scope === 'all' ? units.map((u) => u.id) : [...selected]);

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

  const handleMove = async () => {
    if (!moveForm.to_location_id) { toast.error('Selecione o novo local'); return; }
    setWorking(true);
    try {
      const res = await db.functions.invoke('moveAssets', { batch_id: batchId, ids: scopeIds(moveScope), ...moveForm });
      const count = res.data.count;
      toast.success(`${count} patrimônio${count === 1 ? '' : 's'} movimentado${count === 1 ? '' : 's'}`);
      setMoveScope(null);
      setMoveForm(EMPTY_MOVE);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao movimentar');
    } finally {
      setWorking(false);
    }
  };

  const handleState = async () => {
    const payload = {
      batch_id: batchId,
      ids: scopeIds(stateScope),
      status: stateForm.status === KEEP ? null : stateForm.status,
      condition: stateForm.condition === KEEP ? null : stateForm.condition,
    };
    if (!payload.status && !payload.condition) { toast.error('Escolha o novo status ou a nova condição'); return; }
    setWorking(true);
    try {
      const res = await db.functions.invoke('updateAssetsState', payload);
      const count = res.data.count;
      toast.success(`${count} patrimônio${count === 1 ? '' : 's'} atualizado${count === 1 ? '' : 's'}`);
      setStateScope(null);
      setStateForm(EMPTY_STATE);
      setSelected(new Set());
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao atualizar');
    } finally {
      setWorking(false);
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
  const moveCount = moveScope === 'all' ? units.length : selected.size;
  const stateCount = stateScope === 'all' ? units.length : selected.size;

  return (
    <Layout>
      <PageHeader title={first.name} description={`Lote com ${units.length} unidades`}>
        <Button variant="outline" onClick={() => navigate('/patrimonios')}><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
        {canEditAsset(user) && (
          <Button variant="outline" onClick={() => navigate(`/patrimonios/lote/${batchId}/editar`)}><Pencil className="w-4 h-4 mr-2" /> Editar lote</Button>
        )}
        {canMoveAsset(user) && (
          <Button variant="outline" onClick={() => setMoveScope('all')}><ArrowLeftRight className="w-4 h-4 mr-2" /> Movimentar lote</Button>
        )}
        <Button onClick={() => navigate(`/etiquetas?batch_id=${batchId}`)}><Printer className="w-4 h-4 mr-2" /> Imprimir etiquetas</Button>
        {canDeleteAsset(user) && (
          <Button variant="destructive" onClick={() => setDeleteScope('all')}><Trash2 className="w-4 h-4 mr-2" /> Excluir lote inteiro</Button>
        )}
      </PageHeader>

      <div className="rounded-xl border border-border bg-card p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        <div><p className="text-muted-foreground">Categoria</p><p className="font-medium">{first.category_name || '-'}</p></div>
        <div><p className="text-muted-foreground">Total de unidades</p><p className="font-medium">{units.length}</p></div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-muted-foreground">Local</p>
          <p className="font-medium">{byLocation.length === 1 ? byLocation[0][0] : byLocation.map(([label, count]) => `${label} (${count})`).join(', ')}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Status</p>
          <AssetBadgeSummary kind="status" counts={countBy(units, 'status')} />
        </div>
        <div>
          <p className="text-muted-foreground mb-1">Condição</p>
          <AssetBadgeSummary kind="condition" counts={countBy(units, 'condition')} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <p className="text-muted-foreground">Variantes</p>
          <p className="font-medium">{byVariant.map(([label, count]) => `${label} (${count})`).join(', ')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, variante, local, status..." className="pl-9" />
        </div>
        {canSelect && (
          <>
            <Button size="sm" variant="outline" onClick={toggleSelectAllFiltered}>
              {allFilteredSelected ? 'Desmarcar' : q ? 'Selecionar filtrados' : 'Selecionar todos'} ({filtered.length})
            </Button>
            {selected.size > 0 && (
              <>
                <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
                {canMoveAsset(user) && (
                  <Button size="sm" variant="outline" onClick={() => setMoveScope('selected')}>
                    <ArrowLeftRight className="w-4 h-4 mr-1" /> Movimentar ({selected.size})
                  </Button>
                )}
                {canEditAsset(user) && (
                  <Button size="sm" variant="outline" onClick={() => setStateScope('selected')}>
                    <Tag className="w-4 h-4 mr-1" /> Alterar status/condição ({selected.size})
                  </Button>
                )}
                {canDeleteAsset(user) && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteScope('selected')}>
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir selecionados ({selected.size})
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {canSelect && (
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
                {canSelect && (
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
                    {canEditAsset(user) && <Link to={`/patrimonios/${u.id}/editar`} className="p-1.5 rounded hover:bg-accent" title="Editar unidade"><Pencil className="w-4 h-4" /></Link>}
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
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            {canSelect && <input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} className="shrink-0" />}
            <Link to={`/p/${u.asset_number}`} className="flex flex-1 min-w-0 items-center justify-between gap-3 active:opacity-70">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{u.asset_number}</p>
                <p className="font-medium truncate">{u.variant || first.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.location_name || '-'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <AssetStatusBadge status={u.status} />
                <AssetConditionBadge condition={u.condition} />
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Movimentar (lote inteiro ou selecionados) */}
      <Dialog open={!!moveScope} onOpenChange={(v) => { if (!v) setMoveScope(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveScope === 'all' ? 'Movimentar lote inteiro' : 'Movimentar selecionados'}</DialogTitle>
            <DialogDescription>
              {moveCount} unidade{moveCount === 1 ? '' : 's'} de &quot;{first.name}&quot;. A movimentação fica registrada no histórico de cada unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Novo local *</Label><Select value={moveForm.to_location_id} onValueChange={(v) => setMoveForm((f) => ({ ...f, to_location_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Responsável</Label><Input value={moveForm.responsible_person} onChange={(e) => setMoveForm((f) => ({ ...f, responsible_person: e.target.value }))} /></div>
            <div><Label>Tipo</Label><Select value={moveForm.movement_type} onValueChange={(v) => setMoveForm((f) => ({ ...f, movement_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MOVEMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Observação</Label><Textarea value={moveForm.notes} onChange={(e) => setMoveForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveScope(null)} disabled={working}>Cancelar</Button>
            <Button onClick={handleMove} disabled={working}>{working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar status/condição dos selecionados */}
      <Dialog open={!!stateScope} onOpenChange={(v) => { if (!v) setStateScope(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status/condição</DialogTitle>
            <DialogDescription>{stateCount} unidade{stateCount === 1 ? '' : 's'} de &quot;{first.name}&quot;.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={stateForm.status} onValueChange={(v) => setStateForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Não alterar</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condição</Label>
              <Select value={stateForm.condition} onValueChange={(v) => setStateForm((f) => ({ ...f, condition: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP}>Não alterar</SelectItem>
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStateScope(null)} disabled={working}>Cancelar</Button>
            <Button onClick={handleState} disabled={working}>{working && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
