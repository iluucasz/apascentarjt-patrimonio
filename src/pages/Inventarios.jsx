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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { formatDateTime, formatDay, todayISO, INVENTORY_STATUS_LABELS } from '@/lib/format';
import { canCreateInventory } from '@/lib/permissions';
import { locationKind, mainLocationOf } from '@/lib/locations';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
};

export default function Inventarios() {
  const { scopeLocations: locations, locations: allLocations, isScoped, currentFilial, user } = useApp();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', location_id: '', all_locations: false, scheduled_date: '', responsible_person: '', notes: '' });
  // Enquanto o usuário não mexe no nome, ele acompanha a unidade escolhida.
  const [nameTouched, setNameTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try { setItems(await db.entities.Inventory.list('-created_date', 100)); }
    catch (e) { setItems([]); }
  };
  useEffect(() => { load(); }, []);

  const selectedLocation = locations.find((l) => l.id === form.location_id);
  const allUnits = form.all_locations && !isScoped;
  const autoName = `Inventário ${allUnits ? 'geral' : selectedLocation?.name || ''} · ${formatDay(form.scheduled_date)}`.replace('Inventário  ·', 'Inventário ·');
  const inventoryName = nameTouched && form.name.trim() ? form.name.trim() : autoName;
  const selectedKind = selectedLocation ? locationKind(allLocations, selectedLocation) : null;

  // Abre já com a unidade da filial escolhida no seletor (na visão geral, a matriz).
  const openNew = () => {
    const main = mainLocationOf(allLocations);
    const preferred = currentFilial && !currentFilial.overview ? currentFilial.id : main?.id;
    const locationId = locations.some((l) => l.id === preferred) ? preferred : locations[0]?.id || '';
    setForm({
      name: '', location_id: locationId, all_locations: false,
      scheduled_date: todayISO(), responsible_person: user?.full_name || user?.email || '', notes: '',
    });
    setNameTouched(false);
    setOpen(true);
  };

  const create = async () => {
    if (!allUnits && !form.location_id) { toast.error('Selecione a unidade'); return; }
    if (!form.scheduled_date) { toast.error('Informe a data do inventário'); return; }
    try {
      const loc = locations.find((l) => l.id === form.location_id);
      const inv = await db.entities.Inventory.create({
        name: inventoryName,
        location_id: form.all_locations && !isScoped ? '' : (form.location_id || ''),
        location_name: form.all_locations && !isScoped ? 'Todas as unidades' : (loc?.name || ''),
        all_locations: form.all_locations && !isScoped,
        status: 'draft',
        created_by_name: user?.full_name || user?.email,
        scheduled_date: form.scheduled_date,
        responsible_person: form.responsible_person.trim(),
        notes: form.notes.trim(),
      });
      toast.success('Inventário criado');
      setOpen(false);
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
      <PageHeader title="Inventários" description="Realize conferências de patrimônio por unidade">
        {canCreateInventory(user) && <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo inventário</Button>}
      </PageHeader>
      {items === null ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 rounded bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum inventário criado" action={canCreateInventory(user) && <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo inventário</Button>} />
      ) : (
        <div className="space-y-3">
          {items.map((inv) => (
            <div key={inv.id} className="w-full rounded-xl border border-border bg-card p-4 hover:bg-accent/30 flex items-center gap-2">
              <button onClick={() => navigate(`/inventarios/${inv.id}`)} className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{inv.name}</p>
                    <p className="text-sm text-muted-foreground">{inv.location_name || 'Todas as unidades'} · {inv.scheduled_date ? `Previsto para ${formatDay(inv.scheduled_date)}` : formatDateTime(inv.created_date)}{inv.responsible_person ? ` · Responsável: ${inv.responsible_person}` : ''}</p>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo inventário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!isScoped && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.all_locations} onChange={(e) => setForm(f => ({...f, all_locations: e.target.checked}))} /> Todas as unidades (inventário geral)</label>}
            {(isScoped || !form.all_locations) && (
              <div>
                <Label>Unidade *</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm(f => ({...f, location_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                {selectedKind === 'matriz' && <p className="text-xs text-muted-foreground mt-1">Confere só o que está na matriz; cada filial tem o próprio inventário.</p>}
                {selectedKind !== 'matriz' && selectedLocation && <p className="text-xs text-muted-foreground mt-1">Confere esta unidade e as salas dela.</p>}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Data do inventário *</Label>
                <Input type="date" value={form.scheduled_date} onChange={(e) => setForm(f => ({...f, scheduled_date: e.target.value}))} />
              </div>
              <div>
                <Label>Responsável pela conferência</Label>
                <Input value={form.responsible_person} onChange={(e) => setForm(f => ({...f, responsible_person: e.target.value}))} placeholder="Quem vai conferir" />
              </div>
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={nameTouched ? form.name : autoName} onChange={(e) => { setNameTouched(true); setForm(f => ({...f, name: e.target.value})); }} />
              <p className="text-xs text-muted-foreground mt-1">{nameTouched ? 'Deixe em branco para usar o nome automático.' : 'Gerado com a unidade e a data; pode editar.'}</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} rows={2} placeholder="Ex: conferir também o depósito dos fundos" />
            </div>
            <p className="text-xs text-muted-foreground">A lista de patrimônios esperados é gerada quando o inventário for iniciado.</p>
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