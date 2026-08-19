import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { MapPin, Plus, Pencil, Power } from 'lucide-react';

export default function Locais() {
  const { locations, refresh } = useApp();
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parent_location_id: '' });

  useEffect(() => {
    (async () => {
      try { setAssets(await db.entities.Asset.list('-updated_date', 1000)); } catch (e) {}
    })();
  }, []);

  const count = (locId) => assets.filter((a) => a.location_id === locId).length;

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', parent_location_id: '' }); setOpen(true); };
  const openEdit = (l) => { setEditing(l); setForm({ name: l.name, description: l.description || '', parent_location_id: l.parent_location_id || '' }); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error('Informe o nome'); return; }
    try {
      const parent = locations.find((l) => l.id === form.parent_location_id);
      if (editing) {
        await db.entities.Location.update(editing.id, { ...form, parent_location_name: parent?.name || '' });
      } else {
        await db.entities.Location.create({ ...form, parent_location_name: parent?.name || '', active: true });
      }
      setOpen(false);
      await refresh();
      toast.success('Local salvo');
    } catch (e) { toast.error('Erro ao salvar'); }
  };

  const toggleActive = async (l) => {
    try { await db.entities.Location.update(l.id, { active: !l.active }); await refresh(); toast.success('Atualizado'); }
    catch (e) { toast.error('Erro'); }
  };

  return (
    <Layout>
      <PageHeader title="Locais" description="Cadastre e organize os locais da igreja">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo local</Button>
      </PageHeader>
      {locations.length === 0 ? (
        <EmptyState icon={MapPin} title="Nenhum local cadastrado" action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo local</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {locations.map((l) => (
            <div key={l.id} className={`rounded-xl border border-border bg-card p-4 ${l.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{l.name}</p>
                  {l.parent_location_name && <p className="text-xs text-muted-foreground">↳ {l.parent_location_name}</p>}
                  {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{count(l.id)} patrim.</span>
              </div>
              <div className="flex gap-1 mt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(l)}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(l)}><Power className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar local' : 'Novo local'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div><Label>Local pai (opcional)</Label><Select value={form.parent_location_id} onValueChange={(v) => setForm(f => ({...f, parent_location_id: v}))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent>{locations.filter((l) => l.id !== editing?.id).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}