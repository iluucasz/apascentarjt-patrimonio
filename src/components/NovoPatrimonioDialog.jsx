import { db } from '@/lib/db';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, Camera, Loader2, CheckCircle2, Printer, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { STATUS_LABELS, CONDITION_LABELS } from '@/lib/format';
import { Image } from '@/components/ui/image';
import AssetQRCode from '@/components/AssetQRCode';
import AssetBarcode from '@/components/AssetBarcode';

const EMPTY_FORM = {
  name: '', description: '', category_id: '', brand: '', model: '', serial_number: '',
  location_id: '', responsible_person: '', acquisition_date: '', acquisition_value: '',
  supplier: '', invoice_number: '', condition: 'good', status: 'active', notes: '', photo_url: ''
};
const EMPTY_VARIANTS = [{ label: '', quantity: '' }];

export default function NovoPatrimonioDialog({ open, onOpenChange, onCreated }) {
  const { categories, locations, settings } = useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [quantity, setQuantity] = useState('1');
  const [useVariants, setUseVariants] = useState(false);
  const [variants, setVariants] = useState(EMPTY_VARIANTS);
  const [uploading, setUploading] = useState(false);

  const qty = Math.max(1, Number(quantity) || 1);
  const isMulti = qty > 1;
  const variantSum = variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setVariantField = (idx, k, v) => setVariants((vs) => vs.map((row, i) => (i === idx ? { ...row, [k]: v } : row)));
  const addVariant = () => setVariants((vs) => [...vs, { label: '', quantity: '' }]);
  const removeVariant = (idx) => setVariants((vs) => (vs.length > 1 ? vs.filter((_, i) => i !== idx) : vs));

  const resetAll = () => {
    setForm(EMPTY_FORM);
    setQuantity('1');
    setUseVariants(false);
    setVariants(EMPTY_VARIANTS);
  };

  const handleOpenChange = (next) => {
    if (!next) {
      setCreated(null);
      resetAll();
    }
    onOpenChange(next);
  };

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
    if (isMulti && useVariants && variantSum !== qty) {
      toast.error(`A soma das variantes (${variantSum}) deve ser igual à quantidade informada (${qty})`);
      return;
    }
    setSaving(true);
    try {
      const cat = categories.find((c) => c.id === form.category_id);
      const loc = locations.find((l) => l.id === form.location_id);
      const basePayload = {
        ...form,
        category_name: cat?.name || '',
        location_name: loc?.name || '',
        acquisition_value: form.acquisition_value ? Number(form.acquisition_value) : 0,
      };

      if (!isMulti) {
        const res = await db.functions.invoke('createAsset', basePayload);
        const asset = res.data.asset;
        setCreated(asset);
        toast.success('Patrimônio cadastrado com sucesso');
        onCreated?.(asset);
      } else {
        const cleanVariants = useVariants
          ? variants.map((v) => ({ label: v.label.trim(), quantity: Number(v.quantity) || 0 })).filter((v) => v.quantity > 0)
          : [{ label: '', quantity: qty }];
        const res = await db.functions.invoke('createAssetBatch', { ...basePayload, variants: cleanVariants });
        setCreated({ batch: true, name: form.name, ...res.data });
        toast.success(`${res.data.count} patrimônios cadastrados com sucesso`);
        onCreated?.();
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao cadastrar patrimônio');
    } finally {
      setSaving(false);
    }
  };

  if (created?.batch) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold">{created.count} patrimônios cadastrados com sucesso</h2>
            <p className="text-muted-foreground mt-1">{created.name}</p>
            <p className="font-mono text-lg font-bold mt-3 text-primary">{created.first_asset_number} — {created.last_asset_number}</p>
            <p className="text-xs text-muted-foreground mt-1">Cada unidade tem seu próprio número e QR Code, prontos para imprimir.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <Button className="flex-1" onClick={() => { handleOpenChange(false); navigate(`/patrimonios/lote/${created.batch_id}`); }}>Ver lote</Button>
              <Button variant="outline" className="flex-1" onClick={() => { handleOpenChange(false); navigate(`/etiquetas?batch_id=${created.batch_id}`); }}><Printer className="w-4 h-4 mr-2" /> Imprimir etiquetas</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setCreated(null); resetAll(); }}><PackagePlus className="w-4 h-4 mr-2" /> Cadastrar outro</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (created) {
    const appUrl = window.location.origin;
    const url = `${appUrl}/p/${created.asset_number}`;
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="text-center">
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
              <Button className="flex-1" onClick={() => { handleOpenChange(false); navigate(`/p/${created.asset_number}`); }}>Ver patrimônio</Button>
              <Button variant="outline" className="flex-1" onClick={() => { handleOpenChange(false); navigate(`/etiquetas?ids=${created.id}`); }}><Printer className="w-4 h-4 mr-2" /> Imprimir etiqueta</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setCreated(null); resetAll(); }}><PackagePlus className="w-4 h-4 mr-2" /> Cadastrar outro</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo patrimônio</DialogTitle>
          <DialogDescription>
            {isMulti
              ? 'Cada unidade vira um patrimônio independente, com seu próprio número e QR Code'
              : 'O número patrimonial será gerado automaticamente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground">Número{isMulti ? 's' : ''} patrimonia{isMulti ? 'is' : 'l'}:</span>
              {isMulti
                ? `Gerados automaticamente, ${qty} no total (a partir de ${settings?.asset_prefix || 'PAT'}-${String(settings?.next_asset_sequence || 1).padStart(settings?.digit_count || 6, '0')})`
                : `Gerado automaticamente (${settings?.asset_prefix || 'PAT'}-${String(settings?.next_asset_sequence || 1).padStart(settings?.digit_count || 6, '0')})`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Nome do patrimônio *</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Ex: Mesa de Som Behringer X32" />
              </div>
              <div>
                <Label>Quantidade *</Label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
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
              {!isMulti && <div><Label>Número de série</Label><Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} /></div>}
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
            {isMulti && (
              <div className="rounded-lg border border-border p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={useVariants} onChange={(e) => setUseVariants(e.target.checked)} />
                  Dividir essa quantidade em variantes (cores, modelos, desenhos diferentes...)
                </label>
                {useVariants ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">A soma das variantes precisa fechar com a quantidade informada</span>
                      <span className={`text-xs font-semibold ${variantSum === qty ? 'text-emerald-600' : 'text-destructive'}`}>Soma: {variantSum} / {qty}</span>
                    </div>
                    <div className="space-y-2">
                      {variants.map((v, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input placeholder="Ex: Encosto azul" value={v.label} onChange={(e) => setVariantField(idx, 'label', e.target.value)} className="flex-1" />
                          <Input type="number" min="1" placeholder="Qtd" value={v.quantity} onChange={(e) => setVariantField(idx, 'quantity', e.target.value)} className="w-24" />
                          <Button type="button" size="icon" variant="ghost" onClick={() => removeVariant(idx)} disabled={variants.length === 1}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={addVariant}><Plus className="w-4 h-4 mr-1" /> Adicionar variante</Button>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Serão criadas {qty} unidades idênticas, cada uma com número e QR Code próprios.</p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || uploading || (isMulti && useVariants && variantSum !== qty)}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              {saving ? 'Salvando...' : isMulti ? `Cadastrar ${qty} patrimônios` : 'Salvar patrimônio'}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
