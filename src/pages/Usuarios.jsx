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
      toast.success('Locais do usuário atualizados');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar locais');
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

  return (
    <Layout>
      <PageHeader title="Usuários" description="Gerencie quem acessa o sistema">
        <Button onClick={() => setOpen(true)}><UserPlus className="w-4 h-4 mr-2" /> Novo usuário</Button>
      </PageHeader>
      {users === null ? (
        <div className="space-y-2">{Array.from({length:4}).map((_,i)=><div key={i} className="h-14 rounded bg-muted animate-pulse" />)}</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum usuário" />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground"><tr>
              <th className="text-left font-medium px-4 py-3">Nome</th>
              <th className="text-left font-medium px-4 py-3">E-mail</th>
              <th className="text-left font-medium px-4 py-3">Perfil</th>
              <th className="text-left font-medium px-4 py-3">Locais</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Cadastro</th>
              <th className="text-right font-medium px-4 py-3">Ações</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.full_name || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Select value={u.role || 'user'} onValueChange={(r) => changeRole(u, r)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                        <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                        <SelectItem value="user">{ROLE_LABELS.viewer}</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? (
                      <span className="text-muted-foreground">{accessLabel(u)}</span>
                    ) : (
                      <button onClick={() => openAccess(u)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-accent text-left" title="Definir locais que este usuário pode ver">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[180px]">{accessLabel(u)}</span>
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(u.created_date)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id === user.id ? (
                      <span className="text-xs text-muted-foreground">Você</span>
                    ) : (
                      <button onClick={() => setDeleteTarget(u)} className="p-1.5 rounded hover:bg-accent text-rose-600" title="Excluir usuário">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>E-mail *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
            <div><Label>Senha *</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
            <div><Label>Perfil</Label><Select value={newRole} onValueChange={setNewRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Leitor / Inventariante</SelectItem><SelectItem value="manager">Gestor</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>
            {newRole !== 'admin' && (
              <div>
                <Label>Locais que pode ver</Label>
                <p className="text-xs text-muted-foreground mb-1.5">Deixe tudo desmarcado para ver todos os locais.</p>
                <LocationPicker locations={locations} value={newAllowed} onChange={setNewAllowed} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Não há envio de e-mail: compartilhe essa senha diretamente com a pessoa.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={createUser} disabled={creating}>{creating ? 'Criando...' : 'Criar usuário'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accessTarget} onOpenChange={(v) => { if (!v) setAccessTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Locais que {accessTarget?.full_name || accessTarget?.email} pode ver</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              O usuário só vê os patrimônios, movimentações, manutenções e inventários dos locais marcados (e dos sublocais deles).
              Ele ainda pode movimentar um item dele para outro local. Deixe tudo desmarcado para liberar todos os locais.
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