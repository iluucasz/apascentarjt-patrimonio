import React from 'react';
import { ShieldAlert } from 'lucide-react';

const UserNotRegisteredError = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-card text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-700/25">
          <ShieldAlert className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="mb-3 text-2xl font-bold tracking-tight">Acesso restrito</h1>
        <p className="mb-6 text-base text-muted-foreground">
          Esta conta ainda não tem permissão para usar o sistema. Peça ao administrador para liberar o seu acesso.
        </p>
        <div className="rounded-xl bg-muted/60 p-4 text-left text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Se você acha que isso é um engano:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Confira se entrou com a conta certa</li>
            <li>Peça acesso ao administrador</li>
            <li>Saia e entre de novo</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
