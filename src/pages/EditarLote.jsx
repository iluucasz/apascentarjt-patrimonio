import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Loader2, Camera, Plus, Trash2 } from 'lucide-react';
import { Image } from '@/components/ui/image';
import PhotoPicker from '@/components/PhotoPicker';
import { STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { canDeleteAsset } from '@/lib/permissions';

// Valor de Select para "não alterar": usado quando as unidades do lote já estão
// com status/condição/local diferentes entre si.
const KEEP = '__keep';
const MAX_BATCH_QUANTITY = 1000;

function uniformValue(list, key) {
  const values = new Set(list.map((u) => u[key] || ''));
  return values.size === 1 ? [...values][0] : null;
}

const qtyOf = (row) => Math.max(0, Math.floor(Number(row.quantity) || 0));
const rowLabel = (row) => (row.isNew ? row.label.trim() : row.variant || 'Padrão');

export default function EditarLote() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { user, categories, locations } = useApp();
  const [units, setUnits] = useState(null);
  const [form, setForm] = useState(null);
  const [mixed, setMixed] = useState({ status: false, condition: false, location: false, detail: false });
  const [variantRows, setVariantRows] = useState([]);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const canReduce = canDeleteAsset(user);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.filter({ batch_id: batchId }, 'asset_number', 2000);
        if (list.length === 0) { toast.error('Lote não encontrado'); navigate('/patrimonios'); return; }
        setUnits(list);
        const first = list[0];
        const status = uniformValue(list, 'status');
        const condition = uniformValue(list, 'condition');
        const location = uniformValue(list, 'location_id');
        const detail = uniformValue(list, 'location_detail');
        setMixed({ status: status === null, condition: condition === null, location: location === null, detail: detail === null });
        setForm({
          name: first.name || '', description: first.description || '', category_id: first.category_id || '',
          brand: first.brand || '', model: first.model || '', location_id: location ?? KEEP,
          responsible_person: first.responsible_person || '', acquisition_date: first.acquisition_date || '',
          acquisition_value: first.acquisition_value || '', supplier: first.supplier || '', invoice_number: first.invoice_number || '',
          notes: first.notes || '', status: status ?? KEEP, condition: condition ?? KEEP, location_detail: detail ?? '',
        });
        const groups = new Map();
        for (const u of list) {
          const key = u.variant || '';
          if (!groups.has(key)) groups.set(key, { rowId: `v:${key}`, variant: key, label: '', isNew: false, original: 0, photo_url: u.photo_url || '' });
          groups.get(key).original += 1;
        }
        setVariantRows([...groups.values()].map((g) => ({ ...g, quantity: String(g.original) })));
      } catch (e) { toast.error('Erro ao carregar lote'); }
    })();
  }, [batchId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setRow = (rowId, k, v) => setVariantRows((rows) => rows.map((r) => (r.rowId === rowId ? { ...r, [k]: v } : r)));
  const addRow = () => setVariantRows((rows) => [
    ...rows,
    { rowId: `new:${Date.now()}`, variant: '', label: '', isNew: true, original: 0, quantity: '1', photo_url: '' },
  ]);
  const removeRow = (rowId) => setVariantRows((rows) => rows.filter((r) => r.rowId !== rowId));

  const total = variantRows.reduce((sum, r) => sum + qtyOf(r), 0);
  const added = variantRows.reduce((sum, r) => sum + Math.max(0, qtyOf(r) - r.original), 0);
  const removed = variantRows.reduce((sum, r) => sum + Math.max(0, r.original - qtyOf(r)), 0);

  const handleVariantPhoto = async (rowId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey(rowId);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setRow(rowId, 'photo_url', file_url);
    } catch (err) { toast.error('Erro ao enviar foto'); }
    finally { setUploadingKey(null); }
  };

  const validate = () => {
    if (!form.name) return 'Informe o nome';
    const activeRows = variantRows.filter((r) => !(r.isNew && qtyOf(r) === 0));
    if (activeRows.some((r) => r.isNew && !r.label.trim())) return 'Informe o nome de cada variante nova';
    const labels = activeRows.map((r) => rowLabel(r).toLowerCase());
    if (new Set(labels).size !== labels.length) return 'Há variantes com o mesmo nome';
    if (total < 1) return 'O lote precisa ter ao menos um item. Para apagar tudo, use "Excluir lote inteiro".';
    if (total > MAX_BATCH_QUANTITY) return `Máximo de ${MAX_BATCH_QUANTITY} itens por lote`;
    if (removed > 0 && !canReduce) return 'Apenas administradores podem reduzir a quantidade';
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validate();
    if (error) { toast.error(error); return; }
    if (removed > 0) { setConfirmOpen(true); return; }
    save();
  };

  const save = async () => {
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const res = await db.functions.invoke('updateAssetBatch', {
        batch_id: batchId,
        ...form,
        category_name: cat?.name || '',
        location_id: form.location_id === KEEP ? null : form.location_id,
        status: form.status === KEEP ? null : form.status,
        condition: form.condition === KEEP ? null : form.condition,
        // Itens com Locais diferentes e campo em branco = manter o de cada item.
        location_detail: mixed.detail && !form.location_detail ? null : form.location_detail,
        acquisition_value: form.acquisition_value ? Number(form.acquisition_value) : 0,
        variants: variantRows
          .filter((r) => !(r.isNew && qtyOf(r) === 0))
          .map((r) => ({ variant: r.isNew ? r.label.trim() : r.variant, quantity: qtyOf(r), photo_url: r.photo_url })),
      });
      const { added: addedCount, removed: removedCount } = res.data;
      const parts = ['Lote atualizado'];
      if (addedCount) parts.push(`${addedCount} ite${addedCount === 1 ? 'm' : 'ns'} novo${addedCount === 1 ? '' : 's'} (lembre de imprimir as etiquetas)`);
      if (removedCount) parts.push(`${removedCount} ite${removedCount === 1 ? 'm' : 'ns'} excluído${removedCount === 1 ? '' : 's'}`);
      toast.success(parts.join(' · '));
      navigate(`/patrimonios/lote/${batchId}`);
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao atualizar lote'); }
    finally { setSaving(false); setConfirmOpen(false); }
  };

  if (!form) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  const singleDefault = variantRows.length === 1 && !variantRows[0].isNew && !variantRows[0].variant;

  return (
    <Layout>
      <PageHeader title="Editar lote" description={`${units.length} itens`} />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Label>Nome do patrimônio *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div><Label>Categoria</Label><Select value={form.category_id} onValueChange={(v) => set('category_id', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div>
              <Label>Unidade</Label>
              <Select value={form.location_id} onValueChange={(v) => set('location_id', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {mixed.location && <SelectItem value={KEEP}>Várias unidades (manter cada item onde está)</SelectItem>}
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Mudar a unidade registra uma transferência no histórico de cada item.</p>
            </div>
            <div>
              <Label>Local</Label>
              <Input value={form.location_detail} onChange={(e) => set('location_detail', e.target.value)} placeholder={mixed.detail ? 'Vários (deixe em branco para manter o de cada item)' : 'Ex: Salão, armário 2'} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mixed.status && <SelectItem value={KEEP}>Vários (manter o de cada item)</SelectItem>}
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condição</Label>
              <Select value={form.condition} onValueChange={(v) => set('condition', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {mixed.condition && <SelectItem value={KEEP}>Várias (manter a de cada item)</SelectItem>}
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} /></div>
            <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
            <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
            <div><Label>Responsável</Label><Input value={form.responsible_person} onChange={(e) => set('responsible_person', e.target.value)} /></div>
            <div><Label>Data de aquisição</Label><Input type="date" value={form.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} /></div>
            <div><Label>Valor de aquisição (R$)</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={(e) => set('acquisition_value', e.target.value)} /></div>
            <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></div>
            <div><Label>Número da nota fiscal</Label><Input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Status e condição escolhidos aqui valem para todos os itens. Para mudar só alguns, selecione-os na página do lote. O número de série continua individual de cada item.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-semibold">{singleDefault ? 'Quantidade e foto' : 'Variantes, quantidades e fotos'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aumentar a quantidade cria novos itens com números patrimoniais novos.
              {canReduce
                ? ' Diminuir exclui os itens cadastrados por último (para escolher quais, use a seleção na página do lote).'
                : ' Apenas administradores podem diminuir a quantidade.'}
            </p>
          </div>
          <div className="space-y-3">
            {variantRows.map((r) => (
              <div key={r.rowId} className="flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-lg border border-border p-3">
                {r.photo_url ? (
                  <Image src={r.photo_url} className="w-16 h-16 rounded-lg object-cover shrink-0" fittingType="fill" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0"><Camera className="w-6 h-6 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  {r.isNew ? (
                    <Input placeholder="Nome da variante (ex: Encosto azul)" value={r.label} onChange={(e) => setRow(r.rowId, 'label', e.target.value)} className="mb-1" />
                  ) : (
                    <p className="font-medium truncate">{rowLabel(r)}</p>
                  )}
                  <div className="mt-1"><PhotoPicker onChange={(e) => handleVariantPhoto(r.rowId, e)} disabled={!!uploadingKey} /></div>
                  {uploadingKey === r.rowId && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
                </div>
                <div className="w-24 shrink-0">
                  <Label className="text-xs">Quantidade</Label>
                  <Input type="number" min={canReduce ? 0 : r.original} value={r.quantity} onChange={(e) => setRow(r.rowId, 'quantity', e.target.value)} />
                  {!r.isNew && qtyOf(r) !== r.original && <p className="text-[11px] text-muted-foreground mt-0.5">antes: {r.original}</p>}
                </div>
                {r.isNew && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(r.rowId)} title="Remover variante"><Trash2 className="w-4 h-4" /></Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> Adicionar variante</Button>
            <div className="text-sm text-right">
              <p className="font-medium">Total: {total} ite{total === 1 ? 'm' : 'ns'}{total !== units.length && <span className="text-muted-foreground font-normal"> (antes {units.length})</span>}</p>
              {added > 0 && <p className="text-xs text-emerald-600">+{added} ite{added === 1 ? 'm' : 'ns'} novo{added === 1 ? '' : 's'}</p>}
              {removed > 0 && <p className="text-xs text-destructive">−{removed} ite{removed === 1 ? 'm' : 'ns'} será{removed === 1 ? '' : 'ão'} excluído{removed === 1 ? '' : 's'}</p>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !!uploadingKey}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{saving ? 'Salvando...' : 'Salvar'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Excluir ${removed} ite${removed === 1 ? 'm' : 'ns'}?`}
        description={`Diminuir a quantidade vai apagar ${removed} ite${removed === 1 ? 'm' : 'ns'} (os cadastrados por último de cada variante) e todo o histórico deles. Para escolher exatamente quais itens sair, cancele e use a seleção na página do lote. Essa ação não pode ser desfeita.`}
        confirmLabel="Salvar e excluir"
        loading={saving}
        onConfirm={save}
      />
    </Layout>
  );
}
