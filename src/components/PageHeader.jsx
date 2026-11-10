import React from 'react';

// Cabeçalho padrão das páginas: título, uma linha de contexto e as ações.
// No celular as ações ficam embaixo, em linha, para o polegar alcançar.
export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">{title}</h1>
        {description && <p className="text-[15px] text-muted-foreground mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}
