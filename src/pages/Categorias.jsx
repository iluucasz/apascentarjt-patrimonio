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
import { toast } from 'sonner';
import { Tags, Plus, Pencil } from 'lucide-react';

export default function Categorias() {
  const { categories, refresh } = useApp();
  const [assets, setAssets] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });

  useEffect(() => {
    (async () => { try { setAssets(await db.entities.Asset.list('-updated_date', 1000)); } catch (e) {} })();
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

  return (
    <Layout>
      <PageHeader title="Categorias" description="Organize os patrimônios por categoria">
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova categoria</Button>
      </PageHeader>
      {categories.length === 0 ? (
        <EmptyState icon={Tags} title="Nenhuma categoria cadastrada" action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Nova categoria</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{count(c.id)}</span>
              </div>
              <Button size="sm" variant="ghost" className="mt-3" onClick={() => openEdit(c)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} /></div>
            <div><Label>Descrição</Label><Textarea value={form.description} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}