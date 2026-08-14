const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Camera, Loader2, CheckCircle2, Printer, PackagePlus } from 'lucide-react';
import { STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { Image } from '@/components/ui/image';
import AssetQRCode from '@/components/AssetQRCode';
import AssetBarcode from '@/components/AssetBarcode';

export default function NovoPatrimonio() {
  const { categories, locations, user, settings } = useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', category_id: '', brand: '', model: '', serial_number: '',
    location_id: '', responsible_person: '', acquisition_date: '', acquisition_value: '',
    supplier: '', invoice_number: '', condition: 'good', status: 'active', notes: '', photo_url: ''
  });
  const [uploading, setUploading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
      toast.success('Foto enviada');
    } catch (err) {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.category_id || !form.location_id) {
      toast.error('Preencha nome, categoria e local');
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const loc = locations.find((l) => l.id === form.location_id);
      const payload = {
        ...form,
        category_name: cat?.name || '',
        location_name: loc?.name || '',
        acquisition_value: form.acquisition_value ? Number(form.acquisition_value) : 0
      };
      const res = await db.functions.invoke('createAsset', payload);
      const asset = res.data.asset;
      setCreated(asset);
      toast.success('Patrimônio cadastrado com sucesso');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao cadastrar patrimônio');
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    const appUrl = window.location.origin;
    const url = `${appUrl}/p/${created.asset_number}`;
    return (
      <Layout>
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold">Patrimônio cadastrado com sucesso</h2>
          <p className="font-mono text-2xl font-bold mt-3 text-primary">{created.asset_number}</p>
          <p className="text-muted-foreground mt-1">{created.name}</p>
          <div className="flex justify-center gap-6 mt-6 py-4 border-y border-border">
            <div className="text-center">
              <AssetQRCode value={url} size={120} />
              <p className="text-xs text-muted-foreground mt-1">QR Code</p>
            </div>
            <div className="text-center flex flex-col justify-center">
              <AssetBarcode value={created.asset_number} height={50} fontSize={12} />
              <p className="text-xs text-muted-foreground mt-1">Code 128</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            <Button className="flex-1" onClick={() => navigate(`/p/${created.asset_number}`)}>Ver patrimônio</Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate(`/etiquetas?ids=${created.id}`)}><Printer className="w-4 h-4 mr-2" /> Imprimir etiqueta</Button>
            <Button variant="outline" className="flex-1" onClick={() => { setCreated(null); setForm({ name: '', description: '', category_id: '', brand: '', model: '', serial_number: '', location_id: '', responsible_person: '', acquisition_date: '', acquisition_value: '', supplier: '', invoice_number: '', condition: 'good', status: 'active', notes: '', photo_url: '' }); }}><PackagePlus className="w-4 h-4 mr-2" /> Cadastrar outro</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader title="Novo patrimônio" description="O número patrimonial será gerado automaticamente" />
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex items-center gap-2">
            <span className="font-mono font-semibold text-foreground">Número patrimonial:</span>
            Gerado automaticamente ({settings?.asset_prefix || 'PAT'}-{String(settings?.next_asset_sequence || 1).padStart(settings?.digit_count || 6, '0')})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label>Nome do patrimônio *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex: Mesa de Som Behringer X32" />
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => set('category_id', v)} required>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local *</Label>
              <Select value={form.location_id} onValueChange={(v) => set('location_id', v)} required>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
            </div>
            <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Ex: Behringer" /></div>
            <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="Ex: X32" /></div>
            <div><Label>Número de série</Label><Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>
            <div><Label>Responsável</Label><Input value={form.responsible_person} onChange={(e) => set('responsible_person', e.target.value)} /></div>
            <div><Label>Data de aquisição</Label><Input type="date" value={form.acquisition_date} onChange={(e) => set('acquisition_date', e.target.value)} /></div>
            <div><Label>Valor de aquisição (R$)</Label><Input type="number" step="0.01" value={form.acquisition_value} onChange={(e) => set('acquisition_value', e.target.value)} placeholder="0,00" /></div>
            <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></div>
            <div><Label>Número da nota fiscal</Label><Input value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)} /></div>
            <div>
              <Label>Estado/conservação</Label>
              <Select value={form.condition} onValueChange={(v) => set('condition', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONDITION_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(STATUS_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>
          </div>
          <div>
            <Label>Foto</Label>
            <div className="flex items-center gap-4">
              {form.photo_url ? (
                <Image src={form.photo_url} className="w-24 h-24 rounded-lg object-cover" fittingType="fill" />
              ) : (
                <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center"><Camera className="w-8 h-8 text-muted-foreground" /></div>
              )}
              <div>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="text-sm" />
                {uploading && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || uploading}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'Salvando...' : 'Salvar patrimônio'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/patrimonios')}>Cancelar</Button>
        </div>
      </form>
    </Layout>
  );
}