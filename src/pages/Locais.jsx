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
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { MapPin, Plus, Pencil, Power, Trash2, Star } from 'lucide-react';
import { locationTree } from '@/lib/locations';

// Valor do Select para "sem local pai" (Radix não aceita value vazio).
const NO_PARENT = '__none';

export default function Locais() {
  const { user, locations, scopeLocations, refresh } = useApp();
  const isAdmin = user?.role === 'admin';
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', parent_location_id: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try { setAssets(await db.entities.Asset.list('-updated_date')); } catch (e) {}
    })();
  }, []);

  const count = (locId) => assets.filter((a) => a.location_id === locId).length;

  const openNew = () => { setEditing(null); setForm({ name: '', description: '', parent_location_id: '' }); setOpen(true); };
  const tree = locationTree(scopeLocations);
  const openEdit = (l) => { setEditing(l); setForm({ name: l.name, description: l.description || '', parent_location_id: l.parent_location_id || '' }); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error('Informe o nome'); return; }
    try {
      const parent = locations.find((l) => l.id === form.parent_location_id);
      const data = { ...form, parent_location_id: parent ? parent.id : '', parent_location_name: parent?.name || '' };
      if (editing) {
        await db.entities.Location.update(editing.id, data);
      } else {
        await db.entities.Location.create({ ...data, active: true });
      }
      setOpen(false);
      await refresh();
      toast.success('Local salvo');
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao salvar'); }
  };

  const toggleActive = async (l) => {
    try { await db.entities.Location.update(l.id, { active: !l.active }); await refresh(); toast.success('Atualizado'); }
    catch (e) { toast.error('Erro'); }
  };

  // A filial principal é a visão geral do seletor (mostra tudo). Só pode haver uma.
  const toggleMain = async (l) => {
    try {
      if (l.is_main) {
        await db.entities.Location.update(l.id, { is_main: false });
      } else {
        for (const other of locations.filter((o) => o.is_main)) {
          await db.entities.Location.update(other.id, { is_main: false });
        }
        await db.entities.Location.update(l.id, { is_main: true });
      }
      await refresh();
      toast.success(l.is_main ? 'Filial principal removida' : `${l.name} agora é a filial principal`);
    } catch (e) { toast.error(e?.response?.data?.error || 'Erro ao definir filial principal'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await db.entities.Location.delete(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      toast.success('Local excluído');
    } catch (e) {
      toast.error('Erro ao excluir local');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <PageHeader title="Locais" description="Locais sem local pai são filiais e aparecem no seletor da barra lateral; a filial principal mostra o patrimônio de todas">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo local</Button>
      </PageHeader>
      {scopeLocations.length === 0 ? (
        <EmptyState icon={MapPin} title="Nenhum local cadastrado" action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo local</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tree.map(({ location: l }) => (
            <div key={l.id} className={`rounded-xl border border-border bg-card p-4 ${l.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold truncate">{l.name}</p>
                    {l.is_main && <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary">Principal</span>}
                    {!l.is_main && !l.parent_location_id && <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Filial</span>}
                  </div>
                  {l.parent_location_name && <p className="text-xs text-muted-foreground">↳ {l.parent_location_name}</p>}
                  {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{count(l.id)} patrim.</span>
              </div>
              <div className="flex gap-1 mt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(l)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(l)} title={l.active ? 'Desativar' : 'Ativar'}><Power className="w-4 h-4" /></Button>
                {isAdmin && !l.parent_location_id && (
                  <Button size="sm" variant="ghost" onClick={() => toggleMain(l)} title={l.is_main ? 'Deixar de ser a principal' : 'Tornar filial principal'}>
                    <Star className={`w-4 h-4 ${l.is_main ? 'fill-current text-amber-500' : ''}`} />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-600" onClick={() => setDeleteTarget(l)} title="Excluir"><Trash2 className="w-4 h-4" /></Button>
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
            <div><Label>Local pai (opcional)</Label><Select value={form.parent_location_id || NO_PARENT} onValueChange={(v) => setForm(f => ({...f, parent_location_id: v === NO_PARENT ? '' : v}))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value={NO_PARENT}>Nenhum (é uma filial)</SelectItem>{scopeLocations.filter((l) => l.id !== editing?.id).map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Excluir local?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? ${deleteTarget ? count(deleteTarget.id) : 0} patrimônio(s) estão neste local e ficarão sem local. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}