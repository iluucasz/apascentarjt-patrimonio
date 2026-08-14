const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { setUsers(await db.entities.User.list()); }
    catch (e) { setUsers([]); }
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    if (!inviteEmail) { toast.error('Informe o e-mail'); return; }
    try {
      await db.users.inviteUser(inviteEmail, inviteRole);
      toast.success('Convite enviado');
      setOpen(false);
      setInviteEmail(''); setInviteRole('user');
      load();
    } catch (e) { toast.error('Erro ao convidar'); }
  };

  const changeRole = async (u, role) => {
    try { await db.entities.User.update(u.id, { role }); toast.success('Perfil atualizado'); load(); }
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
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>E-mail *</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" /></div>
            <div><Label>Perfil</Label><Select value={inviteRole} onValueChange={setInviteRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">Leitor / Inventariante</SelectItem><SelectItem value="manager">Gestor</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></div>
            <p className="text-xs text-muted-foreground">O usuário receberá um convite por e-mail para definir a senha.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={invite}>Enviar convite</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}