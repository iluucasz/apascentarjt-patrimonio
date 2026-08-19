import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { formatDateTime, INVENTORY_STATUS_LABELS } from '@/lib/format';
import { canCreateInventory } from '@/lib/permissions';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
};

export default function Inventarios() {
  const { locations, user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location_id: '', all_locations: false });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try { setItems(await db.entities.Inventory.list('-created_date', 100)); }
    catch (e) { setItems([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) { toast.error('Informe o nome'); return; }
    try {
      const loc = locations.find((l) => l.id === form.location_id);
      const inv = await db.entities.Inventory.create({
        name: form.name,
        location_id: form.all_locations ? '' : (form.location_id || ''),
        location_name: form.all_locations ? 'Todos os locais' : (loc?.name || ''),
        all_locations: form.all_locations,
        status: 'draft',
        created_by_name: user?.full_name || user?.email
      });
      toast.success('Inventário criado');
      setOpen(false);
      setForm({ name: '', location_id: '', all_locations: false });
      navigate(`/inventarios/${inv.id}`);
    } catch (e) { toast.error('Erro ao criar inventário'); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await db.entities.Inventory.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      toast.success('Inventário excluído');
    } catch (e) {
      toast.error('Erro ao excluir inventário');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <PageHeader title="Inventários" description="Realize conferências de patrimônio por local">
        {canCreateInventory(user) && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo inventário</Button>}
      </PageHeader>
      {items === null ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 rounded bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum inventário criado" action={canCreateInventory(user) && <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo inventário</Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((inv) => (
            <div key={inv.id} className="w-full rounded-xl border border-border bg-card p-4 hover:bg-accent/30 flex items-center gap-2">
              <button onClick={() => navigate(`/inventarios/${inv.id}`)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{inv.name}</p>
                    <p className="text-sm text-muted-foreground">{inv.location_name || 'Todos os locais'} · {formatDateTime(inv.created_date)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[inv.status]}`}>{INVENTORY_STATUS_LABELS[inv.status]}</span>
                </div>
              </button>
              {canCreateInventory(user) && (
                <button onClick={() => setDeleteTarget(inv)} className="p-1.5 rounded hover:bg-accent text-rose-600 shrink-0" title="Excluir inventário">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo inventário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Inventário Geral Agosto 2026" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.all_locations} onChange={(e) => setForm(f => ({...f, all_locations: e.target.checked}))} /> Todos os locais</label>
            {!form.all_locations && (
              <div><Label>Local</Label><Select value={form.location_id} onValueChange={(v) => setForm(f => ({...f, location_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={create}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Excluir inventário?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Todos os itens escaneados nele serão perdidos. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}