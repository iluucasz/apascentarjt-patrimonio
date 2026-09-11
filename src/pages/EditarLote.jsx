import { db } from '@/lib/db';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Loader2, Camera } from 'lucide-react';
import { Image } from '@/components/ui/image';

export default function EditarLote() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { categories, locations } = useApp();
  const [units, setUnits] = useState(null);
  const [form, setForm] = useState(null);
  const [variantPhotos, setVariantPhotos] = useState({});
  const [uploadingKey, setUploadingKey] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.filter({ batch_id: batchId }, 'asset_number');
        if (list.length === 0) { toast.error('Lote não encontrado'); navigate('/patrimonios'); return; }
        setUnits(list);
        const first = list[0];
        setForm({
          name: first.name || '', description: first.description || '', category_id: first.category_id || '',
          brand: first.brand || '', model: first.model || '', location_id: first.location_id || '',
          responsible_person: first.responsible_person || '', acquisition_date: first.acquisition_date || '',
          acquisition_value: first.acquisition_value || '', supplier: first.supplier || '', invoice_number: first.invoice_number || '',
          notes: first.notes || '',
        });
        const photosByVariant = {};
        for (const u of list) {
          const key = u.variant || '';
          if (!(key in photosByVariant)) photosByVariant[key] = u.photo_url || '';
        }
        setVariantPhotos(photosByVariant);
      } catch (e) { toast.error('Erro ao carregar lote'); }
    })();
  }, [batchId]);

  const variantGroups = useMemo(() => {
    if (!units) return [];
    const counts = new Map();
    for (const u of units) {
      const key = u.variant || '';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].map(([key, count]) => ({ key, label: key || 'Padrão', count }));
  }, [units]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleVariantPhoto = async (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      setVariantPhotos((p) => ({ ...p, [key]: file_url }));
    } catch (err) { toast.error('Erro ao enviar foto'); }
    finally { setUploadingKey(null); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const loc = locations.find((l) => l.id === form.location_id);
      await db.functions.invoke('updateAssetBatch', {
        batch_id: batchId,
        ...form,
        category_name: cat?.name || '',
        location_name: loc?.name || '',
        acquisition_value: form.acquisition_value ? Number(form.acquisition_value) : 0,
        variant_photos: variantGroups.map((g) => ({ variant: g.key, photo_url: variantPhotos[g.key] || '' })),
      });
      toast.success('Lote atualizado');
      navigate(`/patrimonios/lote/${batchId}`);
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao atualizar lote'); }
    finally { setSaving(false); }
  };

  if (!form) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  return (
    <Layout>
      <PageHeader title="Editar lote" description={`${units.length} unidades`} />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Label>Nome do patrimônio *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            <div><Label>Categoria</Label><Select value={form.category_id} onValueChange={(v) => set('category_id', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Local</Label><Select value={form.location_id} onValueChange={(v) => set('location_id', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
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
            Status, condição e número de série são individuais de cada unidade e continuam editáveis abrindo o patrimônio específico.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-semibold">Fotos</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {variantGroups.length > 1
                ? 'Cada variante pode ter sua própria foto.'
                : 'Foto usada por todas as unidades do lote.'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {variantGroups.map((g) => (
              <div key={g.key} className="flex items-center gap-4 rounded-lg border border-border p-3">
                {variantPhotos[g.key] ? (
                  <Image src={variantPhotos[g.key]} className="w-16 h-16 rounded-lg object-cover shrink-0" fittingType="fill" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0"><Camera className="w-6 h-6 text-muted-foreground" /></div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{g.label}</p>
                  <p className="text-xs text-muted-foreground mb-1">{g.count} unidade{g.count === 1 ? '' : 's'}</p>
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => handleVariantPhoto(g.key, e)} className="text-xs w-full" />
                  {uploadingKey === g.key && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={saving || !!uploadingKey}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{saving ? 'Salvando...' : 'Salvar'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </Layout>
  );
}
