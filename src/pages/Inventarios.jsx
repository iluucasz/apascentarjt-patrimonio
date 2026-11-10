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
import { ClipboardList, Plus, Trash2, MapPin, CalendarDays, UserRound, ChevronRight } from 'lucide-react';
import StatusPill from '@/components/StatusPill';
import { formatDateTime, formatDay, todayISO, INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONES } from '@/lib/format';
import { canCreateInventory } from '@/lib/permissions';
import { locationKind, mainLocationOf } from '@/lib/locations';

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
      <PageHeader title="Inventários" description="Confira o patrimônio de cada unidade, item por item">
        {canCreateInventory(user) && <Button onClick={openNew}><Plus className="w-[18px] h-[18px]" /> Novo inventário</Button>}
      </PageHeader>
      {items === null ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum inventário criado" description="Crie um inventário para conferir os patrimônios de uma unidade com o scanner." action={canCreateInventory(user) && <Button onClick={openNew}><Plus className="w-[18px] h-[18px]" /> Novo inventário</Button>} />
      ) : (
        <ul className="space-y-3">
          {items.map((inv) => (
            <li key={inv.id} className="group flex items-stretch rounded-2xl border border-border bg-card shadow-card transition-colors hover:bg-accent/40">
              <button onClick={() => navigate(`/inventarios/${inv.id}`)} className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl p-4 text-left sm:p-5">
                <span className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"><ClipboardList className="w-6 h-6" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-lg font-bold leading-snug">{inv.name}</span>
                    <StatusPill tone={INVENTORY_STATUS_TONES[inv.status]}>{INVENTORY_STATUS_LABELS[inv.status]}</StatusPill>
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" aria-hidden="true" />{inv.location_name || 'Todas as unidades'}</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-4 h-4" aria-hidden="true" />{inv.scheduled_date ? formatDay(inv.scheduled_date) : formatDateTime(inv.created_date)}</span>
                    {inv.responsible_person && <span className="inline-flex items-center gap-1.5"><UserRound className="w-4 h-4" aria-hidden="true" />{inv.responsible_person}</span>}
                  </span>
                  {inv.status === 'completed' && inv.summary && (
                    <span className="mt-2 block text-sm"><b className="text-emerald-700">{inv.summary.found}</b> encontrado{inv.summary.found === 1 ? '' : 's'} · <b className="text-red-700">{inv.summary.notFound}</b> não encontrado{inv.summary.notFound === 1 ? '' : 's'} · {inv.summary.expected} esperado{inv.summary.expected === 1 ? '' : 's'}</span>
                  )}
                </span>
                <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
              {canCreateInventory(user) && (
                <button onClick={() => setDeleteTarget(inv)} className="my-auto mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Excluir inventário" aria-label={`Excluir ${inv.name}`}>
                  <Trash2 className="w-[18px] h-[18px]" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo inventário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!isScoped && <label className="flex items-center gap-2.5 text-[15px] font-medium cursor-pointer"><input type="checkbox" checked={form.all_locations} onChange={(e) => setForm(f => ({...f, all_locations: e.target.checked}))} /> Todas as unidades (inventário geral)</label>}
            {(isScoped || !form.all_locations) && (
              <div>
                <Label>Unidade *</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm(f => ({...f, location_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
                {selectedKind === 'matriz' && <p className="text-sm text-muted-foreground mt-1.5">Confere só o que está na matriz; cada filial tem o próprio inventário.</p>}
                {selectedKind !== 'matriz' && selectedLocation && <p className="text-sm text-muted-foreground mt-1.5">Confere esta unidade e as salas dela.</p>}
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
              <p className="text-sm text-muted-foreground mt-1.5">{nameTouched ? 'Deixe em branco para usar o nome automático.' : 'Gerado com a unidade e a data; pode editar.'}</p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({...f, notes: e.target.value}))} rows={2} placeholder="Ex: conferir também o depósito dos fundos" />
            </div>
            <p className="text-sm text-muted-foreground">A lista de patrimônios esperados é gerada quando o inventário for iniciado.</p>
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