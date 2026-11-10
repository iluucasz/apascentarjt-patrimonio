import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';

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
import LocationPicker from '@/components/LocationPicker';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, MapPin } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

export default function Usuarios() {
  const { user, locations } = useApp();
  const [users, setUsers] = useState(null);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newAllowed, setNewAllowed] = useState([]);
  // Edição dos locais que um usuário pode ver
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessValue, setAccessValue] = useState([]);
  const [savingAccess, setSavingAccess] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try { setUsers(await db.entities.User.list()); }
    catch (e) { setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    if (!newEmail || !newPassword) { toast.error('Informe e-mail e senha'); return; }
    if (newPassword.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    setCreating(true);
    try {
      await db.users.createUser(newEmail, newPassword, newRole, newRole === 'admin' ? [] : newAllowed);
      setOpen(false);
      setNewEmail(''); setNewPassword(''); setNewRole('user'); setNewAllowed([]);
      await load();
      toast.success('Usuário criado');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao criar usuário');
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (u, role) => {
    try { await db.entities.User.update(u.id, { role }); await load(); toast.success('Perfil atualizado'); }
    catch (e) { toast.error('Erro'); }
  };

  const openAccess = (u) => {
    setAccessTarget(u);
    setAccessValue(u.allowed_location_ids || []);
  };

  const saveAccess = async () => {
    setSavingAccess(true);
    try {
      await db.entities.User.update(accessTarget.id, { allowed_location_ids: accessValue });
      setAccessTarget(null);
      await load();
      toast.success('Unidades do usuário atualizadas');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar unidades');
    } finally {
      setSavingAccess(false);
    }
  };

  // "Todos" ou os nomes dos locais liberados (os que ainda existem).
  const accessLabel = (u) => {
    if (u.role === 'admin') return 'Todos (administrador)';
    const names = (u.allowed_location_ids || []).map((id) => locations.find((l) => l.id === id)?.name).filter(Boolean);
    if (names.length === 0) return 'Todos';
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await db.entities.User.delete(deleteTarget.id);
      setDeleteTarget(null);
      await load();
      toast.success('Usuário excluído');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao excluir usuário');
    } finally {
      setDeleting(false);
    }
  };

  if (user?.role !== 'admin') {
    return <Layout><EmptyState icon={Users} title="Acesso restrito" description="Apenas administradores podem gerenciar usuários." /></Layout>;
  }

  const roleSelect = (u, full = false) => (
    <Select value={u.role || 'user'} onValueChange={(r) => changeRole(u, r)}>
      <SelectTrigger className={full ? 'w-full' : 'w-48'} aria-label={`Perfil de ${u.full_name || u.email}`}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
        <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
        <SelectItem value="user">{ROLE_LABELS.viewer}</SelectItem>
      </SelectContent>
    </Select>
  );

  const unitsCell = (u) => (
    u.role === 'admin' ? (
      <span className="text-muted-foreground">{accessLabel(u)}</span>
    ) : (
      <button onClick={() => openAccess(u)} className="inline-flex items-center gap-2 rounded-lg -ml-2 px-2 py-2 hover:bg-accent text-left" title="Definir unidades que este usuário pode ver">
        <MapPin className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[220px] font-medium">{accessLabel(u)}</span>
      </button>
    )
  );

  const deleteCell = (u) => (
    u.id === user.id ? (
      <span className="text-sm text-muted-foreground">Você</span>
    ) : (
      <button onClick={() => setDeleteTarget(u)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Excluir usuário" aria-label={`Excluir ${u.full_name || u.email}`}>
        <Trash2 className="w-[18px] h-[18px]" />
      </button>
    )
  );

  return (
    <Layout>
      <PageHeader title="Usuários" description="Gerencie quem acessa o sistema">
        <Button onClick={() => setOpen(true)}><UserPlus /> Novo usuário</Button>
      </PageHeader>
      {users === null ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário" description="Crie o acesso de quem vai cadastrar e conferir o patrimônio." />
      ) : (
        <>
          {/* Computador: tabela */}
          <div className="hidden xl:block table-card">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Unidades</th>
                  <th className="hidden xl:table-cell">Cadastro</th>
                  <th className="text-right"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.full_name || '-'}</td>
                    <td className="text-muted-foreground">{u.email}</td>
                    <td>{roleSelect(u)}</td>
                    <td>{unitsCell(u)}</td>
                    <td className="hidden xl:table-cell text-muted-foreground tnum">{formatDate(u.created_date)}</td>
                    <td className="text-right">{deleteCell(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Celular: cartões */}
          <ul className="xl:hidden grid gap-3 md:grid-cols-2">
            {users.map((u) => (
              <li key={u.id} className="rounded-2xl border border-border bg-card shadow-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-snug">{u.full_name || '-'}</p>
                    <p className="text-sm text-muted-foreground break-all">{u.email}</p>
                  </div>
                  {deleteCell(u)}
                </div>
                <div className="mt-3 space-y-2.5">
                  {roleSelect(u, true)}
                  <div className="text-sm">{unitsCell(u)}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>E-mail *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
            <div><Label>Senha *</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
            <div><Label>Perfil</Label><Select value={newRole} onValueChange={setNewRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Leitor / Inventariante</SelectItem><SelectItem value="manager">Gestor</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>
            {newRole !== 'admin' && (
              <div>
                <Label>Unidades que pode ver</Label>
                <p className="text-sm text-muted-foreground mb-2">Deixe tudo desmarcado para ver todas as unidades.</p>
                <LocationPicker locations={locations} value={newAllowed} onChange={setNewAllowed} />
              </div>
            )}
            <p className="text-sm text-muted-foreground">Não há envio de e-mail: compartilhe essa senha diretamente com a pessoa.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={createUser} disabled={creating}>{creating ? 'Criando...' : 'Criar usuário'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessTarget} onOpenChange={(v) => { if (!v) setAccessTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Unidades que {accessTarget?.full_name || accessTarget?.email} pode ver</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              O usuário só vê os patrimônios, movimentações, manutenções e inventários das unidades marcadas (e das unidades dentro delas).
              Ele ainda pode movimentar um item dele para outra unidade. Deixe tudo desmarcado para liberar todas as unidades.
            </p>
            <LocationPicker locations={locations} value={accessValue} onChange={setAccessValue} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccessValue([])} disabled={savingAccess || accessValue.length === 0}>Liberar todos</Button>
            <Button onClick={saveAccess} disabled={savingAccess}>{savingAccess ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title="Excluir usuário?"
        description={`Tem certeza que deseja excluir "${deleteTarget?.email}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </Layout>
  );
}