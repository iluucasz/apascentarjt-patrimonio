import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Loader2, Camera, Layers } from 'lucide-react';
import { STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { Image } from '@/components/ui/image';

export default function EditarPatrimonio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, categories, locations } = useApp();
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await db.entities.Asset.filter({ id });
        if (list.length === 0) { toast.error('Patrimônio não encontrado'); navigate('/patrimonios'); return; }
        const a = list[0];
        setOriginal(a);
        setForm({
          name: a.name || '', description: a.description || '', category_id: a.category_id || '', brand: a.brand || '',
          model: a.model || '', serial_number: a.serial_number || '', location_id: a.location_id || '',
          responsible_person: a.responsible_person || '', acquisition_date: a.acquisition_date || '',
          acquisition_value: a.acquisition_value || '', supplier: a.supplier || '', invoice_number: a.invoice_number || '',
          condition: a.condition || 'good', status: a.status || 'active', notes: a.notes || '', photo_url: a.photo_url || '',
          variant: a.variant || '', location_detail: a.location_detail || ''
        });
      } catch (e) { toast.error('Erro ao carregar'); }
    })();
  }, [id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
    } catch (err) { toast.error('Erro ao enviar foto'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Informe o nome'); return; }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const loc = locations.find((l) => l.id === form.location_id);
      // Trocar o local pela edição também entra no histórico de movimentações,
      // igual ao botão Movimentar da página do patrimônio.
      if (form.location_id && form.location_id !== (original.location_id || '')) {
        await db.entities.AssetMovement.create({
          asset_id: id, asset_number: original.asset_number, asset_name: form.name,
          from_location_id: original.location_id, from_location_name: original.location_name,
          to_location_id: form.location_id, to_location_name: loc?.name || '',
          movement_type: 'transfer', notes: 'Unidade alterada na edição do patrimônio',
          moved_by_name: user?.full_name || user?.email
        });
      }
      await db.entities.Asset.update(id, {
        ...form, category_name: cat?.name || '', location_name: loc?.name || '',
        acquisition_value: form.acquisition_value ? Number(form.acquisition_value) : 0
      });
      await db.entities.AuditLog.create({ action: 'asset_update', entity_type: 'Asset', entity_id: id, entity_label: '', user_name: '' });
      const qty = Math.floor(Number(quantity) || 1);
      if (!original.batch_id && qty > 1) {
        const res = await db.functions.invoke('expandAsset', { asset_id: id, quantity: qty });
        toast.success(`Patrimônio atualizado · agora é um lote com ${qty} itens (lembre de imprimir as etiquetas das novas)`);
        navigate(`/patrimonios/lote/${res.data.batch_id}`);
        return;
      }
      toast.success('Patrimônio atualizado');
      navigate(-1);
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao atualizar'); }
    finally { setSaving(false); }
  };

  if (!form) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  return (
    <Layout>
      <PageHeader title="Editar patrimônio" description={original.asset_number} />
      {original.batch_id && (
        <div className="max-w-3xl mb-4 rounded-lg border border-border bg-muted/50 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-muted-foreground" /> Este item faz parte de um lote. As alterações abaixo valem só para ele.</span>
          <Link to={`/patrimonios/lote/${original.batch_id}/editar`} className="font-medium text-primary hover:underline">Editar lote / quantidade</Link>
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={original.batch_id ? 'md:col-span-2' : ''}><Label>Nome do patrimônio *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} required /></div>
            {!original.batch_id && (
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                {Number(quantity) > 1 && <p className="text-xs text-muted-foreground mt-1">Serão criados mais {Math.floor(Number(quantity)) - 1} item(ns) iguais a este, cada um com número e QR Code próprios, formando um lote.</p>}
              </div>
            )}
            <div><Label>Categoria</Label><Select value={form.category_id} onValueChange={(v) => set('category_id', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Unidade</Label><Select value={form.location_id} onValueChange={(v) => set('location_id', v)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Local</Label><Input value={form.location_detail} onChange={(e) => set('location_detail', e.target.value)} placeholder="Ex: Salão, armário 2" /></div>
            <div className="md:col-span-2"><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} /></div>
            <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} /></div>
            <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
            <div><Label>Variante</Label><Input value={form.variant} onChange={(e) => set('variant', e.target.value)} placeholder="Ex: Encosto azul" /></div>
            <div><Label>Número de série</Label><Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
            <div><Label>Responsável</Label><Input value={form.responsible_person} onChange={(e) => set('responsible_person', e.target.value)} /></div>
            <div><Label>Data de aquisição</Label><Input type="date" value={form.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} /></div>
            <div><Label>Valor de aquisição (R$)</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={(e) => set('acquisition_value', e.target.value)} /></div>
            <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></div>
            <div><Label>Número da nota fiscal</Label><Input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} /></div>
            <div><Label>Condição</Label><Select value={form.condition} onValueChange={(v) => set('condition', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CONDITION_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={form.status} onValueChange={(v) => set('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <div>
            <Label>Foto</Label>
            <div className="flex items-center gap-4">
              {form.photo_url ? <Image src={form.photo_url} className="w-24 h-24 rounded-lg object-cover" fittingType="fill" /> : <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center"><Camera className="w-8 h-8 text-muted-foreground" /></div>}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || uploading}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}{saving ? 'Salvando...' : 'Salvar'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        </div>
      </form>
    </Layout>
  );
}