import { db } from '@/lib/db';

import React, { useState } from 'react';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Save, Loader2, Upload, Church } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { Settings as SettingsIcon } from 'lucide-react';

export default function Configuracoes() {
  const { settings, user, refresh } = useApp();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);

  if (user?.role !== 'admin') {
    return <Layout><EmptyState icon={SettingsIcon} title="Acesso restrito" description="Apenas administradores podem alterar configurações." /></Layout>;
  }
  if (!form) return <Layout><div className="h-40 rounded bg-muted animate-pulse" /></Layout>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set('church_logo_url', file_url);
    } catch (err) { toast.error('Erro ao enviar logo'); }
    finally { setUploading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await db.entities.SystemSettings.update(form.id, {
        church_name: form.church_name,
        church_logo_url: form.church_logo_url,
        asset_prefix: form.asset_prefix,
        digit_count: Number(form.digit_count) || 6,
        public_asset_lookup: form.public_asset_lookup
      });
      await refresh();
      toast.success('Configurações salvas');
    } catch (e) { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const preview = `${form.asset_prefix || 'PAT'}-${String(form.next_asset_sequence || 1).padStart(Number(form.digit_count) || 6, '0')}`;

  return (
    <Layout>
      <PageHeader title="Configurações" description="Ajuste as preferências do sistema" />
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2"><Church className="w-4 h-4" /> Igreja</h3>
          <div><Label>Nome da igreja</Label><Input value={form.church_name || ''} onChange={(e) => set('church_name', e.target.value)} /></div>
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {form.church_logo_url ? <img src={form.church_logo_url} alt="" className="h-12 object-contain" /> : <div className="h-12 w-12 rounded bg-muted flex items-center justify-center"><Upload className="w-5 h-5 text-muted-foreground" /></div>}
              <input type="file" accept="image/*" onChange={handleLogo} className="text-sm" />
              {uploading && <span className="text-xs text-muted-foreground">Enviando...</span>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Patrimônio</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Prefixo</Label><Input value={form.asset_prefix || ''} onChange={(e) => set('asset_prefix', e.target.value.toUpperCase())} placeholder="PAT" /></div>
            <div><Label>Quantidade de dígitos</Label><Input type="number" min={4} max={10} value={form.digit_count || 6} onChange={(e) => set('digit_count', e.target.value)} /></div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Próximo número: </span>
            <span className="font-mono font-bold">{preview}</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold">Consulta pública</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Consulta pública por QR Code</p>
              <p className="text-xs text-muted-foreground">Permite abrir a ficha do patrimônio sem login (informações limitadas)</p>
            </div>
            <Switch checked={form.public_asset_lookup || false} onCheckedChange={(v) => set('public_asset_lookup', v)} />
          </div>
        </div>

        <Button onClick={save} disabled={saving || uploading}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? 'Salvando...' : 'Salvar configurações'}
        </Button>
      </div>
    </Layout>
  );
}