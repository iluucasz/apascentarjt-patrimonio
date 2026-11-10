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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { Tags, Plus, Pencil, Trash2 } from 'lucide-react';

export default function Categorias() {
  const { categories, refresh } = useApp();
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => { try { setAssets(await db.entities.Asset.list('-updated_date')); } catch (e) {} })();
  }, []);

  const count = (catId) => assets.filter((a) => a.category_id === catId).length;

  const openNew = () => { setEditing(null); setForm({ name: '', description: '' }); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ name: c.name, description: c.description || '' }); setOpen(true); };

  const save = async () => {
    if (!form.name) { toast.error('Informe o nome'); return; }
    try {
      if (editing) await db.entities.Category.update(editing.id, form);
      else await db.entities.Category.create({ ...form, active: true });
      setOpen(false);
      await refresh();
      toast.success('Categoria salva');
    } catch (e) { toast.error('Erro ao salvar'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await db.entities.Category.delete(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
      toast.success('Categoria excluída');
    } catch (e) {
      toast.error('Erro ao excluir categoria');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <PageHeader title="Categorias" description="Organize os patrimônios por categoria">
        <Button onClick={openNew}><Plus /> Nova categoria</Button>
      </PageHeader>
      {categories.length === 0 ? (
        <EmptyState icon={Tags} title="Nenhuma categoria cadastrada" description="Categorias ajudam a agrupar os patrimônios (som, mobiliário, informática…)." action={<Button onClick={openNew}><Plus /> Nova categoria</Button>} />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {categories.map((c) => (
            <li key={c.id} className="flex flex-col rounded-2xl border border-border bg-card shadow-card p-4 sm:p-5">
              <div className="mb-4 min-w-0">
                <p className="font-bold text-lg leading-snug break-words">{c.name}</p>
                {c.description && <p className="text-[15px] text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
              </div>
              <div className="mt-auto pt-3 border-t border-border flex items-center gap-1">
                <p className="mr-auto text-[15px] text-muted-foreground tnum"><b className="text-foreground text-lg">{count(c.id)}</b> patrimônio{count(c.id) === 1 ? '' : 's'}</p>
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title="Editar" aria-label={`Editar ${c.name}`}><Pencil /></Button>
                <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(c)} title="Excluir" aria-label={`Excluir ${c.name}`}><Trash2 /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Excluir categoria?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? ${deleteTarget ? count(deleteTarget.id) : 0} patrimônio(s) usam essa categoria e ficarão sem categoria. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}