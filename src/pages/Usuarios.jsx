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
import { toast } from 'sonner';
import { Users, UserPlus, Pencil } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/permissions';
import { formatDate } from '@/lib/format';

export default function Usuarios() {
  const { user } = useApp();
  const [users, setUsers] = useState(null);
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);

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
      await db.users.createUser(newEmail, newPassword, newRole);
      setOpen(false);
      setNewEmail(''); setNewPassword(''); setNewRole('user');
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
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{formatDate(u.created_date)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role === 'admin' ? <span className="text-xs text-muted-foreground">Admin</span> : <Pencil className="w-4 h-4 inline text-muted-foreground" />}
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
            <p className="text-xs text-muted-foreground">Não há envio de e-mail: compartilhe essa senha diretamente com a pessoa.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={createUser} disabled={creating}>{creating ? 'Criando...' : 'Criar usuário'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}