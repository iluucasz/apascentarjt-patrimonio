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
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Ellipsis, Package, Printer, Search, Eye, ArrowLeft, Trash2, Pencil, ArrowLeftRight, Tag, Loader2 } from 'lucide-react';
import { formatDate, MOVEMENT_LABELS, STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { canDeleteAsset, canEditAsset, canMoveAsset } from '@/lib/permissions';
import { toast } from 'sonner';

const KEEP = '__keep';
const ALL = '__all';
const EMPTY_MOVE = {
  to_location_id: '', location_detail: '', responsible_person: '', movement_type: 'transfer', notes: '',
  from_location_id: ALL, variant: ALL, quantity: '',
};

// Resume uma lista de números patrimoniais para exibir: todos se forem poucos,
// senão o primeiro e o último.
function describeNumbers(numbers) {
  if (numbers.length <= 6) return numbers.join(', ');
  return `${numbers[0]} … ${numbers[numbers.length - 1]} (${numbers.length} itens)`;
}
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
  // Movimentar: 'quantity' (escolher quantas) | 'selected' (as marcadas); null = fechado
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

  // Locais de origem possíveis (onde há unidades do lote que não foram baixadas).
  const originOptions = useMemo(() => {
    if (!units) return [];
    const map = new Map();
    for (const u of units) {
      if (u.status === 'disposed') continue;
      const key = u.location_id || '';
      if (!map.has(key)) map.set(key, { id: key, name: u.location_name || 'Sem unidade', count: 0 });
      map.get(key).count += 1;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [units]);

  // Unidades que podem ser movidas com os filtros do diálogo (em ordem de número).
  const movable = useMemo(() => {
    if (!units || moveScope !== 'quantity') return [];
    return units.filter((u) => u.status !== 'disposed'
      && (moveForm.from_location_id === ALL || (u.location_id || '') === moveForm.from_location_id)
      && (moveForm.variant === ALL || (u.variant || '') === moveForm.variant)
      && (!moveForm.to_location_id || u.location_id !== moveForm.to_location_id));
  }, [units, moveScope, moveForm.from_location_id, moveForm.variant, moveForm.to_location_id]);
  const moveQuantity = Math.floor(Number(moveForm.quantity) || 0);
  const toMove = moveScope === 'quantity' ? movable.slice(0, Math.max(0, moveQuantity)) : [];

  const openQuantityMove = () => {
    setMoveForm({ ...EMPTY_MOVE, from_location_id: originOptions.length === 1 ? originOptions[0].id : ALL });
    setMoveScope('quantity');
  };

  const filtered = useMemo(() => {
    if (!units) return [];
    const term = q.trim().toLowerCase();
    if (!term) return units;
    return units.filter((u) => [
      u.asset_number, u.variant, u.location_name, u.location_detail, STATUS_LABELS[u.status], CONDITION_LABELS[u.condition],
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
    if (!moveForm.to_location_id) { toast.error('Selecione a nova unidade'); return; }
    let ids = [...selected];
    if (moveScope === 'quantity') {
      if (moveQuantity < 1) { toast.error('Informe quantos itens movimentar'); return; }
      if (moveQuantity > movable.length) {
        toast.error(`Só há ${movable.length} ite${movable.length === 1 ? 'm' : 'ns'} disponíve${movable.length === 1 ? 'l' : 'is'} com esses filtros`);
        return;
      }
      ids = toMove.map((u) => u.id);
    }
    const { to_location_id, location_detail, responsible_person, movement_type, notes } = moveForm;
    setWorking(true);
    try {
      const res = await db.functions.invoke('moveAssets', { batch_id: batchId, ids, to_location_id, location_detail, responsible_person, movement_type, notes });
      const count = res.data.count;
      const destination = locations.find((l) => l.id === to_location_id)?.name || 'a nova unidade';
      toast.success(`${count} patrimônio${count === 1 ? '' : 's'} movimentado${count === 1 ? '' : 's'} para ${destination}`, {
        action: { label: 'Imprimir etiquetas', onClick: () => navigate(`/etiquetas?ids=${ids.join(',')}`) },
      });
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
  const stateCount = stateScope === 'all' ? units.length : selected.size;

  return (
    <Layout>
      <PageHeader title={first.name} description={`Lote com ${units.length} itens`}>
        {canMoveAsset(user) && (
          <Button variant="outline" onClick={openQuantityMove}><ArrowLeftRight /> Movimentar</Button>
        )}
        {canEditAsset(user) && (
          <Button onClick={() => navigate(`/patrimonios/lote/${batchId}/editar`)}><Pencil /> Editar lote</Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Mais ações"><Ellipsis /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => navigate(`/etiquetas?batch_id=${batchId}`)}><Printer /> Imprimir etiquetas</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/patrimonios')}><ArrowLeft /> Voltar para a lista</DropdownMenuItem>
            {canDeleteAsset(user) && <DropdownMenuSeparator />}
            {canDeleteAsset(user) && <DropdownMenuItem onSelect={() => setDeleteScope('all')} className="text-destructive focus:text-destructive"><Trash2 /> Excluir lote inteiro</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <dl className="rounded-2xl border border-border bg-card shadow-card p-5 mb-5 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
        <div><dt className="text-sm text-muted-foreground">Categoria</dt><dd className="text-[15px] font-semibold mt-0.5">{first.category_name || '-'}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Total de itens</dt><dd className="text-[15px] font-semibold mt-0.5 tnum">{units.length}</dd></div>
        <div className="col-span-2 md:col-span-1">
          <dt className="text-sm text-muted-foreground">Unidade</dt>
          <dd className="text-[15px] font-semibold mt-0.5">{byLocation.length === 1 ? byLocation[0][0] : byLocation.map(([label, count]) => `${label} (${count})`).join(', ')}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground mb-1">Status</dt>
          <dd><AssetBadgeSummary kind="status" counts={countBy(units, 'status')} /></dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground mb-1">Condição</dt>
          <dd><AssetBadgeSummary kind="condition" counts={countBy(units, 'condition')} /></dd>
        </div>
        <div className="col-span-2 md:col-span-1">
          <dt className="text-sm text-muted-foreground">Variantes</dt>
          <dd className="text-[15px] font-semibold mt-0.5">{byVariant.map(([label, count]) => `${label} (${count})`).join(', ')}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, variante ou unidade" aria-label="Buscar no lote" className="pl-10" />
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
                    <ArrowLeftRight /> Movimentar ({selected.size})
                  </Button>
                )}
                {canEditAsset(user) && (
                  <Button size="sm" variant="outline" onClick={() => setStateScope('selected')}>
                    <Tag /> Alterar status/condição ({selected.size})
                  </Button>
                )}
                {canDeleteAsset(user) && (
                  <Button size="sm" variant="destructive" onClick={() => setDeleteScope('selected')}>
                    <Trash2 /> Excluir selecionados ({selected.size})
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="hidden md:block table-card">
        <table>
          <thead>
            <tr>
              {canSelect && (
                <th className="w-12"><Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAllFiltered} aria-label="Selecionar todos" /></th>
              )}
              <th>Número</th>
              <th>Variante</th>
              <th>Unidade</th>
              <th>Status</th>
              <th>Condição</th>
              <th className="hidden xl:table-cell">Atualizado</th>
              <th className="text-right"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                {canSelect && (
                  <td><Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} aria-label={`Selecionar ${u.asset_number}`} /></td>
                )}
                <td><span className="asset-code">{u.asset_number}</span></td>
                <td className="font-semibold">{u.variant || '-'}</td>
                <td className="text-muted-foreground">{u.location_name || '-'}{u.location_detail && <span className="block text-xs">{u.location_detail}</span>}</td>
                <td><AssetStatusBadge status={u.status} /></td>
                <td><AssetConditionBadge condition={u.condition} /></td>
                <td className="hidden xl:table-cell text-muted-foreground tnum">{formatDate(u.updated_date)}</td>
                <td>
                  <div className="flex items-center justify-end gap-1">
                    <Link to={`/p/${u.asset_number}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" title="Visualizar" aria-label={`Ver ${u.asset_number}`}><Eye className="w-[18px] h-[18px]" /></Link>
                    {canEditAsset(user) && <Link to={`/patrimonios/${u.id}/editar`} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" title="Editar item" aria-label={`Editar ${u.asset_number}`}><Pencil className="w-[18px] h-[18px]" /></Link>}
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
          <div key={u.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card shadow-card p-3">
            {canSelect && <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} className="shrink-0" aria-label={`Selecionar ${u.asset_number}`} />}
            <Link to={`/p/${u.asset_number}`} className="flex flex-1 min-w-0 items-center justify-between gap-3 active:opacity-70">
              <div className="min-w-0">
                <p className="asset-code">{u.asset_number}</p>
                <p className="font-bold truncate">{u.variant || first.name}</p>
                <p className="text-sm text-muted-foreground truncate">{u.location_name || '-'}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <AssetStatusBadge status={u.status} />
                <AssetConditionBadge condition={u.condition} />
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Movimentar (por quantidade ou as selecionadas) */}
      <Dialog open={!!moveScope} onOpenChange={(v) => { if (!v) setMoveScope(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveScope === 'quantity' ? `Movimentar ${first.name}` : `Movimentar ${selected.size} selecionado${selected.size === 1 ? '' : 's'}`}</DialogTitle>
            <DialogDescription>
              {moveScope === 'quantity'
                ? 'Escolha quantos itens vão para a nova unidade. Para mandar outra parte para outra unidade, é só repetir.'
                : `${selected.size} ite${selected.size === 1 ? 'm' : 'ns'} de "${first.name}".`}
              {' '}A movimentação fica registrada no histórico de cada item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {moveScope === 'quantity' && originOptions.length > 1 && (
              <div>
                <Label>Sair de</Label>
                <Select value={moveForm.from_location_id} onValueChange={(v) => setMoveForm((f) => ({ ...f, from_location_id: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Qualquer unidade</SelectItem>
                    {originOptions.map((o) => <SelectItem key={o.id || 'none'} value={o.id}>{o.name} ({o.count})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {moveScope === 'quantity' && byVariant.length > 1 && (
              <div>
                <Label>Variante</Label>
                <Select value={moveForm.variant} onValueChange={(v) => setMoveForm((f) => ({ ...f, variant: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Qualquer variante</SelectItem>
                    {[...new Set(units.map((u) => u.variant || ''))].map((v) => <SelectItem key={v || 'default'} value={v}>{v || 'Padrão'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Nova unidade *</Label><Select value={moveForm.to_location_id} onValueChange={(v) => setMoveForm((f) => ({ ...f, to_location_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            {moveScope === 'quantity' && (
              <div>
                <Label>Quantidade *</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min="1" max={movable.length} placeholder="Ex: 4" value={moveForm.quantity} onChange={(e) => setMoveForm((f) => ({ ...f, quantity: e.target.value }))} className="w-28" />
                  <span className="text-sm text-muted-foreground">de {movable.length} disponíve{movable.length === 1 ? 'l' : 'is'}</span>
                  {movable.length > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => setMoveForm((f) => ({ ...f, quantity: String(movable.length) }))}>Todas</Button>}
                </div>
                {toMove.length > 0 && moveQuantity <= movable.length && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Vão os itens <span className="font-mono text-foreground">{describeNumbers(toMove.map((u) => u.asset_number))}</span>. Separe as peças com essas etiquetas.
                  </p>
                )}
              </div>
            )}
            <div><Label>Local na nova unidade</Label><Input value={moveForm.location_detail} onChange={(e) => setMoveForm((f) => ({ ...f, location_detail: e.target.value }))} placeholder="Ex: Salão, armário 2" /></div>
            <div><Label>Responsável</Label><Input value={moveForm.responsible_person} onChange={(e) => setMoveForm((f) => ({ ...f, responsible_person: e.target.value }))} /></div>
            <div><Label>Tipo</Label><Select value={moveForm.movement_type} onValueChange={(v) => setMoveForm((f) => ({ ...f, movement_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MOVEMENT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Observação</Label><Textarea value={moveForm.notes} onChange={(e) => setMoveForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveScope(null)} disabled={working}>Cancelar</Button>
            <Button onClick={handleMove} disabled={working}>{working && <Loader2 className="animate-spin" />}Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar status/condição dos selecionados */}
      <Dialog open={!!stateScope} onOpenChange={(v) => { if (!v) setStateScope(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar status/condição</DialogTitle>
            <DialogDescription>{stateCount} ite{stateCount === 1 ? 'm' : 'ns'} de &quot;{first.name}&quot;.</DialogDescription>
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
            <Button onClick={handleState} disabled={working}>{working && <Loader2 className="animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteScope}
        onOpenChange={(v) => { if (!v) setDeleteScope(null); }}
        title={deleteScope === 'all' ? 'Excluir lote inteiro?' : `Excluir ${selected.size} patrimônios?`}
        description={deleteScope === 'all'
          ? `Isso vai apagar os ${units.length} itens deste lote ("${first.name}") e todo o histórico deles (movimentações, manutenções, documentos e registros de inventário) para sempre. Essa ação não pode ser desfeita.`
          : `Isso vai apagar ${selected.size} ite${selected.size === 1 ? 'm' : 'ns'} selecionado${selected.size === 1 ? '' : 's'} e todo o histórico deles para sempre. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir permanentemente"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </Layout>
  );
}
